import i18next from "i18next";
import { Sprite, Text, TextStyle, Container, Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { DodgeScene } from "./DodgeScene";
import { Manager } from "../../..";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { Easing, Tween } from "tweedle.js";
import { BasePopup } from "./BasePopUp";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class MenuScene extends PixiScene {
	public static readonly BUNDLES = ["package-1", "sfx", "music", "fallrungame"];

	private backgroundContainer: Container;
	private bleedingBackgroundContainer: Container;
	private musicPaused: boolean = false;

	constructor() {
		super();

		// SoundLib.stopAllMusic();
		SoundLib.playMusic("sound_BGM", { volume: 0.03, loop: true });

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
		// const button = new Container();

		// const buttonSprite = Sprite.from("playbutton");
		// button.addChild(buttonSprite);
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

		// button.addChild(buttonBackgroundLine, buttonBackground);
		// button.addChild(buttonText);
		// button.eventMode = "static";
		// button.position.set(0, 750);

		// button.on("pointerdown", () => {
		// 	Manager.changeScene(DodgeScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		// });

		// this.backgroundContainer.addChild(button);

		const title = Sprite.from("runfall");
		title.anchor.set(0.5);
		title.scale.set(0.75);
		title.x = 15;
		this.backgroundContainer.addChild(title);

		const playButton = Sprite.from("playbutton");
		const playY = background.height * 0.3 + playButton.height * 0.5;
		playButton.anchor.set(0.5);
		playButton.y = 1500;
		this.backgroundContainer.addChild(playButton);
		playButton.eventMode = "static";
		playButton.on("pointerdown", () => {
			Manager.changeScene(DodgeScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});

		const soundBtn = Sprite.from("soundbtn");
		soundBtn.anchor.set(0.5);
		soundBtn.y = -background.height * 0.5 + soundBtn.height * 0.5;
		soundBtn.x = -background.width * 0.5 + soundBtn.width * 0.5;
		this.backgroundContainer.addChild(soundBtn);
		soundBtn.eventMode = "static";
		soundBtn.on("pointerdown", () => {
			// toggleSound()
			if (!this.musicPaused) {
				SoundLib.pauseMusic("sound_BGM");
				this.musicPaused = true;
				soundBtn.alpha = 0.5;
			} else {
				SoundLib.resumeMusic("sound_BGM");
				this.musicPaused = false;
				soundBtn.alpha = 1;
			}
		});

		if (!this.musicPaused) {
			soundBtn.alpha = 0.5;
		} else {
			soundBtn.alpha = 1;
		}

		new Tween(title).from({ y: - 1500 }).to({ y: 0 }, 1200).start().easing(Easing.Bounce.Out).onComplete(() => {
			new Tween(playButton).from({ x: 0, y: 1500 }).to({ x: 0, y: playY }, 800).start().onComplete(() => {
				new Tween(playButton).to({ scale: { x: 1.05, y: 1.05 } }, 500).start().repeat(Infinity).yoyo(true);
			});
		});

		const leaderboard = Sprite.from("enemy");
		leaderboard.x = background.width * 0.5 - leaderboard.width * 0.5;
		leaderboard.y = -background.height * 0.5 + leaderboard.height * 0.5;
		leaderboard.anchor.set(0.5);
		new Tween(leaderboard).from({ angle: -5 }).to({ angle: 5 }, 500).start().yoyo(true).repeat(Infinity);
		leaderboard.eventMode = "static";
		leaderboard.on("pointertap", () => {
			this.openGameOverPopup();
		})
		this.backgroundContainer.addChild(leaderboard);
	}

	private async openGameOverPopup(): Promise<void> {
		try {
			const popupInstance = await Manager.openPopup(BasePopup);
			if (popupInstance instanceof BasePopup) {
				popupInstance.showHighscoresMenu();
			} else {
				console.error("Error al abrir el popup: no se pudo obtener la instancia de BasePopup.");
			}
		} catch (error) {
			console.error("Error al abrir el popup:", error);
		}
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);

		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
