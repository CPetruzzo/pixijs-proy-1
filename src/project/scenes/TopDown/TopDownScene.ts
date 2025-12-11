/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Manager } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Sprite, Texture, Graphics, Container } from "pixi.js";
import { Keyboard } from "../../../engine/input/Keyboard";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";

interface Enemy {
	sprite: Sprite;
	health: number;
	maxHealth: number;
	healthBar: Graphics;
	speed: number;
	state: "patrol" | "chase" | "dead";
	patrolDirection: { x: number; y: number };
	patrolTimer: number;
}

export class TopDownGameScene extends PixiScene {
	private player: StateMachineAnimator;
	private enemies: Enemy[] = [];
	private attackHitbox: Graphics;
	private camera: Container;
	private world: Container;
	private playerSpeed: number = 0.6;
	private movementDirection: string = "idle";
	private attackCooldown: number = 0;
	private attackDuration: number = 0;
	private playerHealth: number = 100;
	private playerMaxHealth: number = 100;
	private healthBar: Graphics;
	private worldObjects: Sprite[] = [];
	private currentState: string = "idle"; // Nuevo: rastrear el estado actual

	// Dimensiones del mundo
	private readonly WORLD_WIDTH = (832 * 2000) / 840;
	private readonly WORLD_HEIGHT = (1248 * 2000) / 840;

	public static readonly BUNDLES = ["fallrungame", "sfx", "myfriend"];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public readonly MOVEMENT_SPEED: number = 0.01;

	constructor() {
		super();
		this.createScene();
	}

	private createScene(): void {
		// Crear el mundo (contenedor principal)
		this.world = new Container();
		this.addChild(this.world);

		// Crear la cámara
		this.camera = new Container();
		this.world.addChild(this.camera);

		// Crear el fondo del mundo
		this.createWorldBackground();

		// Crear objetos decorativos en el mundo
		// this.createWorldObjects();

		// Crear al personaje usando StateMachineAnimator
		this.player = new StateMachineAnimator();
		this.player.anchor.set(0.5);
		this.player.addState("idle", [Texture.from("soul_walk0")], 0.2, true);
		this.player.addState(
			"move",
			[
				Texture.from("soul_walk1"),
				Texture.from("soul_walk2"),
				Texture.from("soul_walk3"),
				Texture.from("soul_walk4"),
				Texture.from("soul_walk5"),
				Texture.from("soul_walk6"),
			],
			6,
			true
		);
		this.player.addState("attack", [Texture.from("player3")], 0.1, false);
		this.player.playState("idle");
		this.player.scale.set(1.5);

		// Posicionar al jugador en el centro del mundo
		this.player.x = this.WORLD_WIDTH * 0.5;
		this.player.y = this.WORLD_HEIGHT * 0.5;
		this.camera.addChild(this.player);

		// Crear enemigos en diferentes posiciones
		// this.createEnemies();

		// Crear la hitbox de ataque
		this.attackHitbox = new Graphics();
		this.attackHitbox.beginFill(0xff0000, 0.3);
		this.attackHitbox.drawCircle(0, 0, 40);
		this.attackHitbox.endFill();
		this.attackHitbox.visible = false;
		this.camera.addChild(this.attackHitbox);

		// Crear UI (barra de vida)
		this.createUI();

		// Centrar la cámara en el jugador
		this.updateCamera();
	}

	private createWorldBackground(): void {
		// Crear el fondo usando el sprite del mapa
		const background = new Sprite(Texture.from("soul_map4"));
		background.x = 0;
		background.y = 0;

		// Ajustar el tamaño del background para que cubra todo el mundo
		background.width = this.WORLD_WIDTH;
		background.height = this.WORLD_HEIGHT;

		this.camera.addChildAt(background, 0);
	}

	public createWorldObjects(): void {
		// Crear árboles/obstáculos aleatorios por el mundo
		const objectCount = 30;
		for (let i = 0; i < objectCount; i++) {
			const obj = new Sprite(Texture.from("player1"));
			obj.anchor.set(0.5);
			obj.tint = 0x8b4513; // Color café para simular árboles
			obj.scale.set(2);

			// Posición aleatoria evitando el centro donde aparece el jugador
			let x, y;
			do {
				x = Math.random() * (this.WORLD_WIDTH - 200) + 100;
				y = Math.random() * (this.WORLD_HEIGHT - 200) + 100;
			} while (Math.abs(x - this.WORLD_WIDTH * 0.5) < 200 && Math.abs(y - this.WORLD_HEIGHT * 0.5) < 200);

			obj.x = x;
			obj.y = y;
			this.worldObjects.push(obj);
			this.camera.addChild(obj);
		}
	}

