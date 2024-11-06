import { Point, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import type { World } from "@dimforge/rapier2d";
import { ColliderDesc, RigidBodyDesc, type Collider, type RigidBody } from "@dimforge/rapier2d";
import { BasquetballGameScene } from "./BasquetballGameScene";
import { Keyboard } from "../../../engine/input/Keyboard";

export class BasketballPlayer extends StateMachineAnimator {
	public rigidBody: RigidBody;
	public collider: Collider;
	public world: World;

	constructor(world: World) {
		super();
		this.world = world;

		this.position.x = 1100;
		this.position.y = 950;
		this.pivot.set(this.width * 0.5, this.height * 0.5);

		this.addState("idle", [Texture.from("basketballplayer"), Texture.from("basketballplayer")], 0.2, true);
		this.addState("move", [Texture.from("basketballplayer"), Texture.from("basketballplayer"), Texture.from("basketballplayer")], 0.3, true);

		this.playState("idle");

		const rigidBodyDesc = RigidBodyDesc.dynamic()
			.setTranslation(this.x / BasquetballGameScene.METER_TO_PIXEL, this.y / BasquetballGameScene.METER_TO_PIXEL)
			.lockRotations();
		this.rigidBody = world.createRigidBody(rigidBodyDesc);

		const colliderDesc = ColliderDesc.cuboid(8, 20);
		this.collider = this.world.createCollider(colliderDesc, this.rigidBody);
	}

	public setDirection(movingLeft: boolean): void {
		this.scale.x = movingLeft ? -1 : 1;
	}

	public override update(_dt: number): void {
		const position = this.rigidBody.translation();
		this.position.set(position.x * BasquetballGameScene.METER_TO_PIXEL, position.y * BasquetballGameScene.METER_TO_PIXEL + 10);
		this.x = this.rigidBody.translation().x * BasquetballGameScene.METER_TO_PIXEL;
		this.y = this.rigidBody.translation().y * BasquetballGameScene.METER_TO_PIXEL;

		if (Keyboard.shared.justReleased("Space")) {
			this.rigidBody.applyImpulse(new Point(0, -200), true);
		}
	}
}
