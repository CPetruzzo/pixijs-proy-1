import { Mesh3D } from "pixi3d/pixi7";
import type { Gate } from "./Gate";
import type { AABB, ITransform3D } from "./CollisionUtils";
import { intersect } from "./CollisionUtils";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export class Trigger {
	public mesh: Mesh3D;
	private gate: Gate;
	private activated: boolean = false;

	constructor(container: any, gate: Gate, position: { x: number; y: number; z: number }, scale: { x: number; y: number; z: number }) {
		this.gate = gate;
		this.mesh = container.addChild(Mesh3D.createCube());
		this.mesh.position.set(position.x, position.y, position.z);
		this.mesh.scale.set(scale.x, scale.y, scale.z);
		// Si no querés que se vea el trigger, lo ocultás:
		this.mesh.visible = true;
	}

	/**
	 * Convierte la posición y escala de un objeto en un AABB.
	 */
	private getAABB(mesh: { position: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } }): AABB {
		return {
			min: {
				x: mesh.position.x - mesh.scale.x / 2,
				y: mesh.position.y - mesh.scale.y / 2,
				z: mesh.position.z - mesh.scale.z / 2,
			},
			max: {
				x: mesh.position.x + mesh.scale.x / 2,
				y: mesh.position.y + mesh.scale.y / 2,
				z: mesh.position.z + mesh.scale.z / 2,
			},
		};
	}

	/**
	 * Actualiza el trigger verificando la colisión AABB entre el trigger y el objeto.
	 * @param target Transformación del objeto a testear (por ejemplo, el jugador).
	 */
	public update(target: ITransform3D): void {
		if (this.activated) {
			return;
		}

		const triggerAABB = this.getAABB({ position: this.mesh.position, scale: this.mesh.scale });
		const targetAABB = this.getAABB(target);

		if (intersect(triggerAABB, targetAABB)) {
			SoundLib.playSound("switch", { volume: 0.1 });
			this.activated = true;
			this.gate.open();
		}
	}
}
