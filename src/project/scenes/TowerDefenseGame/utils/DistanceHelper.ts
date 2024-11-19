import { Tower } from "../models/Tower";
import { Enemy } from "../models/Enemy";

export class DistanceHelper {
	static isWithinRange(tower: Tower, enemy: Enemy, range: number, tileSize: number): boolean {
		const dx = tower.x - enemy.sprite.x / tileSize;
		const dy = tower.y - enemy.sprite.y / tileSize;
		return Math.sqrt(dx * dx + dy * dy) <= range;
	}
}
