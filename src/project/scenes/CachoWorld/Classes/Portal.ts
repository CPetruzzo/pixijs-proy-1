import { Graphics, Rectangle } from "pixi.js";
import { getDatabase, ref, remove, set } from "firebase/database";
import type { CachoWorldPlayer } from "../CachoWorldPlayer";
import { Manager } from "../../../..";

export class Portal extends Graphics {
	private hasTeleported = false;
	private cooldownTime = 1000; // 1 segundo de cooldown
	private isTeleporting = false; // Flag to prevent multiple teleport attempts

	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		private targetSceneClass: any, // La clase de la escena destino
		private targetRoomId: string, // ID de la sala destino
		private spawnX: number = 150,
		private spawnY: number = 150
	) {
		super();
		// Draw the portal
		this.beginFill(0x0000ff, 0.5);
		this.drawRect(x, y, width, height);
		this.endFill();

		this.eventMode = "static";
		this.hitArea = new Rectangle(x, y, width, height);
	}

	public checkCollision(player: CachoWorldPlayer, currentRoomId: string): void {
		// Safety checks
		if (!player || !player.position || this.hasTeleported || this.isTeleporting) {
			return;
		}

		// Check if player still has getBounds method (not destroyed)
		if (typeof player.getBounds !== "function") {
			return;
		}

		try {
			if (this.getBounds().intersects(player.getBounds())) {
				this.hasTeleported = true;
				this.teleport(player, currentRoomId);

				// Reset cooldown
				setTimeout(() => {
					this.hasTeleported = false;
				}, this.cooldownTime);
			}
		} catch (error) {
			console.error("Error checking portal collision:", error);
			this.hasTeleported = false;
			this.isTeleporting = false;
		}
	}

	private async teleport(player: CachoWorldPlayer, currentRoomId: string): Promise<void> {
		// Prevent multiple teleport attempts
		if (this.isTeleporting) {
			return;
		}

		this.isTeleporting = true;
		const db = getDatabase();

		try {
			console.log(`Teleporting player ${player.id} from ${currentRoomId} to ${this.targetRoomId}`);

			// 1) Make player invisible immediately so others don't see them frozen
			player.visible = false;
			console.log(`Player ${player.id} made invisible`);

			// 2) Remove from current room in Firebase
			await remove(ref(db, `rooms/${currentRoomId}/players/${player.id}`));
			console.log(`Removed player ${player.id} from rooms/${currentRoomId}`);

			// 3) Add to target room in Firebase with spawn position
			// IMPORTANT: Only store x and y coordinates
			await set(ref(db, `rooms/${this.targetRoomId}/players/${player.id}`), {
				x: this.spawnX,
				y: this.spawnY,
			});
			console.log(`Added player ${player.id} to rooms/${this.targetRoomId}`);

			// 4) Wait a tiny bit to ensure Firebase has processed the write
			await new Promise((resolve) => setTimeout(resolve, 100));

			// 5) Change scene - pass both playerId and roomId
			Manager.changeScene(this.targetSceneClass, {
				sceneParams: [player.id, this.targetRoomId],
			});
		} catch (error) {
			console.error("Error during teleport:", error);
			// Restore visibility on error
			player.visible = true;
			this.hasTeleported = false;
			this.isTeleporting = false;
		}
	}
}
