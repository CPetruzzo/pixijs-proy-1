import { Mesh3D, StandardMaterial } from "pixi3d/pixi7";
import type { Gate } from "./Gate";
import type { AABB, ITransform3D } from "./CollisionUtils";
import { intersect } from "./CollisionUtils";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { Assets } from "pixi.js";
import { Easing, Tween } from "tweedle.js";

export class Trigger {
	public mesh: Mesh3D;
	private gate: Gate;
	private activated: boolean = false;

	constructor(container: any, gate: Gate, position: { x: number; y: number; z: number }, scale: { x: number; y: number; z: number }) {
		// Crear un material para las paredes
		const wallMaterial = new StandardMaterial();
		const texture = Assets.get("wallTexture");
		texture.baseTexture.wrapMode = 10497; // PIXI.WRAP_MODES.REPEAT
		wallMaterial.baseColorTexture = texture;
		wallMaterial.metallicRoughnessTexture = texture;
		wallMaterial.roughness = 1;
		wallMaterial.metallic = 1;

		this.gate = gate;
		this.mesh = container.addChild(Mesh3D.createCube());
		this.mesh.position.set(position.x, position.y, position.z);
		this.mesh.scale.set(scale.x, scale.y, scale.z);
		this.mesh.material = wallMaterial;

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
			SoundLib.playSound("switch", { volume: 0.05 });
			this.activated = true;
			this.gate.open();
			// Por ejemplo, bajar la puerta 20 unidades en Y en 1 segundo.
			new Tween(this.mesh.position)
				.to({ y: this.mesh.position.y - 0.7 }, 500)
				.easing(Easing.Quadratic.Out)
				.start();
		}
	}
}
