import { Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class HookGameScene extends PixiScene {
	private player: Graphics;
	private rope: Graphics;
	private background: Graphics;
	private platforms: Graphics[] = [];

	// Posición y velocidad del jugador
	private playerPos: { x: number; y: number };
	private playerVel: { x: number; y: number };

	// Sistema de gancho
	private hookPoint: { x: number; y: number } | null = null;
	private ropeLength: number = 0;

	// Física
	private readonly gravity = 0.01;
	private readonly airDrag = 0.995; // aplica a ambas componentes
	private readonly swingDamping = 0.998; // damping cuando está enganchado
	private isRetractingRope: boolean = false;

	// Parámetros
	private readonly retractSpeed = 3.5; // unidades por frame (ajustá)
	private readonly minRopeLength = 40;
	private readonly stageWidth = 800;
	private readonly stageHeight = 600;

	constructor() {
		super();

		this.playerPos = { x: 400, y: 300 };
		this.playerVel = { x: 0, y: 0 };

		this.background = new Graphics();
		this.background.beginFill(0x000000, 0.01);
		this.background.drawRect(0, 0, 2000, 2000);
		this.background.endFill();
		this.background.interactive = true;
		this.background.on("pointerdown", this.handleClick, this);
		// importante: capturar pointerup fuera del objeto también
		this.background.on("pointerup", this.releaseHook, this);
		this.background.on("pointerupoutside", this.releaseHook, this);
		this.addChild(this.background);

		this.createPlatforms();

		this.rope = new Graphics();
		this.addChild(this.rope);

		this.player = new Graphics();
		this.player.beginFill(0xff0000);
		this.player.drawCircle(0, 0, 15);
		this.player.endFill();
		this.player.x = this.playerPos.x;
		this.player.y = this.playerPos.y;
		this.addChild(this.player);

		// también en la escena por si soltás fuera del background
		this.interactive = true;
		this.on("pointerup", this.releaseHook, this);
		this.on("pointerupoutside", this.releaseHook, this);

		window.addEventListener("keydown", this.handleKeyDown.bind(this));
		window.addEventListener("keyup", this.handleKeyUp.bind(this));
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (event.key === "e" || event.key === "E") {
			this.isRetractingRope = true;
		}
	}

	private handleKeyUp(event: KeyboardEvent): void {
		if (event.key === "e" || event.key === "E") {
			this.isRetractingRope = false;
		}
	}

	private createPlatforms(): void {
		const platformData = [
			{ x: 200, y: 150, w: 100, h: 20 },
			{ x: 500, y: 200, w: 120, h: 20 },
			{ x: 300, y: 400, w: 150, h: 20 },
			{ x: 600, y: 350, w: 100, h: 20 },
			{ x: 100, y: 500, w: 200, h: 20 },
			{ x: 700, y: 500, w: 100, h: 20 },
		];

		platformData.forEach((data) => {
			const platform = new Graphics();
			platform.beginFill(0x666666);
			platform.drawRect(data.x, data.y, data.w, data.h);
			platform.endFill();
			this.addChild(platform);
			this.platforms.push(platform);
		});
	}

	private handleClick(event: any): void {
		const mousePos = event.data.global;
		this.hookPoint = { x: mousePos.x, y: mousePos.y };

		const dx = this.hookPoint.x - this.playerPos.x;
		const dy = this.hookPoint.y - this.playerPos.y;
		this.ropeLength = Math.sqrt(dx * dx + dy * dy);

		// Convertimos la velocidad actual a la componente TANGENCIAL
		// para mantener el momentum al engancharse.
		// Vector radial (desde hook hacia player):
		const currentDistance = Math.sqrt(dx * dx + dy * dy) || 1;
		const nx = dx / currentDistance;
		const ny = dy / currentDistance;
		// Vector tangencial (perpendicular): t = (-ny, nx)
		const tx = -ny;
		const ty = nx;
		const tangentialSpeed = this.playerVel.x * tx + this.playerVel.y * ty;
		this.playerVel.x = tangentialSpeed * tx;
		this.playerVel.y = tangentialSpeed * ty;
	}

	private releaseHook(): void {
		if (this.hookPoint) {
			// Simplemente liberamos el hook. Dejamos la velocidad tal cual (conserva tangencial)
			this.hookPoint = null;
			// asegurate que la física siguiente aplique gravedad y arrastre
			// (no setear playerVel.y = 0 u otra cosa)
		}
	}

	public override update(_dt: number): void {
		// _dt puede ser deltaTicker (1 por frame) o ms según tu ticker.
		// Para estabilidad simple, tratamos dt como múltiplo de frames:
		const dt = Math.max(0.016 * _dt, 0.016); // base ~0.016s

		if (this.hookPoint) {
			// Retracción de cuerda si se mantiene la tecla
			if (this.isRetractingRope) {
				this.ropeLength = Math.max(this.minRopeLength, this.ropeLength - this.retractSpeed * (dt * 60));
				// Si re-trajimos la cuerda, forzamos la posición a la nueva longitud
				const dx = this.playerPos.x - this.hookPoint.x;
				const dy = this.playerPos.y - this.hookPoint.y;
				const dist = Math.sqrt(dx * dx + dy * dy) || 1;
				const nx = dx / dist;
				const ny = dy / dist;
				this.playerPos.x = this.hookPoint.x + nx * this.ropeLength;
				this.playerPos.y = this.hookPoint.y + ny * this.ropeLength;
				// conservamos componente tangencial de la velocidad
				const tx = -ny;
				const ty = nx;
				const tangentialSpeed = this.playerVel.x * tx + this.playerVel.y * ty;
				this.playerVel.x = tangentialSpeed * tx;
				this.playerVel.y = tangentialSpeed * ty;
			}

			// gravedad aplicada a la velocidad
			this.playerVel.y += this.gravity * (dt * 60);

			// actualizar posición tentativa
			this.playerPos.x += this.playerVel.x * (dt * 60);
			this.playerPos.y += this.playerVel.y * (dt * 60);

			// Constraint: mantener la distancia de la cuerda
			const dx = this.playerPos.x - this.hookPoint.x;
			const dy = this.playerPos.y - this.hookPoint.y;
			const currentDistance = Math.sqrt(dx * dx + dy * dy) || 0.0001;

			if (currentDistance > this.ropeLength) {
				const nx = dx / currentDistance;
				const ny = dy / currentDistance;

				// Ajustar posición a la longitud exacta de la cuerda
				this.playerPos.x = this.hookPoint.x + nx * this.ropeLength;
				this.playerPos.y = this.hookPoint.y + ny * this.ropeLength;

				// Velocidad radial (componente hacia afuera/in)
				const radialVel = this.playerVel.x * nx + this.playerVel.y * ny;

				// Eliminamos la componente radial hacia afuera (si existe)
				// Esto mantiene la componente tangencial (swing).
				if (radialVel > 0) {
					this.playerVel.x -= radialVel * nx;
					this.playerVel.y -= radialVel * ny;
				}

				// Damping para simular fricción
				this.playerVel.x *= this.swingDamping;
				this.playerVel.y *= this.swingDamping;
			}
		} else {
			// caída libre cuando no está enganchado
			this.playerVel.y += this.gravity * (dt * 60);
			// aplicar arrastre a ambas componentes para comportamiento realista al soltarse
			this.playerVel.x *= this.airDrag;
			this.playerVel.y *= this.airDrag;

			this.playerPos.x += this.playerVel.x * (dt * 60);
			this.playerPos.y += this.playerVel.y * (dt * 60);

			// Límites de pantalla (suelo)
			if (this.playerPos.y > this.stageHeight - 20) {
				this.playerPos.y = this.stageHeight - 20;
				this.playerVel.y *= -0.45; // rebote más suave
				this.playerVel.x *= 0.8;
			}

			// Límites horizontales
			if (this.playerPos.x < 15) {
				this.playerPos.x = 15;
				this.playerVel.x *= -0.5;
			}
			if (this.playerPos.x > this.stageWidth - 15) {
				this.playerPos.x = this.stageWidth - 15;
				this.playerVel.x *= -0.5;
			}
		}

		// actualizar sprite
		this.player.x = this.playerPos.x;
		this.player.y = this.playerPos.y;

		// dibujar cuerda
		this.rope.clear();
		if (this.hookPoint) {
			this.rope.lineStyle(3, 0xffffff);
			this.rope.moveTo(this.hookPoint.x, this.hookPoint.y);
			this.rope.lineTo(this.playerPos.x, this.playerPos.y);

			this.rope.beginFill(0xffff00);
			this.rope.drawCircle(this.hookPoint.x, this.hookPoint.y, 5);
			this.rope.endFill();
		}
	}
}
