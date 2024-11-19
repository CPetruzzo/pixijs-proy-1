import { Sprite } from "pixi.js";
import type { Node } from "./Node";
import { GameConfig } from "../game/GameConfig";

export class Enemy {
	public sprite: Sprite;
	public currentStep: number = 0;
	public health: number;
	public dead: boolean = false;

	private isShaking: boolean = false;
	private shakeCount: number = 0;
	private maxShakes: number = 6;
	private shakeIntensity: number = 5;
	private originalX: number = 0;
	private originalY: number = 0;
	private originalTint: any = 0;
	private randomIndex: number;

	constructor(public x: number, public y: number, public path: Node[], tileSize: number, typeIndex: number = 0) {
		this.randomIndex = typeIndex;
		const randomSprite = GameConfig.enemyConfig.sprites[this.randomIndex];
		this.sprite = Sprite.from(randomSprite);
		this.sprite.tint = GameConfig.colors.enemy;
		this.sprite.width = tileSize;
		this.sprite.height = tileSize;

		this.sprite.x = x * tileSize;
		this.sprite.y = y * tileSize;

		this.health = GameConfig.enemyConfig.health[this.randomIndex];
	}

	public update(): void {
		// Verificar si el sprite existe antes de procesar
		if (!this.sprite || this.dead) {
			return;
		}

		// Movimiento del enemigo
		if (this.currentStep < this.path.length) {
			const targetNode = this.path[this.currentStep];
			const targetX = targetNode.x * this.sprite.width;
			const targetY = targetNode.y * this.sprite.height;

			const dx = targetX - this.sprite.x;
			const dy = targetY - this.sprite.y;

			this.sprite.x += dx * 0.05;
			this.sprite.y += dy * 0.05;

			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
				this.currentStep++;
			}
		}

		if (this.isShaking) {
			this.applyShakeEffect();
		}
	}

	public takeDamage(amount: number): void {
		if (this.dead) {
			return;
		}
		this.health -= amount;

		if (!this.isShaking) {
			this.startShakeEffect();
		}

		if (this.health <= 0) {
			this.die();
		}
	}

	private die(): void {
		this.dead = true;
		this.sprite.destroy();
	}

	private startShakeEffect(): void {
		this.isShaking = true;
		this.shakeCount = 0;
		this.originalX = this.sprite.x;
		this.originalY = this.sprite.y;
		this.originalTint = this.sprite.tint;
		this.sprite.tint = 0xff0000;
	}

	private applyShakeEffect(): void {
		if (this.shakeCount < this.maxShakes) {
			// Alterar la posición para crear el efecto de vibración
			this.sprite.x = this.originalX + (Math.random() - 0.5) * this.shakeIntensity;
			this.sprite.y = this.originalY + (Math.random() - 0.5) * this.shakeIntensity;
			this.shakeCount++;
		} else {
			// Restaurar la posición y el color original
			this.sprite.x = this.originalX;
			this.sprite.y = this.originalY;
			this.sprite.tint = this.originalTint;

			// Detener el efecto
			this.isShaking = false;
		}
	}

	public isDefeated(): boolean {
		return this.health <= 0;
	}

	public getEnemyIndex(): number {
		return this.randomIndex;
	}
}
