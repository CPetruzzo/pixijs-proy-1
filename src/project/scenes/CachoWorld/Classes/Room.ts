import { Container } from "pixi.js";
import type { CachoWorldPlayer } from "../CachoWorldPlayer";

/**
 * Room class - simplified container for players in a specific room
 * This is NOT a scene, just a logical grouping
 */
export class Room extends Container {
	private players: Set<CachoWorldPlayer>;
	public roomId: string;

	constructor(roomId: string) {
		super();
		this.roomId = roomId;
		this.players = new Set();
		console.log(`Room ${roomId} created`);
	}

	public addPlayer(player: CachoWorldPlayer): void {
		if (!this.players.has(player)) {
			this.players.add(player);
			this.addChild(player);
			console.log(`Player ${player.id} added to room ${this.roomId}`);
		}
	}

	public removePlayer(player: CachoWorldPlayer): void {
		if (this.players.has(player)) {
			this.players.delete(player);
			this.removeChild(player);
			console.log(`Player ${player.id} removed from room ${this.roomId}`);
		}
	}

	public getPlayers(): CachoWorldPlayer[] {
		return Array.from(this.players);
	}

	public hasPlayer(playerId: string): boolean {
		return Array.from(this.players).some((p) => p.id === playerId);
	}

	public getPlayerCount(): number {
		return this.players.size;
	}
}
