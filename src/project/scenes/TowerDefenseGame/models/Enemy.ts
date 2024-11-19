import { Sprite } from "pixi.js";
import { Node } from "./Node";
import { GameConfig } from "../game/GameConfig";

export class Enemy {
	public sprite: Sprite;
	public currentStep: number = 0;
	public health: number;
	public dead: boolean = false;

	private isShaking: boolean = false; // Bandera para efecto de vibración
	private shakeCount: number = 0;
	private maxShakes: number = 6;
	private shakeIntensity: number = 5;
	private originalX: number = 0;
	private originalY: number = 0;
	private originalTint: any = 0;

	constructor(public x: number, public y: number, public path: Node[], tileSize: number) {
		this.sprite = Sprite.from("enemy"); // Usa Texture.WHITE como textura base
		this.sprite.tint = GameConfig.colors.enemy;
		this.sprite.width = tileSize;
		this.sprite.height = tileSize;

		this.sprite.x = x * tileSize;
		this.sprite.y = y * tileSize;

		this.health = GameConfig.enemyConfig.health;
	}

	public update(): void {
		// Verificar si el sprite existe antes de procesar
		if (!this.sprite || this.dead) {
			return; // Salir del método si el sprite no está disponible
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

		// Manejar efecto de vibración
		if (this.isShaking) {
			this.applyShakeEffect();
		}
	}

	// Método para aplicar daño con efectos visuales
	public takeDamage(amount: number): void {
		if (this.dead) {
			return;
		}
		this.health -= amount;

		// Inicia el efecto de vibración si no está activo
		if (!this.isShaking) {
			this.startShakeEffect();
		}

		if (this.health <= 0) {
			this.die();
		}
	}

	// Método para manejar la muerte del enemigo
	private die(): void {
		this.dead = true;
		this.sprite.destroy();
	}

	// Inicializa el efecto de vibración
	private startShakeEffect(): void {
		this.isShaking = true;
		this.shakeCount = 0;
		this.originalX = this.sprite.x;
		this.originalY = this.sprite.y;
		this.originalTint = this.sprite.tint;
		this.sprite.tint = 0xff0000; // Cambiar a rojo al recibir daño
	}

	// Aplica el efecto de vibración en cada cuadro
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
}
