import type { Collider, RigidBody, World } from "@dimforge/rapier2d";
import { ColliderDesc, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d";
import { Container } from "pixi.js";
import { BasquetballGameScene } from "./BasquetballGameScene";
import Random from "../../../engine/random/Random";

export class JoystickBasquetBallPlayer extends Container {
	public rigidBody: RigidBody;
	public collider: Collider;
	public world: World;
	public hasShot: boolean = false;
	public isOnGround: boolean = false; // Nueva variable para verificar si está en el suelo

	constructor(world: World) {
		super();
		this.world = world;

		const spawnX = Random.shared.randomInt(1050, 1500);

		this.position.x = spawnX;
		this.position.y = 1150;
		this.pivot.set(this.width * 0.5, this.height * 0.5);
		const rigidBodyDesc = RigidBodyDesc.dynamic()
			.setTranslation(this.x / BasquetballGameScene.METER_TO_PIXEL, this.y / BasquetballGameScene.METER_TO_PIXEL)
			.lockRotations();
		this.rigidBody = world.createRigidBody(rigidBodyDesc);

		const colliderDesc = ColliderDesc.ball(4);
		this.collider = this.world.createCollider(colliderDesc, this.rigidBody);
	}

	public shootHim(charge: { x: number; y: number }): void {
		if (this.isOnGround) {
			// Verificación de si está en el suelo
			this.hasShot = true;
			this.isOnGround = false; // Después de disparar, ya no está en el suelo

			const force = new Vector2(-charge.x * 4600, -charge.y * 4600);
			this.rigidBody.applyImpulse(force, true);
		}
	}

	public update(): void {
		const position = this.rigidBody.translation();
		this.position.set(position.x * BasquetballGameScene.METER_TO_PIXEL, position.y * BasquetballGameScene.METER_TO_PIXEL + 10);
		this.x = this.rigidBody.translation().x * BasquetballGameScene.METER_TO_PIXEL;
		this.y = this.rigidBody.translation().y * BasquetballGameScene.METER_TO_PIXEL;
	}

	public spawnPlayer(): void {
		const spawnX = Random.shared.randomInt(1050, 1500);
		this.position.x = spawnX;
		this.position.y = 1150;

		// Establece la posición del `RigidBody` usando `setTranslation`
		this.rigidBody.setTranslation({ x: spawnX / BasquetballGameScene.METER_TO_PIXEL, y: 1150 / BasquetballGameScene.METER_TO_PIXEL }, true);

		// Reinicia la velocidad
		this.rigidBody.setLinvel({ x: 0, y: 0 }, true);
		this.rigidBody.setAngvel(0, true);
	}

	public playerMissedSpawn(): void {
		const spawnX = Random.shared.randomInt(1050, 1500);
		this.position.x = spawnX;
		this.position.y = 1150;

		// Establece la posición del `RigidBody` usando `setTranslation`
		this.rigidBody.setTranslation({ x: spawnX / BasquetballGameScene.METER_TO_PIXEL, y: 1150 / BasquetballGameScene.METER_TO_PIXEL }, true);

		// Reinicia la velocidad
		this.rigidBody.setLinvel({ x: 0, y: 0 }, true);
		this.rigidBody.setAngvel(0, true);
	}
}
