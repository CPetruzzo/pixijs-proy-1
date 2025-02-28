import type { Sprite } from "pixi.js";
import { Graphics, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";
import { Timer } from "../../../../engine/tweens/Timer";
import { PLAYER_SCALE_RUNFALL, PLAYER_SPEED, SPEEDUP_TIME, STUN_TIME } from "../../../../utils/constants";
import type { ScoreManager } from "../Managers/ScoreManager";
import type { HealthBar } from "./HealthBar";
import { EffectManager } from "../Managers/EffectManager";
import type { AchievementState } from "../Managers/AchievementsManager";

export class Player extends StateMachineAnimator {
	public canMove: boolean = true;
	public movingLeft: boolean = false;
	public speed: number;
	public aux: Graphics;
	public effectManager: EffectManager;
	private isShielded: boolean = false;
	private shieldDuration: number = 5000; // Duración de la inmunidad en milisegundos
	public achievementsState: AchievementState;
	constructor(public scoreManager: ScoreManager, public healthBar: HealthBar, public background: Sprite) {
		super();
		this.scoreManager = scoreManager;
		this.healthBar = healthBar;
		this.effectManager = new EffectManager(this, background);
		console.log("isShielded", this.isShielded);

		// Inicializamos achievementsState con valores por defecto
		this.achievementsState = {
			score: 0, // Podrías actualizar este valor según el puntaje real
			lives: healthBar.getCurrentHealth(), // O el número máximo de vidas
			cumulativeCoinsCollected: 0,
			coinsCollected: 0,
			enemyCollisions: 0,
			obstacleCollisions: 0,
			potionsCollected: 0,
		};

		this.speed = PLAYER_SPEED;

		this.anchor.set(0.5, 0);
		this.eventMode = "none";

		this.addState("idle", [Texture.from("astro1"), Texture.from("astro5")], 0.2, true);
		this.addState("move", [Texture.from("astro1"), Texture.from("astro3"), Texture.from("astro5")], 0.3, true);

		this.playState("idle");

		this.aux = new Graphics();
		this.aux.beginFill(0x0000ff, 0.05);
		this.aux.drawRect(-35, 50, 70, 100);
		this.aux.endFill();
		this.addChild(this.aux);
	}

	public stopMovement(): void {
		this.canMove = false;
		this.speed = 0;
		new Timer()
			.to(STUN_TIME)
			.start()
			.onComplete(() => {
				this.speed = PLAYER_SPEED;
				this.canMove = true;
				// this.filters = [];
			});
	}

	public setDirection(movingLeft: boolean): void {
		this.scale.x = movingLeft ? -PLAYER_SCALE_RUNFALL : PLAYER_SCALE_RUNFALL;
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
		this.effectManager.speedingPowerUp(SPEEDUP_TIME);

		new Timer()
			.to(5500)
			.start()
			.onComplete(() => {
				this.speed = PLAYER_SPEED;
				this.filters = [];
			});
	}

	public collideWithObstacle(): void {
		this.effectManager.causeStun(STUN_TIME);
		this.stopMovement();
	}

	public applyShield(): void {
		this.isShielded = true;
		console.log("Inmunidad activada");

		setTimeout(() => {
			this.isShielded = false;
			console.log("Inmunidad desactivada");
		}, this.shieldDuration);
	}
}
