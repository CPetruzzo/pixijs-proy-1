import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Sprite } from "@pixi/sprite";
import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Manager } from "../../..";
import { Timer } from "../../../engine/tweens/Timer";
import { Button } from "@pixi/ui";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { DodgeScene } from "./DodgeScene";

export interface PopupOptions {
	title: string;
	buttonLabels: string[];
	buttonCallbacks: (() => void)[];
}

export class BasePopup extends PixiScene {
	private fadeAndBlocker: Graphics;
	public background: Sprite;
	public buttons: Button[];
	public closing: boolean = false;
	public restart: boolean = false;
	public readonly level: any;
	public levelNumber: number;
	public pauseScene: boolean = false;
	public levelTime: number;

	constructor() {
		super();

		this.fadeAndBlocker = new Graphics();
		this.fadeAndBlocker.beginFill(0x000000, 0.5);
		this.fadeAndBlocker.drawRect(0, 0, 1, 1);
		this.fadeAndBlocker.endFill();
		this.fadeAndBlocker.interactive = true;
		this.fadeAndBlocker.pivot.set(this.fadeAndBlocker.width * 0.5, this.fadeAndBlocker.height * 0.5);
		this.addChild(this.fadeAndBlocker);

		this.background = Sprite.from("package 1 background");
		this.background.anchor.set(0.5);
		this.background.scale.set(0.5);
		this.addChild(this.background);

		const buttonPopUp = new Graphics();
		buttonPopUp.beginFill(0x808080);
		buttonPopUp.drawRect(0, 0, 45, 45);
		buttonPopUp.endFill();
		this.background.addChild(buttonPopUp);
		buttonPopUp.eventMode = "static";
		buttonPopUp.on("pointertap", () => {
			this.closePopup();
		})
	}

	public override onStart(): void {
		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);

		const elasticAnimation = new Tween(this.background).to({ scale: { x: 4.5, y: 4.5 } }, 1000).easing(Easing.Elastic.Out);

		elasticAnimation.onStart(() => {
			SoundLib.playSound("beep", {});
		});
		elasticAnimation.onComplete(() => {
			this.background.interactiveChildren = true;
			if (this.pauseScene) {
				Keyboard.shared.pressed.once("Escape", this.closePopup.bind(this));
			}
		});
		fadeAnimation.chain(elasticAnimation);
		fadeAnimation.start();
	}

	public override requestClose(_doSomething?: () => void): Promise<boolean> {
		this.closing = true;
		return new Promise((resolve) => {
			this.background.interactiveChildren = false;

			const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 0 }, 500);
			const elasticAnimation = new Tween(this.background).to({ scale: { x: 0, y: 0 } }, 1000).easing(Easing.Elastic.In);

			fadeAnimation.onComplete(() => {
				Keyboard.shared.pressed.off("Escape", this.closePopup.bind(this));
				this.closeHandler(_doSomething);
				resolve(true);
				if (this.restart) {
					Manager.changeScene(DodgeScene);
				}
			});

			elasticAnimation.chain(fadeAnimation);
			elasticAnimation.start();
		});
	}

	public closePopup(): void {
		if (this.closing) {
			return;
		}
		this.requestClose();
	}

	public override onResize(_newW: number, _newH: number): void {
		this.fadeAndBlocker.width = _newW;
		this.fadeAndBlocker.height = _newH;

		ScaleHelper.setScaleRelativeToScreen(this, _newW, _newH, 0.1, 0.1, ScaleHelper.FILL);
		this.x = _newW * 0.5;
		this.y = _newH * 0.5;
	}

	public backToSelector(): void {
		SoundLib.playSound("beep", {});
		this.requestClose();
		new Timer()
			.to(1000)
			.start()
			.onComplete(() => {
				this.closeHandler();
				Manager.changeScene(DodgeScene);
			});
	}
}
