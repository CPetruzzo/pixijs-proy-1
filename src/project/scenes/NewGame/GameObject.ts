import { Graphics } from "pixi.js";

export abstract class GameObject extends Graphics {
	protected constructor() {
		super();
		this.interactive = true; // Para detectar eventos
	}

	// Método abstracto para actualizar el objeto
	public abstract update(dt: number): void;

	// Método abstracto para manejar eventos como el clic
	public abstract handleEvent(): void;
}
