/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { StandardMaterial } from "pixi3d/pixi7";
import { Color, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { cameraControl } from "../../../index"; // Cámara global
import { Keyboard } from "../../../engine/input/Keyboard";
import { EnviromentalLights } from "./Lights/Light";
import { VEHICULE_SPEED } from "../../../utils/constants";
import { GameObjectFactory } from "./GameObject";
import type { PhysicsContainer3d } from "./3DPhysicsContainer";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { ref, set, onValue, onDisconnect, remove, get } from "firebase/database";
import { db } from "../../../index";
import { SoundLib } from "../../../engine/sound/SoundLib";

interface RemoteBullet extends Mesh3D {
	direction: { x: number; y: number; z: number };
}

export class Multiplayer3DScene extends PixiScene {
	public static readonly BUNDLES = ["3d", "package-1", "music", "sfx"];

	// Cada sesión tiene un ID único (por ejemplo, basado en Date.now)
	private localPlayerId: string = Date.now().toString();
	// Registro de jugadores (local y remotos) – cada uno tendrá además la propiedad 'hp' y 'angle'
	private playersInRoom: Record<string, PhysicsContainer3d & { hp?: number }> = {};

	// Variables locales para el jugador
	private player: PhysicsContainer3d & { hp?: number };
	private bullets: Mesh3D[] = []; // Balas disparadas por el jugador local
	private keys: Record<string, boolean> = {};

	// Balas disparadas por los rivales (almacenadas por su id de Firebase)
	private remoteBullets: { [bulletId: string]: Mesh3D } = {};

	public cameraControl: any;
	public enviromentalLights: EnviromentalLights;

	private lastCameraPosition = { x: 20, y: 0, z: 50 }; // Para el Lerp de la cámara
	private cameraLerpSpeed = 0.8;
	// Almacenamos la dirección para cada bala local (para moverla en cada frame)
	private bulletDirections: { x: number; y: number; z: number }[] = [];

	// Estado de vida del jugador local y flag de muerte
	private isDead: boolean = false;
	// Botón de respawn en Pixi
	private respawnButton: Container;
	// UI local: contenedor para la barra de vida del jugador local (en pantalla, en coordenadas UI)
	private localUI: Container;
	private readonly BULLET_SPEED = 10; // Ejemplo de velocidad de bala (unidades por segundo)

	private readonly DATABASE_NAME: string = "player3d";
	constructor() {
		super();

		SoundLib.playMusic("battle", { volume: 0.2, loop: true });
		// Crear el suelo
		const ground = this.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(100, 1, 100);

		// Configurar la cámara global
		this.cameraControl = cameraControl;
		this.cameraControl.distance = 15;
		this.cameraControl.angles.x = 25;
		this.cameraControl.target = { x: 20, y: 1.3, z: 50 };

		// Configurar listener para jugadores
		this.listenForPlayersUpdates();
		// Configurar listener para balas de rivales
		this.listenForBullets();
		// Agregar al jugador local a Firebase y configurar onDisconnect
		this.addPlayerToDatabase();
		// Inicializar la escena (jugador local y controles)
		this.init();
		// Crear el botón de respawn en Pixi (inicialmente oculto)
		this.createRespawnButton();
		// Crear la UI local del jugador (por ejemplo, la barra de vida)
		this.createLocalUI();

		this.enviromentalLights = new EnviromentalLights();
	}

	// Inicializa el jugador local y los controles
	private init(): void {
		this.setupPlayer();
		this.setupControls();
	}

	// Crea la UI local del jugador (barra de vida en la esquina superior izquierda)
	private createLocalUI(): void {
		this.localUI = new Container();
		// Posicionar la UI en la esquina superior izquierda (por ejemplo, 10 px desde la izquierda y arriba)
		this.localUI.x = 10;
		this.localUI.y = 10;

		// Fondo de la barra (barra gris de 100px de ancho y 20px de alto)
		const bgBar = new Graphics();
		bgBar.beginFill(0x555555);
		bgBar.drawRect(0, 0, 100, 20);
		bgBar.endFill();
		this.localUI.addChild(bgBar);

		// Barra de salud (inicialmente 100px de ancho, color verde)
		const healthBar = new Graphics();
		healthBar.name = "healthBar";
		healthBar.beginFill(0x00ff00);
		healthBar.drawRect(0, 0, 100, 20);
		healthBar.endFill();
		this.localUI.addChild(healthBar);

		// Agregar la UI al escenario (la UI local se coloca fuera del mundo 3D)
		this.addChild(this.localUI);
	}

	private updateLocalUI(): void {
		if (!this.localUI || !this.player) {
			return;
		}
		const healthBar: Graphics = this.localUI.getChildByName("healthBar");
		if (healthBar) {
			const newWidth = Math.max(0, this.player.hp ?? 0);
			// console.log(`Actualizando barra de vida: ${newWidth} HP`);

			healthBar.clear();
			healthBar.beginFill(0x00ff00);
			healthBar.drawRect(0, 0, newWidth, 20);
			healthBar.endFill();
		}
	}

	// Actualiza (cada frame) la barra de vida de cada jugador remoto (sobre su cabeza)
	private updateRemoteHealthBars(): void {
		for (const id in this.playersInRoom) {
			if (id === this.localPlayerId) {
				continue;
			}
			const player = this.playersInRoom[id];
			// Buscamos un child llamado "healthBar" en el objeto del jugador
			let bar: Graphics = player.getChildByName("healthBar");
			if (!bar) {
				// Si no existe, lo creamos
				bar = new Graphics();
				bar.name = "healthBar";
				player.addChild(bar);
			}
			// Dibujamos la barra; la posición se coloca, por ejemplo, 20 unidades sobre la cabeza (ajusta según convenga)
			bar.clear();
			// Dibujar fondo (barra gris, 50px de ancho)
			bar.beginFill(0x555555);
			bar.drawRect(-25, -20, 50, 6);
			bar.endFill();
			// Dibujar barra de vida (proporcional a los hp, suponiendo que 100 hp = 50px de ancho)
			const hpPercentage = (player.hp ?? 100) / 100;
			bar.beginFill(0xff0000);
			bar.drawRect(-25, -20, 50 * hpPercentage, 6);
			bar.endFill();
		}
	}

	// Actualiza la posición, hp y ángulo del jugador local en Firebase
	private updatePlayerPosition(x: number, y: number, z: number): void {
		get(ref(db, `${this.DATABASE_NAME}/${this.localPlayerId}`)).then((snapshot) => {
			const currentData = snapshot.val() || {};
			set(ref(db, `${this.DATABASE_NAME}/${this.localPlayerId}`), {
				x,
				y,
				z,
				hp: currentData.hp ?? this.player.hp, // Mantiene el hp actual
				angle: this.cameraControl.angles.y,
			});
		});
	}

	// Crea el objeto 3D que representa al jugador local, asigna 100 hp y lo agrega a la escena y al registro
	private setupPlayer(): void {
		this.player = GameObjectFactory.createPlayer("futurecop") as PhysicsContainer3d & { hp?: number };
		this.player.name = this.localPlayerId;
		this.player.scale.set(4, 4, 4);
		this.player.y = 150;
		this.player.hp = 100;
		this.playersInRoom[this.localPlayerId] = this.player;
		this.addChild(this.player);
		this.isDead = false;
	}

	// Configura los controles de teclado
	private setupControls(): void {
		this.keys = {};
		window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
		window.addEventListener("keyup", (e) => (this.keys[e.code] = false));
	}

	// Agrega al jugador local a Firebase y configura onDisconnect para eliminarlo
	private addPlayerToDatabase(): void {
		set(ref(db, `${this.DATABASE_NAME}/${this.localPlayerId}`), {
			x: this.cameraControl.target.x,
			y: this.cameraControl.target.y,
			z: this.cameraControl.target.z,
			hp: 100,
			angle: this.cameraControl.angles.y,
		});
		onDisconnect(ref(db, `${this.DATABASE_NAME}/${this.localPlayerId}`)).remove();
	}

	private listenForPlayersUpdates(): void {
		onValue(ref(db, `${this.DATABASE_NAME}`), (snapshot) => {
			const playersData = snapshot.val();
			if (playersData) {
				Object.keys(playersData).forEach((id) => {
					const data = playersData[id];

					// Si es el jugador local, actualiza su hp
					if (id === this.localPlayerId) {
						if (this.player) {
							this.player.hp = data.hp ?? 100; // Mantiene el valor de Firebase
							this.updateLocalUI(); // Refresca la barra de salud
						}
						return;
					}

					// Lógica de actualización para jugadores remotos (sin cambios)
					let otherPlayer = this.playersInRoom[id];
					if (!otherPlayer) {
						otherPlayer = GameObjectFactory.createPlayer("futurecop") as PhysicsContainer3d & { hp?: number };
						otherPlayer.name = id;
						otherPlayer.scale.set(4, 4, 4);
						otherPlayer.y = 150;
						otherPlayer.hp = data.hp ?? 100;
						this.playersInRoom[id] = otherPlayer;
						this.addChild(otherPlayer);
					}
					otherPlayer.position.set(data.x, data.y, data.z);
					otherPlayer.hp = data.hp ?? 100;

					if (data.angle !== undefined) {
						otherPlayer.rotationQuaternion.setEulerAngles(0, data.angle, 0);
					}
				});
			}
		});
	}

	// Escucha Firebase para obtener los disparos (balas) de los rivales
	private listenForBullets(): void {
		onValue(ref(db, "bullets"), (snapshot) => {
			console.log("Snapshot received:", snapshot); // Esto te mostrará el snapshot completo

			const bulletsData = snapshot.val() || {};
			console.log("Bullets Data received:", bulletsData); // Verifica si se recibe algo

			// Eliminar de la escena las balas remotas que ya no existan en Firebase
			for (const id in this.remoteBullets) {
				if (!bulletsData[id]) {
					const bullet = this.remoteBullets[id];
					this.removeChild(bullet);
					delete this.remoteBullets[id];
					this.removeBulletFromFirebase(id); // Eliminar de Firebase
				}
			}

			// Crear o actualizar las balas de los rivales
			for (const id in bulletsData) {
				const data = bulletsData[id];
				// Ignorar balas disparadas por el jugador local
				if (data.playerId === this.localPlayerId) {
					continue;
				}

				let bullet: Mesh3D;
				if (!this.remoteBullets[id]) {
					// Crear la bala remota
					bullet = Mesh3D.createCube();
					bullet.scale.set(0.2, 0.2, 0.2);
					const bulletMaterial = new StandardMaterial();
					bulletMaterial.baseColor = new Color(1, 1, 0); // Color amarillo
					bullet.material = bulletMaterial;
					// Almacenamos la dirección
					(bullet as any).direction = data.direction;
					// Almacenamos el timestamp (para calcular la posición actual)
					(bullet as any).timestamp = data.timestamp;
					// Guardamos la bala
					this.remoteBullets[id] = bullet;
					this.addChild(bullet);
				} else {
					bullet = this.remoteBullets[id];
				}

				// Calcular la posición actual:
				const currentTime = Date.now();
				const timeElapsed = (currentTime - data.timestamp) / 1000; // en segundos
				const newX = data.x + data.direction.x * this.BULLET_SPEED * timeElapsed;
				const newY = data.y; // Suponiendo que no hay movimiento vertical
				const newZ = data.z + data.direction.z * this.BULLET_SPEED * timeElapsed;
				bullet.position.set(newX, newY, newZ);

				console.log("Bullet Position:", newX, newY, newZ);
			}
		});
	}

	// Elimina la bala de Firebase cuando se impacta o se elimina
	private removeBulletFromFirebase(bulletId: string): void {
		const bulletRef = ref(db, `bullets/${bulletId}`);
		remove(bulletRef)
			.then(() => {
				console.log(`Bullet ${bulletId} removed from Firebase`);
			})
			.catch((error) => {
				console.error("Error removing bullet from Firebase:", error);
			});
	}

	// Se llama en cada frame
	public override update(delta: number): void {
		// Actualizar las balas remotas (moverlas localmente)
		this.updateRemoteBullets();

		// Actualizar la UI local (barra de vida)
		this.updateLocalUI();
		// Actualizar las barras de vida de los jugadores remotos
		this.updateRemoteHealthBars();

		// Si el jugador local está muerto, no se actualizan movimientos ni disparos
		if (this.isDead) {
			return;
		}

		this.player.update(delta);

		// Actualiza la cámara y la posición del jugador local
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
		this.updateBullets(); // Actualiza las balas locales

		this.updateLocalUI();
		this.updateRemoteHealthBars();
	}

	// Mueve la cámara suavemente usando interpolación (lerp)
	private handleCameraMovement(_delta?: number): void {
		const targetX = this.cameraControl.target.x;
		const targetY = this.cameraControl.target.y;
		const targetZ = this.cameraControl.target.z;
		this.cameraControl.target.x = this.lastCameraPosition.x + (targetX - this.lastCameraPosition.x) * this.cameraLerpSpeed;
		this.cameraControl.target.y = this.lastCameraPosition.y + (targetY - this.lastCameraPosition.y) * this.cameraLerpSpeed;
		this.cameraControl.target.z = this.lastCameraPosition.z + (targetZ - this.lastCameraPosition.z) * this.cameraLerpSpeed;
		this.lastCameraPosition = { ...this.cameraControl.target };
	}

	// Maneja el movimiento del jugador local y actualiza su posición (y ángulo) en Firebase
	private handlePlayerMovement(_delta?: number): void {
		const angleYRad = this.cameraControl.angles.y * (Math.PI / 180);
		const moveX = VEHICULE_SPEED * Math.sin(angleYRad);
		const moveZ = VEHICULE_SPEED * Math.cos(angleYRad);

		if (Keyboard.shared.isDown("KeyA")) {
			this.cameraControl.target.z -= moveX;
			this.cameraControl.target.x += moveZ;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			this.cameraControl.target.z += moveX;
			this.cameraControl.target.x -= moveZ;
		}
		if (Keyboard.shared.isDown("KeyW")) {
			this.cameraControl.target.z += moveZ;
			this.cameraControl.target.x += moveX;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			this.cameraControl.target.z -= moveZ;
			this.cameraControl.target.x -= moveX;
		}
		this.updatePlayerPosition(this.cameraControl.target.x, this.cameraControl.target.y, this.cameraControl.target.z);
	}

	// Envía a Firebase la información de un disparo, registrando el shooter y la dirección
	private shootBullet(x: number, y: number, z: number, direction: { x: number; y: number; z: number }): void {
		const bulletId = Date.now(); // Usamos Date.now() como id
		const bulletData = {
			playerId: this.localPlayerId,
			x,
			y,
			z,
			direction,
			timestamp: Date.now(), // Guarda el momento de creación
		};
		set(ref(db, `bullets/${bulletId}`), bulletData);
	}

	// Detecta el disparo del jugador local, crea la bala local y la envía a Firebase
	private handleShooting(): void {
		if (this.isDead) {
			return;
		} // No permite disparar si está muerto

		if (Keyboard.shared.justPressed("Space")) {
			const bullet = Mesh3D.createCube();
			bullet.scale.set(0.2, 0.2, 0.2);
			bullet.position.set(this.player.position.x, 0, this.player.position.z);

			const bulletMaterial = new StandardMaterial();
			bulletMaterial.baseColor = new Color(1, 1, 0);
			bullet.material = bulletMaterial;

			// Asigna el shooterId para evitar autodaño
			(bullet as any).shooterId = this.localPlayerId;
			// Almacena la dirección inicial usando la dirección de la cámara
			this.bulletDirections.push({
				x: Math.sin(this.cameraControl.angles.y * (Math.PI / 180)),
				y: 0,
				z: Math.cos(this.cameraControl.angles.y * (Math.PI / 180)),
			});
			this.bullets.push(bullet);
			this.addChild(bullet);

			// Sincroniza el disparo en Firebase
			this.shootBullet(bullet.position.x, bullet.position.y, bullet.position.z, {
				x: Math.sin(this.cameraControl.angles.y * (Math.PI / 180)),
				y: 0,
				z: Math.cos(this.cameraControl.angles.y * (Math.PI / 180)),
			});
		}
	}

	// Actualiza la posición de las balas locales, comprueba colisiones y aplica daño (10 hp por impacto)
	private updateBullets(): void {
		const collisionThreshold = 1.0;
		this.bullets.forEach((bullet, index) => {
			// Usar la dirección almacenada para mover la bala
			if (!this.bulletDirections[index]) {
				return;
			}
			const dir = this.bulletDirections[index];
			bullet.position.x += dir.x;
			bullet.position.z += dir.z;

			// Comprobar colisiones con cada jugador (excluyendo al shooter)
			for (const playerId in this.playersInRoom) {
				if (playerId === (bullet as any).shooterId) {
					continue;
				}
				const targetPlayer = this.playersInRoom[playerId];
				const dx = bullet.position.x - targetPlayer.position.x;
				const dz = bullet.position.z - targetPlayer.position.z;
				const distance = Math.sqrt(dx * dx + dz * dz);
				if (distance < collisionThreshold) {
					// Se produce la colisión: se resta 10 hp
					targetPlayer.hp = (targetPlayer.hp ?? 100) - 10;
					set(ref(db, `${this.DATABASE_NAME}/${playerId}/hp`), targetPlayer.hp);
					// Si es el jugador local y hp llega a 0, maneja la muerte
					if (playerId === this.localPlayerId && targetPlayer.hp <= 0) {
						this.handleLocalPlayerDeath();
					} else if (targetPlayer.hp <= 0) {
						// Para jugadores remotos, se eliminan
						remove(ref(db, `${this.DATABASE_NAME}/${playerId}`));
						this.removeChild(targetPlayer);
						delete this.playersInRoom[playerId];
					}
					// Se elimina la bala que impactó
					this.removeChild(bullet);
					this.bullets.splice(index, 1);
					this.bulletDirections.splice(index, 1);
					break;
				}
			}

			// Eliminar la bala si se aleja demasiado del jugador local
			const dx = bullet.position.x - this.player.position.x;
			const dz = bullet.position.z - this.player.position.z;
			const distFromPlayer = Math.sqrt(dx * dx + dz * dz);
			if (distFromPlayer > 60) {
				this.removeChild(bullet);
				this.bullets.splice(index, 1);
				this.bulletDirections.splice(index, 1);
			}
		});
	}

	// Actualiza (cada frame) el movimiento de las balas remotas (disparadas por rivales)
	private updateRemoteBullets(): void {
		for (const id in this.remoteBullets) {
			const bullet = this.remoteBullets[id] as RemoteBullet;
			console.log("bullet", bullet);
			if (bullet.direction) {
				bullet.position.x += bullet.direction.x;
				bullet.position.z += bullet.direction.z;
			}
			const dx = bullet.position.x - this.player.position.x;
			const dz = bullet.position.z - this.player.position.z;
			const dist = Math.sqrt(dx * dx + dz * dz);
			if (dist > 60) {
				this.removeChild(bullet);
				delete this.remoteBullets[id];
			}
		}
	}

	// Se invoca cuando el jugador local muere (hp ≤ 0)
	private handleLocalPlayerDeath(): void {
		if (this.player) {
			this.removeChild(this.player);
			delete this.playersInRoom[this.localPlayerId];
		}
		this.isDead = true;
		this.showRespawnButton();
	}

	// Crea el botón de respawn usando objetos Pixi (Container con Graphics y Text) y lo agrega a la escena
	private createRespawnButton(): void {
		this.respawnButton = new Container();

		// Fondo del botón
		const buttonBg = new Graphics();
		buttonBg.beginFill(0x333333, 0.8);
		buttonBg.drawRoundedRect(0, 0, 150, 50, 10);
		buttonBg.endFill();
		this.respawnButton.addChild(buttonBg);

		// Texto del botón
		const style = new TextStyle({
			fill: "white",
			fontSize: 20,
			fontFamily: "Arial",
		});
		const buttonText = new Text("Respawn", style);
		buttonText.x = (150 - buttonText.width) / 2;
		buttonText.y = (50 - buttonText.height) / 2;
		this.respawnButton.addChild(buttonText);

		this.respawnButton.interactive = true;
		this.respawnButton.on("pointerdown", () => this.respawn());
		this.respawnButton.visible = false;
		this.addChild(this.respawnButton);
	}

	// Muestra el botón de respawn
	private showRespawnButton(): void {
		if (this.respawnButton) {
			this.respawnButton.visible = true;
		}
	}

	// Oculta el botón de respawn
	private hideRespawnButton(): void {
		if (this.respawnButton) {
			this.respawnButton.visible = false;
		}
	}

	// Función de respawn: recrea el jugador local en el punto de inicio, reinicia hp y reanuda el juego
	private respawn(): void {
		this.hideRespawnButton();
		// Reinicia la posición de la cámara (punto de inicio)
		this.cameraControl.target = { x: 20, y: 1.3, z: 50 };
		this.lastCameraPosition = { ...this.cameraControl.target };
		// Recrea el jugador local
		this.setupPlayer();
		// Agrega el jugador local a Firebase nuevamente
		this.addPlayerToDatabase();
		this.updatePlayerPosition(this.cameraControl.target.x, this.cameraControl.target.y, this.cameraControl.target.z);
		// Permite nuevamente el movimiento
		this.isDead = false;
	}
}
