import { Container, Graphics, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Player } from "../Objects/Player";
import type { GameObject } from "../Objects/GameObject";
import { Manager } from "../../../..";
import { HighScorePopUp } from "./PopUps/HighScorePopUp";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { HealthBar } from "../Objects/HealthBar";
import { PlayerController } from "../Utils/PlayerController";
import { ScoreManager } from "../Managers/ScoreManager";
import { CollisionManager } from "../Managers/CollisionManager";
import { SpawnManager } from "../Managers/SpawnManager";
import { Sounds } from "../Managers/SoundManager";
import { ObjectsNames } from "../Objects/Objects";
import { PLAYER_SCALE_RUNFALL, REMOVE_OBJECT_TIME } from "../../../../utils/constants";
import { SettingsPopUp } from "./PopUps/SettingsPopUp";
import { Tween } from "tweedle.js";
import { RunFallNameInputPopUp } from "./PopUps/RunFallNameInputPopUp";
import type { Achievement, AchievementState } from "../Managers/AchievementsManager";
import { AchievementsManager } from "../Managers/AchievementsManager";

export class DodgeScene extends PixiScene {
	// #region VARIABLES
	public static readonly BUNDLES = ["fallrungame", "sfx"];
	// objects
	private scoreText: Text;
	private healthBar: HealthBar;
	private objects: GameObject[] = [];
	private player: Player;
	// containers
	private background: Sprite;
	private backgroundContainer: Container = new Container();
	private bleedingBackgroundContainer: Container = new Container();
	private bottomEventContainer: Graphics;
	private rightEventContainer: Graphics;
	private leftEventContainer: Graphics;
	// managers
	private playerController: PlayerController;
	private scoreManager: ScoreManager;
	private spawnManager: SpawnManager;
	private achievementsManager: AchievementsManager;
	// booleans
	public isPaused: boolean = false;

	private uiButton: Sprite;
	private isPopupOpen: boolean = false;

	// Propiedad para almacenar las monedas acumuladas de partidas anteriores
	private cumulativeCoinsInitial: number = 0;
	// #endregion VARIABLES

	constructor() {
		super();

		SoundLib.playMusic(Sounds.BG_MUSIC, { volume: 0.03, loop: true });

		this.addChild(this.bleedingBackgroundContainer);
		this.addChild(this.backgroundContainer);

		const bleedBG = Sprite.from("DODGE-BACKGROUND2");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		this.background = Sprite.from("DODGE-BACKGROUND");
		this.background.position.set(-this.background.width * 0.5, -this.background.height * 0.5);
		this.backgroundContainer.addChild(this.background);

		this.background.filters = [];

		this.scoreText = new Text(`Score: 0`, { fontSize: 45, fill: 0xffffff, dropShadow: true, fontFamily: "Daydream" });
		this.scoreText.anchor.set(0.5);
		this.scoreText.position.set(0, -this.background.height * 0.47);
		this.backgroundContainer.addChild(this.scoreText);

		this.scoreManager = new ScoreManager(this.scoreText);

		this.healthBar = new HealthBar(3, 350, 30);
		this.healthBar.position.set(-this.healthBar.width * 0.5, -this.background.height * 0.5 + 150);
		this.backgroundContainer.addChild(this.healthBar);

		this.player = new Player(this.scoreManager, this.healthBar, this.background);
		this.player.scale.set(PLAYER_SCALE_RUNFALL);
		this.player.x = this.background.width * 0.5;
		this.player.y = this.background.height - this.player.height * 1.5;
		this.background.addChild(this.player);

		this.background.eventMode = "static";
		this.eventMode = "static";

		this.bottomEventContainer = this.createEventContainer(0, this.background.height, this.background.width, 400);
		this.rightEventContainer = this.createEventContainer(this.background.width, 0, this.background.width * 0.3, this.background.height);
		this.leftEventContainer = this.createEventContainer(-this.background.width * 0.3, 0, this.background.width * 0.3, this.background.height);
		this.background.addChild(this.bottomEventContainer, this.leftEventContainer, this.rightEventContainer);

		// Botón principal para abrir el popup
		this.uiButton = Sprite.from("config");
		this.uiButton.anchor.set(0.5);
		this.uiButton.eventMode = "static";
		this.uiButton.on("pointerdown", () => {
			if (!this.isPopupOpen) {
				this.isPopupOpen = true;
				this.openSettingsPopup();
			}
		});
		this.uiButton.position.set(-this.background.width * 0.5 + this.uiButton.width * 0.5, -this.background.height * 0.5 + this.uiButton.height * 0.5);
		this.backgroundContainer.addChild(this.uiButton);

		this.playerController = new PlayerController(this.player);
		this.spawnManager = new SpawnManager(this.scoreManager);

		this.achievementsManager = AchievementsManager.getInstance();
		this.achievementsManager.on("achievementUnlocked", (achievement: Achievement) => {
			// Muestra la notificación en pantalla
			this.showAchievementNotification(achievement);
		});

		// Inicializamos la cantidad acumulada a partir de localStorage
		this.cumulativeCoinsInitial = Number(localStorage.getItem("cumulativeCoins")) || 0;
		this.player.achievementsState.cumulativeCoinsCollected = this.cumulativeCoinsInitial;
		console.log("this.player.achievementsState.cumulativeCoinsCollected", this.player.achievementsState.cumulativeCoinsCollected);
	}

