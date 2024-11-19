import type { Point } from "pixi.js";
import { Container } from "pixi.js";
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

export class TowerDefenseScene extends PixiScene {
	private grid: number[][];
	private tileSize: number = GameConfig.tileSize; // Usamos GameConfig para el tamaño de los tiles
	private gameContainer: Container = new Container();
	private enemies: Enemy[] = [];
	private towers: Tower[] = [];
	private lastSpawnTime: number = 0;
	private walkableCells: boolean[][] = [];
	private occupiedCells: boolean[][] = []; // Nueva matriz para las celdas ocupadas
	public static readonly BUNDLES = ["towerdefense"];
	public static gameStats: GameStats = new GameStats(GameConfig.initialPoints); // Inicializamos con puntos iniciales
	private towerCost: number = GameConfig.towerCost; // Costo de construir una torre
	private uiContainer: UIContainer = new UIContainer();

	constructor() {
		super();
		this.grid = Grid.createGridWithObstacles(GameConfig.gridWidth, GameConfig.gridHeight); // Usamos dimensiones desde GameConfig
		this.addChild(this.gameContainer);
		this.createBackground();
		this.initializeWalkableCells();
		this.initializeOccupiedCells(); // Inicializamos las celdas ocupadas
		// this.createTowers();
		this.setupClickListener();

		this.addChild(this.uiContainer);
	}

	private createBackground(): void {
		// Dibujar el fondo
		Grid.drawBackground(GameConfig.gridWidth, GameConfig.gridHeight, this.tileSize, this.gameContainer);

		// Dibujar la grilla encima del fondo
		Grid.drawGrid(this.grid, this.tileSize, this.gameContainer);
	}

	public createTowers(): void {
		const towerPositions = GameConfig.towerPositions; // Posiciones de torres definidas en GameConfig

		towerPositions.forEach((pos) => {
			const tower = new Tower(pos.x, pos.y, this.tileSize);
			this.towers.push(tower);
			this.gameContainer.addChild(tower.sprite);
			this.occupiedCells[pos.y][pos.x] = true; // Marcar la celda como ocupada
		});
	}

	private spawnEnemy(): void {
		const startNode = new Node(9, 1);
		const goalNode = new Node(9, GameConfig.gridHeight - 1);
		const path = AStarPathfinding.findPath(this.grid, startNode, goalNode);

		if (path) {
			let enemyIndex = 0; // Por defecto, seleccionamos el primer enemigo

			// Desbloquear enemigos más fuertes si el score supera ciertos valores
			if (TowerDefenseScene.gameStats.getScore() > 200) {
				enemyIndex = 1; // Por ejemplo, desbloqueamos el enemigo 2
			}
			if (TowerDefenseScene.gameStats.getScore() > 400) {
				enemyIndex = 2; // Desbloqueamos el enemigo 3
			}

			const enemy = new Enemy(9, 1, path, this.tileSize, enemyIndex);
			this.enemies.push(enemy);
			this.gameContainer.addChild(enemy.sprite);
		}
	}

	// Configurar el listener para los clics
	private setupClickListener(): void {
		this.gameContainer.eventMode = "static";
		this.gameContainer.on("pointerdown", (event: { data: { getLocalPosition: (arg0: any) => Point } }) => {
			const position = event.data.getLocalPosition(this.gameContainer);
			const tileX = Math.floor(position.x / this.tileSize);
			const tileY = Math.floor(position.y / this.tileSize);

			if (this.isTileEmpty(tileX, tileY)) {
				this.addTower(tileX, tileY);
			} else {
				console.log("ocupado gato");
			}
		});
	}

	// Verificar si la celda está vacía y es válida para colocar una torre
	private isTileEmpty(x: number, y: number): boolean {
		// Comprobar si alguna torre ya está ocupando esa celda
		const isOccupied = this.occupiedCells[y] && this.occupiedCells[y][x]; // Revisamos en la nueva matriz

		// Verificar si la celda forma parte del camino de los enemigos
		const isWalkable = this.walkableCells[y][x];

		// La celda debe estar vacía y debe ser un lugar no transitado por los enemigos
		return !isOccupied && isWalkable;
	}

