import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Manager } from "../../..";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { BasquetballMainScene } from "./BasquetballMainScene";

export class BasquetballGameOverScene extends PixiScene {
	public static readonly BUNDLES = ["joystick", "basquet"];
	private backgroundContainer: Container = new Container();

	constructor() {
		super();

		this.addChild(this.backgroundContainer);

		SoundLib.playMusic("courtBGM", { loop: true, volume: 0.3, singleInstance: true });

		const gameover = Sprite.from("gameoverBG");
		gameover.anchor.set(0.5);
		gameover.scale.set(1.1);
		gameover.x = 1050;
		gameover.y = 590;
		this.backgroundContainer.addChild(gameover);

		const returnbasket = Sprite.from("returnbasket");
		returnbasket.anchor.set(0.5);
		returnbasket.scale.set(1.1);
		returnbasket.x = 1050;
		returnbasket.y = 910;
		this.backgroundContainer.addChild(returnbasket);

		returnbasket.eventMode = "static";
		returnbasket.on("pointertap", () => {
			Manager.changeScene(BasquetballMainScene, { transitionClass: FadeColorTransition });
		});

		this.backgroundContainer.pivot.set(this.backgroundContainer.width * 0.5, this.backgroundContainer.height * 0.5);
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, _newW, _newH, 1920, 1080, ScaleHelper.FILL);
		this.backgroundContainer.x = _newW * 0.5;
		this.backgroundContainer.y = _newH * 0.5;
	}
}
