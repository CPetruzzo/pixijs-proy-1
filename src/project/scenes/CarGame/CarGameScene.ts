import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { db } from "../../.."; // Asegúrate de que db esté correctamente exportado desde tu configuración de Firebase
import { Graphics } from "pixi.js";
import { Keyboard } from "../../../engine/input/Keyboard";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class CarGameScene extends PixiScene {
	private players: Record<string, Graphics> = {};
	private playerId: string;

	constructor() {
		super();

		// Crear un ID único para este jugador
		this.playerId = Date.now().toString(); // Usamos un timestamp único para el ID
		console.log('this.playerId', this.playerId)

		// Escuchar las actualizaciones de la base de datos
		this.listenForPlayersUpdates();
		// Añadir este jugador a Firebase
		this.addPlayerToDatabase();
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

	// Crear jugador
	private createPlayer(id: string, x: number, y: number): void {
		console.log(`Creating player ${id} at (${x}, ${y})`);
		const car = new Graphics();
		car.beginFill(0xff0000);
		car.drawRect(-10, -20, 20, 40);
		car.endFill();
		car.x = x;
		car.y = y;
		this.players[id] = car;
		this.addChild(car);
	}

	// Añadir el jugador a la base de datos
	private async addPlayerToDatabase(): Promise<void> {
		try {
			const playerRef = ref(db, `players/${this.playerId}`);
			await set(playerRef, { x: 0, y: 0 });

			// Establecer el comportamiento de desconexión
			const playerOnDisconnectRef = ref(db, `players/${this.playerId}`);
			onDisconnect(playerOnDisconnectRef).remove(); // Elimina al jugador si se desconecta

			console.log("Player added to Firebase.");
		} catch (error) {
			console.error("Error adding player to Firebase:", error);
		}
	}

	// Actualizar la posición del jugador en Firebase
	private async updatePlayerPosition(): Promise<void> {
		try {
			const player = this.players[this.playerId];
			console.log('player', player)
			if (player) {
				const playerRef = ref(db, `players/${this.playerId}`);
				await set(playerRef, { x: player.x, y: player.y });
				console.log("Player position updated in Firebase.");
			}
		} catch (error) {
			console.error("Error updating player position in Firebase:", error);
		}
	}

	// Manejo de la entrada del jugador
	private handleInput(): void {
		let speed = 0;
		let direction = 0;

		if (Keyboard.shared.isDown("ArrowUp")) speed = 1;
		if (Keyboard.shared.isDown("ArrowDown")) speed = -1;
		if (Keyboard.shared.isDown("ArrowLeft")) direction = -Math.PI / 4;
		if (Keyboard.shared.isDown("ArrowRight")) direction = Math.PI / 4;

		if (speed !== 0 || direction !== 0) {
			const player = this.players[this.playerId];
			if (player) {
				player.x += speed * Math.cos(direction);
				player.y += speed * Math.sin(direction);
				this.updatePlayerPosition(); // Actualizar la posición en Firebase
			}
		}
	}

	// Lógica de actualización de la escena
	public override update(_dt: number): void {
		this.handleInput(); // Procesar la entrada del jugador local
		// console.log("Current players' positions:", this.players);
	}

	// Responder a cambios en el tamaño de la ventana
	public override onResize(_newW: number, _newH: number): void {
		// Redimensiona elementos si es necesario
	}
}
