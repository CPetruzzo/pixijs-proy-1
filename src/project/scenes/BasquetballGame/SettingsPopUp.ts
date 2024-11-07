import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import type { Button } from "@pixi/ui";
import { NineSlicePlane, Sprite, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { SoundManager, Sounds } from "../RunFall/Managers/SoundManager";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Manager } from "../../..";
import { BasquetballMainScene } from "./BasquetballMainScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

export class SettingsPopUp extends PixiScene {
	// Assets
	private fadeAndBlocker: Graphics;
	public background: NineSlicePlane;
	public buttons: Button[];
	private menuButton: Sprite;
	// Level data
	public readonly level: any;
	public levelNumber: number;
	public levelTime: number;
	// Booleans
	public closing: boolean = false;
	public restart: boolean = false;
	public pauseScene: boolean = false;
	private closePopUpButton: Sprite;
	private goToMenu: boolean = false;
	private closePopUpBoolean: boolean = false;

	constructor(_score?: number) {
		super();

		// Create fade background
		this.fadeAndBlocker = new Graphics();
		this.fadeAndBlocker.beginFill(0x000000, 0.5);
		this.fadeAndBlocker.drawRect(0, 0, 1500, 1500);
		this.fadeAndBlocker.endFill();
		this.fadeAndBlocker.interactive = true;
		this.fadeAndBlocker.pivot.set(this.fadeAndBlocker.width * 0.5, this.fadeAndBlocker.height * 0.5);
		this.addChild(this.fadeAndBlocker);
		this.fadeAndBlocker.scale.set(10);

		// Create background sprite
		this.background = new NineSlicePlane(Texture.from("scoreFrame"), 10, 10, 10, 10);
		this.background.pivot.set(this.background.width * 0.5, this.background.height * 0.5);
		this.addChild(this.background);
	}

	// Método para manejar el clic en el botón de cerrar
	private handleResetClick(): void {
		this.closePopUpBoolean = true;
		SoundManager.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopup();
	}
	// Método para manejar el clic en el botón de cerrar
	private handleResetClickAndLeave(): void {
		this.goToMenu = true;
		SoundManager.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopupAndLeave();
	}
	public showButtons(): void {
		// Mostrar el botón de reinicio
		this.closePopUpButton = Sprite.from("play");
		this.closePopUpButton.eventMode = "static";
		this.closePopUpButton.anchor.set(0.5);
		this.closePopUpButton.position.set(this.background.width * 0.5 - this.closePopUpButton.width * 0.6, this.background.height * 0.5); // Posiciona el botón según sea necesario
		this.closePopUpButton.on("pointerover", () => {
			new Tween(this.closePopUpButton)
				.to({ scale: { x: 1.05, y: 1.05 } }, 300)
				.easing(Easing.Bounce.Out)
				.start();
		});
		this.closePopUpButton.on("pointerout", () => {
			new Tween(this.closePopUpButton)
				.to({ scale: { x: 1, y: 1 } }, 300)
				.easing(Easing.Bounce.Out)
				.start();
		});
		this.closePopUpButton.on("pointertap", this.handleResetClick, this); // Agrega un manejador de eventos al hacer clic en el botón
		this.background.addChild(this.closePopUpButton); // Agrega el botón al background

		this.menuButton = Sprite.from("returnbasket");
		this.menuButton.eventMode = "static";
		this.menuButton.anchor.set(0.5);
		this.menuButton.position.set(this.background.width * 0.5 + this.menuButton.width * 0.5, this.background.height * 0.5); // Posiciona el botón según sea necesario
		this.menuButton.on("pointertap", () => {
			this.handleResetClickAndLeave();
		});
		this.menuButton.on("pointerover", () => {
			new Tween(this.menuButton)
				.to({ scale: { x: 1.05, y: 1.05 } }, 300)
				.easing(Easing.Bounce.Out)
				.start();
		});
		this.menuButton.on("pointerout", () => {
			new Tween(this.menuButton)
				.to({ scale: { x: 1, y: 1 } }, 300)
				.easing(Easing.Bounce.Out)
				.start();
		});
		this.background.addChild(this.menuButton); // Agrega el botón al background
	}

	public override onStart(): void {
		// Disable interaction until animations complete
		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		// Fade and scale animations
		const fadeScale = new Tween(this.fadeAndBlocker).to({ scale: { x: 35, y: 15 } });
		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);
		const elasticAnimation = new Tween(this.background)
			.from({
				scale: { x: 20, y: 20 },
				y: 8000,
				alpha: 0,
			})
			.to(
				{
					scale: { x: 20, y: 20 },
					y: 0,
					alpha: 1,
				},
				1000
			)
			.easing(Easing.Elastic.Out);

		// Play sound when animation starts
		elasticAnimation.onStart(() => {
			SoundManager.playSound(Sounds.OPENPOUP, {});
		});

		// Allow interaction after animations
		elasticAnimation.onComplete(() => {
			this.background.interactiveChildren = true;
			Keyboard.shared.pressed.once("Escape", this.closePopup.bind(this));
		});

		// Chain and start animations
		fadeAnimation.chain(elasticAnimation);
		fadeAnimation.start();
		fadeScale.chain(fadeAnimation);
		fadeScale.start();

		// Position buttons
		// this.positionButtons();
	}

	public override requestClose(_doSomething?: () => void): Promise<boolean> {
		this.closing = true;

		return new Promise((resolve) => {
			this.background.interactiveChildren = false;

			// Fade out and scale down animations
			const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 0 }, 500);
			const elasticAnimation = new Tween(this.background)
				.to(
					{
						// scale: { x: 0, y: 0 },
						y: 8000,
						alpha: 0,
					},
					1000
				)
				.easing(Easing.Elastic.In);

			// On animation complete, handle the closure
			fadeAnimation.onComplete(() => {
				Keyboard.shared.pressed.off("Escape", this.closePopup.bind(this));
				this.closeHandler(_doSomething);
				resolve(true);

				// Restart scene if needed
				if (this.restart) {
					Manager.changeScene(BasquetballMainScene);
				}
			});

			// Chain and start closing animations
			elasticAnimation.chain(fadeAnimation);
			elasticAnimation.onComplete(() => {
				if (this.goToMenu) {
					this.emit("RESUME_PAUSE");
					Manager.changeScene(BasquetballMainScene, { transitionClass: FadeColorTransition, transitionParams: [] });
				}

				if (this.closePopUpBoolean) {
					this.emit("RESUME_PAUSE");
				}
			});
			elasticAnimation.start();
		});
	}

	public closePopup(): void {
		if (this.closing) {
			return;
		}
		this.requestClose();
	}

	public closePopupAndLeave(): void {
		if (this.closing) {
			return;
		}
		this.requestClose();
	}
	public override onResize(_newW: number, _newH: number): void {
		// Adjust blocker size to fit new dimensions
		this.fadeAndBlocker.width = _newW;
		this.fadeAndBlocker.height = _newH;

		// Adjust scale and position of the popup
		ScaleHelper.setScaleRelativeToIdeal(this, _newW * 0.1, _newH * 0.1, 720, 1600, ScaleHelper.FIT);
		this.x = _newW * 0.5;
		this.y = _newH * 0.5;
	}
}