	private showAchievementNotification(achievement: Achievement): void {
		// Crea un contenedor para la notificación
		const notificationContainer = new Container();

		// Define el tamaño de la tarjeta
		const notifWidth = 750;
		const notifHeight = 200;

		// Fondo de la notificación con color semi-transparente
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.7);
		bg.drawRoundedRect(0, 0, notifWidth, notifHeight, 15);
		bg.endFill();
		notificationContainer.addChild(bg);

		SoundLib.playSound("sound2", { volume: 0.1 });
		// Creamos el placeholder para la imagen del achievement
		const icon = Sprite.from("bronze1");
		icon.anchor.set(0, 0.5);
		const iconSize = notifHeight * 0.7;
		icon.width = iconSize;
		icon.height = iconSize;
		const iconMargin = 20;
		icon.position.set(iconMargin, notifHeight * 0.5);
		notificationContainer.addChild(icon);

		// Texto de la notificación
		const message = `¡Lograste el achievement:\n"${achievement.title}"!`;
		const notifText = new Text(message, {
			fontSize: 24,
			fill: 0xffffff,
			fontFamily: "Daydream",
			align: "center",
			wordWrap: true,
			wordWrapWidth: notifWidth - (iconMargin + iconSize + iconMargin),
		});
		const textAreaX = iconMargin + iconSize + (notifWidth - (iconMargin + iconSize + iconMargin)) * 0.5;
		notifText.anchor.set(0.5);
		notifText.position.set(textAreaX, notifHeight * 0.5);
		notificationContainer.addChild(notifText);

		notificationContainer.position.set(-notifWidth * 0.5, -700);
		notificationContainer.alpha = 0;
		this.backgroundContainer.addChild(notificationContainer);

