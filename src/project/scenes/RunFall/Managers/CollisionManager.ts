import type { GameObject } from "../Objects/GameObject";
import type { Player } from "../Objects/Player";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { BLUR_TIME, COIN_POINTS, ENEMY_COUNTER_POINTS, POTION_POINTS, SOUNDPARAMS1, SOUNDPARAMS2 } from "../../../../utils/constants";
import { ObjectsNames } from "../Objects/Objects";
import { Sounds } from "./SoundManager";

export class CollisionManager {
	public static gameOver: boolean = false;

	public static checkCollision(player: Player, obj: GameObject): boolean {
		const playerBounds = player.aux.getBounds();
		const objBounds = obj.getBounds();

		return (
			playerBounds.x + playerBounds.width > objBounds.x &&
			playerBounds.x < objBounds.x + objBounds.width &&
			playerBounds.y + playerBounds.height > objBounds.y &&
			playerBounds.y < objBounds.y + objBounds.height
		);
	}

	public static handleCollision(player: Player, obj: GameObject): void {
		switch (obj.name) {
			case ObjectsNames.ENEMY:
				player.scoreManager.decreaseScore(ENEMY_COUNTER_POINTS);
				player.takeDamage();
				player.effectManager.causeBlur(BLUR_TIME);
				player.achievementsState.enemyCollisions++;
				SoundLib.playSound(Sounds.ENEMY, SOUNDPARAMS1);
				if (player.healthBar.getCurrentHealth() <= 0) {
					this.gameOver = true;
				}
				break;

			case ObjectsNames.POTION:
				player.scoreManager.increaseScore(POTION_POINTS);
				player.heal(); // Curar
				player.achievementsState.potionsCollected++;
				SoundLib.playSound(Sounds.POTION, SOUNDPARAMS1);
				break;

			case ObjectsNames.COIN:
				player.collectCoin(COIN_POINTS);
				player.achievementsState.coinsCollected++;
				SoundLib.playSound(Sounds.COIN, SOUNDPARAMS2);
				break;

			case ObjectsNames.POWER_UP:
				player.activatePowerUp();
				player.playState("cheers");
				SoundLib.playSound(Sounds.POWERUP, SOUNDPARAMS1);
				break;

			case ObjectsNames.OBSTACLE:
				player.collideWithObstacle();
				player.playState("defeat");
				player.takeDamage();
				player.achievementsState.obstacleCollisions++;
				if (player.healthBar.getCurrentHealth() <= 0) {
					this.gameOver = true;
				}
				SoundLib.playSound(Sounds.OBSTACLE, SOUNDPARAMS1);
				break;

			default:
				console.log("Unrecognized object for collision handling:", obj);
				break;
		}
	}
}
