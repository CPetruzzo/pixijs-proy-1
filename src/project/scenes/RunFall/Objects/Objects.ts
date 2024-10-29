import type { Container } from "pixi.js";
import { Sprite } from "pixi.js";
import { GameObject } from "./GameObject";
import { Player } from "./Player";
import { OBJECT_SPEED, REMOVE_OBJECT_TIME } from "../../../../utils/constants";
import { Easing, Tween } from "tweedle.js";
import Random from "../../../../engine/random/Random";
import { EffectManager } from "../Managers/EffectManager";

export enum ObjectsNames {
	OBSTACLE = "OBSTACLE",
	ENEMY = "ENEMY",
	POTION = "POTION",
	POWER_UP = "POWER_UP",
	COIN = "COIN",
	ALIEN_SHIP = "ALIEN_SHIP",
	SHIELD = "SHIELD",
}

// #region NORMAL_ENEMY
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
// #endregion NORMAL_ENEMY

// #region POTION
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
// #endregion POTION

// #region COIN
export class CoinObject extends GameObject {
	constructor() {
		super();

		const coin = Sprite.from("golditem2");
		coin.scale.set(0.8);
		coin.anchor.set(0.5);
		this.addChild(coin);

		new Tween(coin).to({ angle: 360 }, 800).start().repeat(Infinity).easing(Easing.Quadratic.InOut).yoyo(true);
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
// #endregion COIN

// #region POWERUP
export class PowerUpObject extends GameObject {
	constructor() {
		super();

		const powerup = Sprite.from("golditem3");
		powerup.anchor.set(0.5);
		powerup.scale.set(0.8);
		this.addChild(powerup);

		new Tween(powerup).to({ angle: 360 }, 800).start().repeat(Infinity);

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
// #endregion POWERUP

// #region OBSTACLE
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
		if (this.y < this.parent?.height - this.height * 0.5 - 100) {
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
					new Tween(this)
						.to({ alpha: 0 }, REMOVE_OBJECT_TIME)
						.start()
						.onComplete(() => {
							this.parent?.removeChild(this);
						});
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
// #endregion OBSTACLE

// #region PROYECTILE
export class AlienProjectile extends GameObject {
	constructor() {
		super();

		const projectile = Sprite.from("shoot");
		projectile.anchor.set(0.5);
		projectile.scale.set(0.3);
		this.addChild(projectile);

		// Efecto de animación
		new Tween(projectile).to({ alpha: 0.5 }, 300).repeat(Infinity).easing(Easing.Quadratic.InOut).yoyo(true).start();
	}

	public update(dt: number): void {
		this.y += OBJECT_SPEED * 2.5 * dt; // Velocidad de movimiento del proyectil

		// Si sale del área, eliminar el proyectil
		if (this.y > this.parent?.height) {
			this.parent?.removeChild(this);
		}
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("El jugador ha sido impactado por un proyectil de la nave alienígena.");
			// Lógica de daño al jugador
			this.parent?.removeChild(this); // Remover proyectil tras impacto
		}
	}
}
// #endregion PROYECTILE

// #region ALIEN_SHIP
export class AlienShipObject extends GameObject {
	public objects: GameObject[];
	public background: Container;
	private shootIntervalId: ReturnType<typeof setInterval> | null = null;

	constructor(objects?: GameObject[], background?: Container) {
		super();

		this.objects = objects;
		this.background = background;
		const alienShip = Sprite.from("spaceship");
		alienShip.anchor.set(0.5);
		alienShip.scale.set(0.43);
		this.addChild(alienShip);

		// Movimiento de la nave hacia abajo
		new Tween(alienShip)
			.to({ y: this.y + 20 }, 500)
			.repeat(Infinity)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true)
			.start();

		// Iniciar disparo solo si la nave no está muerta
		this.startShooting();
	}

	private startShooting(): void {
		this.shootIntervalId = setInterval(() => {
			// Chequeo si la nave está viva antes de disparar
			if (!this.shipDead) {
				this.shootProjectile(this.objects, this.background);
			} else {
				this.stopShooting();
			}
		}, 500); // Intervalo de disparo
	}

	private shootProjectile(objects: GameObject[], background: Container): void {
		const projectile = new AlienProjectile();
		const randomValue = Random.shared.randomIntCentered(0, 50);
		projectile.x = this.x + randomValue;
		projectile.y = this.y + this.height * 0.5;

		// Añadir proyectil al array de objetos y al contenedor
		objects.push(projectile);
		background.addChild(projectile);
	}

	// Método para detener el disparo
	private stopShooting(): void {
		if (this.shootIntervalId) {
			clearInterval(this.shootIntervalId);
			this.shootIntervalId = null; // Asegurarse de que el intervalo no esté definido
		}
	}

	public update(dt: number): void {
		if (this.y < this.parent?.height - this.height * 0.5 - 100) {
			this.y += OBJECT_SPEED * 0.9 * dt;
		} else {
			const index = this.parent?.children.indexOf(this);
			this.shipDead = true;
			if (index !== undefined && index !== -1) {
				new Tween(this)
					.to({ alpha: 0 }, REMOVE_OBJECT_TIME)
					.start()
					.onComplete(() => {
						this.parent?.removeChild(this);
					});
			}
		}
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			console.log("La nave alienígena ha colisionado con el jugador.");
			this.shipDead = true;
		}
	}
}
// #endregion ALIEN_SHIP

// #region SHIELD
export class ShieldObject extends GameObject {
	constructor() {
		super();

		const shield = Sprite.from("capsule");
		shield.anchor.set(0.5);
		const shieldScale = Random.shared.randomIntCentered(0.15, 0.1);
		shield.scale.set(shieldScale);
		this.addChild(shield);

		// Animación de brillo o pulso
		new Tween(shield)
			.to({ scale: { x: shieldScale + 0.05, y: shieldScale + 0.05 } }, 1000)
			.repeat(Infinity)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true)
			.start();
	}

	public update(dt: number): void {
		this.y += OBJECT_SPEED * 0.5 * dt; // Ajustar velocidad del escudo
	}

	public handleEvent(_something: any): void {
		if (_something instanceof Player) {
			// Aplica el escudo de inmunidad al jugador
			console.log("El jugador adquirió el escudo de inmunidad.");
			_something.applyShield(); // Método en Player que activa inmunidad
		}
	}
}
// #endregion SHIELD
