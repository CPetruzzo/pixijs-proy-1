/* eslint-disable @typescript-eslint/restrict-plus-operands */
import type { Graphics } from "pixi.js";
import { Keyboard } from "../../engine/input/Keyboard"; // Ajusta la ruta

export class TopDownMovementController {
	// Configuración
	public speed: number = 5;
	public dashSpeed: number = 15;
	public dashDuration: number = 200; // ms
	public dashCooldown: number = 1000; // ms

	// Estado interno
	private player: Graphics;
	private walls: Graphics[];
	private velocity: { x: number; y: number } = { x: 0, y: 0 };
	private lastDirection: { x: number; y: number } = { x: 0, y: 1 }; // Por defecto mirando abajo

	// Estado del Dash
	private isDashing: boolean = false;
	private canDash: boolean = true;
	private dashTimer: number = 0;
	private cooldownTimer: number = 0;

	// Callbacks para efectos visuales (opcional)
	public onDashStart?: () => void;

	constructor(player: Graphics, walls: Graphics[]) {
		this.player = player;
		this.walls = walls;
	}

	public update(dt: number): void {
		// Manejo de Tiempos (Cooldowns)
		if (!this.canDash) {
			this.cooldownTimer -= dt;
			if (this.cooldownTimer <= 0) {
				this.canDash = true;
			}
		}

		// 1. Lógica de DASH
		if (this.isDashing) {
			this.updateDash(dt);
		} else {
			this.updateWalk(dt);
		}

		// 2. Aplicar Movimiento con Colisiones
		this.applyMovement();
	}

	private updateWalk(_dt: number): void {
		let dx = 0;
		let dy = 0;

		if (Keyboard.shared.isDown("KeyW")) {
			dy = -1;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			dy = 1;
		}
		if (Keyboard.shared.isDown("KeyA")) {
			dx = -1;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			dx = 1;
		}

		// Normalizar vector si se mueve en diagonal (para que no corra más rápido)
		if (dx !== 0 && dy !== 0) {
			const length = Math.sqrt(dx * dx + dy * dy);
			dx /= length;
			dy /= length;
		}

		// Guardar última dirección para saber a dónde dashear si estamos quietos
		if (dx !== 0 || dy !== 0) {
			this.lastDirection = { x: dx, y: dy };
		}

		// Asignar velocidad normal
		this.velocity.x = dx * this.speed;
		this.velocity.y = dy * this.speed;

		// ACTIVAR DASH
		if (Keyboard.shared.justPressed("Space") && this.canDash && (dx !== 0 || dy !== 0)) {
			this.startDash();
		}
	}

	private startDash(): void {
		this.isDashing = true;
		this.canDash = false;
		this.dashTimer = this.dashDuration;
		this.cooldownTimer = this.dashCooldown;

		// La velocidad del dash es fija en la dirección actual
		// Usamos lastDirection para asegurar que haya dirección,
		// aunque la condición (dx!=0 || dy!=0) arriba asegura que nos movemos.
		this.velocity.x = this.lastDirection.x * this.dashSpeed;
		this.velocity.y = this.lastDirection.y * this.dashSpeed;

		if (this.onDashStart) {
			this.onDashStart();
		}
	}

	private updateDash(dt: number): void {
		this.dashTimer -= dt;

		// Durante el dash, ignoramos el input de WASD,
		// la velocidad se mantiene constante (inercia)

		if (this.dashTimer <= 0) {
			this.isDashing = false;
			this.velocity.x = 0;
			this.velocity.y = 0;
		}
	}

	private applyMovement(): void {
		// Si no hay velocidad, no calculamos colisiones
		if (this.velocity.x === 0 && this.velocity.y === 0) {
			return;
		}

		const nextX = this.player.x + this.velocity.x;
		const nextY = this.player.y + this.velocity.y;

		// Verificación de colisión en ejes separados para permitir "deslizarse" por las paredes
		if (!this.checkCollision(nextX, nextY)) {
			this.player.x = nextX;
			this.player.y = nextY;
		} else {
			// Intento mover solo en X
			if (!this.checkCollision(nextX, this.player.y)) {
				this.player.x = nextX;
			}
			// Intento mover solo en Y
			else if (!this.checkCollision(this.player.x, nextY)) {
				this.player.y = nextY;
			}
		}
	}

	private checkCollision(x: number, y: number): boolean {
		const radius = 20; // Radio del jugador (hardcodeado según tu código original)

		for (const wall of this.walls) {
			const wX = wall.x;
			const wY = wall.y;
			// Asumimos que guardaste widthRect/heightRect en el objeto como en tu escena original
			const wW = (wall as any).widthRect || 0;
			const wH = (wall as any).heightRect || 0;

			if (x + radius > wX && x - radius < wX + wW && y + radius > wY && y - radius < wY + wH) {
				return true;
			}
		}
		return false;
	}
}
