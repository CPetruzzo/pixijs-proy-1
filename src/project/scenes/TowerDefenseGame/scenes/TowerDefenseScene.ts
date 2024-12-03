import type { Point } from "pixi.js";
import { AnimatedSprite, Container, Sprite, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Enemy } from "../models/Enemy";
import { Tower } from "../models/Tower";
import { Grid } from "../utils/Grid";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { GameConfig } from "../game/GameConfig";
import { GameStats } from "../utils/GameStats";
import { UIContainer } from "../ui/UIContainer";
import { ProjectileManager } from "../utils/ProjectileManager";
import { Manager } from "../../../..";
import { TowerDefenseNameInputPopUp } from "./TowerDefenseNameInputPopUp";
import { Tween } from "tweedle.js";
import { RestartButton } from "../ui/RestartButton";

export class TowerDefenseScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private grid: number[][];
	public static tileSize: number = GameConfig.tileSize;
	public static towerCost: number = GameConfig.towerCost;
	public static gameStats: GameStats = new GameStats(GameConfig.initialPoints);
	private enemies: Enemy[] = [];
	private towers: Tower[] = [];

	private lastSpawnTime: number = 0;

	private gameContainer: Container = new Container();
	private uiLeftContainer: UIContainer = new UIContainer();
	private uiRightContainer: Container = new Container();
	private bgContainer: Container = new Container();
	private frontContainer: Container = new Container();
	private fadeContainer: Container = new Container();

	private restart: boolean = false;
	private gameOver: boolean = false;

	constructor() {
		super();
		this.grid = Grid.createGridWithObstacles(GameConfig.gridWidth, GameConfig.gridHeight);
		this.addChild(this.bgContainer, this.gameContainer, this.frontContainer, this.uiLeftContainer, this.uiRightContainer, this.fadeContainer);
		this.createBackground();

		Grid.initializeWalkableCells();
		Grid.initializeOccupiedCells();
		Grid.initializeWoodTiles(this.grid);

		this.setupClickListener();

		RestartButton.createRestartButton(this.uiRightContainer, () => this.cleanupBeforeRestart());
	}

	private cleanupBeforeRestart(): void {
		// Elimina hijos del contenedor
		this.gameContainer.removeChildren();
		this.uiLeftContainer.removeChildren();
		this.uiRightContainer.removeChildren();
		this.frontContainer.removeChildren();

		// Elimina todos los listeners de los contenedores
		this.gameContainer.removeAllListeners();
		this.uiLeftContainer.removeAllListeners();
		this.uiRightContainer.removeAllListeners();
		this.frontContainer.removeAllListeners();
		TowerDefenseScene.gameStats = new GameStats(GameConfig.initialPoints);
	}

	private addFlagAtEndPoint(x: number, y: number): void {
		// Crear el AnimatedSprite con las texturas
		const animatedSprite = new AnimatedSprite([Texture.from("1"), Texture.from("2"), Texture.from("3"), Texture.from("4"), Texture.from("5"), Texture.from("6")], true);
		// Agregar el AnimatedSprite al contenedor del personaje
		this.gameContainer.addChild(animatedSprite);

		// Configurar propiedades iniciales
		animatedSprite.anchor.set(0.5);
		animatedSprite.x = x * TowerDefenseScene.tileSize + TowerDefenseScene.tileSize / 2; // Centrar en el tile
		animatedSprite.y = y * TowerDefenseScene.tileSize + TowerDefenseScene.tileSize / 2; // Centrar en el tile
		animatedSprite.animationSpeed = 0.1; // Ajusta la velocidad de la animación
		animatedSprite.play();
	}

	private createBackground(): void {
		const rows = GameConfig.gridHeight - 1;
		const cols = GameConfig.gridWidth - 1;
		const start: [number, number] = [0, 0];
		const end: [number, number] = [cols - 1, rows - 1];

		const bg = Sprite.from("mainBG");
		bg.anchor.set(0.5);
		this.bgContainer.addChild(bg);

		const frame = Sprite.from("tdBG");
		frame.anchor.set(0.5);
		this.frontContainer.addChild(frame);

		this.grid = Grid.createMaze(rows, cols, start, end);
		Grid.drawGrid(this.grid, TowerDefenseScene.tileSize, this.gameContainer);

		this.addFlagAtEndPoint(end[0], end[1]);
	}

	private setupClickListener(): void {
		this.gameContainer.eventMode = "static";

		this.gameContainer.on("rightclick", (event: { data: { getLocalPosition: (arg0: any) => Point } }) => {
			console.log("this.gameContainer", this.gameContainer);
			const position = event.data.getLocalPosition(this.gameContainer);
			const tileX = Math.floor(position.x / TowerDefenseScene.tileSize);
			const tileY = Math.floor(position.y / TowerDefenseScene.tileSize);

			const clickedTower = this.towers.find((t) => t.x === tileX && t.y === tileY);
			if (clickedTower) {
				// this.setupHoverListener(clickedTower);
				this.tryUpgradeTower(clickedTower);
			} else if (Grid.isTileEmpty(tileX, tileY)) {
				Tower.addTower(tileX, tileY, this.towers, this.gameContainer);
			} else {
				console.log("Ocupado.");
			}
		});

		this.gameContainer.on("pointerdown", (event: { data: { getLocalPosition: (arg0: any) => Point } }) => {
			const position = event.data.getLocalPosition(this.gameContainer);
			const tileX = Math.floor(position.x / TowerDefenseScene.tileSize);
			const tileY = Math.floor(position.y / TowerDefenseScene.tileSize);

			const clickedTower = this.towers.find((t) => t.x === tileX && t.y === tileY);
			if (clickedTower) {
				// this.setupHoverListener(clickedTower);
				this.tryUpgradeTower(clickedTower);
			} else if (Grid.isTileEmpty(tileX, tileY)) {
				Tower.addTower(tileX, tileY, this.towers, this.gameContainer);
			} else {
				console.log("Ocupado.");
			}
		});
	}

	private tryUpgradeTower(clickedTower: Tower): void {
		// Buscar torres contiguas del mismo nivel
		const adjacentOffsets = [
			{ dx: 1, dy: 0 },
			{ dx: -1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: 0, dy: -1 },
		];

		for (const offset of adjacentOffsets) {
			const adjacentTower = this.towers.find((t) => t.x === clickedTower.x + offset.dx && t.y === clickedTower.y + offset.dy && t.level === clickedTower.level);

			if (adjacentTower) {
				// Fusionar torres
				if (clickedTower.level < GameConfig.towerConfig.maxLevel) {
					this.upgradeTower(clickedTower, adjacentTower);
					return;
				} else {
					console.log("no more lvls to upgrade");
				}
			}
		}

		console.log("No hay torres contiguas del mismo nivel para mejorar.");
	}

	private upgradeTower(baseTower: Tower, mergedTower: Tower): void {
		baseTower.upgrade();
		this.towers = this.towers.filter((t) => t !== mergedTower); // Eliminar la torre fusionada
		this.gameContainer.removeChild(mergedTower.animatedSprite); // Quitar la torre fusionada del contenedor
		console.log(`Torre en (${baseTower.x}, ${baseTower.y}) mejorada a nivel ${baseTower.level}`);
		Grid.occupiedCells[mergedTower.y][mergedTower.x] = false; // Marcar la celda como ocupada
	}

	public override update(delta: number): void {
		if (this.restart || this.gameOver) {
			return;
		}

		if (Date.now() - this.lastSpawnTime > GameConfig.spawnInterval) {
			Enemy.spawnEnemy(this.grid, this.enemies, this.gameContainer);
			this.lastSpawnTime = Date.now();
		}

		ProjectileManager.updateProjectiles(this.gameContainer, delta);

		// console.log("this.enemies", this.enemies.length);
		this.enemies.forEach((enemy, index) => {
			enemy.update();

			// Comprobar si el enemigo ha llegado a la bandera
			const rows = GameConfig.gridHeight - 1;
			const cols = GameConfig.gridWidth - 1;

			if (enemy.isDefeated()) {
				this.enemies.splice(index, 1); // Eliminar enemigo derrotado
				this.gameContainer.removeChild(enemy.sprite);

				// Otorgar puntos al jugador por matar al enemigo
				TowerDefenseScene.gameStats.addPoints(GameConfig.pointsPerKill[enemy.getEnemyIndex()]);
				TowerDefenseScene.gameStats.addScore(GameConfig.pointsPerKill[enemy.getEnemyIndex()]); // Incrementar el score también
				console.log(`Enemigo derrotado. Puntos actuales: ${TowerDefenseScene.gameStats.getPoints()}`);
			}

			if (!enemy.isDefeated()) {
				if (enemy.getCurrentPosition().x === cols - 1 && enemy.getCurrentPosition().y === rows - 1) {
					this.gameOver = true; // Marcar el juego como terminado
					console.log("Game Over!"); // Mostrar mensaje en consola
					// alert("Game Over!"); // Mostrar alerta en pantalla

					const gameOverBG = Sprite.from("uiFrame");
					gameOverBG.tint = 0x0fff;
					gameOverBG.scale.set(5);
					gameOverBG.anchor.set(0.5);
					gameOverBG.alpha = 0;
					this.fadeContainer.addChild(gameOverBG);

					const gameOver = Sprite.from("resetButton");
					gameOver.anchor.set(0.5);
					gameOver.alpha = 0;
					gameOver.eventMode = "static";
					this.fadeContainer.addChild(gameOver);
					gameOver.on("pointerdown", () => {
						this.restart = true;
						this.cleanupBeforeRestart(); // Limpieza antes de reiniciar
						Manager.changeScene(TowerDefenseScene); // Reiniciar la escena
					});

					new Tween(gameOverBG).to({ alpha: 1 }, 500).start();
					new Tween(gameOver).to({ alpha: 1 }, 500).start();
					// this.openTowerDefenseInputPopup();
					return; // Salir del bucle para evitar más actualizaciones
				}
			}
		});
		this.towers.forEach((tower) => tower.update(delta, this.enemies, this.gameContainer));

		this.uiLeftContainer.updateUI(TowerDefenseScene.gameStats, TowerDefenseScene.towerCost, UIContainer.calculateTotalDamage(this.towers));
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, 690, 690, ScaleHelper.FIT);
		this.gameContainer.x = newW * 0.5;
		this.gameContainer.y = newH * 0.5;

		const containerBounds = this.gameContainer.getLocalBounds();
		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);

		ScaleHelper.setScaleRelativeToIdeal(this.bgContainer, newW, newH, 1920, 1080, ScaleHelper.FILL);
		this.bgContainer.x = newW * 0.5;
		this.bgContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiRightContainer.x = newW;
		this.uiRightContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.frontContainer, newW, newH, 355, 355, ScaleHelper.FIT);
		this.frontContainer.x = newW * 0.5;
		this.frontContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.fadeContainer, newW, newH, 355, 355, ScaleHelper.FIT);
		this.fadeContainer.x = newW * 0.5;
		this.fadeContainer.y = newH * 0.5;
	}

	public async openTowerDefenseInputPopup(): Promise<void> {
		try {
			const popupInstance = await Manager.openPopup(TowerDefenseNameInputPopUp);
			if (popupInstance instanceof TowerDefenseNameInputPopUp) {
				popupInstance.showButtons();
			}
			if (popupInstance instanceof TowerDefenseNameInputPopUp) {
				popupInstance.on("HIGHSCORE_NAME_READY", () => {
					console.log("cerrate loco");
				});
			}
		} catch (error) {
			console.error("Error opening settings popup:", error);
		}
	}
}
