import { Model, StandardMaterial } from "pixi3d/pixi7";
import { Color, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { cameraControl } from "../../../index"; // Importamos la cámara global
import { Keyboard } from "../../../engine/input/Keyboard";
import { EnviromentalLights } from "./Lights/Light";
import { VEHICULE_SPEED } from "../../../utils/constants";
import { GameObjectFactory } from "./GameObject";
import type { PhysicsContainer3d } from "./3DPhysicsContainer";
import { Assets } from "pixi.js";

export interface Bullet extends Mesh3D {
	direction: { x: number; y: number; z: number };
}

export class DoomScene extends PixiScene {
	public static readonly BUNDLES = ["3d", "package-1"];

	private player: PhysicsContainer3d;
	private bullets: any[];
	private enemies: any[];
	private keys: Record<string, boolean> = {};
	public cameraControl: any;
	public enviromentalLights: EnviromentalLights;

	private lastCameraPosition = { x: 20, y: 0, z: 50 }; // Posición inicial de la cámara
	private cameraLerpSpeed = 0.8; // Factor de suavizado

	private spawnInterval = 3; // Intervalo en segundos para generar nuevos enemigos
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

		this.init();

		this.enviromentalLights = new EnviromentalLights();
	}

	private init(): void {
		this.setupPlayer();
		this.setupEnemies();
		this.setupControls();
	}

	private setupPlayer(): void {
		this.player = GameObjectFactory.createPlayer("futurecop");
		this.player.name = "firstperson";
		this.player.scale.set(4, 4, 4);
		this.player.y = 150;

		this.addChild(this.player);
		this.bullets = [];
	}

	private setupEnemies(): void {
		this.enemies = [];
		for (let i = 0; i < 5; i++) {
			const enemy = Mesh3D.createCube();
			enemy.position.set(Math.random() * 10 - 5, 2, -Math.random() * 10 - 5);

			const enemyMaterial = new StandardMaterial();
			enemyMaterial.baseColor = new Color(1, 0, 0); // Rojo
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
		enemyMaterial.baseColor = new Color(1, 0, 0); // Rojo
		enemy.material = enemyMaterial;

		this.addChild(enemy);
		this.enemies.push(enemy);
	}

	public override update(delta: number): void {
		this.player.update(delta);

		// Movemos la cámara con un delay usando Lerp
		this.handleCameraMovement(delta);
		this.player.position.set(this.cameraControl.target.x, this.cameraControl.target.y, this.cameraControl.target.z);
		this.player.rotationQuaternion.setEulerAngles(0, this.cameraControl.angles.y, 0);

		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.cameraControl.angles.y += 2;
		}

		if (Keyboard.shared.isDown("ArrowRight")) {
			this.cameraControl.angles.y -= 2;
		}

		this.handlePlayerMovement(delta);
		this.handleShooting();
		this.updateBullets();
		this.updateEnemies();
		this.handleEnemySpawning(delta); // Controlamos el respawn de enemigos
	}

	// Método para suavizar el movimiento de la cámara
	private handleCameraMovement(_delta?: number): void {
		// Calculamos la nueva posición deseada de la cámara
		const targetX = this.cameraControl.target.x;
		const targetY = this.cameraControl.target.y;
		const targetZ = this.cameraControl.target.z;

		// Lerp entre la última posición conocida y la nueva posición
		this.cameraControl.target.x = this.lastCameraPosition.x + (targetX - this.lastCameraPosition.x) * this.cameraLerpSpeed;
		this.cameraControl.target.y = this.lastCameraPosition.y + (targetY - this.lastCameraPosition.y) * this.cameraLerpSpeed;
		this.cameraControl.target.z = this.lastCameraPosition.z + (targetZ - this.lastCameraPosition.z) * this.cameraLerpSpeed;

		// Guardamos la posición actual para la próxima iteración
		this.lastCameraPosition = { ...this.cameraControl.target };
	}

	private handleEnemySpawning(delta: number): void {
		this.lastSpawnTime += delta / 1000; // Convertimos delta a segundos
		if (this.lastSpawnTime >= this.spawnInterval) {
			this.spawnEnemy(); // Generamos un nuevo enemigo
			this.lastSpawnTime = 0; // Reiniciamos el temporizador
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
			bullet.position.set(this.player.position.x, 0, this.player.position.z);

			const bulletMaterial = new StandardMaterial();
			bulletMaterial.baseColor = new Color(1, 1, 0); // Amarillo
			bullet.material = bulletMaterial;

			this.bullets.push(bullet);
			this.addChild(bullet);
		}
	}

	private updateBullets(): void {
		// Obtener la dirección de la cámara
		const cameraDirectionX = Math.sin(this.cameraControl.angles.y * (Math.PI / 180)); // Convertir a radianes
		const cameraDirectionZ = Math.cos(this.cameraControl.angles.y * (Math.PI / 180));

		this.bullets.forEach((bullet, index) => {
			// Asegurarse de que la dirección esté asignada
			if (!this.bulletDirections[index]) {
				this.bulletDirections[index] = {
					x: cameraDirectionX,
					y: 0,
					z: cameraDirectionZ,
				};
			}

			const bulletDirection = this.bulletDirections[index];
			// Movimiento de la bala en la dirección de la cámara
			bullet.position.x += bulletDirection.x;
			bullet.position.z += bulletDirection.z;

			// Calcular la distancia entre la bala y el jugador
			const distance = Math.sqrt((bullet.position.x - this.player.position.x) ** 2 + (bullet.position.z - this.player.position.z) ** 2);

			// Si la bala se aleja más de 60 unidades del jugador, la eliminamos
			if (distance > 60) {
				this.removeChild(bullet);
				this.bullets.splice(index, 1);
				this.bulletDirections.splice(index, 1); // Eliminar la dirección correspondiente
			}
		});
	}

	private updateEnemies(): void {
		this.enemies.forEach((enemy, enemyIndex) => {
			const directionX = this.player.position.x - enemy.position.x;
			const directionZ = this.player.position.z - enemy.position.z;
			const length = Math.sqrt(directionX ** 2 + directionZ ** 2);

			// Normalizamos el vector de dirección y lo escalamos para definir la velocidad
			if (length > 0) {
				enemy.position.x += (directionX / length) * 0.05;
				enemy.position.z += (directionZ / length) * 0.05;
			}

			this.bullets.forEach((bullet, bulletIndex) => {
				if (Math.abs(enemy.position.z - bullet.position.z) < 0.5 && Math.abs(enemy.position.x - bullet.position.x) < 0.5) {
					// Eliminamos la bala y el enemigo de inmediato (por ahora, antes de la animación)

					// Creamos la animación de la explosión
					const cublosion = Model.from(Assets.get("cublosion"));

					// Configuración de la animación para que no tenga delay
					cublosion.animations[0].loop = false;
					cublosion.animations[0].speed = 2;
					cublosion.animations[0].play();
					cublosion.position.set(enemy.position.x, enemy.position.y - 1, enemy.position.z);

					this.removeChild(enemy);
					this.removeChild(bullet);
					this.enemies.splice(enemyIndex, 1);
					this.bullets.splice(bulletIndex, 1);

					// Ajustar el comportamiento de la animación
					// cublosion.meshes.forEach((mesh) => {
					// 	const mat = mesh.material as StandardMaterial;
					// 	mat.exposure = 1.1;
					// 	mat.roughness = 0.6;
					// 	mat.metallic = 0;
					// });

					// Posicionamos la animación en la misma posición que el enemigo

					// Para asegurarnos de que la animación empieza inmediatamente
					// cublosion.animations[0].stop(); // Detenemos cualquier animación que pueda estar en curso
					cublosion.animations[0].play(); // Reanudamos la animación desde 0, sin retraso
					console.log("cublosion.animations", cublosion.animations);

					// Añadimos la animación a la escena
					this.addChild(cublosion);

					// Usamos setTimeout para eliminar la animación después de la duración
					const animationDuration = cublosion.animations[0].duration;

					setTimeout(() => {
						// Eliminamos la animación y el objeto después de que termine
						this.removeChild(cublosion);
					}, animationDuration * 1000); // Convertimos a milisegundos
				}
			});
		});
	}
}