	// Agregar torre solo si se tienen suficientes puntos
	// Agregar torre solo si se tienen suficientes puntos
	private addTower(x: number, y: number): void {
		if (this.isTileEmpty(x, y)) {
			if (TowerDefenseScene.gameStats.spendPoints(this.towerCost)) {
				const tower = new Tower(x, y, this.tileSize);
				this.towers.push(tower);
				this.gameContainer.addChild(tower.sprite);

				// Marcar la celda como ocupada
				this.occupiedCells[y][x] = true;

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
		if (Date.now() - this.lastSpawnTime > GameConfig.spawnInterval) {
			this.spawnEnemy();
			this.lastSpawnTime = Date.now();
		}

		ProjectileManager.updateProjectiles(this.gameContainer, delta);

		console.log("this.enemies", this.enemies.length);
		this.enemies.forEach((enemy, index) => {
			enemy.update();
			if (enemy.isDefeated()) {
				this.enemies.splice(index, 1); // Eliminar enemigo derrotado
				this.gameContainer.removeChild(enemy.sprite);

				// Otorgar puntos al jugador por matar al enemigo
				TowerDefenseScene.gameStats.addPoints(GameConfig.pointsPerKill[enemy.getEnemyIndex()]);
				TowerDefenseScene.gameStats.addScore(GameConfig.pointsPerKill[enemy.getEnemyIndex()]); // Incrementar el score también
				console.log(`Enemigo derrotado. Puntos actuales: ${TowerDefenseScene.gameStats.getPoints()}`);
			}
		});
		this.towers.forEach((tower) => tower.update(delta, this.enemies, this.gameContainer));

		this.uiContainer.updateUI(TowerDefenseScene.gameStats, this.towerCost);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, 620, 620, ScaleHelper.FIT);
		this.gameContainer.x = newW * 0.5;
		this.gameContainer.y = newH * 0.5;

		const containerBounds = this.gameContainer.getLocalBounds();
		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);
	}

	// Método para inicializar la matriz de celdas ocupadas
	private initializeOccupiedCells(): void {
		for (let y = 0; y < GameConfig.gridHeight; y++) {
			this.occupiedCells[y] = [];
			for (let x = 0; x < GameConfig.gridWidth; x++) {
				this.occupiedCells[y][x] = false; // Inicializamos todas las celdas como no ocupadas
			}
		}
	}

	// Método para inicializar las celdas caminables en forma de "U"
	private initializeWalkableCells(): void {
		// Inicializar la matriz de celdas caminables
		for (let y = 0; y < GameConfig.gridHeight; y++) {
			this.walkableCells[y] = [];
			for (let x = 0; x < GameConfig.gridWidth; x++) {
				// El camino de la "U" se define de la siguiente manera:
				if (
					(y === 0 && x >= 0 && x <= 9) ||
					(y === 1 && x >= 0 && x <= 9) ||
					(y === 2 && x >= 0 && x <= 9) ||
					(y === 3 && x === 3) ||
					(y === 5 && x === 3) ||
					(y === 6 && x >= 0 && x <= 9) ||
					(y === 7 && x >= 0 && x <= 9) ||
					(y === 8 && x >= 0 && x <= 9) ||
					(y === 9 && x >= 0 && x <= 9) ||
					(x === 0 && y >= 0 && y <= 9) ||
					(x === 1 && y >= 0 && y <= 9) ||
					(x === 8 && y === 4) ||
					(x === 9 && y >= 0 && y <= 9) ||
					(x === 2 && y >= 0 && y <= 9)
				) {
					this.walkableCells[y][x] = false; // Las celdas por las que los enemigos pueden caminar
				} else {
					this.walkableCells[y][x] = true; // Las celdas que están bloqueadas
				}
			}
		}
	}
}
