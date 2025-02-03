import { CameraOrbitControl } from "pixi3d/pixi7";

/**
 * Extiende la cámara de órbita para incluir un modo mira (aim mode) que aplica
 * un offset extra a la posición calculada de la cámara.
 */
export class CameraOrbitControlAim extends CameraOrbitControl {
	// Indica si el modo aim está activo.
	private _aimMode: boolean = false;

	// Offset extra que se aplicará cuando el modo aim esté activado.
	// Por ejemplo: { x: 0, y: 0, z: 20 } moverá la cámara 20 unidades hacia adelante.
	private _aimOffset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

	/**
	 * Activa o desactiva el modo aim.
	 */
	public set aimMode(value: boolean) {
		this._aimMode = value;
	}

	public get aimMode(): boolean {
		return this._aimMode;
	}

	/**
	 * Permite establecer un offset extra para el modo aim.
	 */
	public set aimOffset(offset: { x: number; y: number; z: number }) {
		this._aimOffset = offset;
	}

	public get aimOffset(): { x: number; y: number; z: number } {
		return this._aimOffset;
	}

	/**
	 * Actualiza la cámara. Se invoca el método original para calcular la posición
	 * y luego, si el modo aim está activado, se aplica el offset extra.
	 */
	public override updateCamera(): void {
		// Llama al método original para actualizar la posición y la orientación.
		super.updateCamera();

		// Si el modo aim está activo, aplicamos el offset extra.
		if (this._aimMode) {
			this.camera.position.x += this._aimOffset.x;
			this.camera.position.y += this._aimOffset.y;
			this.camera.position.z += this._aimOffset.z;
		}
	}
}
