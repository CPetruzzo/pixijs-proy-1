import type { FederatedPointerEvent } from "pixi.js";
import { Container, Graphics } from "pixi.js";

export class VirtualJoystick extends Container {
	// Gráficos para el fondo (base) y el knob (puntero)
	private base: Graphics;
	private knob: Graphics;

	// Radio máximo (distancia máxima que el knob se mueve desde el centro)
	public maxRadius: number;
	// Dirección calculada (vector normalizado en el rango [-1,1])
	public direction: { x: number; y: number } = { x: 0, y: 0 };
	// Bandera para saber si está activo (se está usando)
	public active: boolean = false;

	constructor(maxRadius: number = 50) {
		super();
		this.maxRadius = maxRadius;

		// Creamos el gráfico de la base (fondo circular)
		this.base = new Graphics();
		this.base.beginFill(0x888888, 0.5);
		this.base.drawCircle(0, 0, this.maxRadius);
		this.base.endFill();
		this.addChild(this.base);

		// Creamos el knob (círculo interior)
		this.knob = new Graphics();
		this.knob.beginFill(0xffffff, 0.8);
		this.knob.drawCircle(0, 0, this.maxRadius / 2);
		this.knob.endFill();
		this.knob.x = 0;
		this.knob.y = 0;
		this.addChild(this.knob);

		// Hacemos este contenedor interactivo
		this.interactive = true;
		this.on("pointerdown", this.onPointerDown, this);
		this.on("pointermove", this.onPointerMove, this);
		this.on("pointerup", this.onPointerUp, this);
		this.on("pointerupoutside", this.onPointerUp, this);

		// Inicialmente lo dejamos oculto
		this.visible = true;
	}

	private onPointerDown(event: FederatedPointerEvent): void {
		// Al tocar la pantalla, anclamos el joystick en esa posición.
		const pos = event.data.getLocalPosition(this.parent);
		this.position.set(pos.x, pos.y);
		this.visible = true;
		this.active = true;
		this.knob.position.set(0, 0);
		this.direction = { x: 0, y: 0 };
	}

	private onPointerMove(event: FederatedPointerEvent): void {
		if (!this.active) {
			return;
		}
		// Obtenemos la posición actual del puntero respecto al centro del joystick
		const pos = event.data.getLocalPosition(this);
		const dx = pos.x;
		const dy = pos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		let clampedX = dx;
		let clampedY = dy;
		if (dist > this.maxRadius) {
			// Limitar el knob dentro del radio máximo
			const angle = Math.atan2(dy, dx);
			clampedX = Math.cos(angle) * this.maxRadius;
			clampedY = Math.sin(angle) * this.maxRadius;
		}
		this.knob.position.set(clampedX, clampedY);
		// Calcular la dirección normalizada
		this.direction = {
			x: clampedX / this.maxRadius,
			y: clampedY / this.maxRadius,
		};
	}

	private onPointerUp(_event: FederatedPointerEvent): void {
		// Al soltar, desactivamos el joystick y lo ocultamos
		this.active = false;
		this.visible = true;
		this.knob.position.set(0, 0);
		this.direction = { x: 0, y: 0 };
	}
}
