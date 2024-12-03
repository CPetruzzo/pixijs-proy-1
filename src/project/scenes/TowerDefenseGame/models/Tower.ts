import type { Container } from "pixi.js";
import { AnimatedSprite, Texture } from "pixi.js";
import type { Enemy } from "./Enemy";
import { ProjectileManager } from "../utils/ProjectileManager";
import { DistanceHelper } from "../utils/DistanceHelper";
import { GameConfig } from "../game/GameConfig"; // Asegúrate de importar GameConfig
import { Grid } from "../utils/Grid";
import { TowerDefenseScene } from "../scenes/TowerDefenseScene";

export class Tower {
	public level: number = 1; // Nivel inicial de la torre
	public animatedSprite: AnimatedSprite;
	public lastShotTime: number = 0;
	public towerConfig: { range: number; damage: number; fireRate: number };
	private animations: string[];

	constructor(public x: number, public y: number, public tileSize: number) {
		// Usar valores de GameConfig para la torre
		this.towerConfig = { ...GameConfig.towerConfig }; // Clonar para evitar modificar la configuración global

		this.animations = [`towerLevel${this.level}A`, `towerLevel${this.level}B`, `towerLevel${this.level}C`, `towerLevel${this.level}D`];

		this.animatedSprite = new AnimatedSprite(
			[Texture.from(this.animations[0]), Texture.from(this.animations[1]), Texture.from(this.animations[2]), Texture.from(this.animations[3])],
			true
		);
		this.animatedSprite.x = x * this.tileSize + this.tileSize * 0.5; // Centrar en el tile
		this.animatedSprite.y = y * this.tileSize + this.tileSize * 0.5; // Centrar en el tile
		this.animatedSprite.anchor.set(0.5, 0.7);
		this.animatedSprite.scale.set(0.8, 0.8);
		this.animatedSprite.animationSpeed = 0.1; // Ajusta la velocidad de la animación
		this.animatedSprite.play();

		// // Crear un sprite utilizando la textura "towerBuilding"
		// this.sprite = AnimatedSprite.from("towerLevel1");
		// this.sprite.width = tileSize * 0.8; // Escalado según el tamaño deseado
		// this.sprite.height = tileSize * 1.2;
		// this.sprite.anchor.set(0.5, 0.7); // Anclar el sprite al centro para facilitar posicionamiento

		// // Posicionar el sprite en el mapa
		// this.sprite.x = (x + 0.5) * tileSize;
		// this.sprite.y = (y + 0.5) * tileSize;
	}

	public update(_delta: number, enemies: Enemy[], gameContainer: Container): void {
		const now = Date.now();
		const towerConfig = this.towerConfig; // Usar configuración específica de esta torre

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

	public upgrade(): void {
		if (this.level < GameConfig.towerConfig.maxLevel) {
			this.level++;

			this.animations = [`towerLevel${this.level}A`, `towerLevel${this.level}B`, `towerLevel${this.level}C`, `towerLevel${this.level}D`];

			this.animatedSprite.textures = [Texture.from(this.animations[0]), Texture.from(this.animations[1]), Texture.from(this.animations[2]), Texture.from(this.animations[3])];
			this.animatedSprite.play();

			// Incrementar el daño en un 5%
			this.towerConfig.damage *= 2;
			console.log("Daño de la nueva torre", this.towerConfig.damage);
		}
	}

	public static addTower(x: number, y: number, towers: Tower[], gameContainer: Container): void {
		if (!Grid.isWoodTile(x, y)) {
			console.log("Solo puedes colocar torres en tiles de tipo wood.");
			return;
		}

		if (Grid.isTileEmpty(x, y)) {
			if (TowerDefenseScene.gameStats.spendPoints(TowerDefenseScene.towerCost)) {
				const tower = new Tower(x, y, TowerDefenseScene.tileSize);
				towers.push(tower);
				gameContainer.addChild(tower.animatedSprite);
				tower.animatedSprite.zIndex = 1; // Asegúrate de que esté por encima de otros objetos.
				gameContainer.sortChildren(); // Ordena los elementos según sus zIndex.

				// Marcar la celda como ocupada
				Grid.occupiedCells[y][x] = true;

				// Aumentar el costo de la próxima torre en 5
				TowerDefenseScene.towerCost += 30;

				console.log(`Torre agregada en (${x}, ${y}). Puntos restantes: ${TowerDefenseScene.gameStats.getPoints()}`);
				console.log(`Costo de la siguiente torre: ${TowerDefenseScene.towerCost}`);
			} else {
				console.log("No tienes suficientes puntos para agregar una torre.");
			}
		} else {
			console.log("La celda está ocupada o no es válida para una torre.");
		}
	}
}
