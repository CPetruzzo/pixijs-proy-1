import { Tween } from "tweedle.js";
import { Keyboard } from "../../../../engine/input/Keyboard";
import type { Player } from "../Objects/Player";

export class PlayerController {
	private player: Player;
	public isMoving: boolean = false;
	private moveTween: Tween<Player>;

	constructor(player: Player) {
		this.player = player;
	}

	public onKeyDown(background: any): void {
		if (this.player.canMove) {
			if (Keyboard.shared.isDown("ArrowLeft") || Keyboard.shared.isDown("KeyA")) {
				this.moveLeft();
			} else if (Keyboard.shared.isDown("ArrowRight") || Keyboard.shared.isDown("KeyD")) {
				this.moveRight(background);
			}
		}
	}

	public onMouseMove(event: any, background: any): void {
		if (!this.isMoving) {
			const globalMousePosition = background.toLocal(event.data.global);
			const targetX = Math.max(Math.min(globalMousePosition.x, background.width - this.player.width * 0.3), this.player.width * 0.3);
			const distance = targetX - this.player.x;
			this.player.movingLeft = distance < 0;
			this.player.setDirection(this.player.movingLeft);

			const duration = Math.abs(distance) / this.player.speed;
			this.player.playState("move");

			this.moveTween = new Tween(this.player).to({ x: targetX }, duration).onComplete(() => {
				this.isMoving = false;
			});

			if (this.player.canMove) {
				this.moveTween.start();
			}

			this.isMoving = true;
		}
	}

	public onMouseStop(): void {
		if (this.moveTween) {
			this.moveTween.pause();
		}
		this.isMoving = false;
		this.player.playState("idle");
	}

	private moveLeft(): void {
		this.isMoving = true;
		this.player.movingLeft = true;
		this.player.setDirection(this.player.movingLeft);
		if (this.player.x > this.player.width * 0.3) {
			this.player.x -= this.player.speed * 15;
		}
	}

	private moveRight(background: any): void {
		this.isMoving = true;
		this.player.movingLeft = false;
		this.player.setDirection(this.player.movingLeft);
		if (this.player.x < background.width - this.player.width * 0.3) {
			this.player.x += this.player.speed * 15;
		}
	}

	public isPlayerMoving(): boolean {
		return this.isMoving;
	}

	public mouseMovements(background: any): void {
		background.on("pointerdown", (event: any) => this.onMouseMove(event, background));
		background.on("pointerup", () => {
			if (this.isMoving) {
				this.onMouseStop();
			}
		});
	}
}
