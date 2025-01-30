import { cameraControl } from "../../../..";

export class Camera3D {
	public cameraControl: any;

	private lastCameraPosition = { x: 20, y: 0, z: 50 }; // Posición inicial de la cámara
	private cameraLerpSpeed = 0.8; // Factor de suavizado

	constructor(_distance: number = 35, _angleWithFloor: number = 50, _position: { x: number; y: number; z: number } = { x: 20, y: 0, z: 50 }) {
		this.cameraControl = cameraControl;

		this.cameraControl.distance = _distance;
		this.cameraControl.angles.x = _angleWithFloor;
		this.cameraControl.target = _position;
	}

	// Método para suavizar el movimiento de la cámara
	public handleCameraMovement(_delta?: number): void {
		// Calculamos la nueva posición deseada de la cámara
		const targetX = this.cameraControl.target.x;
		const targetY = this.cameraControl.target.y;
		const targetZ = this.cameraControl.target.z;

		// Lerp entre la última posición conocida y la nueva posición
		this.cameraControl.target.x = this.lastCameraPosition.x + (targetX - this.lastCameraPosition.x) * this.cameraLerpSpeed;
		this.cameraControl.target.y = this.lastCameraPosition.y + (targetY - this.lastCameraPosition.y) * this.cameraLerpSpeed;
		this.cameraControl.target.z = this.lastCameraPosition.z + (targetZ - this.lastCameraPosition.z) * this.cameraLerpSpeed;

		// Guardamos la posición actual para la próxima iteración
		this.lastCameraPosition = { ...this.cameraControl.target };
	}
}