		new Tween(notificationContainer)
			.to({ alpha: 1 }, 500)
			.start()
			.onComplete(() => {
				new Tween(notificationContainer)
					.delay(2000)
					.to({ alpha: 0 }, 500)
					.start()
					.onComplete(() => {
						notificationContainer.parent?.removeChild(notificationContainer);
					});
			});
	}

	private createEventContainer(x: number, y: number, width: number, height: number): Graphics {
		const container = new Graphics();
		container.beginFill(0xff5ff, 0.01);
		container.drawRect(x, y, width, height);
		container.endFill();
		container.eventMode = "static";
		return container;
	}

	private checkCollisions(dt: number): void {
		this.objects.forEach((obj) => {
			obj.update(dt);

			if (obj.y >= this.background.height - obj.height * 0.5 - this.player.height * 0.5) {
				if (obj.name === ObjectsNames.OBSTACLE) {
					if (obj.isOnGround) {
						if (CollisionManager.checkCollision(this.player, obj)) {
							this.player.collideWithObstacle();
							if (this.playerController.isMoving) {
								this.playerController.onMouseStop();
							}
						}
					}
					obj.handleEvent(this.player);
				} else if (obj.name === ObjectsNames.ALIEN_SHIP) {
					if (obj.shipDead) {
						if (CollisionManager.checkCollision(this.player, obj)) {
							(obj as any).stopShooting();
						}
					}
					obj.handleEvent(this.player);
				} else {
					this.removeObject(obj);
				}
			} else if (CollisionManager.checkCollision(this.player, obj)) {
				CollisionManager.handleCollision(this.player, obj);
				obj.handleEvent(this.player);
				this.removeObject(obj);
			}
		});
	}

	private removeObject(obj: GameObject): void {
		const objIndex = this.objects.indexOf(obj);
		new Tween(this.objects[objIndex])
			.to({ alpha: 0 }, REMOVE_OBJECT_TIME)
			.start()
			.onComplete(() => {
				this.background.removeChild(obj);
			});
		this.objects.splice(objIndex, 1);
	}

	private isGameOver(): boolean {
		if (CollisionManager.gameOver && !this.isPopupOpen) {
			this.openNameInputPopup();
			this.isPopupOpen = true;
			// Actualizamos las monedas acumuladas en localStorage al terminar la partida
			const finalCumulative = this.cumulativeCoinsInitial + this.player.achievementsState.coinsCollected;
			localStorage.setItem("cumulativeCoins", finalCumulative.toString());
			return true;
		}
		return false;
	}

	public async openNameInputPopup(): Promise<void> {
		this.isPopupOpen = true;
		this.isPaused = true;

		try {
			const popupInstance = await Manager.openPopup(RunFallNameInputPopUp);
			if (popupInstance instanceof RunFallNameInputPopUp) {
				popupInstance.showButtons();
				popupInstance.on("HIGHSCORE_NAME_READY", () => {
					this.openGameOverPopup();
				});
			}
		} catch (error) {
			console.error("Error opening settings popup:", error);
		}
	}

	private async openGameOverPopup(): Promise<void> {
		CollisionManager.gameOver = false;
		try {
			const popupInstance = await Manager.openPopup(HighScorePopUp, [this.scoreManager.getScore()]);
			if (popupInstance instanceof HighScorePopUp) {
				popupInstance.showHighscores(this.scoreManager.getScore());
			} else {
				console.error("Error al abrir el popup: no se pudo obtener la instancia de BasePopup.");
			}
		} catch (error) {
			console.error("Error al abrir el popup:", error);
		}
	}

	private async openSettingsPopup(): Promise<void> {
		this.isPopupOpen = true;
		this.isPaused = true;

		try {
			const popupInstance = await Manager.openPopup(SettingsPopUp);
			if (popupInstance instanceof SettingsPopUp) {
				popupInstance.showButtons();
				popupInstance.on("RESUME_PAUSE", () => {
					this.isPaused = false;
					this.isPopupOpen = false;
				});
			}
		} catch (error) {
			console.error("Error opening settings popup:", error);
		}
	}

	public override update(dt: number): void {
		if (this.isGameOver()) {
			this.isPaused = true;
			this.uiButton.visible = false;
			return;
		}
		if (this.isPaused || this.isPopupOpen) {
			return;
		}

		this.player.update(dt);
		this.spawnManager.update(dt, this.objects, this.background);
		this.checkCollisions(dt);
		this.scoreText.text = `Score: ${this.scoreManager.getScore()}`;
		this.playerController.mouseMovements(this.background);
		this.playerController.onKeyDown(this.background);

		// Construir el estado para evaluar logros
		const currentState: AchievementState = {
			score: this.scoreManager.getScore(),
			lives: this.healthBar.getCurrentHealth(),
			coinsCollected: this.player.achievementsState.coinsCollected,
			// Suma de monedas recogidas en la partida actual más las acumuladas de sesiones anteriores
			cumulativeCoinsCollected: this.cumulativeCoinsInitial + this.player.achievementsState.coinsCollected,
			enemyCollisions: this.player.achievementsState.enemyCollisions,
			obstacleCollisions: this.player.achievementsState.obstacleCollisions,
			potionsCollected: this.player.achievementsState.potionsCollected,
		};

		// Actualiza logros
		this.achievementsManager.update(currentState);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
