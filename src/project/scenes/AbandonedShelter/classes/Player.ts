import type { Graphics } from "pixi.js";
import { Container, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";
import type { IHitable } from "../../../../engine/collision/IHitable";
import { HitPoly } from "../../../../engine/collision/HitPoly";
import { Keyboard } from "../../../../engine/input/Keyboard";

export interface PlayerConfig {
	x?: number;
	y?: number;
	speed?: number;
}

export class AHPlayer extends Container {
	public animator: StateMachineAnimator;
	public hitbox: Graphics & IHitable;
	private speed: number;
	private isWalking = false;

	constructor(config: PlayerConfig = {}) {
		super();
		this.speed = config.speed ?? 200;
		this.x = config.x ?? 0;
		this.y = config.y ?? 0;

		// Animator setup
		this.animator = new StateMachineAnimator();
		this.animator.anchor.set(0.5);
		this.animator.addState("idle", [Texture.from("AH_idle")], 4, true);
		this.animator.addState("walk", [Texture.from("AH_walk1"), Texture.from("AH_walk2")], 4, true);
		this.animator.playState("idle");
		this.addChild(this.animator);

		// Hitbox for collisions
		this.hitbox = HitPoly.makeBox(-25, -50, 50, 100);
		this.hitbox.eventMode = "none";
		this.animator.addChild(this.hitbox);
	}

	/**
	 * Call in scene.update(dt)
	 */
	public update(dt: number): void {
		const left = Keyboard.shared.isDown("ArrowLeft");
		const right = Keyboard.shared.isDown("ArrowRight");

		if (left || right) {
			if (!this.isWalking) {
				this.animator.playState("walk");
				this.isWalking = true;
			}
			// move and flip
			const dir = right ? 1 : -1;
			this.x += dir * this.speed * (dt / 1000);
			this.scale.x = dir;
		} else if (this.isWalking) {
			this.animator.playState("idle");
			this.isWalking = false;
		}
	}
}