	public createEnemies(): void {
		const enemyPositions = [
			{ x: this.WORLD_WIDTH * 0.3, y: this.WORLD_HEIGHT * 0.3 },
			{ x: this.WORLD_WIDTH * 0.7, y: this.WORLD_HEIGHT * 0.3 },
			{ x: this.WORLD_WIDTH * 0.3, y: this.WORLD_HEIGHT * 0.7 },
			{ x: this.WORLD_WIDTH * 0.7, y: this.WORLD_HEIGHT * 0.7 },
			{ x: this.WORLD_WIDTH * 0.5, y: this.WORLD_HEIGHT * 0.2 },
			{ x: this.WORLD_WIDTH * 0.2, y: this.WORLD_HEIGHT * 0.5 },
		];

		enemyPositions.forEach((pos) => {
			const sprite = new Sprite(Texture.from("player1"));
			sprite.anchor.set(0.5);
			sprite.tint = 0xff0000;
			sprite.scale.set(1.2);
			sprite.x = pos.x;
			sprite.y = pos.y;
			this.camera.addChild(sprite);

			// Crear barra de vida del enemigo
			const healthBar = new Graphics();
			this.camera.addChild(healthBar);

			const enemy: Enemy = {
				sprite,
				health: 30,
				maxHealth: 30,
				healthBar,
				speed: 2,
				state: "patrol",
				patrolDirection: { x: Math.random() - 0.5, y: Math.random() - 0.5 },
				patrolTimer: 0,
			};

			this.enemies.push(enemy);
		});
	}

	private createUI(): void {
		// Crear contenedor de UI (no se mueve con la cámara)
		const uiContainer = new Container();
		this.addChild(uiContainer);

		// Barra de vida del jugador
		this.healthBar = new Graphics();
		this.updateHealthBar();
		uiContainer.addChild(this.healthBar);

		// Texto de instrucciones
		const instructions = new Graphics();
		instructions.beginFill(0x000000, 0.7);
		instructions.drawRoundedRect(10, Manager.height - 100, 300, 90, 5);
		instructions.endFill();
		uiContainer.addChild(instructions);
	}

	private updateHealthBar(): void {
		this.healthBar.clear();

		// Fondo de la barra
		this.healthBar.beginFill(0x333333);
		this.healthBar.drawRoundedRect(10, 10, 200, 20, 5);
		this.healthBar.endFill();

		// Vida actual
		const healthPercent = this.playerHealth / this.playerMaxHealth;
		const color = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffaa00 : 0xff0000;

		this.healthBar.beginFill(color);
		this.healthBar.drawRoundedRect(10, 10, 200 * healthPercent, 20, 5);
		this.healthBar.endFill();

		// Borde
		this.healthBar.lineStyle(2, 0xffffff);
		this.healthBar.drawRoundedRect(10, 10, 200, 20, 5);
	}

	private updateCamera(): void {
		// Centrar la cámara en el jugador
		this.camera.x = Manager.width * 0.5 - this.player.x;
		this.camera.y = Manager.height * 0.5 - this.player.y;

		// Limitar la cámara a los bordes del mundo
		const minX = Manager.width - this.WORLD_WIDTH;
		const minY = Manager.height - this.WORLD_HEIGHT;

		this.camera.x = Math.max(minX, Math.min(0, this.camera.x));
		this.camera.y = Math.max(minY, Math.min(0, this.camera.y));
	}

	private movePlayer(dx: number, dy: number): void {
		const newX = this.player.x + dx;
		const newY = this.player.y + dy;

		// Limitar el movimiento a los bordes del mundo
		if (newX >= 50 && newX <= this.WORLD_WIDTH - 50) {
			this.player.x = newX;
		}
		if (newY >= 50 && newY <= this.WORLD_HEIGHT - 50) {
			this.player.y = newY;
		}

		this.updateCamera();
	}

	private updateEnemies(dt: number): void {
		this.enemies.forEach((enemy, _index) => {
			if (enemy.state === "dead") {
				return;
			}

			const dx = this.player.x - enemy.sprite.x;
			const dy = this.player.y - enemy.sprite.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Actualizar estado del enemigo
			if (distance < 250) {
				enemy.state = "chase";
			} else {
				enemy.state = "patrol";
			}

			// Comportamiento según el estado
			if (enemy.state === "chase") {
				// Perseguir al jugador
				const moveX = (dx / distance) * enemy.speed;
				const moveY = (dy / distance) * enemy.speed;
				enemy.sprite.x += moveX;
				enemy.sprite.y += moveY;

				// Daño por contacto
				if (distance < 40 && this.movementDirection !== "attack") {
					this.playerHealth -= 0.3;
					this.playerHealth = Math.max(0, this.playerHealth);
					this.updateHealthBar();
				}
			} else {
				// Patrullar
				enemy.patrolTimer += dt;
				if (enemy.patrolTimer > 2000) {
					enemy.patrolDirection = {
						x: Math.random() - 0.5,
						y: Math.random() - 0.5,
					};
					enemy.patrolTimer = 0;
				}

				enemy.sprite.x += enemy.patrolDirection.x * enemy.speed;
				enemy.sprite.y += enemy.patrolDirection.y * enemy.speed;

				// Limitar patrulla a los bordes del mundo
				enemy.sprite.x = Math.max(50, Math.min(this.WORLD_WIDTH - 50, enemy.sprite.x));
				enemy.sprite.y = Math.max(50, Math.min(this.WORLD_HEIGHT - 50, enemy.sprite.y));
			}

			// Actualizar barra de vida del enemigo
			this.updateEnemyHealthBar(enemy);
		});
	}

