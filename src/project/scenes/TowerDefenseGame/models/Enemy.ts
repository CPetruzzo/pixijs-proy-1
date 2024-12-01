import { Graphics, Sprite } from "pixi.js";
import type { Node } from "./Node";
import { GameConfig } from "../game/GameConfig";

export class Enemy {
	public sprite: Sprite;
	public currentStep: number = 0;
	public health: number;
	public dead: boolean = false;
	private healthBar: Graphics; // Barra de vida
	private healthBarWidth: number = 80; // Ancho inicial de la barra de vida
	private healthBarHeight: number = 10; // Alto de la barra de vida

	private isShaking: boolean = false;
	private shakeCount: number = 0;
	private maxShakes: number = 6;
	private shakeIntensity: number = 5;
	private originalX: number = 0;
	private originalY: number = 0;
	private originalTint: any = 0;
	private enemyIndex: number;

	constructor(public posX: number, public posY: number, public path: Node[], tileSize: number, typeIndex: number = 0) {
		this.enemyIndex = typeIndex;
		const randomSprite = GameConfig.enemyConfig.sprites[this.enemyIndex];
		this.sprite = Sprite.from(randomSprite);
		this.sprite.tint = GameConfig.colors.enemy;
		this.sprite.width = tileSize;
		this.sprite.height = tileSize;

		this.sprite.x = posX * tileSize;
		this.sprite.y = posY * tileSize;

		this.health = GameConfig.enemyConfig.health[this.enemyIndex];

		// Crear barra de vida
		this.healthBar = new Graphics();
		this.updateHealthBar();
		this.sprite.addChild(this.healthBar); // Añadir la barra al sprite del enemigo
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

		// Actualizar la posición de la barra de vida
		this.healthBar.x = this.sprite.width;
		this.healthBar.y = 10; // Posicionar justo encima del enemigo
	}

	public takeDamage(amount: number): void {
		if (this.dead) {
			return;
		}
		this.health -= amount;

		this.updateHealthBar();

		if (!this.isShaking) {
			this.startShakeEffect();
		}

		if (this.health <= 0) {
			this.die();
		}
	}

	private updateHealthBar(): void {
		this.healthBar.clear();
		this.healthBar.beginFill(0xff0000); // Fondo rojo
		this.healthBar.drawRect(0, 0, this.healthBarWidth, this.healthBarHeight);
		this.healthBar.endFill();

		const healthPercentage = Math.max(this.health / GameConfig.enemyConfig.health[this.enemyIndex], 0);
		this.healthBar.beginFill(0x00ff00); // Barra verde
		this.healthBar.drawRect(0, 0, this.healthBarWidth * healthPercentage, this.healthBarHeight);
		this.healthBar.endFill();
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
		return this.enemyIndex;
	}

	public getCurrentPosition(): { x: number; y: number } {
		return { x: this.path[this.currentStep].x, y: this.path[this.currentStep].y }; // Ajusta según la implementación de coordenadas en Enemy
	}

}
