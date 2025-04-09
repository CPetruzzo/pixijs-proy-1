import { Sprite } from "pixi.js";
import { Graphics, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";
import { Timer } from "../../../../engine/tweens/Timer";
import { PLAYER_SCALE_RUNFALL, PLAYER_SPEED, SPEEDUP_TIME, STUN_TIME } from "../../../../utils/constants";
import type { ScoreManager } from "../Managers/ScoreManager";
import type { HealthBar } from "./HealthBar";
import { EffectManager } from "../Managers/EffectManager";
import type { AchievementState } from "../Managers/AchievementsManager";
import { Easing, Tween } from "tweedle.js";

interface CharacterConfig {
	idleFrames: string[]; // asset keys for idle
	walkFrames: string[]; // asset keys for moving
	cheersFrames: string[]; // asset keys for moving
	speed: number;
	maxHealth: number;
}

export class Player extends StateMachineAnimator {
	public canMove: boolean = true;
	public movingLeft: boolean = false;
	public speed: number;
	public aux: Graphics;
	public effectManager: EffectManager;
	public isShielded: boolean = false;
	private shieldDuration: number = 5000; // Duración de la inmunidad en milisegundos
	public achievementsState: AchievementState;

	private trailIntervalId: number | null = null;

	constructor(public scoreManager: ScoreManager, public healthBar: HealthBar, public background: Sprite) {
		super();
		this.scoreManager = scoreManager;
		this.healthBar = healthBar;
		this.effectManager = new EffectManager(this, background);

		// 1) Read which character is equipped
		let chosenIndex = 0;
		try {
			const raw = localStorage.getItem("equippedCharacter");
			if (raw !== null) {
				chosenIndex = parseInt(raw, 10);
			}
		} catch {
			chosenIndex = 0;
		}

		// 2) Define your per-character configs (just asset keys here)
		const configs: CharacterConfig[] = [
			{
				idleFrames: ["idle2", "idle3"],
				walkFrames: ["walk1", "walk2", "walk3", "walk4"],
				cheersFrames: ["cheers"],
				speed: 0.5,
				maxHealth: 3,
			},
			{
				idleFrames: ["newidle1", "newidle2"],
				walkFrames: ["newwalk1", "newidle1", "newwalk2", "newidle1"],
				cheersFrames: ["newcheers1"],
				speed: 0.1,
				maxHealth: 5,
			},
			{
				idleFrames: ["alienidle1", "alienidle2"],
				walkFrames: ["alienwalk1", "alienidle1", "alienwalk2", "alienidle1"],
				cheersFrames: ["aliencheers1"],
				speed: 0.5,
				maxHealth: 4,
			},
		];

		// clamp
		if (chosenIndex < 0 || chosenIndex >= configs.length) {
			chosenIndex = 0;
		}
		const cfg = configs[chosenIndex];

		// 3) Apply speed & health
		this.speed = cfg.speed;

		// assume your HealthBar has these methods:
		this.healthBar.setMaxHealth(cfg.maxHealth);
		this.healthBar.setCurrentHealth(cfg.maxHealth);

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
		// 5) Set up animation states using asset keys
		this.anchor.set(0.5, 0);
		this.eventMode = "none";

		this.addState(
			"idle",
			cfg.idleFrames.map((key) => Texture.from(key)),
			0.15,
			true
		);
		this.addState(
			"move",
			cfg.walkFrames.map((key) => Texture.from(key)),
			0.3,
			true
		);
		this.addState(
			"defeat",
			["defeat0", "defeat1", "defeat2", "defeat3", "defeat4", "defeat5"].map((k) => Texture.from(k)),
			0.4,
			false
		);

		this.addState(
			"cheers",
			cfg.cheersFrames.map((k) => Texture.from(k)),
			0.3,
			true
		);
		this.addState("block", [Texture.from("block1"), Texture.from("block2")], 0.3, true);

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

		if (this.trailIntervalId !== null) {
			clearInterval(this.trailIntervalId);
		}

		this.trailIntervalId = window.setInterval(() => {
			const after = new Sprite(this.texture);
			after.anchor.set(this.anchor.x, this.anchor.y);
			after.position.set(this.x, this.y);
			after.scale.set(this.scale.x, this.scale.y);
			after.alpha = 0.5;
			this.parent.addChild(after);

			new Tween(after)
				.to({ alpha: 0 }, 400)
				.easing(Easing.Linear.None)
				.onComplete(() => {
					after.parent?.removeChild(after);
				})
				.start();
		}, 100);

		window.setTimeout(() => {
			if (this.trailIntervalId !== null) {
				clearInterval(this.trailIntervalId);
				this.trailIntervalId = null;
			}

			this.speed = PLAYER_SPEED;
			this.filters = [];
		}, SPEEDUP_TIME);
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
