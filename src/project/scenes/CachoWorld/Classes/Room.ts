import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import type { CachoWorldPlayer } from "../CachoWorldPlayer";
import { Manager } from "../../../..";
import { getDatabase, ref, update } from "firebase/database"; // Asegúrate de importar Firebase
import { MultiplayerCachoWorldGameScene } from "../Scenes/MultiplayerCachoWorldGameScene"; // Asegúrate de importar la escena principal

export class Room extends PixiScene {
	private players: Set<CachoWorldPlayer>;
	public roomId: string; // Identificador único de la sala
	private playerId: string;
	private isMainScene: boolean; // Nueva propiedad para decidir si ir a la escena principal
	public destinationSceneName: PixiScene | any | null;

	constructor(
		roomId: string,
		roomScene?: PixiScene | any | null,
		playerId?: string,
		isMainScene: boolean = false // Nuevo parámetro para decidir si es la escena principal
	) {
		super();
		this.roomId = roomId; // Asignar un identificador único
		this.players = new Set();
		this.destinationSceneName = roomScene;
		this.playerId = playerId;
		this.isMainScene = isMainScene; // Establecer el valor del booleano
	}

	public addPlayer(player: CachoWorldPlayer): void {
		// Verificar si el jugador ya está en la sala
		if (!this.players.has(player)) {
			this.players.add(player);
			this.addChild(player);
			player.currentRoom = this;
			console.log(`Player ${player.id} added to room ${this.roomId}.`);
			this.updatePlayerInFirebase(player, "add");
			// Si isMainScene es true, ir directamente a la escena principal
			if (this.isMainScene) {
				player.currentRoom.goToScene(MultiplayerCachoWorldGameScene, this.playerId); // Ir directamente a la escena principal
			} else {
				// De lo contrario, ir a la escena de destino
				player.currentRoom.goToScene(this.destinationSceneName, this.playerId);
			}
		} else {
			console.log(`Player ${player.id} is already in room ${this.roomId}.`);
		}
	}

	public removePlayer(player: CachoWorldPlayer): void {
		this.players.delete(player);
		this.removeChild(player);
		console.log(`Player ${player.id} removed from room ${this.roomId}.`);
		this.updatePlayerInFirebase(player, "remove");
	}

	private updatePlayerInFirebase(player: CachoWorldPlayer, action: "add" | "remove"): void {
		const db = getDatabase();
		const playerRef = ref(db, `rooms/${this.roomId}/players/${player.id}`);

		if (action === "add") {
			update(playerRef, { id: player.id, x: player.x, y: player.y });
		} else if (action === "remove") {
			update(playerRef, {}); // Pasar un objeto vacío para eliminar el jugador
		}
	}

	public goToScene(sceneName: PixiScene | any, playerId: string): void {
		Manager.changeScene(sceneName, { sceneParams: [playerId] });
	}
}
