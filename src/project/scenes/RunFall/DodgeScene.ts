import { Container, filters, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import Random from "../../../engine/random/Random";
import { Tween } from "tweedle.js";
import { Player } from "./Player";
import type { GameObject } from "./GameObject";
import { CoinObject, EnemyObject, NegativeObject, ObstacleObject, PowerUpObject } from "./Objects";
import { Timer } from "../../../engine/tweens/Timer";
import { BLUR_TIME, PLAYER_SPEED } from "../../../utils/constants";
import { Manager } from "../../..";
import { BasePopup } from "./BasePopUp";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { SmokeEmitter } from "./SmokeEmitter";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { MenuScene } from "./MenuScene";

export class DodgeScene extends PixiScene {
	public static readonly BUNDLES = ["fallrungame", "sfx"];

	private backgroundContainer: Container = new Container();
	private background: Sprite;

	private scoreText: Text;
	private score: number = 0;

	private spawnInterval: number = Random.shared.randomInt(500, 1500);
	private timeSinceLastSpawn: number = 0;

	private objects: GameObject[] = [];
	private player: Player;
	private moveTween: Tween<Player>;

	private healthBar: Sprite;
	private healthSprites: Sprite[];
	private maxHealth: number = 3;
	private currentHealth: number = this.maxHealth;
	private gameOver: boolean = false;
	private bottomEventContainer: Graphics;
	private bleedingBackgroundContainer: Container = new Container();
	private rightEventContainer: Graphics;
	private leftEventContainer: Graphics;
	private isMoving: boolean = false;

	private smokeContainers: Container[] = [];
	private smokeParticles: SmokeEmitter[] = [];
	public isPaused: boolean = false;
	private pausebuttonText: Text;

	// private smokeContainer: Container;
	// private smoke: SmokeEmitter;

	constructor() {
		super();

		SoundLib.stopAllMusic();
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

		const buttonPopUp = new Graphics();
		buttonPopUp.beginFill(0x808080);
		buttonPopUp.drawRect(0, 0, 45, 45);
		buttonPopUp.endFill();
		// this.background.addChild(buttonPopUp);
		buttonPopUp.eventMode = "static";
		buttonPopUp.on("pointertap", () => {
			Manager.openPopup(BasePopup, [this.score]);
		});

		this.player = new Player();
		this.player.x = this.background.width * 0.5;
		this.player.y = this.background.height - this.player.height;
		this.background.addChild(this.player);

		this.scoreText = new Text(`Score: ${this.score}`, { fontSize: 55, fill: 0xffffff, fontFamily: "Darling Coffee" });
		this.scoreText.anchor.set(0.5);
		this.scoreText.position.set(0, -this.background.height * 0.48);
		this.backgroundContainer.addChild(this.scoreText);

		this.background.eventMode = "static";
		this.eventMode = "static";

		this.background.on("pointerdown", this.onMouseMove, this);
		this.background.on("pointerup", this.onMouseStop, this);

		this.healthBar = new Sprite(Texture.WHITE);
		this.healthBar.width = 99;
		this.healthBar.height = 20;
		this.healthBar.tint = 0xff0000;
		this.healthBar.position.set(-this.healthBar.width * 0.5, this.background.height * 0.5 - 50);
		this.backgroundContainer.addChild(this.healthBar);

		this.healthSprites = [];
		for (let i = 0; i < this.maxHealth; i++) {
			const healthSprite = new Sprite(Texture.WHITE);
			healthSprite.width = 33;
			healthSprite.height = 20;
			healthSprite.tint = 0x00ff00;
			healthSprite.position.set(this.healthBar.x + i * healthSprite.width, this.healthBar.y);
			this.healthSprites.push(healthSprite);
			this.backgroundContainer.addChild(healthSprite);
		}

		// Crear un contenedor invisible para eventos debajo del background
		this.bottomEventContainer = new Graphics();
		this.bottomEventContainer.beginFill(0xff5ff, 0.01); // Color transparente
		this.bottomEventContainer.drawRect(0, this.background.height, this.background.width, 400); // Misma dimensión que el background
		this.bottomEventContainer.endFill();
		this.bottomEventContainer.eventMode = "static";

		// Crear un contenedor invisible para eventos debajo del background
		this.rightEventContainer = new Graphics();
		this.rightEventContainer.beginFill(0xff5ff, 0.01); // Color transparente
		this.rightEventContainer.drawRect(this.background.width, 0, this.background.width * 0.3, this.background.height); // Misma dimensión que el background
		this.rightEventContainer.endFill();
		this.rightEventContainer.eventMode = "static";

		// Crear un contenedor invisible para eventos debajo del background
		this.leftEventContainer = new Graphics();
		this.leftEventContainer.beginFill(0xff5ff, 0.01); // Color transparente
		this.leftEventContainer.drawRect(-this.background.width * 0.3, 0, this.background.width * 0.3, this.background.height); // Misma dimensión que el background
		this.leftEventContainer.endFill();
		this.leftEventContainer.eventMode = "static";

		this.background.addChild(this.bottomEventContainer, this.leftEventContainer, this.rightEventContainer); // Agregar el contenedor al fondo

		// this.smokeContainer = new Container();
		// this.smoke = new SmokeEmitter(this.smokeContainer);
		// this.backgroundContainer.addChild(this.smokeContainer);
		// this.smoke.start();

		// Creación del botón
		const button = new Container();
		const buttonText = new Text("Back", new TextStyle({ fill: "#ffffff", fontFamily: "Darling Coffee" }));
		buttonText.anchor.set(0.5);
		buttonText.scale.set(1);

		const buttonBackground = new Graphics();
		buttonBackground.beginFill(0x252525);
		buttonBackground.drawRoundedRect(-buttonText.width / 2 - 10, -buttonText.height / 2 - 5, buttonText.width + 20, buttonText.height + 10, 10);
		buttonBackground.endFill();
		buttonBackground.scale.set(2);

		button.addChild(buttonBackground);
		button.addChild(buttonText);
		button.eventMode = "static";
		button.position.set(this.background.width / 2 - button.width * 0.5, -this.background.height / 2 + button.height * 0.5);
		button.alpha = 0.5;

		button.on("pointerdown", () => {
			Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});

		const pausebutton = new Container();
		this.pausebuttonText = new Text("Pause", new TextStyle({ fill: "#ffffff", fontFamily: "Darling Coffee" }));
		this.pausebuttonText.anchor.set(0.5);
		this.pausebuttonText.scale.set(1);

		const pausebuttonBackground = new Graphics();
		pausebuttonBackground.beginFill(0x252525);
		pausebuttonBackground.drawRoundedRect(
			-this.pausebuttonText.width * 0.5 - 10,
			-this.pausebuttonText.height * 0.5 - 5,
			this.pausebuttonText.width + 20,
			this.pausebuttonText.height + 10,
			10
		);
		pausebuttonBackground.endFill();
		pausebuttonBackground.scale.set(2);

		pausebutton.addChild(pausebuttonBackground);
		pausebutton.addChild(this.pausebuttonText);
		pausebutton.alpha = 0.5;
		pausebutton.eventMode = "static";
		pausebutton.position.set(-this.background.width * 0.5 + button.width * 0.5 + 15, -this.background.height * 0.5 + button.height * 0.5);

		pausebutton.on("pointerdown", () => {
			if (!this.isPaused) {
				this.isPaused = true;
				this.background.eventMode = "none";
			} else {
				this.pausebuttonText.text = "Pause";
				this.background.eventMode = "static";
				this.isPaused = false;
			}
		});

		this.backgroundContainer.addChild(pausebutton, button);
	}

	private updateHealthBar(): void {
		for (let i = 0; i < this.healthSprites.length; i++) {
			if (i < this.currentHealth) {
				this.healthSprites[i].visible = true;
			} else {
				this.healthSprites[i].visible = false;
			}
		}
	}

	private onMouseMove(event: any): void {
		if (!this.isMoving) {
			const globalMousePosition = this.background.toLocal(event.data.global);
			const targetX = Math.max(Math.min(globalMousePosition.x, this.background.width - this.player.width * 0.3), this.player.width * 0.3);
			const distance = targetX - this.player.x;
			this.player.movingLeft = distance < 0;
			this.player.setDirection(this.player.movingLeft);

			const duration = Math.abs(distance) / this.player.speed;
			this.player.playState("move");

			this.moveTween = new Tween(this.player).to({ x: targetX }, duration).onComplete(() => {
				this.player.playState("idle");
			});

			if (this.moveTween != undefined) {
				if (this.player.canMove) {
					this.moveTween.start();
				} else {
					this.moveTween.pause();
				}
			}

			this.isMoving = true; // Establecer la bandera de movimiento a verdadero
		}
	}
	private onMouseStop(): void {
		this.moveTween.pause();
		this.isMoving = false; // Establecer la bandera de movimiento a falso cuando se detiene el movimiento
	}

	public override update(dt: number): void {
		if (this.gameOver) {
			return;
		}
		if (this.isPaused) {
			this.pausebuttonText.text = "Game Paused";
			return;
		}
		this.player.update(dt);

		this.timeSinceLastSpawn += dt;

		if (this.timeSinceLastSpawn >= this.spawnInterval) {
			this.timeSinceLastSpawn = 0;
			this.spawnObject();
			this.adjustSpawnInterval(); // Ajustar el intervalo de aparición según la dificultad
		}

		this.objects.forEach((obj) => {
			obj.update(dt);
			// obj.particles?.update(dt); // Actualizar las partículas del objeto

			// obj.particles.start();

			if (obj.y >= this.background.height - obj.height) {
				if (obj.name === "OBSTACLE") {
					if (obj.isOnGround) {
						if (this.checkCollision(this.player, obj)) {
							this.collideWithObstacle();
						}
					}
					obj.handleEvent(this.player);
				} else {
					const index = this.objects.indexOf(obj);
					this.objects.splice(index, 1);
					this.background.removeChild(obj);
				}
			} else if (this.checkCollision(this.player, obj)) {
				this.eventOnPlayerCollision(obj);
				obj.handleEvent(this.player);
			}
		});

		this.scoreText.text = `Score: ${this.score}`;

		// this.smoke.update(dt);

		for (const smoke of this.smokeParticles) {
			smoke.update(dt);
		}
	}

	private increaseHealth(): void {
		console.log("El jugador recibió curación. +1 de vida");
		if (this.currentHealth < this.maxHealth) {
			this.currentHealth++; // Incrementar la vida si no está al máximo
			this.updateHealthBar(); // Actualizar la barra de vida
		}
	}

	private eventOnPlayerCollision(obj: GameObject): void {
		switch (obj.name) {
			case "ENEMY":
				this.decreaseScore(50);
				this.decreaseHealth();
				this.causeBlur();
				this.vibrateMobileDevice();
				SoundLib.playSound("sound_hit", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				break;
			case "POTION":
				this.increaseScore(10);
				this.increaseHealth();
				SoundLib.playSound("sound_award", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				break;
			case "COIN":
				this.collectCoin(50);
				SoundLib.playSound("sound_collectable", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.1 });
				break;
			case "POWER_UP":
				this.activatePowerUp();
				SoundLib.playSound("sound_big_award", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				break;
			case "OBSTACLE":
				this.collideWithObstacle();
				const smokeContainer = new Container();
				const smoke = new SmokeEmitter(smokeContainer);
				this.smokeContainers.push(smokeContainer);
				this.smokeParticles.push(smoke);
				obj.addChild(smokeContainer);
				smoke.start();
				this.decreaseHealth();
				this.vibrateMobileDevice();
				SoundLib.playSound("sound_block", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				break;
			default:
				console.log("that object didn't have a name", obj);
				break;
		}

		const objIndex = this.objects.indexOf(obj);
		this.objects.splice(objIndex, 1);
		this.background.removeChild(obj);
	}

	private causeBlur(): void {
		const blurFilter = new filters.BlurFilter(20);
		this.background.filters = [blurFilter];

		new Timer()
			.to(BLUR_TIME)
			.start()
			.onComplete(() => {
				this.recoverFromBlur();
			});
	}

	private recoverFromBlur(): void {
		this.background.filters = [];
	}

	private collectCoin(amount: number): void {
		console.log("El jugador recogió una moneda. +10 puntos");
		this.increaseScore(amount);
	}

	private activatePowerUp(): void {
		console.log("El jugador activó un power-up. +50 puntos");
		this.score += 50;
		this.player.speed += 0.25;
		new Timer()
			.to(5500)
			.start()
			.onComplete(() => {
				this.player.speed = PLAYER_SPEED;
			});
	}

	private collideWithObstacle(): void {
		console.log("El jugador chocó con un obstáculo.");
		this.player.stopMovement();
		if (this.moveTween != undefined) {
			this.moveTween.pause();
		}
	}

	private decreaseHealth(): void {
		if (this.currentHealth > 0) {
			// Verifica si el jugador todavía tiene vida
			this.currentHealth--; // Reducir la vida
			this.updateHealthBar(); // Actualizar la barra de vida
			if (this.currentHealth <= 0) {
				// Aquí puedes manejar la lógica cuando el jugador pierde toda la vida
				console.log("El jugador perdió toda la vida.");
				this.openGameOverPopup(); // Llama a la función para abrir el popup
			}
		}
	}
	private decreaseScore(amount: number): void {
		if (this.score > 0) {
			this.score -= amount;
		}
	}
	private increaseScore(amount: number): void {
		this.score += amount;
	}

	private checkCollision(player: Player, enemy: GameObject): boolean {
		const playerBounds = player.aux.getBounds();
		const enemyBounds = enemy.getBounds();

		return (
			playerBounds.x + playerBounds.width > enemyBounds.x &&
			playerBounds.x < enemyBounds.x + enemyBounds.width &&
			playerBounds.y + playerBounds.height > enemyBounds.y &&
			playerBounds.y < enemyBounds.y + enemyBounds.height
		);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		// this.backgroundContainer.x = newW * 0.5;
		// this.backgroundContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}

	private adjustSpawnInterval(): void {
		// Ajustar el intervalo de aparición según la dificultad y el puntaje
		if (this.score >= 4000) {
			this.spawnInterval = Random.shared.randomInt(150, 300);
		} else if (this.score >= 3000) {
			this.spawnInterval = Random.shared.randomInt(250, 500);
		} else if (this.score >= 2000) {
			this.spawnInterval = Random.shared.randomInt(300, 800);
		} else if (this.score >= 1000) {
			this.spawnInterval = Random.shared.randomInt(400, 1000);
		} else if (this.score >= 500) {
			this.spawnInterval = Random.shared.randomInt(700, 1500);
		} else {
			this.spawnInterval = Random.shared.randomInt(500, 1500);
		}
	}
	private spawnObject(): void {
		let object: GameObject;
		let objectType: number;
		if (this.score >= 1000) {
			objectType = Random.shared.randomInt(0, 5); // Aumentar la variedad de objetos
		} else if (this.score >= 500) {
			objectType = Random.shared.randomInt(0, 4);
		} else {
			objectType = Random.shared.randomInt(0, 3);
		}

		switch (objectType) {
			case 0:
				object = new EnemyObject();
				object.name = "ENEMY";
				break;
			case 1:
				object = new NegativeObject();
				object.name = "POTION";
				break;
			case 2:
				object = new CoinObject();
				object.name = "COIN";
				// const smokeContainer = new Container();
				// const smoke = new SmokeEmitter(smokeContainer);
				// this.smokeContainers.push(smokeContainer);
				// this.smokeParticles.push(smoke);
				// object.addChild(smokeContainer);
				// smoke.start();
				break;
			case 3:
				object = new PowerUpObject();
				object.name = "POWER_UP";
				break;
			case 4:
				object = new ObstacleObject();
				object.name = "OBSTACLE";
				break;
			default:
				break;
		}

		object.x = Random.shared.randomInt(object.width * 0.5, this.background.width - object.width * 0.5);
		this.objects.push(object);
		this.background.addChild(object);
	}

	private async openGameOverPopup(): Promise<void> {
		this.gameOver = true;
		try {
			const popupInstance = await Manager.openPopup(BasePopup, [this.score]);
			if (popupInstance instanceof BasePopup) {
				popupInstance.showHighscores(this.score);
			} else {
				console.error("Error al abrir el popup: no se pudo obtener la instancia de BasePopup.");
			}
		} catch (error) {
			console.error("Error al abrir el popup:", error);
		}
	}

	private vibrateMobileDevice(): void {
		if ("vibrate" in navigator) {
			navigator.vibrate(500);
			console.log("Vibrando.");
		} else {
			console.log("La vibración no es compatible con este dispositivo.");
		}
	}
}
