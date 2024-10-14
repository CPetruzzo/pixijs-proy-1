import i18next from "i18next";
import { Sprite, Text, TextStyle, Container, Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { DodgeScene } from "./DodgeScene";
import { Manager } from "../../..";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";

export class MenuScene extends PixiScene {
	public static readonly BUNDLES = ["package-1", "sfx", "music", "fallrungame"];

	private backgroundContainer: Container;
	private bleedingBackgroundContainer: Container;

	constructor() {
		super();

		this.bleedingBackgroundContainer = new Container();
		this.backgroundContainer = new Container();

		this.addChild(this.bleedingBackgroundContainer);
		this.addChild(this.backgroundContainer);

		const bleedBG = Sprite.from("DODGE-BACKGROUND2");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		const background = Sprite.from("DODGE-BACKGROUND");
		background.position.set(-background.width * 0.5, -background.height * 0.5);
		this.backgroundContainer.addChild(background);

		// Creación del botón
		const button = new Container();
		const buttonText = new Text(i18next.t<string>("Start Game"), new TextStyle({ fill: "#ffffff", fontFamily: "Darling Coffee" }));
		buttonText.anchor.set(0.5);
		buttonText.scale.set(2);

		const buttonBackgroundLine = new Graphics();
		buttonBackgroundLine.beginFill(0xffffff);
		buttonBackgroundLine.drawRoundedRect(-buttonText.width / 2 - 10, -buttonText.height / 2 - 10, buttonText.width + 20, buttonText.height + 20, 15);
		buttonBackgroundLine.endFill();
		buttonBackgroundLine.scale.set(2.1);

		const buttonBackground = new Graphics();
		buttonBackground.beginFill(0x252525);
		buttonBackground.drawRoundedRect(-buttonText.width / 2 - 10, -buttonText.height / 2 - 5, buttonText.width + 20, buttonText.height + 10, 10);
		buttonBackground.endFill();
		buttonBackground.scale.set(2);
		buttonBackground.alpha = 0.8;

		button.addChild(buttonBackgroundLine, buttonBackground);
		button.addChild(buttonText);
		button.eventMode = "static";
		button.position.set(0, Manager.height * 0.8);

		button.on("pointerdown", () => {
			Manager.changeScene(DodgeScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});

		this.backgroundContainer.addChild(button);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);

		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
