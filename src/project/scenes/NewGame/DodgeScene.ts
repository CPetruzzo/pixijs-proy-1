import { Graphics, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { ObjectToDodge } from "./ObjectToDodge";
import Random from "../../../engine/random/Random";
import { Tween } from "tweedle.js";
import { NegativeObjectToDodge } from "./NegativeObjectToDodge";

export class DodgeScene extends PixiScene {
	private enemies: ObjectToDodge[] = [];
	private timeSinceLastEnemy: number = 0;
	private spawnInterval: number = Random.shared.randomInt(500, 1500);
	private background: Graphics;
	private player: Graphics;
	private scoreText: Text; // Nuevo: texto para mostrar el puntaje
	private score: number = 0;

	private negatives: NegativeObjectToDodge[] = [];
	private timeSinceLastNegative: number = 0;
	private negativeSpawnInterval: number = Random.shared.randomInt(1000, 2000); // Intervalo para los objetos negativos

	constructor() {
		super();

		this.background = new Graphics();
		this.background.beginFill(0x00fff, 0.5);
		this.background.drawRect(0, 0, 600, 900);
		this.background.endFill();
		this.background.pivot.set(this.background.width * 0.5, this.background.height * 0.5);
		this.addChild(this.background);

		this.player = new Graphics();
		this.player.beginFill(0xff0000);
		this.player.drawRect(0, -20, 40, 40);
		this.player.endFill();
		this.player.y = this.background.height - this.player.height * 0.5;
		this.background.addChild(this.player);

		this.scoreText = new Text(`Score: ${this.score}`, { fontSize: 24, fill: 0xffffff });
		this.scoreText.anchor.set(0.5);
		this.scoreText.position.set(0, -this.background.height * 0.5);
		this.addChild(this.scoreText);

		this.background.eventMode = "static";
		this.background.on("pointertap", this.onMouseMove, this);
	}

	private onMouseMove(event: any): void {
		const globalMousePosition = this.background.toLocal(event.data.global);
		const targetX = globalMousePosition.x - this.player.width * 0.5;
		const distance = Math.abs(targetX - this.player.x); // Distancia de movimiento
		const speed = 0.3; // Velocidad constante en píxeles por milisegundo
		const duration = distance / speed; // Duración basada en la distancia y la velocidad

		new Tween(this.player).to({ x: targetX }, duration).start();
	}

	public override update(dt: number): void {
		this.timeSinceLastEnemy += dt;

		if (this.timeSinceLastEnemy >= this.spawnInterval) {
			this.timeSinceLastEnemy = 0;

			const enemy = new ObjectToDodge();
			enemy.name = "enemy";
			enemy.x = Random.shared.randomInt(0, this.background.width);
			this.enemies.push(enemy);
			this.background.addChild(enemy);

			this.spawnInterval = Random.shared.randomInt(500, 1500);
		}

		this.enemies.forEach((enemy) => {
			enemy.y += 0.5 * dt;

			if (enemy.y >= this.background.height * 0.99) {
				const enemyIndex = this.enemies.indexOf(enemy);
				this.enemies.splice(enemyIndex, 1);
				this.background.removeChild(enemy);
			} else if (this.checkCollision(this.player, enemy)) {
				const enemyIndex = this.enemies.indexOf(enemy);
				this.enemies.splice(enemyIndex, 1);
				this.background.removeChild(enemy);
				this.decreaseScore(); // Reducir puntaje al chocar con un enemigo
			}
		});

		this.timeSinceLastNegative += dt;

		if (this.timeSinceLastNegative >= this.negativeSpawnInterval) {
			this.timeSinceLastNegative = 0;

			const negative = new NegativeObjectToDodge();
			negative.name = "negative";
			negative.x = Random.shared.randomInt(0, this.background.width);
			this.negatives.push(negative);
			this.background.addChild(negative);

			this.negativeSpawnInterval = Random.shared.randomInt(1000, 2000); // Actualiza el intervalo para el próximo objeto negativo
		}

		this.negatives.forEach((negative) => {
			negative.y += 0.3 * dt;

			if (negative.y >= this.background.height * 0.98) {
				const negativeIndex = this.negatives.indexOf(negative);
				this.negatives.splice(negativeIndex, 1);
				this.background.removeChild(negative);
			} else if (this.checkCollision(this.player, negative)) {
				const negativeIndex = this.negatives.indexOf(negative);
				this.negatives.splice(negativeIndex, 1);
				this.background.removeChild(negative);
				this.increaseScore(); // Objeto negativo, restar puntos
			}
		});

		this.scoreText.text = `Score: ${this.score}`;
	}

	private decreaseScore(): void {
		if (this.score > 0) {
			this.score -= 10; // Reducir el puntaje en 10 puntos
		}
	}
	private increaseScore(): void {
		this.score += 10;
	}

	private checkCollision(player: Graphics, enemy: ObjectToDodge): boolean {
		const playerBounds = player.getBounds();
		const enemyBounds = enemy.getBounds();

		return (
			playerBounds.x + playerBounds.width > enemyBounds.x &&
			playerBounds.x < enemyBounds.x + enemyBounds.width &&
			playerBounds.y + playerBounds.height > enemyBounds.y &&
			playerBounds.y < enemyBounds.y + enemyBounds.height
		);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this, newW, newH);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
