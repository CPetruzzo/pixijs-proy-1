import type { RigidBody, World } from "@dimforge/rapier2d";
import { ColliderDesc, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d";
import { Container } from "pixi.js";
import { JoystickTestScene } from "../JoystickTestScene";

export class JoystickPlayer extends Container {
	private rigidBody: RigidBody;
	public world: World;

	constructor(world: World) {
		super();
		this.world = world;

		this.position.x = 200;
		this.position.y = 850;

		this.pivot.set(this.width * 0.5, this.height * 0.5);
		const rigidBodyDesc = RigidBodyDesc.dynamic()
			.setTranslation(this.x / JoystickTestScene.METER_TO_PIXEL, this.y / JoystickTestScene.METER_TO_PIXEL)
			.lockRotations();
		rigidBodyDesc.mass = 25;
		this.rigidBody = world.createRigidBody(rigidBodyDesc);

		const colliderDesc = ColliderDesc.ball(4);
		colliderDesc.rotation = 0;
		this.world.createCollider(colliderDesc, this.rigidBody);
	}

	public shootHim(charge: { x: number; y: number }): void {
		const force = new Vector2(-charge.x * 1283, -charge.y * 1283); // Aumenta el factor
		this.rigidBody.applyImpulse(force, true);
	}

	public update(): void {
		const position = this.rigidBody.translation();
		this.position.set(position.x * JoystickTestScene.METER_TO_PIXEL, position.y * JoystickTestScene.METER_TO_PIXEL + 10);
		this.x = this.rigidBody.translation().x * JoystickTestScene.METER_TO_PIXEL;
		this.y = this.rigidBody.translation().y * JoystickTestScene.METER_TO_PIXEL;
	}
}
