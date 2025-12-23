/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Graphics, Container } from "pixi.js";
import { Keyboard } from "../../engine/input/Keyboard"; // Ajusta la ruta

export class TopDownMovementController {
	// Configuración de Movimiento
	public speed: number = 2;
	public dashSpeed: number = 10;
	public dashDuration: number = 200; // ms
	public dashCooldown: number = 1000; // ms

	// Configuración Visual
	public showIndicators: boolean = true;
	public indicatorColor: number = 0xffffff; // Blanco
	public dashReadyColor: number = 0x00ff00; // Verde
	public dashChargingColor: number = 0xffffff; // Blanco/Gris mientras carga

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

	// Componentes Visuales
	private uiContainer: Container;
	private directionArrow: Graphics;
	private dashBar: Graphics;

	// Callbacks
	public onDashStart?: () => void;

	constructor(player: Graphics, walls: Graphics[]) {
		this.player = player;
		this.walls = walls;

		// Inicializar UI
		this.uiContainer = new Container();
		this.directionArrow = new Graphics();
		this.dashBar = new Graphics();

		// Agregamos el contenedor de UI al jugador para que se mueva con él
		this.uiContainer.addChild(this.directionArrow);
		this.uiContainer.addChild(this.dashBar);
		this.player.addChild(this.uiContainer);

		if (this.showIndicators) {
			this.setupDirectionArrow();
		}
	}

	private setupDirectionArrow(): void {
		// Dibujamos un triángulo simple apuntando a la derecha (0 grados)
		// Luego lo rotaremos.
		this.directionArrow.beginFill(this.indicatorColor);
		this.directionArrow.drawPolygon([
			-5,
			-5, // Arriba izquierda
			-5,
			5, // Abajo izquierda
			10,
			0, // Punta derecha
		]);
		this.directionArrow.endFill();

		// Lo alejamos un poco del centro del jugador (radio 20 + margen)
		this.directionArrow.x = 30;
	}

	public update(dt: number): void {
		// --- 1. Lógica de Cooldown ---
		if (!this.canDash) {
			this.cooldownTimer -= dt;
			if (this.cooldownTimer <= 0) {
				this.canDash = true;
				this.cooldownTimer = 0;
			}
		}

		// --- 2. Lógica de Movimiento ---
		if (this.isDashing) {
			this.updateDash(dt);
		} else {
			this.updateWalk(dt);
		}

		// --- 3. Físicas ---
		this.applyMovement();

		// --- 4. Actualización Visual (UI) ---
		if (this.showIndicators) {
			this.updateVisuals();
		}
	}

	private updateVisuals(): void {
		// A. Actualizar Rotación del Indicador de Dirección
		const angle = Math.atan2(this.lastDirection.y, this.lastDirection.x);

		this.directionArrow.x = Math.cos(angle) * 35;
		this.directionArrow.y = Math.sin(angle) * 35;
		this.directionArrow.rotation = angle;

		// B. Actualizar Barra de Dash (Curva abajo)
		this.dashBar.clear();

		const radius = 30;
		const startAngle = Math.PI * 0.25; // 45 grados
		const endAngle = Math.PI * 0.75; // 135 grados
		const totalSpan = endAngle - startAngle;

		// --- CORRECCIÓN MATEMÁTICA ---
		// Calculamos dónde empieza el arco (X, Y) para mover el lápiz ahí primero
		const startX = Math.cos(startAngle) * radius;
		const startY = Math.sin(startAngle) * radius;

		// 1. Dibujar Fondo de la barra
		this.dashBar.lineStyle(4, 0x333333, 0.5);
		this.dashBar.moveTo(startX, startY); // <--- IMPORTANTE: Movemos el lápiz al inicio
		this.dashBar.arc(0, 0, radius, startAngle, endAngle);

		// 2. Calcular progreso
		let progress = 0;
		let color = this.dashChargingColor;

		if (this.canDash) {
			progress = 1;
			color = this.dashReadyColor;
		} else {
			progress = 1 - this.cooldownTimer / this.dashCooldown;
			color = this.dashChargingColor;
		}

		// 3. Dibujar Barra de progreso encima
		if (progress > 0) {
			const currentEndAngle = startAngle + totalSpan * progress;

			this.dashBar.lineStyle(4, color, 1);
			this.dashBar.moveTo(startX, startY); // <--- IMPORTANTE: Volvemos a mover el lápiz al inicio
			this.dashBar.arc(0, 0, radius, startAngle, currentEndAngle);
		}
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

		if (dx !== 0 && dy !== 0) {
			const length = Math.sqrt(dx * dx + dy * dy);
			dx /= length;
			dy /= length;
		}

		if (dx !== 0 || dy !== 0) {
			this.lastDirection = { x: dx, y: dy };
		}

		this.velocity.x = dx * this.speed;
		this.velocity.y = dy * this.speed;

		if (Keyboard.shared.justPressed("Space") && this.canDash && (dx !== 0 || dy !== 0)) {
			this.startDash();
		}
	}

	private startDash(): void {
		this.isDashing = true;
		this.canDash = false;
		this.dashTimer = this.dashDuration;
		this.cooldownTimer = this.dashCooldown;

		this.velocity.x = this.lastDirection.x * this.dashSpeed;
		this.velocity.y = this.lastDirection.y * this.dashSpeed;

		if (this.onDashStart) {
			this.onDashStart();
		}
	}

	private updateDash(dt: number): void {
		this.dashTimer -= dt;
		if (this.dashTimer <= 0) {
			this.isDashing = false;
			this.velocity.x = 0;
			this.velocity.y = 0;
		}
	}

	private applyMovement(): void {
		if (this.velocity.x === 0 && this.velocity.y === 0) {
			return;
		}

		const nextX = this.player.x + this.velocity.x;
		const nextY = this.player.y + this.velocity.y;

		if (!this.checkCollision(nextX, nextY)) {
			this.player.x = nextX;
			this.player.y = nextY;
		} else {
			if (!this.checkCollision(nextX, this.player.y)) {
				this.player.x = nextX;
			} else if (!this.checkCollision(this.player.x, nextY)) {
				this.player.y = nextY;
			}
		}
	}

	private checkCollision(x: number, y: number): boolean {
		const radius = 20;

		for (const wall of this.walls) {
			const wX = wall.x;
			const wY = wall.y;
			const wW = (wall as any).widthRect || 0;
			const wH = (wall as any).heightRect || 0;

			if (x + radius > wX && x - radius < wX + wW && y + radius > wY && y - radius < wY + wH) {
				return true;
			}
		}
		return false;
	}
}
