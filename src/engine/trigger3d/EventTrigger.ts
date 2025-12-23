import type { AABB, ITransform3D } from "./../../project/scenes/3dgame/Utils/CollisionUtils";
import { Mesh3D, StandardMaterial, Color } from "pixi3d/pixi7";
import { intersect } from "../../project/scenes/3dgame/Utils/CollisionUtils";

export class EventTrigger {
	public mesh: Mesh3D;
	public activated: boolean = false;
	private onEnter: () => void; // La función que ejecutaremos

	/**
	 * @param container El contenedor de la escena
	 * @param position Posición x, y, z
	 * @param scale Escala (tamaño del área de activación)
	 * @param onEnter Función que se ejecuta cuando el player entra
	 */
	constructor(container: any, position: { x: number; y: number; z: number }, scale: { x: number; y: number; z: number }, onEnter: () => void) {
		this.onEnter = onEnter;

		// Material casi invisible
		const mat = new StandardMaterial();
		mat.baseColor = new Color(0, 1, 1); // Cyan para debug visual suave

		this.mesh = container.addChild(Mesh3D.createCube());
		this.mesh.position.set(position.x, position.y, position.z);
		this.mesh.scale.set(scale.x, scale.y, scale.z);
		this.mesh.material = mat;
		this.mesh.visible = true;

		// No ocultamos el mesh con visible=false porque queremos que el alpha 0.1 se vea apenas
		// Si quisieras que sea 100% invisible pero funcional, usa this.mesh.visible = false;
	}

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

	public update(target: ITransform3D): void {
		const triggerAABB = this.getAABB({ position: this.mesh.position, scale: this.mesh.scale });
		const targetAABB = this.getAABB(target);

		const isIntersecting = intersect(triggerAABB, targetAABB);

		if (isIntersecting && !this.activated) {
			// --- PLAYER ENTRA AL TRIGGER (ENTRANCE) ---
			this.activated = true; // Establecemos el flag de activación

			// Ejecutamos la acción (Diálogo o Cambio de Cámara)
			if (this.onEnter) {
				this.onEnter();
			}

			// Dejamos el mesh visible para que siempre esté activo
			this.mesh.visible = true; // Ya estaba en true en el constructor, pero lo aseguramos
		} else if (!isIntersecting && this.activated) {
			// --- PLAYER SALE DEL TRIGGER (EXIT) ---
			// Reseteamos el flag para que pueda re-activarse al volver a entrar
			this.activated = false;
		}
	}
}
