/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { StandardMaterial } from "pixi3d/pixi7";
import { Color, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { cameraControl, Manager } from "../../../index";
import { Keyboard } from "../../../engine/input/Keyboard";
import { EnviromentalLights } from "./Lights/Light";
import { VEHICULE_SPEED } from "../../../utils/constants";
import { GameObjectFactory } from "./GameObject";
import type { PhysicsContainer3d } from "./3DPhysicsContainer";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { ref, set, onValue, onDisconnect, remove, get } from "firebase/database";
import { db } from "../../../index";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { MuliplayerLobby } from "./MultiplayerLobby";
// import { SoundLib } from "../../../engine/sound/SoundLib";

interface RemoteBullet extends Mesh3D {
	direction: { x: number; y: number; z: number };
}

export class Multiplayer3DScene extends PixiScene {
	public static readonly BUNDLES = ["3d", "package-1", "music", "sfx"];

	private localPlayerId: string = Date.now().toString();
	private playersInRoom: Record<string, PhysicsContainer3d & { hp?: number }> = {};

	private player: PhysicsContainer3d & { hp?: number };
	private bullets: Mesh3D[] = [];
	private keys: Record<string, boolean> = {};

	private remoteBullets: { [bulletId: string]: Mesh3D } = {};

	public cameraControl: any;
	public enviromentalLights: EnviromentalLights;

	private lastCameraPosition = { x: 20, y: 0, z: 50 };
	private cameraLerpSpeed = 0.8;
	private bulletDirections: { x: number; y: number; z: number }[] = [];

	private isDead: boolean = false;
	private respawnButton: Container;
	private localUI: Container;
	private readonly BULLET_SPEED = 10;

	private readonly DATABASE_NAME: string = "player3d";
	private readonly BULLETS_DATABASE_NAME: string = "bullets";

	private pointerShotFired: boolean = false;
	private bottomRightContainer: Container = new Container();
	private gameOverContainer: Container = new Container();

	// Declaramos una variable para almacenar la función de desuscripción.
	private playersUnsubscribe: () => void;

	constructor() {
		super();

		// SoundLib.playMusic("battle", { volume: 0.02, loop: true });

		const ground = this.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(100, 1, 100);

		this.cameraControl = cameraControl;
		this.cameraControl.distance = 15;
		this.cameraControl.angles.x = 25;
		this.cameraControl.target = { x: 20, y: 1.3, z: 50 };

		this.listenForPlayersUpdates();
		this.listenForBullets();
		this.addPlayerToDatabase();
		this.init();
		this.createRespawnButton();
		this.createLocalUI();

		this.enviromentalLights = new EnviromentalLights();

		this.addChild(this.bottomRightContainer);
		const button = new Graphics();
		button.beginFill(0xffff00);
		button.drawCircle(0, 0, 100);
		button.endFill();
		this.bottomRightContainer.interactive = true;
		this.bottomRightContainer.addChild(button);
		this.bottomRightContainer.eventMode = "static";
		this.bottomRightContainer.on("pointerdown", this.onPointerTap.bind(this));

		this.addChild(this.gameOverContainer);
		const gameOverText = new Text("Game Over", new TextStyle({ fill: "red", fontSize: 50 }));
		gameOverText.anchor.set(0.5);
		// this.gameOverContainer.addChild(gameOverText);
		this.gameOverContainer.visible = false;
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToScreen(this.bottomRightContainer, _newW, _newH, 0.15, 0.15, ScaleHelper.FIT);
		this.bottomRightContainer.x = _newW - 150;
		this.bottomRightContainer.y = _newH - 150;

		ScaleHelper.setScaleRelativeToScreen(this.gameOverContainer, _newW, _newH, 0.5, 0.5, ScaleHelper.FIT);
		this.gameOverContainer.x = _newW * 0.5;
		this.gameOverContainer.y = _newH * 0.5;
	}

	private init(): void {
		this.setupPlayer();
		this.setupControls();
	}

	private onPointerTap(): void {
		// Cuando se detecta un pointertap, se activa la bandera
		this.pointerShotFired = true;
	}

	private createLocalUI(): void {
		this.localUI = new Container();
		this.localUI.x = 10;
		this.localUI.y = 10;

		const bgBar = new Graphics();
		bgBar.beginFill(0x555555);
		bgBar.drawRect(0, 0, 100, 20);
		bgBar.endFill();
		this.localUI.addChild(bgBar);

		const healthBar = new Graphics();
		healthBar.name = "healthBar";
		healthBar.beginFill(0x00ff00);
		healthBar.drawRect(0, 0, 100, 20);
		healthBar.endFill();
		this.localUI.addChild(healthBar);

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

	private updateRemoteHealthBars(): void {
		for (const id in this.playersInRoom) {
			if (id === this.localPlayerId) {
				continue;
			}
			const player = this.playersInRoom[id];
			let bar: Graphics = player.getChildByName("healthBar");
			if (!bar) {
				bar = new Graphics();
				bar.name = "healthBar";
				player.addChild(bar);
			}

			bar.clear();
			bar.beginFill(0x555555);
			bar.drawRect(-25, -20, 50, 6);
			bar.endFill();
			const hpPercentage = (player.hp ?? 100) / 100;
			bar.beginFill(0xff0000);
			bar.drawRect(-25, -20, 50 * hpPercentage, 6);
			bar.endFill();
		}
	}

	private updatePlayerPosition(x: number, y: number, z: number): void {
		get(ref(db, `${this.DATABASE_NAME}/${this.localPlayerId}`)).then((snapshot) => {
			const currentData = snapshot.val() || {};
			set(ref(db, `${this.DATABASE_NAME}/${this.localPlayerId}`), {
				x,
				y,
				z,
				hp: currentData.hp ?? this.player.hp,
				angle: this.cameraControl.angles.y,
			});
		});
	}

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

	private setupControls(): void {
		this.keys = {};
		window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
		window.addEventListener("keyup", (e) => (this.keys[e.code] = false));
	}

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
		const playersRef = ref(db, `${this.DATABASE_NAME}`);

		// Asignamos la función de desuscripción devuelta por onValue.
		this.playersUnsubscribe = onValue(playersRef, (snapshot) => {
			// Definimos la estructura esperada para cada jugador
			type PlayerData = {
				x: number;
				y: number;
				z: number;
				hp?: number;
				angle?: number;
			};

			const serverPlayers: Record<string, PlayerData> = snapshot.exists() ? (snapshot.val() as Record<string, PlayerData>) : {};

			// Si existe la entrada para el jugador local, verificamos su hp.
			if (serverPlayers[this.localPlayerId]) {
				if (serverPlayers[this.localPlayerId].hp <= 0) {
					this.handleLocalPlayerDeath();
					// Desuscribirse para que no se procesen más actualizaciones.
					this.playersUnsubscribe();
					return;
				}
			}

			// Detectamos los jugadores remotos que ya no están en Firebase (desconectados)
			const disconnectedPlayers = Object.keys(this.playersInRoom).filter((id) => id !== this.localPlayerId && !serverPlayers.hasOwnProperty(id));

			disconnectedPlayers.forEach((id) => {
				console.log(`Player ${id} disconnected, removing from scene.`);
				const player = this.playersInRoom[id];
				if (player) {
					remove(ref(db, `${this.DATABASE_NAME}/${id}`));
					this.removeChild(player);
					delete this.playersInRoom[id];
				}
			});

			if (!serverPlayers) {
				return;
			}

			// Recorremos los jugadores recibidos desde Firebase.
			Object.keys(serverPlayers).forEach((id) => {
				const data = serverPlayers[id];

				// Si es el jugador local, actualizamos su hp y la UI.
				if (id === this.localPlayerId) {
					if (this.player) {
						this.player.hp = data.hp ?? 100;
						this.updateLocalUI();
					}
					return;
				}

				// Para los jugadores remotos: si no existe, se crea; de lo contrario se actualiza.
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

				if (otherPlayer) {
					otherPlayer.position.set(data.x, data.y, data.z);
					otherPlayer.hp = data.hp ?? 100;
					if (data.angle !== undefined) {
						otherPlayer.rotationQuaternion.setEulerAngles(0, data.angle, 0);
					}
				}
			});
		});
	}

	private listenForBullets(): void {
		onValue(ref(db, this.BULLETS_DATABASE_NAME), (snapshot) => {
			// console.log("Snapshot received:", snapshot);

			const bulletsData = snapshot.val() || {};
			// console.log("Bullets Data received:", bulletsData);

			for (const id in this.remoteBullets) {
				if (!bulletsData[id]) {
					const bullet = this.remoteBullets[id];
					this.removeChild(bullet);
					delete this.remoteBullets[id];
					this.removeBulletFromFirebase(id);
				}
			}

			for (const id in bulletsData) {
				const data = bulletsData[id];
				if (data.playerId === this.localPlayerId) {
					continue;
				}

				let bullet: Mesh3D;
				if (!this.remoteBullets[id]) {
					bullet = Mesh3D.createCube();
					bullet.scale.set(0.2, 0.2, 0.2);
					const bulletMaterial = new StandardMaterial();
					bulletMaterial.baseColor = new Color(1, 1, 0);
					bullet.material = bulletMaterial;
					(bullet as any).direction = data.direction;
					(bullet as any).timestamp = data.timestamp;
					this.remoteBullets[id] = bullet;
					this.addChild(bullet);
				} else {
					bullet = this.remoteBullets[id];
				}

				const currentTime = Date.now();
				const timeElapsed = (currentTime - data.timestamp) / 1000;
				const newX = data.x + data.direction.x * this.BULLET_SPEED * timeElapsed;
				const newY = data.y;
				const newZ = data.z + data.direction.z * this.BULLET_SPEED * timeElapsed;
				bullet.position.set(newX, newY, newZ);

				// console.log("Bullet Position:", newX, newY, newZ);
			}
		});
	}

	private removeBulletFromFirebase(bulletId: string): void {
		const bulletRef = ref(db, `bullets/${bulletId}`);
		// console.log("bulletRef", bulletRef);
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
		// Si el jugador local está muerto, no se actualizan movimientos ni disparos
		if (this.isDead) {
			this.showRespawnButton();
			return;
		}

		// Actualizar las balas remotas (moverlas localmente)
		this.updateRemoteBullets();

		// Actualizar la UI local (barra de vida)
		this.updateLocalUI();
		// Actualizar las barras de vida de los jugadores remotos
		this.updateRemoteHealthBars();

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

	private shootBullet(x: number, y: number, z: number, direction: { x: number; y: number; z: number }, bulletId: string): void {
		const bulletData = { playerId: this.localPlayerId, x, y, z, direction, timestamp: Date.now() };
		set(ref(db, `bullets/${bulletId}`), bulletData);
	}

	// Detecta el disparo del jugador local, crea la bala local y la envía a Firebase
	private handleShooting(): void {
		if (this.isDead) {
			return; // No permite disparar si está muerto
		}

		// Comprueba si se presionó la barra espaciadora o se detectó un pointertap
		if (Keyboard.shared.justPressed("Space") || this.pointerShotFired) {
			// Resetear la bandera del pointer tap para evitar múltiples disparos
			this.pointerShotFired = false;

			// Crear la bala
			const bullet = Mesh3D.createCube();
			bullet.scale.set(0.2, 0.2, 0.2);
			bullet.position.set(this.player.position.x, 0, this.player.position.z);

			const bulletMaterial = new StandardMaterial();
			bulletMaterial.baseColor = new Color(1, 1, 0);
			bullet.material = bulletMaterial;

			// Asigna el shooterId para evitar autodaño
			(bullet as any).shooterId = this.localPlayerId;
			// Almacena la dirección inicial usando la dirección de la cámara
			const direction = {
				x: Math.sin(this.cameraControl.angles.y * (Math.PI / 180)),
				y: 0,
				z: Math.cos(this.cameraControl.angles.y * (Math.PI / 180)),
			};
			this.bulletDirections.push(direction);
			this.bullets.push(bullet);
			this.addChild(bullet);

			// **Generamos el id y lo asignamos a la bala**
			const bulletId = Date.now().toString();
			(bullet as any).bulletId = bulletId;

			// Sincroniza el disparo en Firebase
			this.shootBullet(bullet.position.x, bullet.position.y, bullet.position.z, direction, bulletId);
		}
	}

	private updateBullets(): void {
		if (!this.player || !this.player.position) {
			return;
		}

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
				// Verificar que targetPlayer y su position existan
				if (!targetPlayer || !targetPlayer.position) {
					continue;
				}

				const dx = bullet.position.x - targetPlayer.position.x;
				const dz = bullet.position.z - targetPlayer.position.z;
				const distance = Math.sqrt(dx * dx + dz * dz);
				if (distance < collisionThreshold) {
					// Se produce la colisión: se resta 10 hp
					targetPlayer.hp = (targetPlayer.hp ?? 100) - 10;
					set(ref(db, `${this.DATABASE_NAME}/${playerId}/hp`), targetPlayer.hp);
					if (playerId === this.localPlayerId && targetPlayer.hp <= 0) {
						this.handleLocalPlayerDeath();
					} else if (targetPlayer.hp <= 0) {
						remove(ref(db, `${this.DATABASE_NAME}/${playerId}`));
						this.removeChild(targetPlayer);
						delete this.playersInRoom[playerId];
					}
					// Eliminar la bala que impactó
					this.removeBulletFromFirebase((bullet as any).bulletId);
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
				this.removeBulletFromFirebase((bullet as any).bulletId);
				this.removeChild(bullet);
				this.bullets.splice(index, 1);
				this.bulletDirections.splice(index, 1);
			}
		});
	}

	private updateRemoteBullets(): void {
		if (!this.player || !this.player.position) {
			return;
		}

		for (const id in this.remoteBullets) {
			const bullet = this.remoteBullets[id] as RemoteBullet;
			if (!bullet || !bullet.position) {
				continue;
			}

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

		const buttonBg = new Graphics();
		buttonBg.beginFill(0x333333, 0.8);
		buttonBg.drawRoundedRect(0, 0, 150, 50, 10);
		buttonBg.endFill();
		this.respawnButton.addChild(buttonBg);

		const style = new TextStyle({
			fill: "white",
			fontSize: 20,
			fontFamily: "Arial",
		});
		const buttonText = new Text("Respawn", style);
		this.respawnButton.addChild(buttonText);

		this.respawnButton.interactive = true;
		this.respawnButton.on("pointerdown", () => this.respawn());
		this.gameOverContainer.addChild(this.respawnButton);
	}

	private showRespawnButton(): void {
		if (this.gameOverContainer) {
			this.gameOverContainer.visible = true;
			this.respawnButton.visible = true;
		}
	}

	private hideRespawnButton(): void {
		if (this.gameOverContainer) {
			this.gameOverContainer.visible = false;
			this.respawnButton.visible = false;
		}
	}

	private respawn(): void {
		this.hideRespawnButton();
		// Opcional: Limpiar las balas locales y remotas
		this.bullets.forEach((bullet) => this.removeChild(bullet));
		this.bullets = [];
		this.bulletDirections = [];
		for (const id in this.remoteBullets) {
			this.removeChild(this.remoteBullets[id]);
		}
		this.remoteBullets = {};

		// Reinicia la posición de la cámara
		this.cameraControl.target = { x: 20, y: 1.3, z: 50 };
		this.lastCameraPosition = { ...this.cameraControl.target };

		remove(ref(db, `${this.DATABASE_NAME}/${this.localPlayerId}`))
			.then(() => {
				console.log(`Jugador ${this.localPlayerId} removido de la base de datos.`);
				Manager.changeScene(MuliplayerLobby, { transitionClass: FadeColorTransition });
			})
			.catch((error) => {
				console.error("Error al remover el jugador de la base de datos:", error);
				Manager.changeScene(MuliplayerLobby, { transitionClass: FadeColorTransition });
			});
	}
}
