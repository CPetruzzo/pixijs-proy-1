import type { Sprite } from "pixi.js";
import { Graphics, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { Timer } from "../../../engine/tweens/Timer";
import { PLAYER_SPEED, STUN_TIME } from "../../../utils/constants";
import type { ScoreManager } from "./ScoreManager";
import type { HealthBar } from "./HealthBar";
import { PlayerEffects } from "./PlayerEffects";

export class Player extends StateMachineAnimator {
	public canMove: boolean = true;
	public movingLeft: boolean = false;
	public speed: number;
	public aux: Graphics;
	public effects: PlayerEffects;
	constructor(public scoreManager: ScoreManager, public healthBar: HealthBar, public background: Sprite) {
		super();
		this.scoreManager = scoreManager;
		this.healthBar = healthBar;
		this.effects = new PlayerEffects(this, background);

		this.speed = PLAYER_SPEED;

		this.anchor.set(0.5, 0);
		this.eventMode = "none";

		this.addState("idle", [Texture.from("player1"), Texture.from("player2")], 0.2, true);
		this.addState("move", [Texture.from("player2"), Texture.from("player3")], 0.2, true);

		this.playState("idle");

		this.aux = new Graphics();
		this.aux.beginFill(0x0000ff, 0.05);
		this.aux.drawRect(-35, 50, 70, 100);
		this.aux.endFill();
		this.addChild(this.aux);
	}

	public stopMovement(): void {
		this.canMove = false;
		new Timer()
			.to(STUN_TIME)
			.start()
			.onComplete(() => {
				this.canMove = true;
				// this.filters = [];
			});
	}

	public setDirection(movingLeft: boolean): void {
		this.scale.x = movingLeft ? -1 : 1;
	}
	public collectCoin(value: number): void {
		if (value) {
			this.scoreManager.collectCoin(value);
		} else {
			this.scoreManager.collectCoin(10);
		}
	}

	public takeDamage(): void {
		this.healthBar.decreaseHealth();
	}

	public heal(): void {
		this.healthBar.increaseHealth();
	}

	public getScore(): number {
		return this.scoreManager.getScore();
	}

	public getHealth(): number {
		return this.healthBar.getCurrentHealth();
	}

	public activatePowerUp(): void {
		this.speed += 0.25;
		this.scoreManager.activatePowerUp();
		new Timer()
			.to(5500)
			.start()
			.onComplete(() => {
				this.speed = PLAYER_SPEED;
				this.filters = [];
			});
	}

	public getSpeedEffect(): void {
		this.effects.causeStun(1500);
	}

	public collideWithObstacle(): void {
		console.log("El jugador chocó con un obstáculo.");
		this.stopMovement();
		// const playerBlur = new BlurFilter(5);
		// this.player.filters = [playerBlur];
	}
}
