import { Sprite, Container, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { DodgeScene } from "./DodgeScene";
import { Manager } from "../../../..";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { FadeColorTransition } from "../../../../engine/scenemanager/transitions/FadeColorTransition";
import { Easing, Tween } from "tweedle.js";
import { HighScorePopUp } from "./PopUps/HighScorePopUp";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { SoundManager, Sounds } from "../Managers/SoundManager";
import { ToggleSwitch } from "../Utils/toggle/ToggleSwitch";
import { CharacterSelectorScene } from "./CharacterSelectorScene";
import { AchievementsScene } from "./AchievementsScene";

export class MenuScene extends PixiScene {
	public static readonly BUNDLES = ["package-1", "sfx", "music", "fallrungame", "runfallsfx"];

	private backgroundContainer: Container = new Container();
	private bleedingBackgroundContainer: Container = new Container();
	private toggleSwitch: ToggleSwitch;

	constructor() {
		super();

		SoundLib.playMusic(Sounds.BG_MUSIC, { volume: 0.03, loop: true });

		this.addChild(this.bleedingBackgroundContainer, this.backgroundContainer);

		const bleedBG = Sprite.from("DODGE-BACKGROUND2");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		const background = Sprite.from("DODGE-BACKGROUND");
		background.position.set(-background.width * 0.5, -background.height * 0.5);
		this.backgroundContainer.addChild(background);

		this.toggleSwitch = new ToggleSwitch({
			knobTexture: "soundKnob",
			backgroundTexture: "soundBG",
			travelDistance: Texture.from("soundBG").width,
			tweenDuration: 500,
			onToggleOn: () => {
				if (!SoundManager.isMusicOn()) {
					SoundManager.resumeMusic(Sounds.BG_MUSIC);
					SoundManager.musicPlaying = true;
				}
			},
			onToggleOff: () => {
				if (SoundManager.isMusicOn()) {
					SoundManager.pauseMusic(Sounds.BG_MUSIC);
					SoundManager.musicPlaying = false;
				}
			},
			startingValue: SoundManager.isMusicOn(),
		});

		this.titleAnimation(background);

		this.toggleSwitch.eventMode = "static";
		this.toggleSwitch.interactive = true;
		this.toggleSwitch.on("pointertap", () => {
			if (this.toggleSwitch.value) {
				SoundManager.playSound(Sounds.START, {});
			} else {
				SoundManager.playSound(Sounds.CLOSEPOPUP, {});
			}
		});

		this.toggleSwitch.anchor.set(0.5);
		this.toggleSwitch.scale.set(0.7);
		this.toggleSwitch.y = -this.backgroundContainer.height * 0.5 + this.toggleSwitch.height * 2.85;
		this.toggleSwitch.x = -this.backgroundContainer.width * 0.5 + this.toggleSwitch.width * 0.5;

		this.backgroundContainer.addChild(this.toggleSwitch);
	}

	private titleAnimation(background: Sprite): void {
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
			SoundLib.playSound(Sounds.START, { volume: 0.2 });
			Manager.changeScene(DodgeScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});

		new Tween(title)
			.from({ y: -1500 })
			.to({ y: 0 }, 1200)
			.delay(800)
			.start()
			.easing(Easing.Bounce.Out)
			.onComplete(() => {
				new Tween(playButton)
					.from({ x: 0, y: 1500 })
					.to({ x: 0, y: playY }, 800)
					.start()
					.onComplete(() => {
						new Tween(playButton)
							.to({ scale: { x: 1.05, y: 1.05 } }, 500)
							.start()
							.repeat(Infinity)
							.yoyo(true);
					});
			});

		const leaderboardBase = Sprite.from("trophyBase");
		leaderboardBase.scale.set(0.3);
		leaderboardBase.x = background.width * 0.5 - leaderboardBase.width * 0.5;
		leaderboardBase.y = background.height * 0.5 - leaderboardBase.height + 50;
		leaderboardBase.anchor.set(0.5);
		leaderboardBase.eventMode = "static";
		leaderboardBase.on("pointertap", () => {
			this.openHighScorePopup();
		});
		this.backgroundContainer.addChild(leaderboardBase);

		const leaderboard = Sprite.from("trophyTop");
		leaderboard.scale.set(0.4);
		leaderboard.x = background.width * 0.5 - leaderboardBase.width * 0.5;
		leaderboard.y = background.height * 0.5 - leaderboard.height - 200;
		leaderboard.anchor.set(0.5);
		new Tween(leaderboard)
			.from({
				angle: 25,
				y: leaderboard.y,
			})
			.to(
				{
					angle: 20,
					y: leaderboard.y + 20,
				},
				2000
			)
			.start()
			.easing(Easing.Sinusoidal.InOut)
			.yoyo(true)
			.repeat(Infinity);
		leaderboard.eventMode = "static";
		leaderboard.on("pointertap", () => {
			this.openHighScorePopup();
		});
		this.backgroundContainer.addChild(leaderboard);

		const playerSelectIcon = Sprite.from("iconBG");
		playerSelectIcon.anchor.set(0.5);
		playerSelectIcon.scale.set(0.35);
		playerSelectIcon.position.set(playerSelectIcon.width * 0.55, background.height - playerSelectIcon.height * 0.6);
		background.addChild(playerSelectIcon);

		const playerSelect = Sprite.from("astroSelect");
		playerSelect.eventMode = "static";
		playerSelect.anchor.set(0.5);
		playerSelect.scale.set(0.5);
		playerSelect.position.set(playerSelect.width * 0.65, background.height - playerSelect.height * 0.75);

		new Tween(playerSelect)
			.from({
				angle: 5,
				y: playerSelect.y,
			})
			.to(
				{
					angle: 0,
					y: playerSelect.y + 20,
				},
				2000
			)
			.start()
			.easing(Easing.Sinusoidal.InOut)
			.yoyo(true)
			.repeat(Infinity);
		background.addChild(playerSelect);
		playerSelect.on("pointertap", () => {
			Manager.changeScene(CharacterSelectorScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});

		const achievements = Sprite.from("achievementIcon");
		achievements.eventMode = "static";
		achievements.anchor.set(0.5);
		achievements.scale.set(0.2);
		achievements.position.set(background.width - achievements.width * 0.55, achievements.height * 0.7);

		new Tween(achievements)
			.from({
				angle: 5,
				y: achievements.y,
			})
			.to(
				{
					angle: 0,
					y: achievements.y + 20,
				},
				2000
			)
			.start()
			.easing(Easing.Sinusoidal.InOut)
			.yoyo(true)
			.repeat(Infinity);
		background.addChild(achievements);
		achievements.on("pointertap", () => {
			Manager.changeScene(AchievementsScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
	}

	private async openHighScorePopup(): Promise<void> {
		try {
			const popupInstance = await Manager.openPopup(HighScorePopUp);
			if (popupInstance instanceof HighScorePopUp) {
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
