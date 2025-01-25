import { Emitter, upgradeConfig } from "@pixi/particle-emitter";
import bubbleParticle from "./emitter.json";
import type { Container } from "pixi.js";
import { Texture } from "pixi.js";

export class BubbleEmitter {
	private emitter: Emitter;

	constructor(particleContainer: Container) {
		// Cargar la textura para las partículas
		const texture = Texture.from("bubbleParticle");
		// Actualizar la configuración del emisor con la textura
		const config = upgradeConfig(bubbleParticle, [texture]);

		// Crear el emisor de partículas
		this.emitter = new Emitter(particleContainer, config);
	}

	// Iniciar la emisión de partículas
	public start(): void {
		this.emitter.emit = true;
	}

	// Detener la emisión de partículas
	public stop(): void {
		this.emitter.emit = false;
	}

	// Actualizar el emisor de partículas con el deltaTime
	public update(dt: number): void {
		this.emitter.update(dt * 0.001); // Convertir el tiempo a segundos
	}

	// Actualizar la posición del emisor para que siga a la burbuja
	// Actualizar la posición del emisor para que siga a la burbuja
	public updateOwnerPos(x: number, y: number): void {
		this.emitter.updateOwnerPos(x, y); // Usar updateOwnerPos en lugar de acceder a ownerPos directamente
	}
}
