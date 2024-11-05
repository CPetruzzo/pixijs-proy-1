import type { Collider, RigidBody, World } from "@dimforge/rapier2d";
import { ColliderDesc, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d";
import { Container } from "pixi.js";
import { BasquetballGameScene } from "./BasquetballGameScene";

export class JoystickBasquetBallPlayer extends Container {
	public rigidBody: RigidBody;
	public collider: Collider;
	public world: World;

	constructor(world: World) {
		super();
		this.world = world;

		this.position.x = 1100;
		this.position.y = 850;

		this.pivot.set(this.width * 0.5, this.height * 0.5);
		const rigidBodyDesc = RigidBodyDesc.dynamic()
			.setTranslation(this.x / BasquetballGameScene.METER_TO_PIXEL, this.y / BasquetballGameScene.METER_TO_PIXEL)
			.lockRotations();
		this.rigidBody = world.createRigidBody(rigidBodyDesc);

		const colliderDesc = ColliderDesc.ball(4);
		this.collider = this.world.createCollider(colliderDesc, this.rigidBody);
	}

	public shootHim(charge: { x: number; y: number }): void {
		const force = new Vector2(-charge.x * 2300, -charge.y * 2300);
		this.rigidBody.applyImpulse(force, true);
	}

	public update(): void {
		const position = this.rigidBody.translation();
		this.position.set(position.x * BasquetballGameScene.METER_TO_PIXEL, position.y * BasquetballGameScene.METER_TO_PIXEL + 10);
		this.x = this.rigidBody.translation().x * BasquetballGameScene.METER_TO_PIXEL;
		this.y = this.rigidBody.translation().y * BasquetballGameScene.METER_TO_PIXEL;
	}
}
