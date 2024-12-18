import { Vector2 } from "@dimforge/rapier2d";
import { Graphics } from "pixi.js";

export class CachoWorldPlayer extends Graphics {
	public id: string;
	public speed: number = 0; // Propiedad adicional ejemplo
	public direction: number = 0; // Dirección de movimiento

	constructor(id: string, x: number, y: number) {
		super();
		this.id = id;
		this.beginFill(0xff0000); // Color rojo
		this.drawRect(-10, -20, 20, 40);
		this.endFill();
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
