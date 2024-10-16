import { Container, Graphics, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import Random from "../../../engine/random/Random";
import { Player } from "./Player";
import type { GameObject } from "./GameObject";
import { CoinObject, EnemyObject, NegativeObject, ObstacleObject, PowerUpObject } from "./Objects";
import { Manager } from "../../..";
import { BasePopup } from "./BasePopUp";
import { SoundLib } from "../../../engine/sound/SoundLib";
import type { SmokeEmitter } from "./SmokeEmitter";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { MenuScene } from "./MenuScene";
import { HealthBar } from "./HealthBar";
import { Button } from "./Button";
import { PlayerController } from "./PlayerController";
import { ScoreManager } from "./ScoreManager";
import { CollisionManager } from "./CollisionManager";

export class DodgeScene extends PixiScene {
	public static readonly BUNDLES = ["fallrungame", "sfx"];

	private backgroundContainer: Container = new Container();
	private background: Sprite;

	private scoreText: Text;

	private spawnInterval: number = Random.shared.randomInt(500, 1500);
	private timeSinceLastSpawn: number = 0;

	private objects: GameObject[] = [];
	private player: Player;

	private healthBar: HealthBar;
	private bottomEventContainer: Graphics;
	private bleedingBackgroundContainer: Container = new Container();
	private rightEventContainer: Graphics;
	private leftEventContainer: Graphics;

	private smokeParticles: SmokeEmitter[] = [];
	public isPaused: boolean = false;
	private playerController: PlayerController;
	private scoreManager: ScoreManager;

	private static readonly SCORE_THRESHOLDS = [500, 1000, 2000, 3000, 4000];
	private static readonly SPAWN_INTERVALS = [1500, 1000, 800, 500, 300, 150];

	constructor() {
		super();

		SoundLib.playMusic("sound_BGM", { volume: 0.03, loop: true });

		this.addChild(this.bleedingBackgroundContainer);
		this.addChild(this.backgroundContainer);

		const bleedBG = Sprite.from("DODGE-BACKGROUND2");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		this.background = Sprite.from("DODGE-BACKGROUND");
		this.background.position.set(-this.background.width * 0.5, -this.background.height * 0.5);
		this.backgroundContainer.addChild(this.background);

		this.background.filters = [];

		this.scoreText = new Text(`Score: 0`, { fontSize: 55, fill: 0xffffff, fontFamily: "Darling Coffee" });
		this.scoreText.anchor.set(0.5);
		this.scoreText.position.set(0, -this.background.height * 0.48);
		this.backgroundContainer.addChild(this.scoreText);

		this.scoreManager = new ScoreManager(this.scoreText);

		this.healthBar = new HealthBar(3, 350, 30);
		this.healthBar.position.set(-this.healthBar.width * 0.5, this.background.height * 0.5 - 50);
		this.backgroundContainer.addChild(this.healthBar);

		this.player = new Player(this.scoreManager, this.healthBar, this.background);
		this.player.x = this.background.width * 0.5;
		this.player.y = this.background.height - this.player.height;
		this.background.addChild(this.player);

		this.background.eventMode = "static";
		this.eventMode = "static";

		this.bottomEventContainer = this.createEventContainer(0, this.background.height, this.background.width, 400);
		this.rightEventContainer = this.createEventContainer(this.background.width, 0, this.background.width * 0.3, this.background.height);
		this.leftEventContainer = this.createEventContainer(-this.background.width * 0.3, 0, this.background.width * 0.3, this.background.height);

		this.background.addChild(this.bottomEventContainer, this.leftEventContainer, this.rightEventContainer);

		const backButton = new Button("Back", 120, 60, () => {
			Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
		backButton.position.set(this.background.width / 2 - backButton.width * 0.5, -this.background.height / 2 + backButton.height * 0.5);

		const pauseButton = new Button("Pause", 120, 60, () => {
			this.isPaused = !this.isPaused;
			pauseButton.setLabel(this.isPaused ? "Resume" : "Pause");
		});
		pauseButton.position.set(-this.background.width * 0.5 + pauseButton.width * 0.5 + 15, -this.background.height * 0.5 + pauseButton.height * 0.5);

		this.backgroundContainer.addChild(pauseButton, backButton);

		this.playerController = new PlayerController(this.player);

		if (!this.isPaused) {
			this.background.on("pointerdown", (event) => this.playerController.onMouseMove(event, this.background));
			this.background.on("pointerup", () => {
				if (this.playerController.isPlayerMoving) {
					this.playerController.onMouseStop();
				}
			});
		}
	}

	private createEventContainer(x: number, y: number, width: number, height: number): Graphics {
		const container = new Graphics();
		container.beginFill(0xff5ff, 0.01);
		container.drawRect(x, y, width, height);
		container.endFill();
		container.eventMode = "static";
		return container;
	}

	private adjustSpawnInterval(): void {
		const score = this.scoreManager.getScore();
		for (let i = 0; i < DodgeScene.SCORE_THRESHOLDS.length; i++) {
			if (score >= DodgeScene.SCORE_THRESHOLDS[i]) {
				this.spawnInterval = Random.shared.randomInt(DodgeScene.SPAWN_INTERVALS[i + 1], DodgeScene.SPAWN_INTERVALS[i]);
			}
		}
	}

	private checkCollisions(dt: number): void {
		this.objects.forEach((obj) => {
			obj.update(dt);

			if (obj.y >= this.background.height - obj.height) {
				if (obj.name === "OBSTACLE") {
					if (obj.isOnGround) {
						if (CollisionManager.checkCollision(this.player, obj)) {
							this.player.collideWithObstacle();
							this.player.effects.causeStun(2000);
						}
					}
					obj.handleEvent(this.player);
				} else {
					const index = this.objects.indexOf(obj);
					this.objects.splice(index, 1);
					this.background.removeChild(obj);
				}
			} else if (CollisionManager.checkCollision(this.player, obj)) {
				CollisionManager.handleCollision(this.player, obj);
				obj.handleEvent(this.player);
				const objIndex = this.objects.indexOf(obj);
				this.objects.splice(objIndex, 1);
				this.background.removeChild(obj);
			}
		});
	}

	private spawnObject(): void {
		let objectType: number;
		const score = this.scoreManager.getScore();

		// Determinar el tipo de objeto según el puntaje
		if (score >= 1000) {
			objectType = Random.shared.randomInt(0, 5); // Aumentar la variedad de objetos
		} else if (score >= 500) {
			objectType = Random.shared.randomInt(0, 4);
		} else {
			objectType = Random.shared.randomInt(0, 3);
		}

		// Array que asocia tipos de objetos con sus nombres
		const objectTypes = [
			{ constructor: EnemyObject, name: "ENEMY" },
			{ constructor: NegativeObject, name: "POTION" },
			{ constructor: CoinObject, name: "COIN" },
			{ constructor: PowerUpObject, name: "POWER_UP" },
			{ constructor: ObstacleObject, name: "OBSTACLE" },
		];

		// Crear el objeto según el tipo
		const selectedObject = objectTypes[objectType];
		const object = new selectedObject.constructor();
		object.name = selectedObject.name;

		// Inicializar la posición del objeto
		object.x = Random.shared.randomInt(object.width * 0.5, this.background.width - object.width * 0.5);

		// Añadir el objeto al array y al background
		this.objects.push(object);
		this.background.addChild(object);
	}

	private async openGameOverPopup(): Promise<void> {
		CollisionManager.gameOver = false;
		try {
			const popupInstance = await Manager.openPopup(BasePopup, [this.scoreManager.getScore()]);
			if (popupInstance instanceof BasePopup) {
				popupInstance.showHighscores(this.scoreManager.getScore());
			} else {
				console.error("Error al abrir el popup: no se pudo obtener la instancia de BasePopup.");
			}
		} catch (error) {
			console.error("Error al abrir el popup:", error);
		}
	}

	public override update(dt: number): void {
		if (CollisionManager.gameOver) {
			this.openGameOverPopup();
			this.isPaused = true;
			return;
		}

		if (this.isPaused) {
			return;
		}

		this.player.update(dt);
		this.timeSinceLastSpawn += dt;

		if (this.timeSinceLastSpawn >= this.spawnInterval) {
			this.timeSinceLastSpawn = 0;
			this.spawnObject();
			this.adjustSpawnInterval();
		}

		this.checkCollisions(dt);

		this.scoreText.text = `Score: ${this.scoreManager.getScore()}`;

		for (const smoke of this.smokeParticles) {
			smoke.update(dt);
		}

		this.playerController.onKeyDown(this.background);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);

		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
