import { Sprite } from "pixi.js";
import { GameObject } from "./GameObject";
import { Player } from "./Player";
import { OBJECT_SPEED } from "../../../../utils/constants";
import { Tween } from "tweedle.js";
import Random from "../../../../engine/random/Random";

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
		enemy.anchor.set(0.5, 0);
		const enemyscale = Random.shared.randomIntCentered(0.55, 0.2);
		enemy.scale.set(enemyscale);
		this.addChild(enemy);

		new Tween(enemy)
			.to({ scale: { y: enemyscale - 0.03 } }, 500)
			.start()
			.repeat(Infinity)
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

		const potion = Sprite.from("powerup");
		potion.anchor.set(0.5, 0);
		this.addChild(potion);
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

		const coin = Sprite.from("coin");
		coin.anchor.set(0.5);
		this.addChild(coin);

		const runfall = Sprite.from("runfall");
		runfall.scale.set(0.11);
		runfall.anchor.set(0.44, 0.5);
		this.addChild(runfall);
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

		const powerup = Sprite.from("star");
		powerup.anchor.set(0.5, 0);
		this.addChild(powerup);
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
		this.obstacule.anchor.set(0.5, 0);
		this.obstacule.scale.set(0.2);
		this.addChild(this.obstacule);
	}

	public update(dt: number): void {
		if (this.y < this.parent?.height - this.height) {
			this.y += OBJECT_SPEED * dt;
		} else {
			if (this.timeOnGround < this.timeToStayOnGround) {
				this.timeOnGround += dt;
				this.isOnGround = true;
				this.obstacule.tint = 0xff0000;
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
