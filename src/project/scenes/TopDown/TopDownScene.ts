/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Manager } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Sprite, Texture, Graphics, Container } from "pixi.js";
import { Keyboard } from "../../../engine/input/Keyboard";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";

export class TopDownGameScene extends PixiScene {
	private player: StateMachineAnimator;
	private enemy: Sprite;
	private attackHitbox: Graphics;
	private maskArea: Graphics;
	private focusContainer: Container;
	private speed: number = 5;
	private movementDirection: string = "idle";

	public static readonly BUNDLES = ["fallrungame", "sfx"];

	constructor() {
		super();
		this.createScene();
	}

	private createScene(): void {
		// Crear un contenedor para el enfoque
		this.focusContainer = new Container();
		this.addChild(this.focusContainer);

		// Crear al personaje usando StateMachineAnimator
		this.player = new StateMachineAnimator();
		this.player.anchor.set(0.5);
		this.player.addState("idle", [Texture.from("player1")], 0.2, true);
		this.player.addState("move", [Texture.from("player2")], 0.1, true);
		this.player.addState("attack", [Texture.from("player3")], 0.1, false);
		this.player.playState("idle");

		this.player.x = Manager.width * 0.5;
		this.player.y = Manager.height * 0.5;
		this.focusContainer.addChild(this.player);

		// Crear al enemigo
		this.enemy = new Sprite(Texture.from("player1"));
		this.enemy.x = Manager.width * 0.7;
		this.enemy.y = Manager.height * 0.5;
		this.addChild(this.enemy);

		// Crear la hitbox de ataque
		this.attackHitbox = new Graphics();
		this.attackHitbox.beginFill(0xff0000, 0.5);
		this.attackHitbox.drawRect(0, 0, 50, 50);
		this.attackHitbox.endFill();
		this.attackHitbox.x = this.player.x - 25;
		this.attackHitbox.y = this.player.y - 25;
		this.attackHitbox.visible = false;
		this.focusContainer.addChild(this.attackHitbox);

		// Crear la máscara para el área de enfoque
		this.maskArea = new Graphics();
		this.maskArea.beginFill(0x000000, 1);
		this.maskArea.drawCircle(0, 0, 100); // Enfoque circular alrededor del jugador
		this.maskArea.endFill();
		this.focusContainer.mask = this.maskArea;
		this.addChild(this.maskArea);
	}

	private movePlayer(dx: number, dy: number): void {
		this.player.x += dx;
		this.player.y += dy;
		this.attackHitbox.x = this.player.x - 25;
		this.attackHitbox.y = this.player.y - 25;

		// Actualizar la posición de la máscara
		this.maskArea.x = this.player.x;
		this.maskArea.y = this.player.y;
	}

	private checkAttack(): void {
		const playerHitboxBounds = this.attackHitbox.getBounds();
		const enemyBounds = this.enemy.getBounds();

		if (
			playerHitboxBounds.x < enemyBounds.x + enemyBounds.width &&
			playerHitboxBounds.x + playerHitboxBounds.width > enemyBounds.x &&
			playerHitboxBounds.y < enemyBounds.y + enemyBounds.height &&
			playerHitboxBounds.y + playerHitboxBounds.height > enemyBounds.y
		) {
			console.log("¡Ataque realizado!");
		}
	}

	public override update(_dt: number): void {
		let moved = false;
		let dx = 0;
		let dy = 0;

		if (Keyboard.shared.isDown("ArrowUp")) {
			dy -= 1;
			moved = true;
		}
		if (Keyboard.shared.isDown("ArrowDown")) {
			dy += 1;
			moved = true;
		}
		if (Keyboard.shared.isDown("ArrowLeft")) {
			dx -= 1;
			moved = true;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			dx += 1;
			moved = true;
		}

		if (Keyboard.shared.isDown("Space") && this.movementDirection !== "attack") {
			this.attackHitbox.visible = true;
			this.movementDirection = "attack";
			this.player.playState("attack");
		}

		if (!Keyboard.shared.isDown("Space")) {
			if (moved) {
				const magnitude = Math.sqrt(dx * dx + dy * dy);
				dx = (dx / magnitude) * this.speed;
				dy = (dy / magnitude) * this.speed;
				this.movePlayer(dx, dy);
				this.movementDirection = "move";
			} else if (this.movementDirection !== "idle") {
				this.movementDirection = "idle";
			}
			this.attackHitbox.visible = false;
		}

		if (this.movementDirection !== "attack") {
			this.player.playState(this.movementDirection);
		}

		if (this.movementDirection === "attack") {
			this.checkAttack();
		}
	}
}
