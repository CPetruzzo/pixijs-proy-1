import type { Container } from "pixi.js";
import { Graphics, Rectangle } from "pixi.js";
import { getDatabase, ref, remove, update } from "firebase/database"; // Importa Firebase
import { CachoWorldPlayer } from "./CachoWorldPlayer";
import type { Room } from "./Room";

export class PortalToMenu extends Graphics {
	private destinationRoom: Room;
	public playerId: string;

	constructor(destinationRoom: Room, x: number, y: number, width: number, height: number, playerId: string) {
		super();
		this.destinationRoom = destinationRoom;
		this.playerId = playerId;

		// Dibujar el portal
		this.beginFill(0x0000ff, 0.8);
		this.drawRect(x, y, width, height);
		this.endFill();
		this.interactive = true;
		this.hitArea = new Rectangle(x, y, width, height);
	}

	public checkCollision(player: CachoWorldPlayer, worldContainer: Container): void {
		const playerBounds = player.getBounds();
		const portalBounds = this.getBounds();

		if (
			playerBounds.x < portalBounds.x + portalBounds.width &&
			playerBounds.x + playerBounds.width > portalBounds.x &&
			playerBounds.y < portalBounds.y + portalBounds.height &&
			playerBounds.height + playerBounds.y > portalBounds.y
		) {
			this.handlePlayerEnter(player, worldContainer);
		}
	}

	private async handlePlayerEnter(player: CachoWorldPlayer, worldContainer: Container): Promise<void> {
		console.log(`Player ${player.id} entered the portal.`);

		if (this.destinationRoom) {
			// Eliminar al jugador de la escena (del worldContainer)
			worldContainer.removeChild(player);

			// Eliminar al jugador de Firebase
			const db = getDatabase();
			const playerRef = ref(db, `players/${player.id}`);
			await remove(playerRef); // Eliminar de Firebase

			// Eliminar de la sala anterior
			if (player.currentRoom) {
				const mainPlayerRef = ref(db, `players/${player.id}`);
				await remove(mainPlayerRef); // Eliminar al jugador de la sala anterior
				console.log(`Player ${player.id} removed from the previous room.`);

				const playerRoomRef = ref(db, `rooms/${player.currentRoom.roomId}/players/${player.id}`);
				await remove(playerRoomRef); // Eliminar al jugador de la sala anterior
				console.log(`Player ${player.id} removed from the previous room.`);
			}

			console.log(`Player ${player.id} removed from Firebase and scene.`);

			// Eliminar al jugador de la sala en la base de datos
			const playerRoomRef = ref(db, `rooms/${player.currentRoom?.roomId}/players/${player.id}`);
			await remove(playerRoomRef); // Eliminarlo también de la sala

			// Actualiza en Firebase el movimiento entre salas (removerlo de la sala anterior)
			const playerRoomUpdateRef = ref(db, `players/${player.id}`);
			await update(playerRoomUpdateRef, { currentRoom: this.destinationRoom.roomId });

			// Crear un nuevo jugador con un nuevo playerId en la nueva sala
			const newPlayerId = this.generateNewPlayerId(); // Generar un nuevo ID único
			const newPlayer = new CachoWorldPlayer(newPlayerId, 0, 0);

			// Establecer la posición inicial del nuevo jugador
			newPlayer.x = 150;
			newPlayer.y = 150; // O la posición inicial deseada
			if (newPlayer && newPlayer.position) {
				console.log(`Player ${newPlayer.id} position: (${newPlayer.position.x}, ${newPlayer.position.y})`);
			} else {
				console.error("Player or position is null.");
			}

			// Agregar al nuevo jugador a la nueva sala en la escena
			this.destinationRoom.addPlayer(newPlayer);

			// Agregar al nuevo jugador al contenedor
			worldContainer.addChild(newPlayer);

			console.log(`New player ${newPlayer.id} created and added to the new room.`);
		} else {
			console.error("Destination room is undefined.");
		}
	}

	// Función para generar un nuevo ID de jugador único
	private generateNewPlayerId(): string {
		// Puedes usar alguna estrategia aquí, como generar un UUID o un ID único basado en el tiempo
		return `${Date.now()}`;
	}
}
