import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Text, TextStyle } from "@pixi/text";
import i18next from "i18next";
import { Tween } from "tweedle.js";
import { Manager } from "../../../..";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";

import { GuessShapes } from "./GuessShapes";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { SimpleButton } from "../../../../engine/button/SimpleButton";

export class FinishGuessScene extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];
	bg: Sprite;
	winContainer: Container;
	titlewin: any;
	frame1: Sprite;
	sceneContainer: Container;
	nextLevel: SimpleButton;

	constructor() {
		super();

		this.sceneContainer = new Container();
		this.sceneContainer.pivot.set(this.sceneContainer.width / 2, this.sceneContainer.height / 2);

		SoundLib.stopMusic("farm-sfx");
		SoundLib.playMusic("chooserMusic", { loop: true, volume: 0.5 });

		this.bg = Sprite.from("BG9");
		this.bg.scale.set(1.05, 0.81);

		this.winContainer = new Container();
		this.winContainer.position.set(1000, 250);
		this.winContainer.pivot.set(this.winContainer.width / 2, this.winContainer.height / 2);

		this.nextLevel = new SimpleButton("b_7", () => this.NextLevel());
		this.nextLevel.scale.set(0.4);
		this.nextLevel.position.set(0, 550)

		const style = new TextStyle({
			align: "center",
			dropShadow: true,
			dropShadowAlpha: 0.3,
			dropShadowAngle: 7.1,
			dropShadowBlur: 4,
			dropShadowDistance: 6,
			fill: "#d6cdcd",
			fontFamily: "Courier New",
			fontSize: 65,
			fontStyle: "oblique",
			fontVariant: "small-caps",
			fontWeight: "bolder",
			lineHeight: 60,
			lineJoin: "round",
			padding: 5,
			stroke: "#582d2d",
			strokeThickness: 24,
			wordWrapWidth: 160
		});

		this.titlewin = new Text(i18next.t<string>("finish.win"), style);
		this.titlewin.position.set(10, 0);
		this.titlewin.anchor.set(0.5);

		this.frame1 = Sprite.from("frame1");
		this.frame1.scale.set(0.6);
		this.frame1.position.set(this.titlewin.position.x - this.frame1.width / 2, this.titlewin.position.y);
		this.frame1.alpha = 0.8;

		this.winContainer.addChild(
			this.frame1,
			this.titlewin,
			this.nextLevel
		)

		this.sceneContainer.addChild(
			this.bg,
			this.winContainer,

		);
		this.sceneContainer.pivot.set(this.sceneContainer.width / 2, this.sceneContainer.height / 2);

		this.addChild(this.sceneContainer);

		new Tween(this.winContainer)
			.from({ angle: -1 })
			.to({ angle: 1 }, 1000)
			.yoyo()
			.repeat(Infinity)
			.start();

	}

	NextLevel() {
		Manager.changeScene(GuessShapes)
	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.sceneContainer, newW, newH, 1, 1, ScaleHelper.FIT);
	}

}