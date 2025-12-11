import type { Container } from "pixi.js";
import { Sprite } from "pixi.js";
import type { Tower } from "../models/Tower";
import type { Enemy } from "../models/Enemy";

export class ProjectileManager {
	private static projectiles: { projectile: Sprite; enemy: Enemy }[] = []; // Lista de proyectiles con su enemigo objetivo

	public static shootAtEnemy(tower: Tower, enemy: Enemy, gameContainer: Container, tileSize: number): void {
		// Crear un nuevo Sprite para el proyectil
		const projectile = Sprite.from("projectile");

		// Escalar y posicionar el proyectil según el tamaño de la grilla
		projectile.width = tileSize * 0.2; // Ajustar tamaño relativo
		projectile.height = tileSize * 0.2; // Ajustar tamaño relativo
		projectile.anchor.set(0.5); // Centrar el ancla

		// Establecer la posición inicial del proyectil
		projectile.x = (tower.x + 0.5) * tileSize;
		projectile.y = (tower.y + 0.5) * tileSize;

		gameContainer.addChild(projectile);

		// Asociar el proyectil con el enemigo
		this.projectiles.push({ projectile, enemy });
	}

	// Método para actualizar los proyectiles y moverlos
	public static updateProjectiles(gameContainer: Container, delta: number): void {
		this.projectiles.forEach(({ projectile, enemy }, index) => {
			// Verificar si el enemigo sigue existiendo y no está muerto
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

			// Actualizamos la posición del proyectil
			projectile.x += (dx * speed * delta) / speedFactor;
			projectile.y += (dy * speed * delta) / speedFactor;

			// **Inclinamos el proyectil hacia la dirección del movimiento**
			projectile.rotation = Math.atan2(dy, dx) + 89.5;

			// Verificar si el proyectil ha llegado lo suficientemente cerca
			if (Math.abs(dx) <= 18 && Math.abs(dy) <= 120) {
				this.removeProjectile(projectile, gameContainer, index);
				enemy.takeDamage(10);

				if (enemy.health <= 0) {
					gameContainer.removeChild(enemy.sprite);
				}
			}
		});
	}

	// Método para eliminar un proyectil
	private static removeProjectile(projectile: Sprite, gameContainer: Container, index: number): void {
		// Eliminamos el proyectil de la lista
		this.projectiles.splice(index, 1);
		gameContainer.removeChild(projectile);
		projectile.destroy();
	}

	public static reset(): void {
		this.projectiles = []; // Limpia los proyectiles
	}
}
