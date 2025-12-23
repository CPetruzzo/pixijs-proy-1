import { Model, StandardMaterial, Container3D } from "pixi3d/pixi7"; // Importamos Container3D
import { Color, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { cameraControl } from "../../../index";
import { Keyboard } from "../../../engine/input/Keyboard";
import { EnviromentalLights } from "./Lights/EnviromentalLights";
import { VEHICULE_SPEED } from "../../../utils/constants";
// import { GameObjectFactory } from "./GameObject"; // Ya no lo necesitamos para el player
import { Assets } from "pixi.js";

export interface Bullet extends Mesh3D {
	direction: { x: number; y: number; z: number };
}

export class DoomScene extends PixiScene {
	public static readonly BUNDLES = ["3d", "package-1", "3dshooter"];

	// REEMPLAZO: En lugar de un solo player, usamos un contenedor y dos modelos
	private playerContainer: Container3D;
	private modelIdle: Model;
	private modelRun: Model;
	private currentAnimState: "idle" | "run" = "idle";

	private bullets: any[];
	private enemies: any[];
	private keys: Record<string, boolean> = {};
	public cameraControl: any;
	public enviromentalLights: EnviromentalLights;

	private lastCameraPosition = { x: 20, y: 0, z: 50 };
	private cameraLerpSpeed = 0.8;

	private spawnInterval = 3;
	private lastSpawnTime = 0;

	private bulletDirections: { x: number; y: number; z: number }[] = [];

	constructor() {
		super();

		const ground = this.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(100, 1, 100);

		this.cameraControl = cameraControl;
		this.cameraControl.distance = 15;
		this.cameraControl.angles.x = 25;
		this.cameraControl.target = { x: 20, y: 1.3, z: 50 };

		this.enviromentalLights = new EnviromentalLights();

		// Llamamos a init al final del constructor
		this.init();
	}

	private init(): void {
		this.setupPlayer();
		this.setupEnemies();
		this.setupControls();
	}

	/**
	 * Función de limpieza (Igual que en SideScroller)
	 */
	private cleanModel(model: Container3D): void {
		const checkChildren = (obj: Container3D): void => {
			obj.children.forEach((child) => {
				const name = child.name.toLowerCase();
				if (name.includes("cube") || name.includes("box")) {
					child.visible = false;
				}
				if (child instanceof Container3D) {
					checkChildren(child);
				}
			});
		};
		checkChildren(model);
	}

	private setupPlayer(): void {
		// 1. Creamos el contenedor padre (Invisible, solo lógica)
		this.playerContainer = new Container3D();
		this.playerContainer.name = "firstperson";
		// Mantenemos la escala y posición que tenías
		this.playerContainer.scale.set(4, 4, 4);
		this.playerContainer.y = 150; // Ojo: ¿150 de altura? Asegúrate de que esto sea correcto.

		// 2. Cargar IDLE ("futurecop")
		this.modelIdle = Model.from(Assets.get("futurecop"));
		this.modelIdle.name = "Idle";
		this.cleanModel(this.modelIdle);
		if (this.modelIdle.animations.length > 0) {
			this.modelIdle.animations[0].loop = true;
			this.modelIdle.animations[0].play();
		}
		this.playerContainer.addChild(this.modelIdle);

		// 3. Cargar RUN ("futurecoprunforward")
		this.modelRun = Model.from(Assets.get("futurecoprunforward"));
		this.modelRun.name = "Run";
		this.cleanModel(this.modelRun);
		if (this.modelRun.animations.length > 0) {
			this.modelRun.animations[0].loop = true;
			this.modelRun.animations[0].play();
		}
		this.modelRun.visible = false; // Oculto al principio
		this.playerContainer.addChild(this.modelRun);

		// 4. Añadir a la escena
		this.addChild(this.playerContainer);
		this.bullets = [];
	}

	private setupEnemies(): void {
		this.enemies = [];
		for (let i = 0; i < 5; i++) {
			const enemy = Mesh3D.createCube();
			enemy.position.set(Math.random() * 10 - 5, 2, -Math.random() * 10 - 5);
			const enemyMaterial = new StandardMaterial();
			enemyMaterial.baseColor = new Color(1, 0, 0);
			enemy.material = enemyMaterial;
			this.addChild(enemy);
			this.enemies.push(enemy);
		}
	}

	private setupControls(): void {
		this.keys = {};
		window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
		window.addEventListener("keyup", (e) => (this.keys[e.code] = false));
	}

	private spawnEnemy(): void {
		const enemy = Mesh3D.createCube();
		enemy.position.set(Math.random() * 20 - 10, 0, -Math.random() * 20 - 10);
		const enemyMaterial = new StandardMaterial();
		enemyMaterial.baseColor = new Color(1, 0, 0);
		enemy.material = enemyMaterial;
		this.addChild(enemy);
		this.enemies.push(enemy);
	}

	public override update(delta: number): void {
		// En lugar de this.player.update(delta), movemos el contenedor
		// Si PhysicsContainer3d tenía lógica interna, habría que replicarla,
		// pero por ahora solo manejamos posición visual.

		this.handleCameraMovement(delta);

		// Sincronizar posición del jugador con el target de la cámara (Estilo Doom/Tanque)
		this.playerContainer.position.set(this.cameraControl.target.x, this.cameraControl.target.y, this.cameraControl.target.z);

		// Rotar el jugador según la cámara
		this.playerContainer.rotationQuaternion.setEulerAngles(0, this.cameraControl.angles.y, 0);

		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.cameraControl.angles.y += 2;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			this.cameraControl.angles.y -= 2;
		}

		this.handlePlayerMovement(delta);

		// --- NUEVO: Manejo de Animaciones ---
		this.handlePlayerAnimation();

		this.handleShooting();
		this.updateBullets();
		this.updateEnemies();
		this.handleEnemySpawning(delta);
	}

	/**
	 * Lógica para cambiar entre Idle y Run
	 */
	private handlePlayerAnimation(): void {
		// Detectar si alguna tecla de movimiento está presionada
		const isMoving = Keyboard.shared.isDown("KeyW") || Keyboard.shared.isDown("KeyS") || Keyboard.shared.isDown("KeyA") || Keyboard.shared.isDown("KeyD");

		const nextState = isMoving ? "run" : "idle";

		if (this.currentAnimState !== nextState) {
			this.currentAnimState = nextState;

			// Ocultar ambos
			this.modelIdle.visible = false;
			this.modelRun.visible = false;

			// Mostrar el correcto
			if (nextState === "idle") {
				this.modelIdle.visible = true;
			} else {
				this.modelRun.visible = true;
			}
		}
	}

	private handleCameraMovement(_delta?: number): void {
		const targetX = this.cameraControl.target.x;
		const targetY = this.cameraControl.target.y;
		const targetZ = this.cameraControl.target.z;

		this.cameraControl.target.x = this.lastCameraPosition.x + (targetX - this.lastCameraPosition.x) * this.cameraLerpSpeed;
		this.cameraControl.target.y = this.lastCameraPosition.y + (targetY - this.lastCameraPosition.y) * this.cameraLerpSpeed;
		this.cameraControl.target.z = this.lastCameraPosition.z + (targetZ - this.lastCameraPosition.z) * this.cameraLerpSpeed;

		this.lastCameraPosition = { ...this.cameraControl.target };
	}

	private handleEnemySpawning(delta: number): void {
		this.lastSpawnTime += delta / 1000;
		if (this.lastSpawnTime >= this.spawnInterval) {
			this.spawnEnemy();
			this.lastSpawnTime = 0;
		}
	}

	private handlePlayerMovement(_delta?: number): void {
		const angleYRad = cameraControl.angles.y * (Math.PI / 180);
		const moveX = VEHICULE_SPEED * Math.sin(angleYRad);
		const moveZ = VEHICULE_SPEED * Math.cos(angleYRad);

		if (Keyboard.shared.isDown("KeyA")) {
			cameraControl.target.z -= moveX;
			cameraControl.target.x += moveZ;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			cameraControl.target.z += moveX;
			cameraControl.target.x -= moveZ;
		}
		if (Keyboard.shared.isDown("KeyW")) {
			cameraControl.target.z += moveZ;
			cameraControl.target.x += moveX;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			cameraControl.target.z -= moveZ;
			cameraControl.target.x -= moveX;
		}
	}

	private handleShooting(): void {
		if (Keyboard.shared.justPressed("Space")) {
			const bullet = Mesh3D.createCube();
			bullet.scale.set(0.2, 0.2, 0.2);
			// Usamos playerContainer en lugar de player
			bullet.position.set(this.playerContainer.position.x, 0, this.playerContainer.position.z);

			const bulletMaterial = new StandardMaterial();
			bulletMaterial.baseColor = new Color(1, 1, 0);
			bullet.material = bulletMaterial;

			this.bullets.push(bullet);
			this.addChild(bullet);
		}
	}

	private updateBullets(): void {
		const cameraDirectionX = Math.sin(this.cameraControl.angles.y * (Math.PI / 180));
		const cameraDirectionZ = Math.cos(this.cameraControl.angles.y * (Math.PI / 180));

		this.bullets.forEach((bullet, index) => {
			if (!this.bulletDirections[index]) {
				this.bulletDirections[index] = {
					x: cameraDirectionX,
					y: 0,
					z: cameraDirectionZ,
				};
			}

			const bulletDirection = this.bulletDirections[index];
			bullet.position.x += bulletDirection.x;
			bullet.position.z += bulletDirection.z;

			// Usamos playerContainer para calcular distancia
			const distance = Math.sqrt((bullet.position.x - this.playerContainer.position.x) ** 2 + (bullet.position.z - this.playerContainer.position.z) ** 2);

			if (distance > 60) {
				this.removeChild(bullet);
				this.bullets.splice(index, 1);
				this.bulletDirections.splice(index, 1);
			}
		});
	}

	private updateEnemies(): void {
		this.enemies.forEach((enemy, enemyIndex) => {
			// Usamos playerContainer para que los enemigos sigan al jugador
			const directionX = this.playerContainer.position.x - enemy.position.x;
			const directionZ = this.playerContainer.position.z - enemy.position.z;
			const length = Math.sqrt(directionX ** 2 + directionZ ** 2);

			if (length > 0) {
				enemy.position.x += (directionX / length) * 0.05;
				enemy.position.z += (directionZ / length) * 0.05;
			}

			this.bullets.forEach((bullet, bulletIndex) => {
				if (Math.abs(enemy.position.z - bullet.position.z) < 0.5 && Math.abs(enemy.position.x - bullet.position.x) < 0.5) {
					const cublosion = Model.from(Assets.get("cublosion"));
					cublosion.animations[0].loop = false;
					cublosion.animations[0].speed = 2;
					cublosion.animations[0].play();
					cublosion.position.set(enemy.position.x, enemy.position.y - 1, enemy.position.z);

					this.removeChild(enemy);
					this.removeChild(bullet);
					this.enemies.splice(enemyIndex, 1);
					this.bullets.splice(bulletIndex, 1);

					this.addChild(cublosion);

					const animationDuration = cublosion.animations[0].duration;
					setTimeout(() => {
						this.removeChild(cublosion);
					}, animationDuration * 1000);
				}
			});
		});
	}
}
