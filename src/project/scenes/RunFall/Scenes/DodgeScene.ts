import { Container, Graphics, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Player } from "../Objects/Player";
import type { GameObject } from "../Objects/GameObject";
import { Manager } from "../../../..";
import { HighScorePopUp } from "./HighScorePopUp";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { FadeColorTransition } from "../../../../engine/scenemanager/transitions/FadeColorTransition";
import { MenuScene } from "./MenuScene";
import { HealthBar } from "../Objects/HealthBar";
import { Button } from "../Objects/Button";
import { PlayerController } from "../Utils/PlayerController";
import { ScoreManager } from "../Managers/ScoreManager";
import { CollisionManager } from "../Managers/CollisionManager";
import { SpawnManager } from "../Managers/SpawnManager";

export class DodgeScene extends PixiScene {
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
	// booleans
	public isPaused: boolean = false;

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
		this.spawnManager = new SpawnManager(this.scoreManager);

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

	private checkCollisions(dt: number): void {
		this.objects.forEach((obj) => {
			obj.update(dt);

			if (obj.y >= this.background.height - obj.height) {
				if (obj.name === "OBSTACLE") {
					if (obj.isOnGround) {
						if (CollisionManager.checkCollision(this.player, obj)) {
							this.player.collideWithObstacle();
							this.player.effectManager.causeStun(2000);
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

		this.spawnManager.update(dt, this.objects, this.background);

		this.checkCollisions(dt);

		this.scoreText.text = `Score: ${this.scoreManager.getScore()}`;

		this.playerController.onKeyDown(this.background);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);

		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}