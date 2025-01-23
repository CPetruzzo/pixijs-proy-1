import { Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class HookGameScene extends PixiScene {
	private anchor: { x: number; y: number };
	private circle: Graphics;
	private rope: Graphics;
	private hookAngle: number;
	private angularVelocity: number;
	private isSwinging: boolean;
	private maxAngle: number;
	private gravity: number;
	private clickArea: Graphics;

	constructor() {
		super();
		this.anchor = { x: 400, y: 100 }; // Punto de anclaje en el centro superior
		this.hookAngle = 0; // Ángulo inicial
		this.angularVelocity = 0; // Velocidad angular inicial
		this.isSwinging = false; // Indicador de columpio activo
		this.maxAngle = Math.PI / 6; // Máximo ángulo (30°)
		this.gravity = 0.05; // Gravedad

		this.circle = new Graphics();
		this.rope = new Graphics();
		this.clickArea = new Graphics();

		// Dibujar el círculo (personaje)
		this.circle.beginFill(0xff0000);
		this.circle.drawCircle(0, 0, 20);
		this.circle.endFill();
		this.circle.x = this.anchor.x;
		this.circle.y = this.anchor.y + 400; // Posición inicial
		this.addChild(this.circle);

		// Dibujar la cuerda
		this.addChild(this.rope);

		// Dibujar el área clickeable
		this.clickArea.beginFill(0xffffff, 0.5); // Blanco semi-transparente
		this.clickArea.drawRect(300, 300, 200, 200); // Rectángulo en posición (300, 300) de 200x200 px
		this.clickArea.endFill();
		this.clickArea.interactive = true;
		this.clickArea.on("pointerdown", this.handlePointerDown, this);
		this.addChild(this.clickArea);

		// Configurar interacción del mouse
		this.interactive = true;
		this.on("pointerup", this.handlePointerUp, this);
	}

	private handlePointerDown(event: any): void {
		const mousePos = event.data.global;
		const dx = mousePos.x - this.anchor.x;
		const dy = mousePos.y - this.anchor.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance < 300) {
			// Permitir engancharse solo si está dentro de un rango
			this.isSwinging = true;
			this.angularVelocity = 0.1; // Darle un empujón inicial
		}
	}

	private handlePointerUp(): void {
		this.isSwinging = false;
		// Calcular la velocidad al soltar
		this.angularVelocity *= 0.8; // Reducir velocidad para simular fricción
	}

	public override update(_dt: number): void {
		if (this.isSwinging) {
			// Simular el columpio
			const force = -this.gravity * Math.sin(this.hookAngle); // Fuerza pendular
			this.angularVelocity += force; // Actualizar velocidad angular
			this.angularVelocity *= 0.99; // Fricción
			this.hookAngle += this.angularVelocity;

			// Limitar el ángulo
			if (this.hookAngle > this.maxAngle) {
				this.hookAngle = this.maxAngle;
				this.angularVelocity *= -0.8; // Rebote en los extremos
			} else if (this.hookAngle < -this.maxAngle) {
				this.hookAngle = -this.maxAngle;
				this.angularVelocity *= -0.8;
			}
		}

		// Calcular la posición del círculo
		this.circle.x = this.anchor.x + Math.sin(this.hookAngle) * 200;
		this.circle.y = this.anchor.y + Math.cos(this.hookAngle) * 200;

		// Dibujar la cuerda
		this.rope.clear();
		this.rope.lineStyle(2, 0xffffff);
		this.rope.moveTo(this.anchor.x, this.anchor.y);
		this.rope.lineTo(this.circle.x, this.circle.y);
	}
}
