import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { db } from "../../.."; // Asegúrate de que db esté correctamente exportado desde tu configuración de Firebase
import { Keyboard } from "../../../engine/input/Keyboard";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { JoystickMultiplayerCachoWorld } from './JoystickMultiplayerCachoWorld';
import { CachoWorldPlayer } from './CachoWorldPlayer';
// import { Camera2D } from '../../../utils/Camera2D';
import { Container } from 'pixi.js';
import { ScaleHelper } from '../../../engine/utils/ScaleHelper';

export class MultiplayerCachoWorldGameScene extends PixiScene {
	private players: Record<string, CachoWorldPlayer> = {};
	private playerId: string;
	private joystick: JoystickMultiplayerCachoWorld;
	public static readonly BUNDLES = ["joystick"];
	// private camera: Camera2D;
	private worldContainer: Container = new Container();

	constructor() {
		super();

		this.addChild(this.worldContainer);
		// Crear un ID único para este jugador
		this.playerId = Date.now().toString(); // Usamos un timestamp único para el ID
		// console.log('this.playerId', this.playerId)

		// Escuchar las actualizaciones de la base de datos
		this.listenForPlayersUpdates();
		// Añadir este jugador a Firebase
		this.addPlayerToDatabase();

		// this.camera = new Camera2D();
	}

	// Escuchar cambios en la base de datos y actualizar jugadores en tiempo real
	private async listenForPlayersUpdates(): Promise<void> {
		try {
			const playersRef = ref(db, "players");

			// Usar onValue para escuchar actualizaciones en tiempo real
			onValue(playersRef, (snapshot) => {
				if (snapshot.exists()) {
					const serverPlayers = snapshot.val() as Record<string, { x: number, y: number }>;
					console.log("Players received:", serverPlayers);

					for (const [id, playerData] of Object.entries(serverPlayers)) {
						if (!this.players[id] && playerData) {
							this.createPlayer(id, playerData.x, playerData.y);
						} else {
							this.players[id].x = playerData.x;
							this.players[id].y = playerData.y;
						}
					}
				} else {
					console.log("No players in the database.");
				}
			});
		} catch (error) {
			console.error("Error fetching players from Firebase:", error);
		}
	}

	private createPlayer(id: string, x: number, y: number): void {
		console.log(`Creating player ${id} at (${x}, ${y})`);
		const player = new CachoWorldPlayer(id, x, y);
		this.players[id] = player;
		this.worldContainer.addChild(player);
	}

	private async addPlayerToDatabase(): Promise<void> {
		try {
			const playerRef = ref(db, `players/${this.playerId}`);
			await set(playerRef, { x: 0, y: 0 });

			// Establecer desconexión
			const playerOnDisconnectRef = ref(db, `players/${this.playerId}`);
			onDisconnect(playerOnDisconnectRef).remove();

			console.log("Player added to Firebase.");

			// Crear al jugador local después de añadirlo a Firebase
			this.createLocalPlayer();
		} catch (error) {
			console.error("Error adding player to Firebase:", error);
		}
	}

	private createLocalPlayer(): void {
		// Crear el jugador local en la escena
		const myPlayer = new CachoWorldPlayer(this.playerId, 0, 0);
		myPlayer.name = `Player${this.playerId}`
		this.players[this.playerId] = myPlayer;
		this.addChild(myPlayer);

		// Crear el joystick
		this.joystick = new JoystickMultiplayerCachoWorld(myPlayer);
		this.addChild(this.joystick);
	}

	// Actualizar la posición del jugador en Firebase
	private async updatePlayerPosition(): Promise<void> {
		try {
			const player = this.players[this.playerId];
			// console.log('player', player)
			if (player) {
				const playerRef = ref(db, `players/${this.playerId}`);
				await set(playerRef, { x: player.x, y: player.y });
				// console.log("Player position updated in Firebase.");
			}
		} catch (error) {
			console.error("Error updating player position in Firebase:", error);
		}
	}

	private handleInput(): void {
		let speed = 0;
		let direction = 0;

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

		if (speed !== 0 || direction !== 0) {
			const player = this.players[this.playerId];
			if (player) {
				player.move(speed, direction);
				this.updatePlayerPosition(); // Actualiza posición en Firebase
			}
		}
	}


	// Lógica de actualización de la escena
	public override update(_dt: number): void {
		if (this.joystick) {
			this.joystick.updateJoystick();
			this.updatePlayerPosition(); // Actualiza posición en Firebase
		}
		this.handleInput(); // Procesar la entrada del jugador local
		// console.log("Current players' positions:", this.players);
		// this.camera.anchoredOnLevel(this.worldContainer, this.players[this.playerId]);

	}

	// Responder a cambios en el tamaño de la ventana
	public override onResize(_newW: number, _newH: number): void {
		// Redimensiona elementos si es necesario
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, _newW * 0.9, _newH * 0.9);

	}
}
