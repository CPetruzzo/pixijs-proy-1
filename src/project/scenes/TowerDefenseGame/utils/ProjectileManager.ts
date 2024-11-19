import { Container, Graphics } from "pixi.js";
import { Tower } from "../models/Tower";
import { Enemy } from "../models/Enemy";
import { GameConfig } from "../game/GameConfig";

export class ProjectileManager {
	private static projectiles: Graphics[] = []; // Lista de proyectiles

	static shootAtEnemy(tower: Tower, enemy: Enemy, gameContainer: Container, tileSize: number): void {
		const projectile = new Graphics();
		projectile.beginFill(GameConfig.colors.bullet);
		projectile.drawCircle(0, 0, 5);
		projectile.endFill();

		projectile.x = (tower.x + 0.5) * tileSize;
		projectile.y = (tower.y + 0.5) * tileSize;

		gameContainer.addChild(projectile);
		this.projectiles.push(projectile); // Añadir el proyectil a la lista

		const speed = 0.05;
		const interval = setInterval(() => {
			// Validar si el enemigo y su sprite existen
			if (!enemy || !enemy.sprite) {
				clearInterval(interval);
				this.removeProjectile(projectile, gameContainer); // Usar el método removeProjectile
				return;
			}

			if (!enemy.dead) {

				const dx = enemy.sprite.x + enemy.sprite.width * 0.5 - projectile.x;
				const dy = enemy.sprite.y + enemy.sprite.height * 0.5 - projectile.y;

				projectile.x += dx * speed;
				projectile.y += dy * speed;

				if (enemy.dead) { return }
				if (Math.abs(dx) <= 18 && Math.abs(dy) <= 18) {
					clearInterval(interval);
					this.removeProjectile(projectile, gameContainer); // Usar el método removeProjectile

					enemy.takeDamage(10);
					if (enemy.health <= 0) {
						gameContainer.removeChild(enemy.sprite);
					}
				}
			} else {
				gameContainer.removeChild(projectile)
			}
		}, 16);
	}

	// Método para eliminar proyectiles
	private static removeProjectile(projectile: Graphics, gameContainer: Container): void {
		this.projectiles = this.projectiles.filter(p => p !== projectile);
		gameContainer.removeChild(projectile);
	}
}

