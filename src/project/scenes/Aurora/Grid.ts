// Grid.ts
import { Terrain } from "./Terrain";

export class Grid {
	public createGrid(): number[][] {
		const rows = 12,
			cols = 8;

		const grid = Array.from({ length: cols }, () => Array(rows));

		// MOUNTAINS
		this.drawV(grid, 0, 0, cols, Terrain.MOUNTAIN.code, 1);
		this.drawH(grid, 0, 0, rows, Terrain.MOUNTAIN.code, 1);
		this.drawV(grid, rows - 1, 0, cols, Terrain.MOUNTAIN.code, 1);
		this.drawZoneV(grid, 1, 4, 5, Terrain.MOUNTAIN.code, 2);
		this.drawZoneV(grid, 1, 2, 3, Terrain.MOUNTAIN.code, 3);
		this.drawZoneV(grid, 1, 1, 2, Terrain.MOUNTAIN.code, 3);
		this.drawCell(grid, 3, 1, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 3, 2, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 3, 3, Terrain.MOUNTAIN.code);

		this.drawCell(grid, 8, 3, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 8, 2, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 8, 1, Terrain.MOUNTAIN.code);

		this.drawCell(grid, 9, 4, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 9, 3, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 9, 2, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 9, 1, Terrain.MOUNTAIN.code);

		this.drawCell(grid, 10, 5, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 10, 4, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 10, 3, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 10, 2, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 10, 1, Terrain.MOUNTAIN.code);

		this.drawCell(grid, 3, 6, Terrain.MOUNTAIN.code);

		this.drawCell(grid, 2, 7, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 3, 7, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 9, 7, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 10, 7, Terrain.MOUNTAIN.code);
		this.drawCell(grid, 10, 6, Terrain.MOUNTAIN.code);

		// FORTRESS
		this.drawCell(grid, 5, 1, Terrain.FORTRESS.code);

		// FORESTS
		// this.drawZoneH(grid, 2, 3, 6, Terrain.FOREST.code, 1);
		this.drawCell(grid, 6, 4, Terrain.FOREST.code);
		this.drawCell(grid, 5, 5, Terrain.FOREST.code);
		this.drawCell(grid, 2, 4, Terrain.FOREST.code);
		this.drawCell(grid, 0, 0, Terrain.FOREST.code);
		this.drawCell(grid, 1, 3, Terrain.FOREST.code);
		this.drawCell(grid, 1, 6, Terrain.FOREST.code);
		this.drawCell(grid, 7, 1, Terrain.FOREST.code);
		this.drawCell(grid, 7, 3, Terrain.FOREST.code);
		this.drawCell(grid, 11, 5, Terrain.FOREST.code);
		this.drawCell(grid, 8, 7, Terrain.FOREST.code);
		return grid;
	}

	/** Dibuja horizontal en columna x fija, filas y0 (inclusive) a y1 (exclusive), con cierto código de terreno. */
	public drawV(grid: number[][], x: number, y0: number, y1: number, terrainCode: number, thickness = 1): void {
		// Asegúrate de no salir de índices: pero confiamos que caller use valores válidos.
		for (let tx = 0; tx < thickness; tx++) {
			for (let y = y0; y < y1; y++) {
				if (y >= 0 && y < grid.length && x + tx >= 0 && x + tx < grid[0].length) {
					grid[y][x + tx] = terrainCode;
				}
			}
		}
	}

	/** Dibuja vertical en fila y fija, columnas x0 (inclusive) a x1 (exclusive), con cierto código de terreno. */
	public drawH(grid: number[][], y: number, x0: number, x1: number, terrainCode: number, thickness = 1): void {
		for (let ty = 0; ty < thickness; ty++) {
			for (let x = x0; x < x1; x++) {
				if (y + ty >= 0 && y + ty < grid.length && x >= 0 && x < grid[0].length) {
					grid[y + ty][x] = terrainCode;
				}
			}
		}
	}

	/** Dibuja zona horizontal (similar a drawH) pero semánticamente "zona", con código de terreno dado. */
	public drawZoneH(grid: number[][], x: number, y0: number, y1: number, terrainCode: number, thickness = 1): void {
		// Internamente idéntico a drawH, pero separa semánticamente en tu código:
		this.drawV(grid, x, y0, y1, terrainCode, thickness);
	}

	/** Dibuja zona vertical (similar a drawV) con código de terreno dado. */
	public drawZoneV(grid: number[][], x0: number, x1: number, y: number, terrainCode: number, thickness = 1): void {
		this.drawH(grid, x0, x1, y, terrainCode, thickness);
	}

	/** Dibuja una sola celda con un código de terreno. */
	public drawCell(grid: number[][], x: number, y: number, terrainCode: number): void {
		if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
			grid[y][x] = terrainCode;
		}
	}
}
