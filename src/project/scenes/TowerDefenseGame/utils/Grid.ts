import type { Container } from "pixi.js";
import {
	// Graphics,
	Sprite,
	// Sprite, Texture
} from "pixi.js";
import { GameConfig } from "../game/GameConfig";
// import { GameConfig } from "../game/GameConfig";

export class Grid {
	public static occupiedCells: boolean[][] = [];
	public static walkableCells: boolean[][] = [];
	public static woodTiles: boolean[][]; // Matriz para marcar tiles de tipo wood

	public static initializeWoodTiles(grid: number[][]): void {
		this.woodTiles = grid.map(row => row.map(cell => cell === 1)); // Suponiendo que 2 indica un tile de tipo wood
	}

	// Verificar si un tile es de tipo wood
	public static isWoodTile(x: number, y: number): boolean {
		return this.woodTiles[y] && this.woodTiles[y][x];
	}

	public static createGridWithObstacles(rows: number, cols: number): number[][] {
		const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

		// Add some obstacles
		grid[3][4] = 1;
		grid[3][5] = 1;
		grid[3][6] = 1;
		grid[2][4] = 1;
		grid[3][7] = 1;
		grid[3][8] = 1;
		grid[3][9] = 1;
		grid[3][3] = 1;
		grid[4][3] = 1;
		grid[5][3] = 1;
		grid[6][4] = 1;
		grid[6][5] = 1;
		grid[6][6] = 1;
		grid[6][7] = 1;
		grid[6][8] = 1;
		grid[6][9] = 1;

		grid[7][2] = 1;
		grid[8][1] = 1;
		grid[8][2] = 1;
		grid[8][3] = 1;
		grid[8][4] = 1;
		grid[8][5] = 1;
		grid[8][6] = 1;
		grid[8][7] = 1;
		grid[8][8] = 1;

		return grid;
	}

	public static createMaze(rows: number, cols: number, start: [number, number], end: [number, number]): number[][] {
		// Inicializa la grilla con todos los valores en 1 (obstáculos)
		const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

		// Función para verificar si una celda es válida
		const isValidCell = (x: number, y: number) =>
			x >= 0 && x < cols && y >= 0 && y < rows && grid[y][x] === 1;

		// Direcciones de movimiento (arriba, abajo, izquierda, derecha)
		const directions = [
			[0, -1], // Arriba
			[0, 1],  // Abajo
			[-1, 0], // Izquierda
			[1, 0],  // Derecha
		];

		// Función recursiva para crear el laberinto
		const carvePath = (x: number, y: number) => {
			grid[y][x] = 0; // Marca el espacio como transitables
			// Mezcla aleatoriamente las direcciones
			directions.sort(() => Math.random() - 0.5);

			for (const [dx, dy] of directions) {
				const nx = x + dx * 2; // Celda destino (salta una celda)
				const ny = y + dy * 2;

				if (isValidCell(nx, ny)) {
					// Quita el muro entre la celda actual y la siguiente
					grid[y + dy][x + dx] = 0;
					carvePath(nx, ny); // Llama recursivamente a la siguiente celda
				}
			}
		};

		// Inicia el laberinto desde el punto de inicio
		carvePath(start[0], start[1]);

		// Asegura que el punto de inicio y final sean transitables
		grid[start[1]][start[0]] = 0;
		grid[end[1]][end[0]] = 0;

		return grid;
	}
	/**
	 * Add a background sprite that fills the entire grid area.
	 */
	// public static drawBackground(gridWidth: number, gridHeight: number, tileSize: number, container: Container): void {
	// 	// const backgroundTexture = Texture.from("bg"); // Reemplaza con tu recurso
	// 	// const backgroundSprite = Sprite.from(backgroundTexture);
	// 	const backgroundSprite = Sprite.from(Texture.WHITE);

	// 	// Ajustar el tamaño del fondo a la grilla
	// 	backgroundSprite.width = gridWidth * tileSize;
	// 	backgroundSprite.height = gridHeight * tileSize;
	// 	// backgroundSprite.scale.set(-1, 1);
	// 	backgroundSprite.anchor.set(0.5);
	// 	// Alinear el fondo con la grilla
	// 	backgroundSprite.position.set(backgroundSprite.width * 0.5, backgroundSprite.height * 0.5);

	// 	// Añadir el sprite al contenedor
	// 	container.addChildAt(backgroundSprite, 0); // Se asegura que el fondo esté detrás de todo
	// }

	public static drawGrid(grid: number[][], tileSize: number, container: Container): void {
		grid.forEach((row, y) => {
			row.forEach((cell, x) => {
				let tile: Sprite;

				if (cell === 1) {
					// Si la celda es un obstáculo (1), usa el sprite de la pared
					tile = Sprite.from("wood"); // Reemplaza con la ruta de tu imagen de pared
				} else {
					// Si es un camino (0), usa el sprite del camino
					tile = Sprite.from("grass"); // Reemplaza con la ruta de tu imagen de camino
				}

				// Ajusta el tamaño y la posición del sprite
				tile.width = tileSize;
				tile.height = tileSize;
				tile.x = x * tileSize; // Posición en el eje X
				tile.y = y * tileSize; // Posición en el eje Y

				// Añadir el sprite al contenedor
				container.addChild(tile);
			});
		});
	}

	public static initializeOccupiedCells(): void {
		for (let y = 0; y < GameConfig.gridHeight; y++) {
			this.occupiedCells[y] = [];
			for (let x = 0; x < GameConfig.gridWidth; x++) {
				this.occupiedCells[y][x] = false; // Inicializamos todas las celdas como no ocupadas
			}
		}
	}

	public static initializeWalkableCells(): void {
		for (let y = 0; y < GameConfig.gridHeight; y++) {
			this.walkableCells[y] = [];
			for (let x = 0; x < GameConfig.gridWidth; x++) {
				this.walkableCells[y][x] = true;
			}
		}
	}

	public static isTileEmpty(x: number, y: number): boolean {
		// Comprobar si la celda está ocupada por una torre (o cualquier otra estructura)
		const isOccupied = this.occupiedCells[y] && this.occupiedCells[y][x]; // Revisamos en la nueva matriz
		// console.log('isOccupied', isOccupied)

		// Verificamos si la celda es caminable para los enemigos
		const isWalkable = this.walkableCells[y][x];
		// console.log('isWalkable', isWalkable)

		// Si la celda está ocupada o no es caminable, no es válida
		// Pero necesitamos permitir que las celdas de inicio sean caminables, aunque estén ocupadas
		if (x === 0 && y === 0) {
			// Celda de inicio, siempre permitimos que sea caminable
			return true;
		}

		// Para las demás celdas, verificamos si está ocupada y si no es caminable
		return !isOccupied && isWalkable;
	}

	public static clearOccupiedCells(): void {
		this.occupiedCells = [];
	}


}