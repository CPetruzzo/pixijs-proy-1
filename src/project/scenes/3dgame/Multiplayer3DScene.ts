/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { StandardMaterial } from "pixi3d/pixi7";
import { Color, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../../index";
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
import { VirtualJoystick } from "./VirtualJoystick";
import { Tween } from "tweedle.js";
// import { SoundLib } from "../../../engine/sound/SoundLib";
import { aimControl } from "../../../index";

interface RemoteBullet extends Mesh3D {
	direction: { x: number; y: number; z: number };
}

export class Multiplayer3DScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx"];

	private localPlayerId: string = Date.now().toString();
	private playersInRoom: Record<string, PhysicsContainer3d & { hp?: number }> = {};

	private player: PhysicsContainer3d & { hp?: number };
	private bullets: Mesh3D[] = [];
	private keys: Record<string, boolean> = {};

	private remoteBullets: { [bulletId: string]: Mesh3D } = {};

	public aimControl: any;
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
	private joystickContainer: Container = new Container();

	// Declaramos una variable para almacenar la función de desuscripción.
	private playersUnsubscribe: () => void;
	private joystick: VirtualJoystick;
	private crosshair: Graphics;
	private crosshairContainer: Container = new Container();
	public movementEnabled: boolean = true;

	constructor() {
		super();

		// SoundLib.playMusic("battle", { volume: 0.02, loop: true });

		const ground = this.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(200, 15, 200);

		this.aimControl = aimControl;

		this.aimControl.distance = 25;

		this.aimControl.angles.x = 25;
		this.aimControl.target = { x: 20, y: 1.3, z: 50 };

		const city = GameObjectFactory.createCity() as PhysicsContainer3d & { hp?: number };
		city.scale.set(54, 54, 54);
		city.y = -4;
		// this.addChild(city);

		// Crear el joystick virtual
		this.joystick = new VirtualJoystick(100); // Radio de 50 (ajustable)
		this.joystickContainer.addChild(this.joystick);

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
		this.addChild(this.joystickContainer);

		this.sortableChildren = true;

		// Escuchar eventos de teclado para detectar Ctrl
		this.createCrosshair(200);
		this.crosshairContainer.zIndex = 1000;
		window.addEventListener("keydown", this.onKeyDown.bind(this));
		window.addEventListener("keyup", this.onKeyUp.bind(this));
		this.addChild(this.crosshairContainer);
		this.exitAimingMode();
	}

	private createCrosshair(circleRadius: number): void {
		// Creamos un Graphics que actuará como máscara (overlay)
		this.crosshair = new Graphics();

		const cross = new Graphics();
		cross.lineStyle(2, 0xff0000, 1);
		// Línea horizontal
		cross.moveTo(-10, 0);
		cross.lineTo(10, 0);
		// Línea vertical
		cross.moveTo(0, -10);
		cross.lineTo(0, 10);
		this.crosshair.addChild(cross);

		// Para facilitar el posicionamiento, centraremos el gráfico en (0,0)
		// y luego posicionaremos el contenedor (crosshairContainer) en el centro de la pantalla.
		this.crosshair.x = 0;
		this.crosshair.y = 0;

		// Dibuja un rectángulo grande que cubra la pantalla, centrado en (0,0).
		// Esto se hace usando coordenadas negativas hasta positivas.
		this.crosshair.beginFill(0x000000, 0.8); // Color negro, opacidad 0.8 (ajustable)
		this.crosshair.drawRect(-Manager.width / 2, -Manager.height / 2, Manager.width, Manager.height);

		// Comienza a definir la forma a "restar" (el agujero)
		this.crosshair.beginHole();
		// Dibuja un círculo en el centro (0,0) con el radio deseado
		this.crosshair.drawCircle(0, 0, circleRadius);
		this.crosshair.endHole();

		this.crosshair.endFill();

		// Ahora, aseguramos que el contenedor del crosshair esté centrado en la pantalla.
		// Por ejemplo, en onResize podrías hacer:
		this.crosshairContainer.x = Manager.width / 2;
		this.crosshairContainer.y = Manager.height / 2;

		// Agrega el crosshair al contenedor
		this.crosshairContainer.addChild(this.crosshair);
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToScreen(this.bottomRightContainer, _newW, _newH, 0.15, 0.15, ScaleHelper.FIT);
		this.bottomRightContainer.x = _newW * 0.85;
		this.bottomRightContainer.y = _newH * 0.8;

		ScaleHelper.setScaleRelativeToScreen(this.gameOverContainer, _newW, _newH, 0.5, 0.5, ScaleHelper.FIT);
		this.gameOverContainer.x = _newW * 0.5;
		this.gameOverContainer.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToScreen(this.joystickContainer, _newW, _newH, 0.3, 0.3, ScaleHelper.FIT);
		this.joystickContainer.x = _newW * 0.15;
		this.joystickContainer.y = _newH * 0.8;

		ScaleHelper.setScaleRelativeToScreen(this.crosshairContainer, _newW, _newH, 1, 1, ScaleHelper.FILL);
		this.crosshairContainer.x = _newW * 0.5;
		this.crosshairContainer.y = _newH * 0.5;
	}

	// Eventos de teclado para controlar el modo mira (Ctrl o Shift)
	private onKeyDown(e: KeyboardEvent): void {
		// Verifica si es la tecla Shift (izquierda o derecha) o Control derecho
		if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "ControlRight") {
			this.enterAimingMode();
		}
	}

	private onKeyUp(e: KeyboardEvent): void {
		if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "ControlRight") {
			this.exitAimingMode();
		}
	}

	// Método para entrar en modo mira
	private enterAimingMode(): void {
		this.movementEnabled = false;
		this.aimControl.aimMode = true;
		console.log("this.aimControl.aimMode", this.aimControl.aimMode);
		this.crosshairContainer.visible = true;

		// Calcula la dirección "forward" en función del ángulo horizontal
		const angleRad = this.aimControl.angles.y * (Math.PI / 180);
		const forward = {
			x: Math.sin(angleRad),
			y: 0,
			z: Math.cos(angleRad),
		};

		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.aimControl.angles.y -= 0.01;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			this.aimControl.angles.y += 0.01;
		}

		const offsetMagnitude = 200; // Ajusta este valor según necesites

		new Tween(this.aimControl.aimOffset).to({ x: forward.x * offsetMagnitude, y: 0, z: forward.z * offsetMagnitude }, 300).start();

		this.aimControl.angles.x = 0;
	}

	// Método para salir del modo mira
	private exitAimingMode(): void {
		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.aimControl.angles.y += 0.01;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			this.aimControl.angles.y -= 0.01;
		}
		this.aimControl.aimMode = false;
		this.movementEnabled = true;
		this.crosshairContainer.visible = false;
		this.aimControl.angles.x = 15;

		new Tween(this.aimControl.aimOffset).to({ x: 0, y: 0, z: 0 }, 300).start();
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
				angle: this.aimControl.angles.y,
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
			x: this.aimControl.target.x,
			y: this.aimControl.target.y,
			z: this.aimControl.target.z,
			hp: 100,
			angle: this.aimControl.angles.y,
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

		if (Keyboard.shared.justPressed("NumpadSubtract")) {
			new Tween(this.aimControl).to({ distance: 25 }, 500).start();
		}
		if (Keyboard.shared.justPressed("NumpadAdd")) {
			new Tween(this.aimControl).to({ distance: 10, y: this.aimControl.target.y }, 500).start();
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
		this.player.position.set(this.aimControl.target.x, this.aimControl.target.y, this.aimControl.target.z);
		this.player.rotationQuaternion.setEulerAngles(0, this.aimControl.angles.y, 0);

		if (!this.aimControl.aimMode) {
			if (Keyboard.shared.isDown("ArrowLeft")) {
				this.aimControl.angles.y += 0.01;
			}
			if (Keyboard.shared.isDown("ArrowRight")) {
				this.aimControl.angles.y -= 0.01;
			}
		}

		this.handlePlayerMovement(delta);
		this.handleShooting();
		this.updateBullets(); // Actualiza las balas locales

		this.updateLocalUI();
		this.updateRemoteHealthBars();
	}

	// Mueve la cámara suavemente usando interpolación (lerp)
	private handleCameraMovement(_delta?: number): void {
		const targetX = this.aimControl.target.x;
		const targetY = this.aimControl.target.y;
		const targetZ = this.aimControl.target.z;
		this.aimControl.target.x = this.lastCameraPosition.x + (targetX - this.lastCameraPosition.x) * this.cameraLerpSpeed;
		this.aimControl.target.y = this.lastCameraPosition.y + (targetY - this.lastCameraPosition.y) * this.cameraLerpSpeed;
		this.aimControl.target.z = this.lastCameraPosition.z + (targetZ - this.lastCameraPosition.z) * this.cameraLerpSpeed;
		this.lastCameraPosition = { ...this.aimControl.target };
	}

	private handlePlayerMovement(_delta?: number, _enabled: boolean = true): void {
		if (!_enabled) {
			return;
		}
		if (this.joystick.active) {
			// Fijar los ángulos que no queremos que se modifiquen
			this.aimControl.angles.x = 25;
			this.aimControl.angles.z = 0;
			// Mantenemos fijo el ángulo de la cámara (para que no gire mientras se usa el joystick)
			// y usamos la entrada del joystick para mover al jugador en la dirección de la cámara.
			const angleYRad = this.aimControl.angles.y * (Math.PI / 180);

			// Obtenemos el vector del joystick.
			// Notar que invertimos el eje Y para que "arriba" en el joystick signifique avanzar.
			const jDir = this.joystick.direction; // Valores en [-1,1]
			const invY = -jDir.y; // Invertir el eje vertical

			// Aplicamos la fórmula de rotación para alinear el vector del joystick con el ángulo de la cámara:
			// Queremos que si jDir = (0, 1) (apretado hacia arriba) y el ángulo es 0,
			// el vector resultante sea (0, -1) (avanzar hacia -Z, que suele ser "adelante").
			const effectiveX = -(jDir.x * Math.cos(angleYRad) - invY * Math.sin(angleYRad));
			const effectiveZ = jDir.x * Math.sin(angleYRad) + invY * Math.cos(angleYRad);

			// Actualizamos el target usando el vector rotado.
			this.aimControl.target.x += effectiveX * VEHICULE_SPEED;
			this.aimControl.target.z += effectiveZ * VEHICULE_SPEED;
		} else {
			// Modo teclado: se permite la rotación y el movimiento según el ángulo.
			if (Keyboard.shared.isDown("ArrowLeft")) {
				this.aimControl.angles.y += 1;
			}
			if (Keyboard.shared.isDown("ArrowRight")) {
				this.aimControl.angles.y -= 1;
			}

			const angleYRad = this.aimControl.angles.y * (Math.PI / 180);
			const moveX = VEHICULE_SPEED * Math.sin(angleYRad);
			const moveZ = VEHICULE_SPEED * Math.cos(angleYRad);

			if (Keyboard.shared.isDown("KeyA")) {
				this.aimControl.target.z -= moveX;
				this.aimControl.target.x += moveZ;
			}
			if (Keyboard.shared.isDown("KeyD")) {
				this.aimControl.target.z += moveX;
				this.aimControl.target.x -= moveZ;
			}
			if (Keyboard.shared.isDown("KeyW")) {
				this.aimControl.target.z += moveZ;
				this.aimControl.target.x += moveX;
			}
			if (Keyboard.shared.isDown("KeyS")) {
				this.aimControl.target.z -= moveZ;
				this.aimControl.target.x -= moveX;
			}
		}

		// Actualiza la posición en Firebase (aplica en ambos modos)
		this.updatePlayerPosition(this.aimControl.target.x, this.aimControl.target.y, this.aimControl.target.z);
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
			bullet.position.set(this.player.position.x, 1, this.player.position.z);

			const bulletMaterial = new StandardMaterial();
			bulletMaterial.baseColor = new Color(1, 1, 0);
			bullet.material = bulletMaterial;

			// Asigna el shooterId para evitar autodaño
			(bullet as any).shooterId = this.localPlayerId;
			// Almacena la dirección inicial usando la dirección de la cámara
			const direction = {
				x: Math.sin(this.aimControl.angles.y * (Math.PI / 180)),
				y: 0,
				z: Math.cos(this.aimControl.angles.y * (Math.PI / 180)),
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
			if (distFromPlayer > 220) {
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
		this.aimControl.target = { x: 20, y: 1.3, z: 50 };
		this.lastCameraPosition = { ...this.aimControl.target };

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
