import type { GameObject } from "./GameObject";
import type { Player } from "./Player";
import { SoundLib } from "../../../engine/sound/SoundLib";

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
			case "ENEMY":
				// player.getStun();
				player.scoreManager.decreaseScore(50); // Disminuir puntuación
				player.takeDamage(); // Disminuir salud
				player.effects.causeBlur(1500);
				SoundLib.playSound("sound_hit", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				if (player.healthBar.getCurrentHealth() <= 0) {
					this.gameOver = true;
				}
				break;

			case "POTION":
				player.scoreManager.increaseScore(10); // Aumentar puntuación
				player.heal(); // Curar
				SoundLib.playSound("sound_award", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				break;

			case "COIN":
				player.collectCoin(50); // Recoger moneda y aumentar puntuación
				SoundLib.playSound("sound_collectable", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.1 });
				break;

			case "POWER_UP":
				player.activatePowerUp(); // Activar power-up
				player.effects.speedingPowerUp(5500); // Causar aturdimiento
				SoundLib.playSound("sound_big_award", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				break;

			case "OBSTACLE":
				player.collideWithObstacle(); // Colisión con obstáculo
				player.effects.causeStun(2000); // Causar aturdimiento
				player.healthBar.decreaseHealth(); // Disminuir salud
				SoundLib.playSound("sound_block", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.3 });
				break;

			default:
				console.log("Unrecognized object for collision handling:", obj);
				break;
		}
	}
}
