import { Container, Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}

export class AStarScene extends PixiScene {
	private grid: number[][] = [];
	private tileSize: number = 50; // Tamaño de cada celda del grid
	private startNode: Node | null = null;
	private goalNode: Node | null = null;
	private player: Graphics | null = null;
	private gameContainer: Container = new Container();
	private targetTileOutline: Graphics;

	constructor() {
		super();
		this.grid = this.createGrid();
		this.addChild(this.gameContainer);
		this.createBackground(); // Crear el fondo con obstáculos
		this.createPlayer(); // Crear el jugador
	}

	private createGrid(): number[][] {
		const rows = 10;
		const cols = 10;
		const grid = new Array(rows).fill(0).map(() => new Array(cols).fill(0));

		// Marcar algunos obstáculos
		grid[3][3] = 1;
		grid[4][3] = 1;
		grid[5][3] = 1;
		grid[6][6] = 1;
		grid[6][7] = 1;
		grid[7][6] = 1;
		grid[7][8] = 1;
		grid[8][6] = 1;
		grid[9][7] = 1;
		return grid;
	}

	private createBackground(): void {
		// Dibujar el fondo con celdas del grid
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				const tile = new Graphics();

				// Si es un obstáculo, lo dibujamos de color rojo, de lo contrario azul
				if (this.grid[x][y] === 1) {
					tile.beginFill(0xff0000); // Color rojo para obstáculos
				} else {
					tile.beginFill(0x0000ff); // Color azul para celdas libres
				}

				tile.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
				tile.endFill();
				this.gameContainer.addChild(tile);

				// Detectar clic en cada tile
				tile.interactive = true;
				tile.on("pointerdown", () => {
					this.onTileClick(x, y);
				});
			}
		}
	}

	private createPlayer(): void {
		// Crear el jugador como un cuadrado verde
		this.player = new Graphics();
		this.player.beginFill(0x00ff00);
		this.player.drawRect(0, 0, this.tileSize, this.tileSize);
		this.player.endFill();
		this.player.x = 0;
		this.player.y = 0;
		this.gameContainer.addChild(this.player);

		// Establecer nodo inicial como la posición del jugador
		this.startNode = new Node(0, 0);

		this.initOutline(this.startNode.x, this.startNode.y);
	}

	private aStar(start: Node, goal: Node): Node[] | null {
		const openSet: Node[] = [start];
		const closedSet: Node[] = [];

		while (openSet.length > 0) {
			let currentNode = openSet.reduce((prev, curr) => (curr.f < prev.f ? curr : prev));

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

			const neighbors = this.getNeighbors(currentNode);
			for (const neighbor of neighbors) {
				if (closedSet.some((n) => n.x === neighbor.x && n.y === neighbor.y)) {
					continue;
				}

				const tentativeG = currentNode.g + 1;

				if (!openSet.some((n) => n.x === neighbor.x && n.y === neighbor.y)) {
					openSet.push(neighbor);
				} else if (tentativeG >= neighbor.g) {
					continue;
				}

				neighbor.parent = currentNode;
				neighbor.g = tentativeG;
				neighbor.h = this.manhattanDistance(neighbor, goal);
				neighbor.f = neighbor.g + neighbor.h;
			}
		}
		return null;
	}

	private getNeighbors(node: Node): Node[] {
		const neighbors: Node[] = [];
		const { x, y } = node;

		// Verificamos los vecinos (arriba, abajo, izquierda, derecha) y que no sean obstáculos
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

	private movePlayer(path: Node[]): void {
		if (!this.player) {
			return;
		}

		path.forEach((node, index) => {
			setTimeout(() => {
				this.player.x = node.x * this.tileSize;
				this.player.y = node.y * this.tileSize;
			}, 500 * index);
		});
	}

	private initOutline(x: number, y: number): void {
		// Dibujar un rectángulo vacío en la posición del destino (tile clickeada)
		this.targetTileOutline = new Graphics();
		this.targetTileOutline.lineStyle(3, 0x00ff00); // Borde verde
		this.targetTileOutline.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize); // Dibujar rectángulo en la tile clickeada
		this.gameContainer.addChild(this.targetTileOutline);
	}

	private updateOutline(x: number, y: number): void {
		this.targetTileOutline.clear();
		this.targetTileOutline.lineStyle(3, 0x00ff00); // Borde verde
		this.targetTileOutline.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize); // Dibujar rectángulo en la tile clickeada
	}

	private onTileClick(x: number, y: number): void {
		if (!this.player) {
			return;
		}

		// Obtener posición actual del jugador
		const playerX = Math.floor(this.player.x / this.tileSize);
		const playerY = Math.floor(this.player.y / this.tileSize);

		// Definir el nodo de inicio y el nodo objetivo
		this.startNode = new Node(playerX, playerY);
		this.goalNode = new Node(x, y);

		this.updateOutline(this.goalNode.x, this.goalNode.y);

		// Iniciar búsqueda de camino usando A*
		const path = this.aStar(this.startNode, this.goalNode);
		if (path) {
			this.movePlayer(path);
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 1920, 720, ScaleHelper.FILL);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;
		const containerBounds = this.gameContainer.getLocalBounds();

		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);
	}
}
