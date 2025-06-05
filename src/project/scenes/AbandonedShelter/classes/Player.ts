import type { Graphics } from "pixi.js";
import { Container, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";
import type { IHitable } from "../../../../engine/collision/IHitable";
import { HitPoly } from "../../../../engine/collision/HitPoly";
import { Keyboard } from "../../../../engine/input/Keyboard";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export interface PlayerConfig {
	x?: number;
	y?: number;
	speed?: number;
	/** Límite mínimo en X (no podrá moverse más a la izquierda de este valor) */
	leftLimit?: number;
	/** Límite máximo en X (no podrá moverse más a la derecha de este valor) */
	rightLimit?: number;
}

export class AHPlayer extends Container {
	public animator: StateMachineAnimator;
	public hitbox: Graphics & IHitable;
	private speed: number;
	private isWalking = false;
	/** Límite mínimo permitido en X */
	private leftLimit: number;
	/** Límite máximo permitido en X */
	private rightLimit: number;

	constructor(config: PlayerConfig = {}) {
		super();

		this.speed = config.speed ?? 200;
		this.x = config.x ?? 0;
		this.y = config.y ?? 0;

		// Si el usuario no especificó límites, los ponemos en ±Infinity
		this.leftLimit = config.leftLimit !== undefined ? config.leftLimit : -Infinity;
		this.rightLimit = config.rightLimit !== undefined ? config.rightLimit : Number(Infinity);

		// Animator setup
		this.animator = new StateMachineAnimator();
		this.animator.anchor.set(0.5);
		this.animator.addState("idle", [Texture.from("AH_idle")], 4, true);
		this.animator.addState("walk", [Texture.from("AH_walk1"), Texture.from("AH_walk2")], 4, true);
		this.animator.playState("idle");
		this.addChild(this.animator);

		// Hitbox for collisions
		this.hitbox = HitPoly.makeBox(-25, -50, 50, 100, false);
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
				SoundLib.playMusic("steps", { volume: 0.02, speed: 2, loop: true });
				this.animator.playState("walk");
				this.isWalking = true;
			}

			// Calculamos movimiento deseado
			const dir = right ? 1 : -1;
			const dx = dir * this.speed * (dt / 1000);
			let newX = this.x + dx;

			// Clamp: no salir de [leftLimit, rightLimit]
			if (newX < this.leftLimit) {
				newX = this.leftLimit;
			}
			if (newX > this.rightLimit) {
				newX = this.rightLimit;
			}

			// Si al haber hecho clamp no se mueve, simplemente no deleguemos flip/animación de caminar
			if (this.x !== newX) {
				this.x = newX;
				this.scale.x = dir; // volteo horizontal según dirección
			} else {
				// Si al intentar moverse ya estamos en el límite horizontal,
				// dejamos animación de “idle” (o podríamos seguir la animación de “walk” sin desplazar)
				// Aquí optamos por detener el paso si no nos movemos realmente:
				SoundLib.stopMusic("steps");
				this.animator.playState("idle");
				this.isWalking = false;
				return;
			}
		} else if (this.isWalking) {
			// Dejar de caminar
			SoundLib.stopMusic("steps");
			this.animator.playState("idle");
			this.isWalking = false;
		}
	}

	/**
	 * Permite ajustar dinámicamente los límites en caso de que quieras cambiarlos en tiempo de ejecución.
	 */
	public setHorizontalBounds(left: number, right: number): void {
		this.leftLimit = left;
		this.rightLimit = right;
	}
}
