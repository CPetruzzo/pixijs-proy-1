import type { Container } from "pixi.js";
import { Graphics, Rectangle } from "pixi.js";
import { getDatabase, ref, update, remove } from "firebase/database"; // Importa Firebase
import { CachoWorldPlayer } from "../CachoWorldPlayer";
import type { Room } from "../Classes/Room";

export class Portal extends Graphics {
	private destinationRoom: Room;
	constructor(x: number, y: number, width: number, height: number, destinationRoom: Room) {
		super();
		this.destinationRoom = destinationRoom;

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
			worldContainer.removeChild(player);

			// 1. Primero elimina al jugador de la sala de origen (si está en una).
			const db = getDatabase();
			const playerRef = ref(db, `players/${player.id}`);

			// Eliminar de la sala anterior
			if (player.currentRoom) {
				const mainPlayerRef = ref(db, `players/${player.id}`);
				await remove(mainPlayerRef); // Eliminar al jugador de la sala anterior
				console.log(`Player ${player.id} removed from the previous room.`);

				const playerRoomRef = ref(db, `rooms/${player.currentRoom.roomId}/players/${player.id}`);
				await remove(playerRoomRef); // Eliminar al jugador de la sala anterior
				console.log(`Player ${player.id} removed from the previous room.`);
			}

			// Eliminar al jugador de Firebase
			await remove(playerRef); // Eliminar al jugador de Firebase completamente
			console.log(`Player ${player.id} removed from Firebase.`);

			// 2. Actualiza la referencia del jugador para reflejar su nueva sala.
			await update(playerRef, { currentRoom: this.destinationRoom.roomId });

			// 3. Crea un nuevo jugador con un nuevo ID y posición inicial en la sala de destino.
			const newPlayerId = this.generateNewPlayerId(); // Generar un nuevo ID único
			const newPlayer = new CachoWorldPlayer(newPlayerId, 0, 0); // Asigna la sala de destino

			// Establecer la posición inicial del nuevo jugador
			newPlayer.x = 150;
			newPlayer.y = 150; // Posición inicial deseada (modificable)
			console.log(`Player ${newPlayer.id} position: (${newPlayer.x}, ${newPlayer.y})`);

			// 4. Agregar al nuevo jugador a la nueva sala
			this.destinationRoom.addPlayer(newPlayer);

			// 5. Agregar al nuevo jugador al contenedor para que sea visible en la escena
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
