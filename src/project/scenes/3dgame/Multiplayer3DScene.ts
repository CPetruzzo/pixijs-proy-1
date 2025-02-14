import { FutureCachopUI } from "./Utils/FutureCachopUI";
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Light, LightingEnvironment, LightType, Point3D, StandardMaterial } from "pixi3d/pixi7";
import { Color, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../../index";
import { Keyboard } from "../../../engine/input/Keyboard";
import { EnviromentalLights } from "./Lights/EnviromentalLights";
import { FUTURECOP_SPEED } from "../../../utils/constants";
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
import { Crosshair } from "./Utils/Crosshair";
import { WorldBuilding } from "./Utils/WorldBuilding";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { getAABB, intersect, rotateVectorByQuaternion } from "./Utils/CollisionUtils";
import { FutureCopPlayer } from "./FutureCopPlayer";

export interface RemoteBullet extends Mesh3D {
	direction: { x: number; y: number; z: number };
}

export class Multiplayer3DScene extends PixiScene {
	// #region  VARIABLES
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx"];

	private localPlayerId: string = Date.now().toString();
	private playersInRoom: Record<string, PhysicsContainer3d & { hp?: number }> = {};

	private player: FutureCopPlayer & { hp?: number };
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
	private readonly BULLET_SPEED = 10;

	private readonly DATABASE_NAME: string = "player3d";
	private readonly BULLETS_DATABASE_NAME: string = "bullets";

	private gameOverContainer: Container = new Container();
	private joystickContainer: Container = new Container();

	// Declaramos una variable para almacenar la función de desuscripción.
	private playersUnsubscribe: () => void;
	private joystick: VirtualJoystick;
	private crosshair: Crosshair;
	public movementEnabled: boolean = true;

	private ui: FutureCachopUI;

	// Dentro de la clase Multiplayer3DScene (o donde corresponda)
	private policeLightRed: Light;
	private policeLightBlue: Light;
	private isPaused: boolean = false;
	public worldBuilding: WorldBuilding;
	private playerBox: any;
	private bombs: Mesh3D[] = [];
	private fixedCam: boolean = true;
	// private carFire: Model;

	// #endregion VARIABLES
	constructor() {
		super();

		// MUSIC
		SoundLib.playMusic("futurecopOST", { volume: 0.22, loop: true });

		// CREATE CITY AND GROUND
		this.worldBuilding = new WorldBuilding(this);

		// CREATE CAMERA
		this.aimControl = aimControl;
		this.aimControl.distance = 35;
		this.aimControl.angles.x = 55;
		this.aimControl.target = { x: 0, y: 1.3, z: -70 };

		// CREATE JOYSTICK
		this.joystick = new VirtualJoystick(100); // Radio de 50 (ajustable)
		this.joystickContainer.addChild(this.joystick);

		this.listenForPlayersUpdates();
		this.listenForBullets();
		this.addPlayerToDatabase();

		this.init();
		this.createRespawnButton();

		this.enviromentalLights = new EnviromentalLights();

		this.addChild(this.gameOverContainer);
		const gameOverText = new Text("Game Over", new TextStyle({ fill: "red", fontSize: 50 }));
		gameOverText.anchor.set(0.5);
		// this.gameOverContainer.addChild(gameOverText);
		this.gameOverContainer.visible = false;
		this.addChild(this.joystickContainer);

		this.sortableChildren = true;

		// CROSSHAIR
		this.crosshair = new Crosshair(200, Manager.width, Manager.height);
		this.crosshair.zIndex = 1000;
		this.addChild(this.crosshair);
		this.exitAimingMode();

		// En la escena, luego de crear e insertar la UI:
		this.ui = new FutureCachopUI();
		this.ui.zIndex = 1001;
		this.addChild(this.ui);

		this.ui.on("aimToggled", (isAiming: boolean) => {
			console.log("aimToggled:", isAiming);
			if (isAiming) {
				this.ui.aimContainer.children[0].alpha = 1;
				this.ui.bottomRightContainer.children[0].alpha = 1;
				this.enterAimingMode();
			} else {
				this.ui.aimContainer.children[0].alpha = 0.5;
				this.ui.bottomRightContainer.children[0].alpha = 0.5;
				this.exitAimingMode();
			}
		});
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToScreen(this.ui.bottomRightContainer, _newW, _newH, 0.3, 0.3, ScaleHelper.FIT);
		this.ui.bottomRightContainer.x = _newW * 0.85;
		this.ui.bottomRightContainer.y = _newH * 0.8;

		ScaleHelper.setScaleRelativeToScreen(this.ui.healthBarContainer, _newW, _newH, 0.15, 0.15, ScaleHelper.FIT);
		this.ui.healthBarContainer.x = _newW * 0.1;
		this.ui.healthBarContainer.y = _newH * 0.1;

		ScaleHelper.setScaleRelativeToScreen(this.ui.aimContainer, _newW, _newH, 0.18, 0.18, ScaleHelper.FIT);
		this.ui.aimContainer.x = _newW * 0.15;
		this.ui.aimContainer.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToScreen(this.gameOverContainer, _newW, _newH, 0.5, 0.5, ScaleHelper.FIT);
		this.gameOverContainer.x = _newW * 0.5;
		this.gameOverContainer.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToScreen(this.joystickContainer, _newW, _newH, 0.3, 0.3, ScaleHelper.FIT);
		this.joystickContainer.x = _newW * 0.15;
		this.joystickContainer.y = _newH * 0.8;

		ScaleHelper.setScaleRelativeToScreen(this.crosshair, _newW, _newH, 1, 1, ScaleHelper.FILL);
		this.crosshair.x = _newW * 0.5;
		this.crosshair.y = _newH * 0.5;
	}

	// Eventos de teclado para controlar el modo mira (Ctrl o Shift)
	private onKeyDown(e: KeyboardEvent): void {
		if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
			this.enterAimingMode();
		}
	}

	private onKeyUp(e: KeyboardEvent): void {
		if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
			this.exitAimingMode();
		}
	}

	private enterAimingMode(offsetMagnitude: number = 200): void {
		this.movementEnabled = false;
		this.aimControl.aimMode = true;
		this.crosshair.visible = true;

		const angleRad = this.aimControl.angles.y * (Math.PI / 180);
		const forward = {
			x: Math.sin(angleRad),
			y: 0,
			z: Math.cos(angleRad),
		};

		new Tween(this.aimControl.aimOffset).to({ x: forward.x * offsetMagnitude, y: 0, z: forward.z * offsetMagnitude }, 300).start();

		this.aimControl.angles.x = 0;
	}

	// Método para salir del modo mira
	private exitAimingMode(): void {
		this.aimControl.aimMode = false;
		this.movementEnabled = true;
		this.crosshair.visible = false;
		this.aimControl.angles.x = 15;

		new Tween(this.aimControl.aimOffset).to({ x: 0, y: 0, z: 0 }, 300).start();
	}

	private init(): void {
		this.setupPlayer();
		this.setupControls();
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
		this.player = new FutureCopPlayer();
		this.player.name = this.localPlayerId;
		this.player.scale.set(4, 4, 4);
		this.player.y = 150;
		this.player.hp = 100;
		this.playersInRoom[this.localPlayerId] = this.player;
		this.addChild(this.player);
		this.isDead = false;

		// Crear la luz roja (sirena)
		this.policeLightRed = new Light();
		this.policeLightRed.type = LightType.spot; // Puedes probar con spot o directional según el efecto
		this.policeLightRed.intensity = 80; // Ajusta según tus necesidades
		this.policeLightRed.color = new Color(1, 0, 0); // Rojo
		this.policeLightRed.range = 100; // Ajusta el rango
		LightingEnvironment.main.lights.push(this.policeLightRed);

		// Crear la luz azul (sirena)
		this.policeLightBlue = new Light();
		this.policeLightBlue.type = LightType.spot;
		this.policeLightBlue.intensity = 80;
		this.policeLightBlue.color = new Color(0, 0, 1); // Azul
		this.policeLightBlue.range = 100;
		LightingEnvironment.main.lights.push(this.policeLightBlue);
	}

	private setupControls(): void {
		this.keys = {};
		window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
		window.addEventListener("keyup", (e) => (this.keys[e.code] = false));

		window.addEventListener("keydown", this.onKeyDown.bind(this));
		window.addEventListener("keyup", this.onKeyUp.bind(this));
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
						this.ui.updateLocalUI(this.player);
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

	private pauseOnOff(): void {
		this.isPaused = !this.isPaused;
	}

	private handlePause(): void {
		if (Keyboard.shared.justPressed("KeyP")) {
			this.pauseOnOff();
		}
	}

	public override update(delta: number): void {
		this.handlePause();
		if (this.isPaused) {
			return;
		} else {
			if (this.isDead) {
				this.showRespawnButton();
				return;
			}

			this.handleBombs();

			this.player.update(delta);
			this.updatePoliceLights();

			this.updateRemoteBullets();
			this.ui.updateLocalUI(this.player);
			this.updateRemoteHealthBars();

			this.handleCameraMovement(delta);
			this.handlePlayerMovement(delta);
			this.handlePlayerWithWorldBuildingObjects();
			this.handleShooting();
			this.updateBullets();
		}
	}

	private handleBombs(): void {
		if (Keyboard.shared.justPressed("Enter")) {
			const bomb = Mesh3D.createSphere();
			bomb.position.set(this.player.position.x, this.player.position.y, this.player.position.z);
			this.addChild(bomb);
			bomb.alpha = 0.7;
			this.bombs.push(bomb);
		}

		// console.log("this.bombs", this.bombs.length);

		for (const bomb of this.bombs) {
			new Tween(bomb)
				.to({ scale: { x: 15, y: 15, z: 15 } }, 300)
				.start()
				.onComplete(() => {
					this.removeChild(bomb);
					const bombIndex = this.bombs.indexOf(bomb);
					this.bombs.splice(bombIndex, 1);
				});
		}
	}

	private handlePlayerWithWorldBuildingObjects(): void {
		for (const torch of this.worldBuilding.torches) {
			torch.update(this.player.position);
		}

		if (this.worldBuilding && this.worldBuilding.trigger) {
			this.worldBuilding.trigger.update(this.player);
		}
	}

	private updatePoliceLights(): void {
		if (!this.player) {
			return;
		}

		const headOffset = { x: 0, y: 1.5, z: 0 };
		const headPosition = new Point3D(this.player.position.x + headOffset.x, this.player.position.y + headOffset.y, this.player.position.z + headOffset.z);

		this.policeLightRed.position.copyFrom(headPosition);
		this.policeLightBlue.position.copyFrom(headPosition);

		const time = performance.now() / 300;

		this.policeLightRed.rotationQuaternion.setEulerAngles(0, time * 90, 0);
		this.policeLightBlue.rotationQuaternion.setEulerAngles(0, -time * 90, 0);
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

		if (Keyboard.shared.justPressed("NumpadSubtract")) {
			new Tween(this.aimControl).to({ distance: 255 }, 500).start();
		}
		if (Keyboard.shared.justPressed("NumpadAdd")) {
			new Tween(this.aimControl).to({ distance: 25, y: this.aimControl.target.y }, 500).start();
		}
		if (Keyboard.shared.justPressed("KeyF")) {
			this.toggleFixedCam();
		}
	}

	private toggleFixedCam(): void {
		const camValue = !this.fixedCam;
		this.fixedCam = camValue;
		console.log("this.fixedCam", this.fixedCam);
	}

	private checkCollisions(): { collision: boolean; adjustedY?: number } {
		// Definir el AABB del jugador usando un tamaño fijo (2,2,2)
		const playerTransform = {
			position: {
				x: this.aimControl.target.x,
				y: this.aimControl.target.y,
				z: this.aimControl.target.z,
			},
			scale: { x: 2, y: 2, z: 2 },
			rotationQuaternion: { x: 0, y: 0, z: 0, w: 1 }, // Suponemos sin rotación para el jugador
		};
		this.playerBox = getAABB(playerTransform);

		let collision = false;
		let adjustedY: number | undefined = undefined;

		if (this.worldBuilding && this.worldBuilding.walls) {
			for (const wall of this.worldBuilding.walls) {
				const wallTransform = {
					position: {
						x: wall.position.x,
						y: wall.position.y,
						z: wall.position.z,
					},
					scale: {
						x: wall.scale.x,
						y: wall.scale.y,
						z: wall.scale.z,
					},
					rotationQuaternion: {
						x: wall.rotationQuaternion.x,
						y: wall.rotationQuaternion.y,
						z: wall.rotationQuaternion.z,
						w: wall.rotationQuaternion.w,
					},
				};
				const wallBox = getAABB(wallTransform);

				if (intersect(this.playerBox, wallBox)) {
					// Si la pared es inclinada (pendiente), asumimos que su dimensión "profunda" (por ejemplo, scale.z) es pequeña.
					if (wall.scale.z < 2) {
						// Ajustá este umbral según convenga
						// Calcular la posición del tope de la pendiente:
						// En el espacio local, la cara superior se encuentra en y = scale.y / 2.
						const localTop = { x: 0, y: wall.scale.y, z: 0 };
						// Rota ese vector usando el rotationQuaternion de la pared.
						const rotatedTop = rotateVectorByQuaternion(localTop, wallTransform.rotationQuaternion);
						const worldTop = {
							x: wall.position.x + rotatedTop.x,
							y: wall.position.y + rotatedTop.y,
							z: wall.position.z + rotatedTop.z,
						};
						// Para obtener la altura en el plano de la pendiente, usamos la normal del tope.
						const topNormal = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, wallTransform.rotationQuaternion);
						if (Math.abs(topNormal.y) > 0.001) {
							const diffX = this.aimControl.target.x - worldTop.x;
							const diffZ = this.aimControl.target.z - worldTop.z;
							// Resolver la ecuación del plano: n.x*(X - worldTop.x) + n.y*(Y - worldTop.y) + n.z*(Z - worldTop.z) = 0
							// Despejando Y:
							const newY = worldTop.y + (topNormal.x * diffX + topNormal.z * diffZ) / topNormal.y;
							adjustedY = newY;
						}
					} else {
						collision = true;
						break;
					}
				}
			}
		}

		return { collision, adjustedY };
	}

	private handlePlayerMovement(_delta?: number, _enabled: boolean = true): void {
		this.player.position.set(this.aimControl.target.x, this.aimControl.target.y, this.aimControl.target.z);
		if (this.fixedCam) {
			this.player.rotationQuaternion.setEulerAngles(0, this.aimControl.angles.y, 0);
		} else {
		}
		if (!_enabled) {
			return;
		}

		// Guardar la posición destino anterior
		const previousTarget = {
			x: this.aimControl.target.x,
			y: this.aimControl.target.y,
			z: this.aimControl.target.z,
		};

		// Actualizar el target según el input (joystick o teclado)
		if (this.joystick.active) {
			this.aimControl.angles.x = 25;
			this.aimControl.angles.z = 0;
			const angleYRad = this.aimControl.angles.y * (Math.PI / 180);
			const jDir = this.joystick.direction;
			const invY = -jDir.y;
			const effectiveX = -(jDir.x * Math.cos(angleYRad) - invY * Math.sin(angleYRad));
			const effectiveZ = jDir.x * Math.sin(angleYRad) + invY * Math.cos(angleYRad);
			this.aimControl.target.x += effectiveX * FUTURECOP_SPEED;
			this.aimControl.target.z += effectiveZ * FUTURECOP_SPEED;
		} else {
			if (Keyboard.shared.isDown("ArrowLeft")) {
				this.aimControl.angles.y += 1;
			}
			if (Keyboard.shared.isDown("ArrowRight")) {
				this.aimControl.angles.y -= 1;
			}
			const angleYRad = this.aimControl.angles.y * (Math.PI / 180);
			const moveX = FUTURECOP_SPEED * Math.sin(angleYRad) * _delta;
			const moveZ = FUTURECOP_SPEED * Math.cos(angleYRad) * _delta;
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
				//	if (Keyboard.shared.justPressed("KeyW")) {
				//		this.player.switchModel("run");
				//		this.player.animationModel.visible = true;
				//	}
			}
			if (Keyboard.shared.isDown("KeyS")) {
				this.aimControl.target.z -= moveZ;
				this.aimControl.target.x -= moveX;
			}
			// if (Keyboard.shared.justReleased("KeyW")) {
			//	this.player.switchModel("idle");
			// }
		}

		// Verificar colisiones
		const collisionData = this.checkCollisions();
		if (collisionData.collision) {
			// Revertir el movimiento si hay colisión bloqueante
			this.aimControl.target.x = previousTarget.x;
			this.aimControl.target.y = previousTarget.y;
			this.aimControl.target.z = previousTarget.z;
			console.log("Collision detected with wall. Movement reverted.");
		} else if (collisionData.adjustedY !== undefined) {
			// Si hay una pendiente, ajustar la Y del target
			this.aimControl.target.y = collisionData.adjustedY;
		}

		// Actualizar la posición en Firebase
		this.updatePlayerPosition(this.aimControl.target.x, this.aimControl.target.y, this.aimControl.target.z);
	}

	private shootBullet(x: number, y: number, z: number, direction: { x: number; y: number; z: number }, bulletId: string): void {
		const bulletData = { playerId: this.localPlayerId, x, y, z, direction, timestamp: Date.now() };
		set(ref(db, `bullets/${bulletId}`), bulletData);
	}

	private handleShooting(): void {
		if (this.isDead) {
			return; // No permite disparar si está muerto
		}

		// Comprueba si se presionó la barra espaciadora o se detectó un pointertap
		if (Keyboard.shared.justPressed("Space") || this.ui.pointerShotFired) {
			// Resetear la bandera del pointer tap para evitar múltiples disparos
			this.ui.pointerShotFired = false;

			SoundLib.playSound("beam", { volume: 0.05, loop: false, allowOverlap: true });
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
		buttonBg.pivot.set(75, 25);
		this.respawnButton.addChild(buttonBg);

		const style = new TextStyle({
			fill: "white",
			fontSize: 20,
			fontFamily: "Arial",
		});
		const buttonText = new Text("Respawn", style);
		buttonText.anchor.set(0.5);
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
		this.removeAllListeners();
		this.removeChildren();
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
				Manager.closeScene(this);
				Manager.changeScene(MuliplayerLobby, { transitionClass: FadeColorTransition });
			})
			.catch((error) => {
				console.error("Error al remover el jugador de la base de datos:", error);
				Manager.closeScene(this);
				Manager.changeScene(MuliplayerLobby, { transitionClass: FadeColorTransition });
			});
	}
}
