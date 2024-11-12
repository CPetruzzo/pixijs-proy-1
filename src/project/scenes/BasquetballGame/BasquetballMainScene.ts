import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, Texture } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Manager } from "../../..";
import { BasquetballGameScene } from "./BasquetballGameScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { Easing, Tween } from "tweedle.js";
import { ToggleSwitch } from "../RunFall/Utils/toggle/ToggleSwitch";
import { SoundManager, Sounds } from "../RunFall/Managers/SoundManager";
import { TutorialManager } from "./Utils/TutorialManager";

export class BasquetballMainScene extends PixiScene {
	public static readonly BUNDLES = ["joystick", "basquet", "runfallsfx"];
	private backgroundContainer: Container = new Container();
	constructor() {
		super();

		this.addChild(this.backgroundContainer);

		SoundLib.playMusic(Sounds.BASKET_MUSIC, { loop: true, singleInstance: true });

		const bG = Sprite.from("cachobasketHQ");
		bG.anchor.set(0.5);
		bG.scale.set(1.2);
		bG.x = 1170;
		bG.y = 590;
		this.backgroundContainer.addChild(bG);

		// music button
		const scoreText1 = new Text(`Music`, {
			fontSize: 50,
			fill: 0xffffff,
			// dropShadowDistance: 15,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
		});
		scoreText1.position.set(960 + scoreText1.width * 0.5, 400);
		scoreText1.anchor.set(0.5);
		this.backgroundContainer.addChild(scoreText1);
		const toggleSwitch1 = new ToggleSwitch({
			knobTexture: "cachoknob",
			backgroundTexture: "cachobasketBAR",
			travelDistance: Texture.from("cachobasketBAR").width,
			tweenDuration: 500,
			startingValue: SoundManager.isMusicOn(),
			onToggleOn: () => {
				// Lógica para activar la música
				if (!SoundManager.isMusicOn()) {
					SoundManager.resumeMusic(Sounds.BASKET_MUSIC);
					SoundManager.musicPlaying = true;
				}
			},
			onToggleOff: () => {
				// Lógica para desactivar la música
				if (SoundManager.isMusicOn()) {
					SoundManager.pauseMusic(Sounds.BASKET_MUSIC);
					SoundManager.musicPlaying = false;
				}
			},
		});
		toggleSwitch1.x = 950;
		toggleSwitch1.y = 411;
		toggleSwitch1.scale.set(1.27);
		this.backgroundContainer.addChild(toggleSwitch1);

		// sfx button
		const scoreText2 = new Text(`SOUND EFFECTS`, {
			fontSize: 50,
			fill: 0xffffff,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
		});
		scoreText2.position.set(960 + scoreText2.width * 0.5, 540);
		scoreText2.anchor.set(0.5);
		this.backgroundContainer.addChild(scoreText2);
		const toggleSwitch2 = new ToggleSwitch({
			knobTexture: "cachoknob",
			backgroundTexture: "cachobasketBAR",
			travelDistance: Texture.from("cachobasketBAR").width,
			tweenDuration: 500,
			startingValue: SoundManager.isSoundOn(),
			onToggleOn: () => {
				// Lógica para activar la música
				if (!SoundManager.isSoundOn()) {
					SoundLib.muteSound = false;
					SoundManager.sfxPlaying = true;
				}
			},
			onToggleOff: () => {
				// Lógica para desactivar la música
				if (SoundManager.isSoundOn()) {
					SoundLib.muteSound = true;
					SoundManager.sfxPlaying = false;
				}
			},
		});
		toggleSwitch2.x = 950;
		toggleSwitch2.y = 552;
		toggleSwitch2.scale.set(1.25, 1.29);
		this.backgroundContainer.addChild(toggleSwitch2);

		const scoreText3 = new Text(`TUTORIAL`, {
			fontSize: 50,
			fill: 0xffffff,
			// dropShadowDistance: 15,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
		});
		scoreText3.position.set(960 + scoreText3.width * 0.5, 690);
		scoreText3.anchor.set(0.5);
		this.backgroundContainer.addChild(scoreText3);
		const toggleSwitch3 = new ToggleSwitch({
			knobTexture: "cachoknob",
			backgroundTexture: "cachobasketBAR",
			travelDistance: Texture.from("cachobasketBAR").width,
			tweenDuration: 500,
			startingValue: TutorialManager.isActive(),
			onToggleOn: () => TutorialManager.enableTutorial(),
			onToggleOff: () => TutorialManager.disableTutorial(),
		});
		toggleSwitch3.x = 950;
		toggleSwitch3.y = 702;
		toggleSwitch3.scale.set(1.25, 1.29);
		this.backgroundContainer.addChild(toggleSwitch3);

		const play = Sprite.from("play");
		play.anchor.set(0.5);
		play.scale.set(1.2);
		play.x = 1160;
		play.y = 937;
		this.backgroundContainer.addChild(play);

		play.eventMode = "static";
		play.on("pointerover", () => {
			new Tween(play)
				.to({ scale: { x: 1.3, y: 1.3 } }, 500)
				.easing(Easing.Bounce.Out)
				.start();
			SoundLib.playSound("bounce", {});
		});
		play.on("pointerout", () => {
			new Tween(play)
				.to({ scale: { x: 1.2, y: 1.2 } }, 500)
				.easing(Easing.Bounce.Out)
				.start();
		});
		play.on("pointertap", () => {
			new Tween(play)
				.to({ scale: { x: 1.3, y: 1.3 } }, 500)
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
