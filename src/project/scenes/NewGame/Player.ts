import { Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { Timer } from "../../../engine/tweens/Timer";
import { PLAYER_SPEED } from "../../../utils/constants";

export class Player extends StateMachineAnimator {
	public canMove: boolean = true;
	public movingLeft: boolean = false;
	public speed: number;

	constructor() {
		super();

		this.speed = PLAYER_SPEED;

		this.anchor.set(0.5, 0)
		this.eventMode = "none";

		this.addState("idle", [
			Texture.from("player1"),
			Texture.from("player2"),
		],
			0.2,
			true
		);

		this.addState("move", [
			Texture.from("player2"),
			Texture.from("player3"),
		],
			0.2,
			true
		);

		this.playState("idle");
	}

	public stopMovement(): void {
		this.canMove = false;
		new Timer().to(2000).start().onComplete(() => {
			this.canMove = true;
		})
	}

	public setDirection(movingLeft: boolean): void {
		this.scale.x = movingLeft ? -1 : 1;
	}

}