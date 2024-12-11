/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Manager } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Sprite, Texture } from "pixi.js"; // Para crear el sprite
import { Keyboard } from "../../../engine/input/Keyboard"; // Para manejar las teclas
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation"; // Asegúrate de tener acceso al StateMachineAnimator
import { Graphics } from "pixi.js"; // Para la hitbox

export class TopDownGameScene extends PixiScene {
	private player: StateMachineAnimator; // Usamos StateMachineAnimator en lugar de Sprite
	private enemy: Sprite; // Sprite del enemigo
	private attackHitbox: Graphics; // Hitbox de ataque del jugador
	private speed: number = 5; // Velocidad de movimiento del jugador
	private movementDirection: string = "idle"; // Dirección del movimiento (idle, move o attack)

	public static readonly BUNDLES = ["fallrungame", "sfx"]; // Cargamos los bundles necesarios

	constructor() {
		super();
		this.createScene();
	}

	private createScene(): void {
		// Crear al personaje usando StateMachineAnimator
		this.player = new StateMachineAnimator();
		this.player.addState("idle", [Texture.from("player1")], 0.2, true); // Animación idle
		this.player.addState("move", [Texture.from("player2")], 0.1, true); // Animación de movimiento
		this.player.addState("attack", [Texture.from("player3")], 0.1, false); // Animación de ataque, no loop
		this.player.playState("idle"); // Iniciar con el estado idle

		this.player.x = Manager.width * 0.5; // Posición inicial en el centro
		this.player.y = Manager.height * 0.5;
		this.addChild(this.player);

		// Crear al enemigo
		this.enemy = new Sprite(Texture.from("player1"));
		this.enemy.x = Manager.width * 0.7; // Posición del enemigo
		this.enemy.y = Manager.height * 0.5;
		this.addChild(this.enemy);

		// Crear la hitbox de ataque (gráfico con alpha para visualizarla)
		this.attackHitbox = new Graphics();
		this.attackHitbox.beginFill(0xff0000, 0.5); // Rojo, 50% de transparencia
		this.attackHitbox.drawRect(0, 0, 50, 50); // Un área de ataque de 50x50
		this.attackHitbox.endFill();
		this.attackHitbox.x = this.player.x - 25; // Ajuste de la hitbox respecto al jugador
		this.attackHitbox.y = this.player.y - 25;
		this.attackHitbox.visible = false; // Inicialmente invisible
		this.addChild(this.attackHitbox);
	}

	private movePlayer(dx: number, dy: number): void {
		// Mover al jugador sumando los desplazamientos
		this.player.x += dx;
		this.player.y += dy;

		// Actualizar la posición de la hitbox para que se mueva con el jugador
		this.attackHitbox.x = this.player.x - 25; // Ajustamos para que la hitbox se mueva con el jugador
		this.attackHitbox.y = this.player.y - 25;
	}

	private checkAttack(): void {
		// Verificar si la hitbox de ataque del jugador está cerca del enemigo
		const playerHitboxBounds = this.attackHitbox.getBounds();
		const enemyBounds = this.enemy.getBounds();

		// Verificar colisión entre las hitboxes
		if (
			playerHitboxBounds.x < enemyBounds.x + enemyBounds.width &&
			playerHitboxBounds.x + playerHitboxBounds.width > enemyBounds.x &&
			playerHitboxBounds.y < enemyBounds.y + enemyBounds.height &&
			playerHitboxBounds.y + playerHitboxBounds.height > enemyBounds.y
		) {
			// Aquí puedes poner la lógica del ataque, como aplicar daño al enemigo, etc.
			console.log("¡Ataque realizado!");
		}
	}

	public override update(_dt: number): void {
		// Habilitar el control con el teclado
		let moved = false;
		let dx = 0;
		let dy = 0;

		// Comprobamos las teclas presionadas
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

		// Comprobamos si se presiona la tecla de ataque (barra espaciadora)
		if (Keyboard.shared.isDown("Space") && this.movementDirection !== "attack") {
			// Mostrar la hitbox de ataque
			this.attackHitbox.visible = true;
			this.movementDirection = "attack";
			this.player.playState("attack"); // Cambiar a la animación de ataque
		}

		// Si no se está atacando, movemos al jugador
		if (!Keyboard.shared.isDown("Space")) {
			// Si se está moviendo, ajustamos las componentes dx y dy para normalizarlas
			if (moved) {
				// Calcular la magnitud del vector de dirección
				const magnitude = Math.sqrt(dx * dx + dy * dy);

				// Normalizar dx y dy para mantener la velocidad constante en todas las direcciones
				dx = (dx / magnitude) * this.speed;
				dy = (dy / magnitude) * this.speed;

				this.movePlayer(dx, dy);
				this.movementDirection = "move"; // Cambiar al estado de movimiento
			} else {
				// Si no se está moviendo, volver al estado "idle"
				if (this.movementDirection !== "idle") {
					this.movementDirection = "idle";
				}
			}

			// Ocultar la hitbox de ataque cuando no se está atacando
			this.attackHitbox.visible = false;
		}

		// Cambiar la animación de acuerdo al estado de movimiento
		if (this.movementDirection !== "attack") {
			this.player.playState(this.movementDirection);
		}

		// Comprobar si el ataque es válido (el jugador está cerca del enemigo)
		if (this.movementDirection === "attack") {
			this.checkAttack();
		}
	}
}
