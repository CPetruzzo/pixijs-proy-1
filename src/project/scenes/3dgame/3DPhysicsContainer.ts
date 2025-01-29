import { Assets } from "pixi.js";
import { Model } from "pixi3d/pixi7";
import { Container3D } from "pixi3d/pixi7";

export class PhysicsContainer3d extends Container3D {
	public speed: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
	public acceleration: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
	public gravity: number = 0.00001;
	public model: Model;
	public canJump: boolean = true;

	constructor(asset: string) {
		super();
		this.model = Model.from(Assets.get(asset));
		this.addChild(this.model);
	}

	public update(deltaSeconds: number): void {
		this.model.x += this.speed.x * deltaSeconds + (1 / 2) * this.acceleration.x * Math.pow(deltaSeconds, 2);
		this.model.y += this.speed.y * deltaSeconds + (1 / 2) * this.acceleration.y * Math.pow(deltaSeconds, 2);
		this.model.z += this.speed.z * deltaSeconds + (1 / 2) * this.acceleration.z * Math.pow(deltaSeconds, 2);

		this.acceleration.y -= this.gravity;

		this.speed.x += this.acceleration.x * deltaSeconds;
		this.speed.y += this.acceleration.y * deltaSeconds;
		this.speed.z += this.acceleration.z * deltaSeconds;

		// Verificar si el objeto está en el suelo
		if (this.model.y > 0) {
			// Si no está en el suelo, aplicar la gravedad
			this.speed.y -= this.gravity * deltaSeconds;
		} else {
			// Si está en el suelo, detener la caída y mantenerlo en el suelo
			this.model.y = 0;
			this.speed.y = 0;
			this.acceleration.y = 0;
			this.canJump = true;
		}
	}

	public jump(): void {
		if (this.canJump) {
			this.canJump = false;
			this.speed.y = 0.02;
		}
	}
}
