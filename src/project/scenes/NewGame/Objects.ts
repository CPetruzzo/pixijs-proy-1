import { Sprite } from "pixi.js";
import { GameObject } from "./GameObject";
import { Player } from "./Player";
import { OBJECT_SPEED } from "../../../utils/constants";

export class EnemyObject extends GameObject {
	constructor() {
		super();

		const enemy = Sprite.from("enemy");
		enemy.anchor.set(0.5, 0);
		this.addChild(enemy);

		// this.beginFill(0xff0000, 0);
		// this.drawRect(0, 0, 40, 40);
		// this.endFill();
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

export class NegativeObject extends GameObject {
	constructor() {
		super();

		// this.beginFill(0x0000ff, 0);
		// this.drawRect(0, 0, 40, 40);
		// this.endFill();

		const powerup = Sprite.from("powerup");
		powerup.anchor.set(0.5, 0);
		this.addChild(powerup);
	}

	public update(dt: number): void {
		this.y += OBJECT_SPEED * 0.6 * dt;
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("Otro objeto ha colisionado con el jugador.");
		}
	}
}

export class CoinObject extends GameObject {
	constructor() {
		super();

		const coin = Sprite.from("coin");
		coin.anchor.set(0.5, 0);
		this.addChild(coin);

		// this.beginFill(0xffff00, 0);
		// this.drawRect(0, 0, 30, 30);
		// this.endFill();
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
		// this.beginFill(0x00ff00);
		// this.drawRect(0, 0, 35, 35);
		// this.endFill();

		const powerup = Sprite.from("star");
		powerup.anchor.set(0.5, 0);
		// powerup.tint = 0x0ffff;
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
		// this.beginFill(0x808080, 0);
		// this.drawRect(0, 0, 45, 45);
		// this.endFill();

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
