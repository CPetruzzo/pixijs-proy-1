import { Graphics, Sprite, Text, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import Random from "../../../engine/random/Random";
import { Tween } from "tweedle.js";
import { Player } from "./Player";
import { GameObject } from "./GameObject";
import { CoinObject, EnemyObject, NegativeObject, ObstacleObject, PowerUpObject } from "./Objects";
import { Timer } from "../../../engine/tweens/Timer";
import { PLAYER_SPEED } from "../../../utils/constants";
import { Manager } from "../../..";
import { BasePopup } from "./BasePopUp";

export class DodgeScene extends PixiScene {
	public static readonly BUNDLES = ["package-1", "sfx"];

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
	private eventContainer: Graphics;

	constructor() {
		super();

		this.background = Sprite.from("DODGE-BACKGROUND");
		this.background.position.set(-this.background.width * 0.5, - this.background.height * 0.5);
		this.addChild(this.background);

		const buttonPopUp = new Graphics();
		buttonPopUp.beginFill(0x808080);
		buttonPopUp.drawRect(0, 0, 45, 45);
		buttonPopUp.endFill();
		// this.background.addChild(buttonPopUp);
		buttonPopUp.eventMode = "static";
		buttonPopUp.on("pointertap", () => {
			Manager.openPopup(BasePopup, [this.score]);
		})

		this.player = new Player();
		this.player.x = this.background.width * 0.5;
		this.player.y = this.background.height - this.player.height;
		this.background.addChild(this.player);

		this.scoreText = new Text(`Score: ${this.score}`, { fontSize: 55, fill: 0xffffff });
		this.scoreText.anchor.set(0.5);
		this.scoreText.position.set(0, -this.background.height * 0.48);
		this.addChild(this.scoreText);

		this.background.eventMode = "static";
		this.eventMode = "static";

		this.background.on("pointerdown", this.onMouseMove, this);
		this.background.on("pointerup", this.onMouseStop, this);

		this.healthBar = new Sprite(Texture.WHITE);
		this.healthBar.width = 99;
		this.healthBar.height = 20;
		this.healthBar.tint = 0xff0000; // Color rojo
		this.healthBar.position.set(-this.healthBar.width * 0.5, this.background.height * 0.5 - 50);
		this.addChild(this.healthBar);

		this.healthSprites = [];
		for (let i = 0; i < this.maxHealth; i++) {
			const healthSprite = new Sprite(Texture.WHITE);
			healthSprite.width = 33;
			healthSprite.height = 20;
			healthSprite.tint = 0x00ff00; // Color verde
			healthSprite.position.set(this.healthBar.x + i * healthSprite.width, this.healthBar.y);
			this.healthSprites.push(healthSprite);
			this.addChild(healthSprite);
		}

		// Crear un contenedor invisible para eventos debajo del background
		this.eventContainer = new Graphics();
		this.eventContainer.beginFill(0xff5ff, 0.1); // Color transparente
		this.eventContainer.drawRect(0, this.background.height, this.background.width, 400); // Misma dimensión que el background
		this.eventContainer.endFill();
		this.eventContainer.eventMode = "static";
		this.background.addChild(this.eventContainer); // Agregar el contenedor al fondo
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
		const globalMousePosition = this.background.toLocal(event.data.global);
		const targetX = globalMousePosition.x;
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
	}

	private onMouseStop(): void {
		this.moveTween.pause();
	}

	public override update(dt: number): void {
		if (this.gameOver) {
			return;
		}
		this.player.update(dt);

		this.timeSinceLastSpawn += dt;

		if (this.timeSinceLastSpawn >= this.spawnInterval) {
			this.timeSinceLastSpawn = 0;
			this.spawnObject();
			this.spawnInterval = Random.shared.randomInt(500, 1500);
		}

		this.objects.forEach((obj) => {
			obj.update(dt);

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
				this.doSomething(obj);
				obj.handleEvent(this.player);

				if (obj.name === "OBSTACLE") {
					this.collideWithObstacle();
				}
			}
		});

		this.scoreText.text = `Score: ${this.score}`;

		// if (this.score > 200) {
		// 	this.background.texture = Texture.from("DODGE-BACKGROUND2");
		// }
	}

	private increaseHealth(): void {
		console.log("El jugador recibió curación. +1 de vida");
		if (this.currentHealth < this.maxHealth) {
			this.currentHealth++; // Incrementar la vida si no está al máximo
			this.updateHealthBar(); // Actualizar la barra de vida
		}
	}

	private doSomething(obj: GameObject): void {
		switch (obj.name) {
			case "ENEMY":
				this.decreaseScore(50);
				this.decreseHealth();
				break;
			case "OTHER":
				this.increaseScore(10);
				this.increaseHealth();
				break;
			case "COIN":
				this.collectCoin(50);
				break;
			case "POWER_UP":
				this.activatePowerUp();
				break;
			case "OBSTACLE":
				this.collideWithObstacle();
				break;
			default:
				console.log("that object didn't have a name", obj);
				break;
		}

		const objIndex = this.objects.indexOf(obj);
		this.objects.splice(objIndex, 1);
		this.background.removeChild(obj);
	}

	private collectCoin(amount: number): void {
		console.log("El jugador recogió una moneda. +10 puntos");
		this.increaseScore(amount);
	}

	private activatePowerUp(): void {
		console.log("El jugador activó un power-up. +50 puntos");
		this.score += 50;
		this.player.speed += 0.25;
		new Timer().to(5500).start().onComplete(() => {
			this.player.speed = PLAYER_SPEED;
		})
	}

	private collideWithObstacle(): void {
		console.log("El jugador chocó con un obstáculo.");
		this.player.stopMovement();
		if (this.moveTween != undefined) {
			this.moveTween.pause();
		}
		this.decreseHealth();
	}

	private decreseHealth(): void {
		if (this.currentHealth > 0) { // Verifica si el jugador todavía tiene vida
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
		ScaleHelper.setScaleRelativeToIdeal(this, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}

	private spawnObject(): void {
		const objectType = Random.shared.randomInt(0, 5); // Ahora hay más tipos de objetos
		let object: GameObject;

		switch (objectType) {
			case 0:
				object = new EnemyObject();
				object.name = "ENEMY";
				break;
			case 1:
				object = new NegativeObject();
				object.name = "OTHER";
				break;
			case 2:
				object = new CoinObject();
				object.name = "COIN";
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
				console.error('Error al abrir el popup: no se pudo obtener la instancia de BasePopup.');
			}
		} catch (error) {
			console.error('Error al abrir el popup:', error);
		}
	}


}
