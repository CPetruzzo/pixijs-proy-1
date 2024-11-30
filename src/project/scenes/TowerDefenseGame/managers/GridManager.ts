import { Container, Graphics } from "pixi.js";

export class GridManager {
	private grid: number[][];
	private walkableCells: boolean[][] = [];
	private occupiedCells: boolean[][] = [];
	private tileSize: number;
	private container: Container;

	constructor(gridWidth: number, gridHeight: number, tileSize: number, container: Container) {
		this.tileSize = tileSize;
		this.container = container;

		// Crear grilla inicial
		this.grid = this.createGridWithObstacles(gridWidth, gridHeight);
		this.initializeWalkableCells(gridWidth, gridHeight);
		this.initializeOccupiedCells(gridWidth, gridHeight);
		this.drawBackground(gridWidth, gridHeight);
		this.drawGrid();
	}

	// Devuelve la matriz de celdas caminables
	public getWalkableCells(): boolean[][] {
		return this.walkableCells;
	}

	// Devuelve la matriz de celdas ocupadas
	public getOccupiedCells(): boolean[][] {
		return this.occupiedCells;
	}

	// Marca una celda como ocupada
	public setOccupied(x: number, y: number, occupied: boolean): void {
		this.occupiedCells[y][x] = occupied;
	}

	// Verifica si una celda es caminable
	public isWalkable(x: number, y: number): boolean {
		return this.walkableCells[y]?.[x] ?? false;
	}

	// Verifica si una celda está ocupada
	public isOccupied(x: number, y: number): boolean {
		return this.occupiedCells[y]?.[x] ?? false;
	}

	// Crear grilla con obstáculos (puedes reutilizar la lógica previa si quieres)
	private createGridWithObstacles(width: number, height: number): number[][] {
		const grid = Array.from({ length: height }, () => Array(width).fill(0));
		// Agregar obstáculos si es necesario
		return grid;
	}

	// Dibujar el fondo
	public drawBackground(gridWidth: number, gridHeight: number): void {
		const background = new Graphics();
		background.beginFill(0x87ceeb); // Color de fondo
		background.drawRect(0, 0, gridWidth * this.tileSize, gridHeight * this.tileSize);
		background.endFill();
		this.container.addChild(background);
	}

	// Dibujar la grilla encima del fondo
	private drawGrid(): void {
		const gridGraphics = new Graphics();
		gridGraphics.lineStyle(1, 0x000000, 0.2);

		for (let y = 0; y <= this.grid.length; y++) {
			gridGraphics.moveTo(0, y * this.tileSize);
			gridGraphics.lineTo(this.grid[0].length * this.tileSize, y * this.tileSize);
		}

		for (let x = 0; x <= this.grid[0].length; x++) {
			gridGraphics.moveTo(x * this.tileSize, 0);
			gridGraphics.lineTo(x * this.tileSize, this.grid.length * this.tileSize);
		}

		this.container.addChild(gridGraphics);
	}

	// Inicializar celdas ocupadas
	private initializeOccupiedCells(gridWidth: number, gridHeight: number): void {
		for (let y = 0; y < gridHeight; y++) {
			this.occupiedCells[y] = Array(gridWidth).fill(false);
		}
	}

	// Inicializar celdas caminables en forma de "U"
	private initializeWalkableCells(gridWidth: number, gridHeight: number): void {
		for (let y = 0; y < gridHeight; y++) {
			this.walkableCells[y] = Array(gridWidth).fill(true);

			for (let x = 0; x < gridWidth; x++) {
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
					this.walkableCells[y][x] = false;
				}
			}
		}
	}
}
