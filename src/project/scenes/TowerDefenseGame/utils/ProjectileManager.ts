import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import type { Tower } from "../models/Tower";
import type { Enemy } from "../models/Enemy";
import { GameConfig } from "../game/GameConfig";

export class ProjectileManager {
	private static projectiles: { projectile: Graphics; enemy: Enemy }[] = []; // Lista de proyectiles con su enemigo objetivo

	public static shootAtEnemy(tower: Tower, enemy: Enemy, gameContainer: Container, tileSize: number): void {
		const projectile = new Graphics();
		projectile.beginFill(GameConfig.colors.bullet);
		projectile.drawCircle(0, 0, 5); // Aumenta el tamaño si es necesario
		projectile.endFill();
		projectile.lineStyle(2, 0xff0000); // Opcional: añade borde rojo para hacer más visible

		// Establecer la posición del proyectil
		projectile.x = (tower.x + 0.5) * tileSize;
		projectile.y = (tower.y + 0.5) * tileSize;

		gameContainer.addChild(projectile);

		// Asociamos el proyectil con su enemigo
		this.projectiles.push({ projectile, enemy });
	}

	// Método para actualizar los proyectiles y moverlos
	public static updateProjectiles(gameContainer: Container, delta: number): void {
		this.projectiles.forEach(({ projectile, enemy }, index) => {
			// Verificamos si el enemigo sigue existiendo y no está muerto
			if (!enemy || enemy.dead) {
				this.removeProjectile(projectile, gameContainer, index);
				return;
			}

			// Cálculos de movimiento del proyectil
			const dx = enemy.sprite.x + enemy.sprite.width * 0.5 - projectile.x;
			const dy = enemy.sprite.y + enemy.sprite.height * 0.5 - projectile.y;
			const distance = Math.sqrt(dx * dx + dy * dy); // Distancia al enemigo

			const speed = 0.1; // Velocidad base del proyectil

			// Si la distancia es pequeña, reducimos la velocidad para simular que se frena
			const speedFactor = Math.max(0.01, distance * 0.05); // Factor de desaceleración

			// Actualizamos la posición del proyectil, moviéndolo más lento a medida que se acerca
			projectile.x += (dx * speed * delta) / speedFactor;
			projectile.y += (dy * speed * delta) / speedFactor;

			// Verificamos si el proyectil ha llegado lo suficientemente cerca
			if (Math.abs(dx) <= 18 && Math.abs(dy) <= 15) {
				this.removeProjectile(projectile, gameContainer, index);
				enemy.takeDamage(10);

				if (enemy.health <= 0) {
					gameContainer.removeChild(enemy.sprite);
				}
			}
		});
	}

	// Método para eliminar un proyectil
	private static removeProjectile(projectile: Graphics, gameContainer: Container, index: number): void {
		// Eliminamos el proyectil de la lista
		this.projectiles.splice(index, 1);
		console.log("this.projectiles", this.projectiles);
		gameContainer.removeChild(projectile);
		projectile.destroy();
	}
}
