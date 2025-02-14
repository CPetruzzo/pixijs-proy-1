import { Easing } from "tweedle.js";
// Gate.ts
import { Mesh3D } from "pixi3d/pixi7";
import { Tween } from "tweedle.js";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export class Gate {
	public mesh: Mesh3D;
	private isOpen: boolean = false;

	/**
	 * @param container: donde agregar el mesh.
	 * @param position: posición inicial de la puerta.
	 * @param scale: dimensiones de la puerta.
	 */
	constructor(container: any, position: { x: number; y: number; z: number }, scale: { x: number; y: number; z: number }) {
		// Creamos la puerta como un cubo (puede ser reemplazado por un modelo 3D)
		this.mesh = container.addChild(Mesh3D.createCube());
		this.mesh.position.set(position.x, position.y, position.z);
		this.mesh.scale.set(scale.x, scale.y, scale.z);
	}

	/**
	 * Abre la puerta bajándola en Y.
	 */
	public open(): void {
		if (this.isOpen) {
			return;
		}
		SoundLib.playSound("gate-heavy", { volume: 0.05 });
		this.isOpen = true;

		// Por ejemplo, bajar la puerta 20 unidades en Y en 1 segundo.
		new Tween(this.mesh.position)
			.delay(1000)
			.to({ y: this.mesh.position.y - 40 }, 6000)
			.easing(Easing.Quadratic.Out)
			.start();
	}
}
