// import type { Point } from "pixi.js";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../..";
import { Scene3D } from "../3dgame/Scene3D";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class LoseScene extends PixiScene {
	public static readonly BUNDLES: string[] = ["3d", "package-1", "music"];
	private frameContainer: Container = new Container();
	private frame: Graphics;
	private ball: Graphics;

	public isInAir: boolean = false;
	public isPointerDown: boolean = false; // Nueva variable para rastrear si se mantiene presionado el mouse
	private loli: Sprite;

	constructor() {
		super();

		SoundLib.playMusic("haunting", {loop: true, volume: 0.05});

		this.frameContainer.pivot.set(this.frameContainer.width / 2, this.frameContainer.height / 2);
		this.frameContainer.position.set(Manager.width / 2, Manager.height / 2);
		this.addChild(this.frameContainer);

		this.frame = new Graphics();
		this.frame.beginFill(0x0ff, 1);
		this.frame.drawRect(0, 0, 400, 500);
		this.frame.endFill();
		this.frame.pivot.set(this.frame.width / 2, this.frame.height / 2);
		this.frameContainer.addChild(this.frame);

		this.loli = Sprite.from("loliLose");
		this.loli.anchor.set(0.5);
		this.addChild(this.loli);

		this.ball = new Graphics();
		this.ball.beginFill(0x0ffff, 1);
		this.ball.drawCircle(0, 0, 10);
		this.ball.endFill();
		this.ball.pivot.set(this.ball.width / 2, this.ball.height / 2);
		this.ball.position.set(0, this.frame.height / 2);
		// this.frameContainer.addChild(this.ball);

		this.frameContainer.interactive = true;

		const lose = new Text("You Lose");
		lose.anchor.set(0.5);
		lose.position.set(this.frame.width / 2, this.frame.height / 2);
		// this.loli.addChild(lose);

		const resetButton = Sprite.from("loliGameOver");
		resetButton.anchor.set(0.5);
		resetButton.y = 357;
		resetButton.x = -26;
		this.loli.addChild(resetButton);

		resetButton.interactive = true;

		resetButton.on("pointertap", () => {
			resetButton.scale.set(1.1);
			Manager.changeScene(Scene3D);
		});

		const PLAY = Sprite.from("PLAY");
		PLAY.anchor.set(0.5);
		PLAY.scale.set(0.3);
		PLAY.position.set(-this.loli.width / 2 + 3 * PLAY.width / 4, this.loli.height / 2 - 3 * PLAY.height / 4)
		this.loli.addChild(PLAY);

		PLAY.interactive = true;

		PLAY.on("pointertap", () => {
			PLAY.scale.set(1.1);
			Manager.changeScene(Scene3D);
		});

	}


	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.loli, newW, newH, 1920, 1080, ScaleHelper.FILL);
		this.loli.x = newW * 0.5;
		this.loli.y = newH * 0.5;
	}
}
