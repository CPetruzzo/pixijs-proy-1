import type { Point } from "pixi.js";
import { AnimatedSprite, Container, Sprite, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Enemy } from "../models/Enemy";
import { Tower } from "../models/Tower";
import { Grid } from "../utils/Grid";
import { AStarPathfinding } from "../utils/AStarPathFinding";
import { Node } from "../models/Node";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { GameConfig } from "../game/GameConfig";
import { GameStats } from "../utils/GameStats";
import { UIContainer } from "../ui/UIContainer";
import { ProjectileManager } from "../utils/ProjectileManager";
import { Manager } from "../../../..";
import { TowerDefenseNameInputPopUp } from "./TowerDefenseNameInputPopUp";
import { Tween } from "tweedle.js";

export class TowerDefenseScene extends PixiScene {
	private grid: number[][];
	private tileSize: number = GameConfig.tileSize; // Usamos GameConfig para el tamaño de los tiles
	private gameContainer: Container = new Container();
	private enemies: Enemy[] = [];
	private towers: Tower[] = [];
	private lastSpawnTime: number = 0;
	public static readonly BUNDLES = ["towerdefense"];
	public static gameStats: GameStats = new GameStats(GameConfig.initialPoints); // Inicializamos con puntos iniciales
	private towerCost: number = GameConfig.towerCost; // Costo de construir una torre
	private uiLeftContainer: UIContainer = new UIContainer();
	private uiRightContainer: Container = new Container();
	private bgContainer: Container = new Container();
	private frontContainer: Container = new Container();
	private fadeContainer: Container = new Container();
	private restartButton: Sprite; // Botón de reinicio
	private restart: boolean = false;
	private gameOver: boolean = false; // Variable para controlar el estado del juego

	constructor() {
		super();
		this.grid = Grid.createGridWithObstacles(GameConfig.gridWidth, GameConfig.gridHeight); // Usamos dimensiones desde GameConfig
		this.addChild(this.bgContainer, this.gameContainer, this.frontContainer, this.uiLeftContainer, this.uiRightContainer, this.fadeContainer);
		this.createBackground();

		Grid.initializeWalkableCells();
		Grid.initializeOccupiedCells(); // Inicializamos las celdas ocupadas
		Grid.initializeWoodTiles(this.grid); // Inicializa los tiles de tipo wood

		// this.createTowers();
		this.setupClickListener();

		this.createRestartButton();
	}

	private createRestartButton(): void {
		const resetBG = Sprite.from("resetButton"); // Asegúrate de tener una imagen para el botón
		resetBG.anchor.set(0.5);
		resetBG.x = resetBG.width * 0.5 - resetBG.width;
		resetBG.y = resetBG.height * 0.5;

		this.restartButton = Sprite.from("resetButtonPressed"); // Asegúrate de tener una imagen para el botón
		this.restartButton.anchor.set(0.5);
		this.restartButton.x = this.restartButton.width * 0.5 - resetBG.width; // Posición del botón
		this.restartButton.y = resetBG.height * 0.5;
		this.restartButton.interactive = true;

		this.restartButton.on("pointerdown", () => {
			this.restart = true;
			this.cleanupBeforeRestart(); // Limpieza antes de reiniciar

			Manager.changeScene(TowerDefenseScene); // Reiniciar la escena
		});

		this.uiRightContainer.addChild(resetBG, this.restartButton); // Agregar el botón al contenedor frontal
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
		animatedSprite.x = x * this.tileSize + this.tileSize / 2; // Centrar en el tile
		animatedSprite.y = y * this.tileSize + this.tileSize / 2; // Centrar en el tile
		animatedSprite.animationSpeed = 0.1; // Ajusta la velocidad de la animación
		animatedSprite.play();
	}

	private createBackground(): void {
		const rows = GameConfig.gridHeight - 1; // Usamos la altura configurada
		const cols = GameConfig.gridWidth - 1; // Usamos el ancho configurado
		const start: [number, number] = [0, 0]; // Coordenadas de inicio
		const end: [number, number] = [cols - 1, rows - 1]; // Coordenadas de fin

		const bg = Sprite.from("mainBG");
		bg.anchor.set(0.5)
		this.bgContainer.addChild(bg);

		const frame = Sprite.from("tdBG");
		frame.anchor.set(0.5)
		this.frontContainer.addChild(frame);

		this.grid = Grid.createMaze(rows, cols, start, end);
		Grid.drawGrid(this.grid, this.tileSize, this.gameContainer);

		this.addFlagAtEndPoint(end[0], end[1]);

	}

