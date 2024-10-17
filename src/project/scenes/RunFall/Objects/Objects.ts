import { Sprite } from "pixi.js";
import { GameObject } from "./GameObject";
import { Player } from "./Player";
import { OBJECT_SPEED } from "../../../../utils/constants";

export class EnemyObject extends GameObject {
	constructor() {
		super();

		const enemy = Sprite.from("enemy");
		enemy.anchor.set(0.5, 0);
		this.addChild(enemy);

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
		coin.anchor.set(0.5, 0);
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

	constructor() {
		super();

		const obstacule = Sprite.from("obstacule");
		obstacule.anchor.set(0.5, 0);
		this.addChild(obstacule);
	}

	public update(dt: number): void {
		if (this.y < this.parent?.height - this.height) {
			this.y += OBJECT_SPEED * dt;
		} else {
			if (this.timeOnGround < this.timeToStayOnGround) {
				this.timeOnGround += dt;
				this.isOnGround = true;
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
