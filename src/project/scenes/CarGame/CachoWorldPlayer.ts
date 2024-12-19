import { Vector2 } from "@dimforge/rapier2d";
import { Sprite } from "pixi.js";

export class CachoWorldPlayer extends Sprite {
	public id: string;
	public speed: number = 0; // Propiedad adicional ejemplo
	public direction: number = 0; // Dirección de movimiento

	constructor(id: string, x: number, y: number) {
		super(Sprite.from("viking").texture);
		this.id = id;
		this.scale.set(0.3);
		this.anchor.set(0.5); // Configura el punto de anclaje al centro
		this.x = x;
		this.y = y;
	}

	public shootHim(charge: { x: number; y: number }): void {
		const force = new Vector2(charge.x * 10, charge.y * 10);
		console.log(`Force applied: (${force.x}, ${force.y})`);
		// Aquí puedes integrar lógica para aplicar la fuerza en el sistema de físicas
		this.x += force.x;
		this.y += force.y;
	}

	public move(speed: number, angle: number): void {
		const dx = speed * Math.cos(angle);
		const dy = speed * Math.sin(angle);
		this.x += dx;
		this.y += dy;
	}
}
