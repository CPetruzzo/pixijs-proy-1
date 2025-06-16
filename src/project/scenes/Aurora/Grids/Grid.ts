// Grid.ts

export class Grid {
	public createGrid(): number[][] {
		const rows = 12,
			cols = 8;
		const grid = Array.from({ length: cols }, () => Array(rows));
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
