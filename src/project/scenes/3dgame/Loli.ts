import type { Resource, Texture } from "pixi.js";
import type { Point3D } from "pixi3d/pixi7";
import { Camera, Sprite3D, SpriteBillboardType } from "pixi3d/pixi7";

export class Loli extends Sprite3D {
	private speedX: number;
	private speedY: number;
	private speedZ: number;

	constructor(texture: Texture<Resource> | undefined, areaSize: number, scale?: Point3D) {
		super(texture);

		this.pixelsPerUnit = areaSize;
		this.position.set(-this.pixelsPerUnit / 2 + Math.random() * this.pixelsPerUnit, 0, -this.pixelsPerUnit / 2 + Math.random() * this.pixelsPerUnit);

		this.speedX = -0.01 + Math.random() * 0.02;
		this.speedY = Math.random() * 6;
		this.speedZ = -0.01 + Math.random() * 0.02;

		// The billboard type is set so the sprite always face the camera.
		this.billboardType = SpriteBillboardType.spherical;

		if (scale) {
			this.scale = scale;
		}
	}

	public distanceFromCamera(): number {
		const dx = this.worldTransform.position.x - Camera.main.worldTransform.position.x;
		const dy = this.worldTransform.position.y - Camera.main.worldTransform.position.y;
		const dz = this.worldTransform.position.z - Camera.main.worldTransform.position.z;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	public update(): void {
		this.position.x += this.speedX;
		this.position.y = Math.cos((this.speedY += 0.4)) * 0.05;
		this.position.z += this.speedZ;

		if (this.position.x > this.pixelsPerUnit / 2) {
			this.speedX *= -1;
			this.position.x = this.pixelsPerUnit / 2;
		} else if (this.position.x < -this.pixelsPerUnit / 2) {
			this.speedX *= -1;
			this.position.x = -this.pixelsPerUnit / 2;
		}
		if (this.position.z > this.pixelsPerUnit / 2) {
			this.speedZ *= -1;
			this.position.z = this.pixelsPerUnit / 2;
		} else if (this.position.z < -this.pixelsPerUnit / 2) {
			this.speedZ *= -1;
			this.position.z = -this.pixelsPerUnit / 2;
		}
	}

	public moveTowards(targetPosition: Point3D | any, speed: number): void {
		const directionX = targetPosition.x - this.position.x;
		const directionY = targetPosition.y - this.position.y;
		const directionZ = targetPosition.z - this.position.z;

		const distance = Math.sqrt(directionX * directionX + directionY * directionY + directionZ * directionZ);

		const normalizedDirection = {
			x: directionX / distance,
			y: directionY / distance,
			z: directionZ / distance,
		};

		this.position.x += normalizedDirection.x * speed;
		this.position.y += normalizedDirection.y * speed;
		this.position.z += normalizedDirection.z * speed;
	}
}
