import type { Tower } from "../models/Tower";
import type { Enemy } from "../models/Enemy";

export class DistanceHelper {
	public static isWithinRange(tower: Tower, enemy: Enemy, range: number, tileSize: number): boolean {
		const dx = tower.x - enemy.sprite.x / tileSize;
		const dy = tower.y - enemy.sprite.y / tileSize;
		return Math.sqrt(dx * dx + dy * dy) <= range;
	}
}
