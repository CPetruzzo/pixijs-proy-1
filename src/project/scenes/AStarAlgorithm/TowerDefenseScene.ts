/* eslint-disable prettier/prettier */
import { Container, Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

class Enemy {
	constructor(public sprite: Graphics, public x: number, public y: number, public path: Node[], public currentStep: number = 0, public health: number = 100) { }
}

class Tower {
	constructor(
		public sprite: Graphics,
		public x: number,
		public y: number,
		public range: number = 3,
		public fireRate: number = 1000, // Disparos por milisegundos
		public lastShotTime: number = 0
	) { }
}

class Node {
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}

export class TowerDefenseScene extends PixiScene {
	private grid: number[][] = [];
	private tileSize: number = 50;
	private gameContainer: Container = new Container();
	private enemies: Enemy[] = [];
	private towers: Tower[] = [];
	private spawnInterval: number = 2000; // Tiempo entre generación de enemigos (ms)
	private lastSpawnTime: number = 0;

	constructor() {
		super();
		this.createGrid(); // Se crea la cuadrícula
		this.addChild(this.gameContainer);
		this.createBackground();
		this.createTowers();
	}

	private createGrid(): void {
		const rows = 9; // Número de filas
		const cols = 9; // Número de columnas
		this.grid = Array.from({ length: rows }, () => Array(cols).fill(0)); // Inicializar la cuadrícula con ceros

		// Aquí puedes llamar la función que genere el laberinto
		this.createMazeGrid();
	}

	private createMazeGrid(): void {
		const rows = this.grid.length;
		const cols = this.grid[0].length;

		// Inicializar el laberinto con paredes
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				this.grid[y][x] = 0; // 0 representa espacio libre
			}
		}

		// Usamos un algoritmo para generar un laberinto. Por ejemplo, el algoritmo de Prim
		const stack: [number, number][] = [];
		const startX = 0;
		const startY = 1;

		this.grid[startY][startX] = 1; // Empezamos el laberinto
		stack.push([startX, startY]);

		while (stack.length > 0) {
			const [cx, cy] = stack.pop()!;
			const directions = this.shuffleDirections();

			for (const [dx, dy] of directions) {
				const nx = cx + dx * 2;
				const ny = cy + dy * 2;

				if (this.isValidCell(nx, ny, cols, rows)) {
					this.grid[ny][nx] = 1; // Marca el paso
					this.grid[cy + dy][cx + dx] = 1; // Marca el paso entre celdas
					stack.push([nx, ny]);
					break;
				}
			}
		}
	}

	private isValidCell(nx: number, ny: number, cols: number, rows: number): boolean {
		return nx > 0 && ny > 0 && nx < cols && ny < rows && this.grid[ny][nx] === 0;
	}

	private shuffleDirections(): [number, number][] {
		// Mezcla las direcciones (arriba, abajo, izquierda, derecha)
		const directions: [number, number][] = [
			[0, -1], // Arriba
			[0, 1], // Abajo
			[-1, 0], // Izquierda
			[1, 0], // Derecha
		];

		// Mezclar las direcciones aleatoriamente
		return directions.sort(() => Math.random() - 0.5);
	}

	private createBackground(): void {
		// Dibujar el fondo con celdas del grid
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				const tile = new Graphics();

				tile.beginFill(this.grid[x][y] === 1 ? 0xff0000 : 0x0000ff);
				tile.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
				tile.endFill();

				this.gameContainer.addChild(tile);
			}
		}
	}

	private createTowers(): void {
		// Crear torres en posiciones específicas
		const towerPositions = [
			{ x: 2, y: 2 },
			{ x: 7, y: 4 },
		];

		towerPositions.forEach((pos) => {
			const towerSprite = new Graphics();
			towerSprite.beginFill(0x00ff00);
			towerSprite.drawCircle((pos.x + 0.5) * this.tileSize, (pos.y + 0.5) * this.tileSize, this.tileSize * 0.4);
			towerSprite.endFill();

			const tower = new Tower(towerSprite, pos.x, pos.y);
			this.towers.push(tower);
			this.gameContainer.addChild(towerSprite);
		});
	}

	private updateTowers(delta: number): void {
		this.towers.forEach((tower) => {
			const now = Date.now();
			if (now - tower.lastShotTime > tower.fireRate) {
				const enemyInRange = this.enemies.find((enemy) => Math.hypot(enemy.sprite.x / this.tileSize - tower.x, enemy.sprite.y / this.tileSize - tower.y) <= tower.range);

				if (enemyInRange) {
					tower.lastShotTime = now;
					this.shootAtEnemy(tower, enemyInRange, delta);
				}
			}
		});
	}

	private shootAtEnemy(tower: Tower, enemy: Enemy, _delta: number): void {
		const projectile = new Graphics();
		projectile.beginFill(0xffff00);
		projectile.drawCircle(0, 0, 5);
		projectile.endFill();

		projectile.x = (tower.x + 0.5) * this.tileSize;
		projectile.y = (tower.y + 0.5) * this.tileSize;

		this.gameContainer.addChild(projectile);

		const duration = 500; // ms
		const targetX = enemy.sprite.x;
		const targetY = enemy.sprite.y;

		const tween = {
			t: 0,
		};

		const interval = setInterval(() => {
			if (tween.t >= 1) {
				clearInterval(interval);
				this.gameContainer.removeChild(projectile);

				if (enemy.health <= 0) {
					this.gameContainer.removeChild(enemy.sprite);
					this.enemies = this.enemies.filter((e) => e !== enemy);
				}
			}

			tween.t += _delta / duration;
			projectile.x += (targetX - projectile.x) * tween.t;
			projectile.y += (targetY - projectile.y) * tween.t;
		}, _delta);
	}

	private spawnEnemy(): void {
		// Generar un nuevo enemigo en la posición inicial
		const startX = 9;
		const startY = 3;
		const goalX = 8;
		const goalY = 5;

		const enemySprite = new Graphics();
		enemySprite.beginFill(0xff0000);
		enemySprite.drawCircle(0, 0, this.tileSize * 0.4);
		enemySprite.endFill();

		const path = this.findPath(new Node(startX, startY), new Node(goalX, goalY));

		if (path) {
			const enemy = new Enemy(enemySprite, startX, startY, path);
			this.enemies.push(enemy);
			this.gameContainer.addChild(enemySprite);
		}
	}

	private findPath(start: Node, goal: Node): Node[] | null {
		// Lógica de búsqueda A* (similar a la escena anterior)
		const openSet: Node[] = [start];
		const closedSet: Node[] = [];

		while (openSet.length > 0) {
			let currentNode = openSet.reduce((prev, curr) => (prev.f < curr.f ? prev : curr));

			if (currentNode.x === goal.x && currentNode.y === goal.y) {
				const path: Node[] = [];
				while (currentNode) {
					path.push(currentNode);
					currentNode = currentNode.parent!;
				}
				return path.reverse();
			}

			openSet.splice(openSet.indexOf(currentNode), 1);
			closedSet.push(currentNode);

			this.getNeighbors(currentNode).forEach((neighbor) => {
				if (closedSet.some((n) => n.x === neighbor.x && n.y === neighbor.y)) {
					return;
				}

				const tentativeG = currentNode.g + 1;

				if (!openSet.some((n) => n.x === neighbor.x && n.y === neighbor.y)) {
					openSet.push(neighbor);
				} else if (tentativeG >= neighbor.g) {
					return;
				}

				neighbor.parent = currentNode;
				neighbor.g = tentativeG;
				neighbor.h = this.manhattanDistance(neighbor, goal);
				neighbor.f = neighbor.g + neighbor.h;
			});
		}

		return null;
	}

	private getNeighbors(node: Node): Node[] {
		// Mismo método de vecinos de la escena anterior
		const neighbors: Node[] = [];
		const { x, y } = node;

		if (x > 0 && this.grid[x - 1][y] === 0) {
			neighbors.push(new Node(x - 1, y));
		}
		if (x < this.grid.length - 1 && this.grid[x + 1][y] === 0) {
			neighbors.push(new Node(x + 1, y));
		}
		if (y > 0 && this.grid[x][y - 1] === 0) {
			neighbors.push(new Node(x, y - 1));
		}
		if (y < this.grid[0].length - 1 && this.grid[x][y + 1] === 0) {
			neighbors.push(new Node(x, y + 1));
		}

		return neighbors;
	}

	private manhattanDistance(nodeA: Node, nodeB: Node): number {
		return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
	}

	public override update(delta: number): void {
		if (Date.now() - this.lastSpawnTime > this.spawnInterval) {
			this.spawnEnemy();
			this.lastSpawnTime = Date.now();
		}

		// Actualizar posición de enemigos
		this.enemies.forEach((enemy) => {
			if (enemy.currentStep < enemy.path.length) {
				const targetNode = enemy.path[enemy.currentStep];
				const targetX = targetNode.x * this.tileSize;
				const targetY = targetNode.y * this.tileSize;

				enemy.sprite.x += (targetX - enemy.sprite.x) * 0.05;
				enemy.sprite.y += (targetY - enemy.sprite.y) * 0.05;

				if (Math.abs(enemy.sprite.x - targetX) < 1 && Math.abs(enemy.sprite.y - targetY) < 1) {
					enemy.currentStep++;
				}
			}
		});
		this.updateTowers(delta);
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 1920, 720, ScaleHelper.FILL);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;
		const containerBounds = this.gameContainer.getLocalBounds();

		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);
	}
}
