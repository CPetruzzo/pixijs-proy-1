import type { Point } from "pixi.js";
import { Container, Sprite } from "pixi.js";
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
	public static readonly BUNDLES = ["towerdefense"];
	public static gameStats: GameStats = new GameStats(GameConfig.initialPoints); // Inicializamos con puntos iniciales
	private towerCost: number = GameConfig.towerCost; // Costo de construir una torre
	private uiContainer: UIContainer = new UIContainer();
	private bgContainer: Container = new Container();
	private frontContainer: Container = new Container();

	constructor() {
		super();
		this.grid = Grid.createGridWithObstacles(GameConfig.gridWidth, GameConfig.gridHeight); // Usamos dimensiones desde GameConfig
		this.addChild(this.bgContainer, this.gameContainer, this.frontContainer);
		this.createBackground();

		Grid.initializeWalkableCells();
		Grid.initializeOccupiedCells(); // Inicializamos las celdas ocupadas
		// this.createTowers();
		this.setupClickListener();

		this.addChild(this.uiContainer);
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
	}

	// Configurar el listener para los clics
	private setupClickListener(): void {
		this.gameContainer.eventMode = "static";
		this.gameContainer.on("pointerdown", (event: { data: { getLocalPosition: (arg0: any) => Point } }) => {
			const position = event.data.getLocalPosition(this.gameContainer);
			const tileX = Math.floor(position.x / this.tileSize);
			const tileY = Math.floor(position.y / this.tileSize);

			if (Grid.isTileEmpty(tileX, tileY)) {
				this.addTower(tileX, tileY);
			} else {
				console.log("ocupado gato");
			}
		});
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
			if (TowerDefenseScene.gameStats.getScore() > 200) {
				enemyIndex = 1; // Desbloqueamos el enemigo 2
			}
			if (TowerDefenseScene.gameStats.getScore() > 400) {
				enemyIndex = 2; // Desbloqueamos el enemigo 3
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

		ScaleHelper.setScaleRelativeToIdeal(this.bgContainer, newW, newH, 1920, 1080, ScaleHelper.FILL);
		this.bgContainer.x = newW * 0.5;
		this.bgContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.frontContainer, newW, newH, 320, 320, ScaleHelper.FIT);
		this.frontContainer.x = newW * 0.5;
		this.frontContainer.y = newH * 0.5;
	}
}
