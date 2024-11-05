import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Manager } from "../../..";
import { BasquetballGameScene } from "./BasquetballGameScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { Easing, Tween } from "tweedle.js";

export class BasquetballMainScene extends PixiScene {
	public static readonly BUNDLES = ["joystick", "basquet"];
	private backgroundContainer: Container = new Container();

	constructor() {
		super();

		this.addChild(this.backgroundContainer);

		SoundLib.playMusic("courtBGM", { loop: true, volume: 0.3, singleInstance: true });

		const bG = Sprite.from("cachobasket");
		bG.anchor.set(0.5);
		bG.scale.set(1.1);
		bG.x = 580;
		bG.y = 590;
		this.backgroundContainer.addChild(bG);

		const play = Sprite.from("play");
		play.anchor.set(0.5);
		play.scale.set(1.1);
		play.x = 570;
		play.y = 910;
		this.backgroundContainer.addChild(play);

		play.eventMode = "static";
		play.on("pointertap", () => {
			new Tween(play)
				.to({ scale: { x: 1.2, y: 1.2 } }, 500)
				.easing(Easing.Bounce.Out)
				.start();
			SoundLib.playSound("bounce", {});
			Manager.changeScene(BasquetballGameScene, { transitionClass: FadeColorTransition });
		});

		this.backgroundContainer.pivot.set(this.backgroundContainer.width * 0.5, this.backgroundContainer.height * 0.5);
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.backgroundContainer.x = _newW / 2;
		this.backgroundContainer.y = _newH / 2;
	}
}
