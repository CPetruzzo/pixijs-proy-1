import type { Container } from "pixi.js";
import type { GameObject } from "./GameObject";
import { CoinObject, EnemyObject, NegativeObject, ObstacleObject, PowerUpObject } from "./Objects";
import type { ScoreManager } from "./ScoreManager";
import Random from "../../../engine/random/Random";

export class SpawnManager {
	private scoreManager: ScoreManager;
	private spawnInterval: number;
	private static readonly SCORE_THRESHOLDS = [500, 1000, 2000, 3000, 4000];
	private static readonly SPAWN_INTERVALS = [1500, 1000, 800, 500, 300, 150];

	constructor(scoreManager: ScoreManager) {
		this.scoreManager = scoreManager;
		this.spawnInterval = Random.shared.randomInt(1500, 1500); // Valor inicial
	}

	public adjustSpawnInterval(): void {
		const score = this.scoreManager.getScore();
		for (let i = 0; i < SpawnManager.SCORE_THRESHOLDS.length; i++) {
			if (score >= SpawnManager.SCORE_THRESHOLDS[i]) {
				this.spawnInterval = Random.shared.randomInt(SpawnManager.SPAWN_INTERVALS[i + 1], SpawnManager.SPAWN_INTERVALS[i]);
			}
		}
	}

	public spawnObject(objects: GameObject[], background: Container): void {
		let objectType: number;
		const score = this.scoreManager.getScore();

		if (score >= 1000) {
			objectType = Random.shared.randomInt(0, 5); // Aumentar la variedad de objetos
		} else if (score >= 500) {
			objectType = Random.shared.randomInt(0, 4);
		} else {
			objectType = Random.shared.randomInt(0, 3);
		}

		const objectTypes = [
			{ constructor: EnemyObject, name: "ENEMY" },
			{ constructor: NegativeObject, name: "POTION" },
			{ constructor: CoinObject, name: "COIN" },
			{ constructor: PowerUpObject, name: "POWER_UP" },
			{ constructor: ObstacleObject, name: "OBSTACLE" },
		];

		const selectedObject = objectTypes[objectType];
		const object = new selectedObject.constructor();
		object.name = selectedObject.name;

		object.x = Random.shared.randomInt(object.width * 0.5, background.width - object.width * 0.5);

		objects.push(object);
		background.addChild(object);
	}

	public getSpawnInterval(): number {
		return this.spawnInterval;
	}
}