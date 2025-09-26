import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Text, TextStyle } from "@pixi/text";
import i18next from "i18next";
import { Tween } from "tweedle.js";
import { Manager } from "../../../..";
import { DataManager } from "../../../../engine/datamanager/DataManager";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";

import { GuessShapes } from "./GuessShapes";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { SimpleButton } from "../../../../engine/button/SimpleButton";

const TITLE_STYLE = new TextStyle({
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
	wordWrapWidth: 480,
});

const RESULT_STYLE = new TextStyle({
	fill: "#f4e4c2",
	fontFamily: '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
	fontSize: 36,
	fontWeight: "bolder",
	stroke: "#3f2b1d",
	strokeThickness: 4,
});

export class FinishGuessScene extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];
	public bg: Sprite;
	public winContainer: Container;
	public titlewin: any;
	public frame1: Sprite;
	public sceneContainer: Container;
	public nextLevel: SimpleButton;

	private resultTimeText: Text;
	private pointsText: Text;

	constructor() {
		super();

		this.sceneContainer = new Container();
		this.winContainer = new Container();

		SoundLib.stopMusic("farm-sfx");
		SoundLib.playMusic("chooserMusic", { loop: true, volume: 0.5 });

		this.bg = Sprite.from("BG10");
		this.bg.anchor.set(0.5);

		this.nextLevel = new SimpleButton("b_7", () => this.NextLevel());
		this.nextLevel.scale.set(0.4);
		this.nextLevel.pivot.set(this.nextLevel.width * 0.5, this.nextLevel.height * 0.5);
		this.nextLevel.y = 300;

		this.titlewin = new Text(i18next.t<string>("finish.win") ?? "You Win!", TITLE_STYLE);
		this.titlewin.position.set(10, -100);
		this.titlewin.anchor.set(0.5);

		this.frame1 = Sprite.from("frame1");
		this.frame1.scale.set(0.6);
		this.frame1.alpha = 0.8;
		this.frame1.x = -350;
		this.frame1.y = -250;

		// --- Resultado tiempo ---
		const rawTime = DataManager.getValue("timeTaken") ?? 0; // espera milisegundos
		const formatted = this.formatMilliseconds(Number(rawTime));
		const timeLabel = i18next.t<string>("finish.time") ?? "Time";
		this.resultTimeText = new Text(`${timeLabel}: ${formatted}`, RESULT_STYLE);
		this.resultTimeText.position.set(0, 0);
		this.resultTimeText.anchor.set(0.5);

		// --- Puntos finales ---
		const finalPoints = DataManager.getValue("FinalPoints") ?? 0;
		const pointsLabel = i18next.t<string>("finish.points") ?? "Points";
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		this.pointsText = new Text(`${finalPoints} ${pointsLabel}`, RESULT_STYLE);
		this.pointsText.position.set(0, 80);
		this.pointsText.anchor.set(0.5);

		this.winContainer.addChild(this.frame1, this.titlewin, this.resultTimeText, this.pointsText, this.nextLevel);

		this.sceneContainer.addChild(this.bg, this.winContainer);

		this.addChild(this.sceneContainer);

		new Tween(this.winContainer).from({ angle: -1 }).to({ angle: 1 }, 1000).yoyo().repeat(Infinity).start();
	}

	// Formatea ms -> m:ss.SS
	private formatMilliseconds(ms: number): string {
		if (!ms || isNaN(ms)) {
			return "0:00.00";
		}
		const totalHundredths = Math.floor(ms / 10);
		const hundredths = totalHundredths % 100;
		const totalSeconds = Math.floor(totalHundredths / 100);
		const seconds = totalSeconds % 60;
		const minutes = Math.floor(totalSeconds / 60);
		return `${minutes}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public NextLevel(): void {
		Manager.changeScene(GuessShapes);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToScreen(this.sceneContainer, newW, newH, 1, 1, ScaleHelper.FILL);
		this.sceneContainer.x = newW * 0.5;
		this.sceneContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToScreen(this.winContainer, newW, newH, 0.6, 0.6, ScaleHelper.FIT);
	}
}
