import type { Container } from "pixi.js";
import type { GameObject } from "../Objects/GameObject";
import { CoinObject, EnemyObject, PotionObject, ObstacleObject, PowerUpObject, ShieldObject, AlienShipObject, AlienProjectile, ObjectsNames } from "../Objects/Objects";
import type { ScoreManager } from "./ScoreManager";
import Random from "../../../../engine/random/Random";

export class SpawnManager {
	private scoreManager: ScoreManager;
	// spawn values
	private spawnInterval: number = Random.shared.randomInt(500, 1500);
	private timeSinceLastSpawn: number = 0;
	private static readonly SCORE_THRESHOLDS = [500, 1000, 2000, 3500, 5000];
	private static readonly SPAWN_INTERVALS = [1500, 1000, 800, 600, 450, 350];

	constructor(scoreManager: ScoreManager) {
		this.scoreManager = scoreManager;
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

		if (score >= 4500) {
			objectType = Random.shared.randomInt(0, 6); // Aumentar la variedad de objetos
		} else if (score >= 3000) {
			objectType = Random.shared.randomInt(0, 6); // Aumentar la variedad de objetos
		} else if (score >= 1750) {
			objectType = Random.shared.randomInt(0, 5); // Aumentar la variedad de objetos
		} else if (score >= 500) {
			objectType = Random.shared.randomInt(0, 4);
		} else {
			objectType = Random.shared.randomInt(0, 3);
		}

		const objectTypes = [
			{ constructor: EnemyObject, name: "ENEMY" },
			{ constructor: PotionObject, name: "POTION" },
			{ constructor: CoinObject, name: "COIN" },
			{ constructor: PowerUpObject, name: "POWER_UP" },
			{ constructor: ObstacleObject, name: "OBSTACLE" },
			{ constructor: ShieldObject, name: "SHIELD" },
			{ constructor: AlienShipObject, name: "ALIEN_SHIP" },
			{ constructor: AlienProjectile, name: "PROYECTILE" },
		];

		// Si el puntaje es mayor o igual a 4500, filtramos el índice de obstáculos
		if (score >= 4500) {
			// Excluyendo obstáculos específicamente
			console.log("objectTypes[0].name", objectTypes[4].name);
			objectTypes.splice(4, 1); // Eliminar el objeto de obstáculos (índice 4)
		}

		const selectedObject = objectTypes[objectType];
		let object;
		if (selectedObject.name == ObjectsNames.ALIEN_SHIP) {
			object = new selectedObject.constructor(objects, background);
		} else {
			object = new selectedObject.constructor();
		}
		object.name = selectedObject.name;

		object.x = Random.shared.randomInt(object.width * 0.5, background.width - object.width * 0.5);

		objects.push(object);
		background.addChild(object);
	}

	public getSpawnInterval(): number {
		return this.spawnInterval;
	}

	public update(dt: number, objects: GameObject[], background: Container): void {
		this.timeSinceLastSpawn += dt;

		if (this.timeSinceLastSpawn >= this.spawnInterval) {
			this.timeSinceLastSpawn = 0;
			this.spawnObject(objects, background);
			this.adjustSpawnInterval();
		}
	}
}
