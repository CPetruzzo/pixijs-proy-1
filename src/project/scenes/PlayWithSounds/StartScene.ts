
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Text, TextStyle } from "@pixi/text";
import { Tween } from "tweedle.js";
import { Manager } from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { AnimalSounds } from "./Scenes/AnimalSounds";
import { Chooser } from "./Scenes/Chooser";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { SimpleButton } from "../../../engine/button/SimpleButton";

export class StartScene extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];

	private cont: Container;
	private bg: Sprite;
	private btnOpenPopup: SimpleButton;
	private text: Text;
	private animals: AnimalSounds;

	constructor() {
		super();

		SoundLib.stopAllMusic();
		SoundLib.playMusic("farm-sfx", { loop: true });

		this.animals = new AnimalSounds();
		this.animals.position.set(-250, -50);

		this.cont = new Container();

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
		this.text = new Text("Who's that animal?", style);
		this.text.position.set(950, 600);
		this.text.anchor.set(0.5);

		this.bg = Sprite.from("BG0");
		this.bg.scale.set(1, 1.46)

		this.cont.addChild(
			this.bg,
		);
		this.cont.pivot.set(this.cont.width / 2, this.cont.height / 2);

		this.cont.addChild(this.text);

		this.addChild(this.cont);


		// #region Open popup simple button
		this.btnOpenPopup = new SimpleButton("btnPlay", () => this.showGames());
		this.btnOpenPopup.position.set(950, 850);
		// this.btnOpenPopup.movement()
		this.cont.addChild(this.btnOpenPopup);
		// #endregion

		new Tween(this.text)
			.from({ angle: -3 })
			.to({ angle: 3 }, 500)
			.yoyo()
			.repeat(Infinity)
			.start();

		new Tween(this.btnOpenPopup)
			.from({ angle: -5 })
			.to({ angle: 5 }, 500)
			.yoyo()
			.repeat(Infinity)
			.start();
	}



	private showGames(): void {
		Manager.changeScene(Chooser
			// , [], IntermissionDuck
		);
	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.cont, newW, newH, 1, 1, ScaleHelper.FIT);
	}

}