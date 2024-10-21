import { Sprite } from "pixi.js";
import { GameObject } from "./GameObject";
import { Player } from "./Player";
import { OBJECT_SPEED } from "../../../../utils/constants";
import { Easing, Tween } from "tweedle.js";
import Random from "../../../../engine/random/Random";
import { EffectManager } from "../Managers/EffectManager";

export enum ObjectsNames {
	OBSTACLE = "OBSTACLE",
	ENEMY = "ENEMY",
	POTION = "POTION",
	POWER_UP = "POWER_UP",
	COIN = "COIN",
}

export class EnemyObject extends GameObject {
	constructor() {
		super();

		const enemy = Sprite.from("comet");
		enemy.anchor.set(0.5);
		const enemyscale = Random.shared.randomIntCentered(0.5, 0.3);
		enemy.scale.set(enemyscale);
		this.addChild(enemy);

		new Tween(enemy)
			.to({ scale: { y: enemyscale - 0.1 } }, 800)
			.start()
			.repeat(Infinity)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true);
	}

	public update(dt: number): void {
		this.y += OBJECT_SPEED * dt;
	}

	public override handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("El enemigo ha colisionado con el jugador.");
		}
	}
}

export class PotionObject extends GameObject {
	constructor() {
		super();

		const potion = Sprite.from("medkit1");
		potion.anchor.set(0.5);
		this.addChild(potion);

		const potionscale = Random.shared.randomIntCentered(0.5, 0.05);
		potion.scale.set(potionscale);

		new Tween(potion)
			.to({ scale: { y: potionscale - 0.05 } }, 800)
			.start()
			.repeat(Infinity)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true);
	}

	public update(dt: number): void {
		this.y += OBJECT_SPEED * 0.6 * dt;
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("Una poción ha sido tomada por el jugador.");
		}
	}
}

export class CoinObject extends GameObject {
	constructor() {
		super();

		const coin = Sprite.from("bronze1");
		coin.anchor.set(0.5);
		this.addChild(coin);
	}

	public update(dt: number): void {
		this.y += OBJECT_SPEED * 0.6 * dt;
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("El jugador recogió una moneda.");
		}
	}
}

export class PowerUpObject extends GameObject {
	constructor() {
		super();

		const powerup = Sprite.from("spacestar");
		powerup.anchor.set(0.5);
		powerup.scale.set(0.15);
		this.addChild(powerup);

		const effectManager = new EffectManager(powerup, undefined);
		effectManager.speedingPowerUp(5500);
	}

	public update(dt: number): void {
		this.y += OBJECT_SPEED * 0.8 * dt;
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("El jugador obtuvo un power-up.");
		}
	}
}

export class ObstacleObject extends GameObject {
	private timeOnGround: number = 0;
	private timeToStayOnGround: number = 2000;
	private obstacule: Sprite;
	constructor() {
		super();

		this.obstacule = Sprite.from("meteorEnemy");
		this.obstacule.anchor.set(0.5);
		this.obstacule.scale.set(0.2);
		this.addChild(this.obstacule);
	}

	public update(dt: number): void {
		if (this.y < this.parent?.height - this.height * 0.5) {
			this.y += OBJECT_SPEED * dt;
		} else {
			if (this.timeOnGround < this.timeToStayOnGround) {
				this.timeOnGround += dt;
				this.isOnGround = true;
				this.obstacule.tint = 0xd83a6d;
				// this.obstacule.tint = 0xfe4d1e;
				// 0xd93e3e
				// new Tween(this.obstacule).to({ scale: { x: 0.35, y: 0.35 } }, this.timeToStayOnGround).easing(Easing.Bounce.InOut).start()
			} else {
				const index = this.parent?.children.indexOf(this);
				if (index !== undefined && index !== -1) {
					this.parent?.removeChild(this);
				}
				this.isOnGround = false;
			}
		}
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("El jugador chocó con un obstáculo.");
		}
	}
}
