import type { Container } from "pixi.js";
import { Sprite } from "pixi.js";
import type { Enemy } from "./Enemy";
import { ProjectileManager } from "../utils/ProjectileManager";
import { DistanceHelper } from "../utils/DistanceHelper";
import { GameConfig } from "../game/GameConfig"; // Asegúrate de importar GameConfig

export class Tower {
	public sprite: Sprite;
	public lastShotTime: number = 0;
	public towerConfig: { range: number; damage: number; fireRate: number };

	constructor(public x: number, public y: number, public tileSize: number) {
		// Usar valores de GameConfig para la torre
		this.towerConfig = GameConfig.towerConfig;

		// Crear un sprite utilizando la textura "towerBuilding"
		this.sprite = Sprite.from("tower");
		this.sprite.width = tileSize * 0.8; // Escalado según el tamaño deseado
		this.sprite.height = tileSize * 1.6;
		this.sprite.anchor.set(0.5); // Anclar el sprite al centro para facilitar posicionamiento

		// Posicionar el sprite en el mapa
		this.sprite.x = (x + 0.5) * tileSize;
		this.sprite.y = (y + 0.5) * tileSize;
	}

	public update(_delta: number, enemies: Enemy[], gameContainer: Container): void {
		const now = Date.now();
		const towerConfig = GameConfig.towerConfig;

		// Eliminar enemigos muertos de la lista de enemigos
		const activeEnemies = enemies.filter((e) => e.health > 0);

		// Verificar si ha pasado el tiempo necesario para disparar
		if (now - this.lastShotTime > towerConfig.fireRate) {
			const enemy = activeEnemies.find((e) => DistanceHelper.isWithinRange(this, e, towerConfig.range, this.tileSize));

			if (enemy) {
				this.lastShotTime = now;
				// Disparar al enemigo usando la configuración de la torre
				ProjectileManager.shootAtEnemy(this, enemy, gameContainer, this.tileSize);
			}
		}
	}
}
