import { ref, set, onValue, onDisconnect, remove } from "firebase/database";
import { db } from "../../../..";
import { Keyboard } from "../../../../engine/input/Keyboard";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Container } from "pixi.js";
import { CachoWorldPlayer } from "../CachoWorldPlayer";
import { NewWorldMap } from "../NewWorldMap";
import { Routes } from "../Chat";
import { JoystickMultiplayerCachoWorld } from "../JoystickMultiplayerCachoWorld";
import { PortalToMenu } from "../PortalToMenu";
import { Room } from "../Classes/Room";
import { MultiplayerCachoWorldGameScene } from "../Scenes/MultiplayerCachoWorldGameScene";

export class RoomScene extends PixiScene {
	private players: Record<string, CachoWorldPlayer> = {};
	private playerId: string;
	private worldContainer: Container = new Container();
	private newWorldMap: NewWorldMap;
	public static readonly BUNDLES = ["joystick", "cachoworld"];
	private joystick: JoystickMultiplayerCachoWorld;
	private portal: PortalToMenu;
	private room: Room; // Instancia de Room para manejar la sala

	constructor(playerEnteringID: string, roomId: string) {
		super();
		this.worldContainer.name = "WorldContainer";
		this.addChild(this.worldContainer);

		this.playerId = playerEnteringID;
		this.room = new Room(roomId, RoomScene, this.playerId); // Crear una instancia de la sala

		// Crear mapa de la nueva escena
		this.createMap();

		// Crear jugadores y actualizaciones
		this.listenForPlayersUpdates();
		this.addPlayerToDatabase();

		// Configurar controles de teclado u otras funcionalidades
		this.setupInputHandling();

		const lobby = new Room("Lobby", MultiplayerCachoWorldGameScene, this.playerId, true);
		this.portal = new PortalToMenu(lobby, 200, 300, 50, 100, this.playerId); // Destino: room2, posición y tamaño
		this.worldContainer.addChild(this.portal); // Agregar el portal al contenedor principal

		console.log("players", this.players);
	}

	private createMap(): void {
		this.newWorldMap = new NewWorldMap(); // Nuevo mapa para la nueva escena
		this.worldContainer.addChildAt(this.newWorldMap, 0);
	}

	// Configuración de jugadores y Firebase
	// eslint-disable-next-line @typescript-eslint/require-await
	private async listenForPlayersUpdates(): Promise<void> {
		const playersRef = ref(db, "players");

		onValue(playersRef, (snapshot) => {
			const serverPlayers = snapshot.exists() ? snapshot.val() : {};

			Object.keys(serverPlayers).forEach((id) => {
				const playerData = serverPlayers[id];
				if (!this.players[id]) {
					this.createPlayer(id, playerData.x, playerData.y);
				} else {
					// Actualizar posición
					this.players[id].x = playerData.x;
					this.players[id].y = playerData.y;
				}
			});
		});
	}

	private createPlayer(id: string, x: number, y: number): void {
		const newPlayer = new CachoWorldPlayer(id, x, y);
		this.players[id] = newPlayer;
		this.worldContainer.addChild(newPlayer);
	}

	private async addPlayerToDatabase(): Promise<void> {
		const playerRef = ref(db, `players/${this.playerId}`);
		await set(playerRef, { x: 150, y: 150 });

		const playerOnDisconnectRef = ref(db, `players/${this.playerId}`);
		onDisconnect(playerOnDisconnectRef).remove();

		if (!this.players[this.playerId]) {
			this.createLocalPlayer(); // Solo crea el jugador si no existe
		}
	}

	private createLocalPlayer(): void {
		const newPlayer = new CachoWorldPlayer(this.playerId, 0, 0);
		this.room.addPlayer(newPlayer); // Agregar al jugador a la sala
		this.addChild(newPlayer); // Agregar el jugador a la escena
		this.joystick = new JoystickMultiplayerCachoWorld(newPlayer);
		this.addChild(this.joystick); // Agregar el joystick a la escena
	}

	private setupInputHandling(): void {
		let speed = 0;
		let direction = 0;

		// Procesar entrada del teclado para el jugador local
		if (Keyboard.shared.isDown("ArrowUp")) {
			speed = 5;
			direction = -Math.PI / 2;
		}
		if (Keyboard.shared.isDown("ArrowDown")) {
			speed = 5;
			direction = Math.PI / 2;
		}
		if (Keyboard.shared.isDown("ArrowLeft")) {
			speed = 5;
			direction = Math.PI;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			speed = 5;
			direction = 0;
		}

		// Obtener el jugador local
		const player = this.players[this.playerId];
		if (!player) {
			console.warn("No local player found with ID:", this.playerId);
			return;
		}

		// Actualizar animación solo para el jugador local
		if (speed === 0) {
			if (player.animator.currentStateName !== "idle") {
				player.animator.playState("idle");
			}
		} else {
			if (player.animator.currentStateName !== "bouncing") {
				player.animator.playState("bouncing");
			}
		}

		// Mover al jugador local si hay velocidad
		if (speed !== 0 || direction !== 0) {
			player.move(speed, direction);
			this.updatePlayerPositionInFirebase(); // Actualizar en Firebase solo para el jugador local
		}
	}

	// Actualizar la posición del jugador en Firebase
	private async updatePlayerPositionInFirebase(): Promise<void> {
		try {
			const player = this.players[this.playerId];
			// console.log('player', player)
			if (player) {
				const playerRef = ref(db, `${Routes.PLAYERS}/${this.playerId}`);
				await set(playerRef, { x: player.x, y: player.y });
				// console.log("Player position updated in Firebase.");
			}
		} catch (error) {
			console.error("Error updating player position in Firebase:", error);
		}
	}

	public override update(_dt: number): void {
		if (this.joystick) {
			this.joystick.updateJoystick();
			this.updatePlayerPositionInFirebase();
		}

		if (this.players[this.playerId]) {
			this.setupInputHandling();
			this.portal.checkCollision(this.players[this.playerId], this.worldContainer);
		}

		// Actualizar todos los jugadores en la escena
		for (const playerId in this.players) {
			const player = this.players[playerId];
			if (player instanceof CachoWorldPlayer) {
				// Centrar la cámara en el jugador local
				if (playerId === this.playerId) {
					const scale = this.worldTransform.a; // Factor de escala
					const targetX = -player.x * scale + window.innerWidth * 0.5;
					const targetY = -player.y * scale + window.innerHeight * 0.5;

					// Aplicar interpolación suave para evitar desfase
					this.worldContainer.x += (targetX - this.worldContainer.x) * 0.1; // Ajusta el factor para suavizar
					this.worldContainer.y += (targetY - this.worldContainer.y) * 0.1;
				}
				player.update(_dt); // Llama al método `update` de cada jugador
			}
		}
	}

	public checkCollision(player: CachoWorldPlayer): void {
		const portalBounds = this.getBounds();
		if (portalBounds.contains(player.x, player.y)) {
			this.teleportPlayer(player);
		}
	}

	private async teleportPlayer(player: CachoWorldPlayer): Promise<void> {
		// Eliminar el jugador de la escena
		this.worldContainer.removeChild(player);

		// Eliminar al jugador de la base de datos
		const playerRef = ref(db, `players/${player.id}`);
		await remove(playerRef);
	}
}