	private updateEnemyHealthBar(enemy: Enemy): void {
		enemy.healthBar.clear();

		if (enemy.health <= 0) {
			return;
		}

		const barWidth = 40;
		const barHeight = 5;
		const healthPercent = enemy.health / enemy.maxHealth;

		// Fondo
		enemy.healthBar.beginFill(0x000000);
		enemy.healthBar.drawRect(enemy.sprite.x - barWidth / 2, enemy.sprite.y - 40, barWidth, barHeight);
		enemy.healthBar.endFill();

		// Vida
		enemy.healthBar.beginFill(0xff0000);
		enemy.healthBar.drawRect(enemy.sprite.x - barWidth / 2, enemy.sprite.y - 40, barWidth * healthPercent, barHeight);
		enemy.healthBar.endFill();
	}

	private performAttack(): void {
		this.attackHitbox.x = this.player.x;
		this.attackHitbox.y = this.player.y;
		this.attackHitbox.visible = true;

		// Verificar colisión con enemigos
		this.enemies.forEach((enemy) => {
			if (enemy.state === "dead" || enemy.health <= 0) {
				return;
			}

			const dx = enemy.sprite.x - this.player.x;
			const dy = enemy.sprite.y - this.player.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < 50) {
				enemy.health -= 15;

				if (enemy.health <= 0) {
					enemy.state = "dead";
					enemy.sprite.alpha = 0.3;
					enemy.healthBar.clear();
					console.log("¡Enemigo derrotado!");
				}
			}
		});
	}

	public override update(dt: number): void {
		let moved = false;
		let dx = 0;
		let dy = 0;
		let scalex = 1.5;
		let scaley = 1.5;

		// Actualizar cooldowns
		if (this.attackCooldown > 0) {
			this.attackCooldown -= dt;
		}
		if (this.attackDuration > 0) {
			this.attackDuration -= dt;
			if (this.attackDuration <= 0) {
				this.attackHitbox.visible = false;
			}
		}

		// Movimiento del jugador
		if (Keyboard.shared.isDown("ArrowUp") || Keyboard.shared.isDown("KeyW")) {
			dy -= this.MOVEMENT_SPEED;
			moved = true;
		}
		if (Keyboard.shared.isDown("ArrowDown") || Keyboard.shared.isDown("KeyS")) {
			dy += this.MOVEMENT_SPEED;
			moved = true;
		}
		if (Keyboard.shared.isDown("ArrowLeft") || Keyboard.shared.isDown("KeyA")) {
			dx -= this.MOVEMENT_SPEED;
			moved = true;
			scalex = -1.5;
		}
		if (Keyboard.shared.isDown("ArrowRight") || Keyboard.shared.isDown("KeyD")) {
			dx += this.MOVEMENT_SPEED;
			moved = true;
		}

		// Ataque
		if (Keyboard.shared.isDown("Space") && this.attackCooldown <= 0) {
			this.movementDirection = "attack";
			if (this.currentState !== "attack") {
				this.currentState = "attack";
				this.player.playState("attack");
			}
			this.performAttack();
			this.attackCooldown = 500; // 500ms de cooldown
			this.attackDuration = 200; // Duración del ataque
		}

		// Aplicar movimiento
		if (moved && this.attackDuration <= 0) {
			const magnitude = Math.sqrt(dx * dx + dy * dy);
			dx = (dx / magnitude) * this.playerSpeed;
			dy = (dy / magnitude) * this.playerSpeed;
			this.movePlayer(dx, dy);
			this.player.scale.set(scalex, scaley);

			if (this.movementDirection !== "attack") {
				this.movementDirection = "move";
				if (this.currentState !== "move") {
					this.currentState = "move";
					this.player.playState("move");
				}
			}
		} else if (!moved && this.attackDuration <= 0) {
			if (this.movementDirection !== "idle") {
				this.movementDirection = "idle";
				this.currentState = "idle";

				this.player.playState("idle");
			}
		}

		// Actualizar enemigos
		this.updateEnemies(dt);

		// Game Over
		if (this.playerHealth <= 0) {
			console.log("Game Over!");
		}
	}
}