	private setupClickListener(): void {
		this.gameContainer.eventMode = "static";
		this.gameContainer.on("pointerdown", (event: { data: { getLocalPosition: (arg0: any) => Point } }) => {
			const position = event.data.getLocalPosition(this.gameContainer);
			const tileX = Math.floor(position.x / this.tileSize);
			const tileY = Math.floor(position.y / this.tileSize);

			const clickedTower = this.towers.find(t => t.x === tileX && t.y === tileY);
			if (clickedTower) {
				this.tryUpgradeTower(clickedTower);
			} else if (Grid.isTileEmpty(tileX, tileY)) {
				this.addTower(tileX, tileY);
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
			{ dx: 0, dy: -1 }
		];

		for (const offset of adjacentOffsets) {
			const adjacentTower = this.towers.find(t =>
				t.x === clickedTower.x + offset.dx &&
				t.y === clickedTower.y + offset.dy &&
				t.level === clickedTower.level
			);

			if (adjacentTower) {
				// Fusionar torres
				if (clickedTower.level < GameConfig.towerConfig.maxLevel) {
					this.upgradeTower(clickedTower, adjacentTower);
					return;
				} else {
					console.log("no more lvls to upgrade")
				}
			}
		}

		console.log("No hay torres contiguas del mismo nivel para mejorar.");
	}

	private upgradeTower(baseTower: Tower, mergedTower: Tower): void {
		baseTower.upgrade();
		this.towers = this.towers.filter(t => t !== mergedTower); // Eliminar la torre fusionada
		this.gameContainer.removeChild(mergedTower.sprite); // Quitar la torre fusionada del contenedor
		console.log(`Torre en (${baseTower.x}, ${baseTower.y}) mejorada a nivel ${baseTower.level}`);
		Grid.occupiedCells[mergedTower.y][mergedTower.x] = false; // Marcar la celda como ocupada

	}

	public createTowers(): void {
		const towerPositions = GameConfig.towerPositions; // Posiciones de torres definidas en GameConfig

		towerPositions.forEach((pos) => {
			const tower = new Tower(pos.x, pos.y, this.tileSize);
			this.towers.push(tower);
			this.gameContainer.addChild(tower.sprite);
			Grid.occupiedCells[pos.y][pos.x] = true; // Marcar la celda como ocupada
		});
	}

	private spawnEnemy(): void {
		const rows = GameConfig.gridHeight - 1;
		const cols = GameConfig.gridWidth - 1;
		// Verificar si la celda de inicio está ocupada
		const startX = 0;
		const startY = 0;
		const startNode: Node = new Node(startX, startY);
		const goalNode: Node = new Node(cols - 1, rows - 1);

		if (!Grid.isTileEmpty(startNode.x, startNode.y)) {
			console.log("La celda de inicio está ocupada o no es válida.");
			return;
		}
		const path = AStarPathfinding.findPath(this.grid, startNode, goalNode);
		if (!path) {
			console.log("No se encontró un camino válido.");
		}

		if (path) {
			let enemyIndex = 0; // Por defecto, seleccionamos el primer enemigo

			// Desbloquear enemigos más fuertes si el score supera ciertos valores
			if (TowerDefenseScene.gameStats.getScore() > 150) {
				enemyIndex = 1; // Desbloqueamos el enemigo 2
			}
			if (TowerDefenseScene.gameStats.getScore() > 400) {
				enemyIndex = 2; // Desbloqueamos el enemigo 3
			}
			if (TowerDefenseScene.gameStats.getScore() > 1300) {
				enemyIndex = 3; // Desbloqueamos el enemigo 4
			}
			if (TowerDefenseScene.gameStats.getScore() > 2000) {
				enemyIndex = 4; // Desbloqueamos el enemigo 5
			}
			if (TowerDefenseScene.gameStats.getScore() > 3500) {
				enemyIndex = 5; // Desbloqueamos el enemigo 6
			}

			if (!Grid.isTileEmpty(startX, startY)) {
				console.log("La celda de inicio está ocupada o no es válida.");
				return;
			}

			// Crear el enemigo en la posición de inicio y asignarle el camino calculado
			const enemy = new Enemy(startX, startY, path, this.tileSize, enemyIndex);
			this.enemies.push(enemy);
			this.gameContainer.addChild(enemy.sprite);
		}
	}

	private addTower(x: number, y: number): void {
		if (!Grid.isWoodTile(x, y)) {
			console.log("Solo puedes colocar torres en tiles de tipo wood.");
			return;
		}

		if (Grid.isTileEmpty(x, y)) {
			if (TowerDefenseScene.gameStats.spendPoints(this.towerCost)) {
				const tower = new Tower(x, y, this.tileSize);
				this.towers.push(tower);
				this.gameContainer.addChild(tower.sprite);

				// Marcar la celda como ocupada
				Grid.occupiedCells[y][x] = true;

				// Aumentar el costo de la próxima torre en 5
				this.towerCost += 30;

				console.log(`Torre agregada en (${x}, ${y}). Puntos restantes: ${TowerDefenseScene.gameStats.getPoints()}`);
				console.log(`Costo de la siguiente torre: ${this.towerCost}`);
			} else {
				console.log("No tienes suficientes puntos para agregar una torre.");
			}
		} else {
			console.log("La celda está ocupada o no es válida para una torre.");
		}
	}


	public override update(delta: number): void {
		if (this.restart || this.gameOver) {
			return;
		}

		if (Date.now() - this.lastSpawnTime > GameConfig.spawnInterval) {
			this.spawnEnemy();
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

		this.uiLeftContainer.updateUI(TowerDefenseScene.gameStats, this.towerCost);
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
		// this.isPopupOpen = true;
		// this.isPaused = true;

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
