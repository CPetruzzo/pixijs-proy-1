/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type { Container } from "pixi.js";
import { Graphics, Rectangle } from "pixi.js";
import { getDatabase, ref, remove, update } from "firebase/database";
import type { CachoWorldPlayer } from "../CachoWorldPlayer";
import type { Room } from "../Classes/Room";
import { Manager } from "../../../..";

export class Portal extends Graphics {
	private hasTeleported = false;

	constructor(x: number, y: number, width: number, height: number, private destinationRoom: Room) {
		super();
		// Draw the portal
		this.beginFill(0x0000ff, 0.8);
		this.drawRect(x, y, width, height);
		this.endFill();

		// Use the new PIXI eventMode API instead of `interactive`
		this.eventMode = "static";
		this.hitArea = new Rectangle(x, y, width, height);
	}

	public checkCollision(player: CachoWorldPlayer, worldContainer: Container) {
		if (this.hasTeleported) {
			return;
		}
		if (this.getBounds().intersects(player.getBounds())) {
			this.hasTeleported = true;
			this.teleport(player, worldContainer);
		}
	}

	private async teleport(player: CachoWorldPlayer, worldContainer: Container) {
		const db = getDatabase();

		// 1) Remove from old room (if any)
		const oldRoomId = player.currentRoom?.roomId;
		if (oldRoomId) {
			await remove(ref(db, `rooms/${oldRoomId}/players/${player.id}`));
			console.log(`Removed player ${player.id} from rooms/${oldRoomId}/players`);
			player.currentRoom.removePlayer(player);
		}

		// 2) Update the player’s currentRoom reference in memory
		player.currentRoom = this.destinationRoom;

		// 3) Write the player into the new room path
		const newRoomId = this.destinationRoom.roomId;
		await update(ref(db, `rooms/${newRoomId}/players/${player.id}`), { x: player.x, y: player.y });
		console.log(`Added player ${player.id} to rooms/${newRoomId}/players`);

		// 4) Remove from current scene graph and re‑add under the new room’s container
		worldContainer.removeChild(player);
		this.destinationRoom.addPlayer(player);

		// 5) Finally, switch the PixiScene
		Manager.changeScene(this.destinationRoom.destinationSceneName, { sceneParams: [player.id] });
	}
}
