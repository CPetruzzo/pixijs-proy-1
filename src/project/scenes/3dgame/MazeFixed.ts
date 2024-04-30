export class MazeFixed {
	public rows: number;
	public cols: number;
	public grid: string[][];

	constructor(rows: number, cols: number) {
		this.rows = rows;
		this.cols = cols;
		this.grid = this.initGrid();
	}

	private initGrid(): string[][] {
		const grid: string[][] = [];
		for (let i = 0; i < this.rows; i++) {
			grid.push(Array(this.cols).fill("wall"));
		}
		return grid;
	}

	public generate(): void {
		// Inicializamos el laberinto con todas las celdas como paredes
		this.grid = this.initGrid();

		// Creamos una lista de paredes y la inicializamos con todas las paredes
		const walls: [number, number][] = [];
		for (let row = 1; row < this.rows - 1; row++) {
			for (let col = 1; col < this.cols - 1; col++) {
				if (row % 2 === 0 || col % 2 === 0) {
					walls.push([row, col]);
				}
			}
		}

		// Seleccionamos una celda aleatoria como punto de partida
		const startRow = this.getRandomInt(1, this.rows - 1, 2);
		const startCol = this.getRandomInt(1, this.cols - 1, 2);
		this.grid[startRow][startCol] = "path";
		this.removeItemFromArray(walls, [startRow, startCol]);

		// Mientras haya paredes en la lista
		while (walls.length > 0) {
			// Elegimos una pared aleatoria
			const index = this.getRandomInt(0, walls.length - 1);
			const [row, col] = walls[index];

			// Encontramos las celdas adyacentes
			const neighbors: [number, number][] = [];
			if (row - 2 >= 0 && this.grid[row - 2][col] === "path") {
				neighbors.push([row - 2, col]);
			}
			if (row + 2 < this.rows && this.grid[row + 2][col] === "path") {
				neighbors.push([row + 2, col]);
			}
			if (col - 2 >= 0 && this.grid[row][col - 2] === "path") {
				neighbors.push([row, col - 2]);
			}
			if (col + 2 < this.cols && this.grid[row][col + 2] === "path") {
				neighbors.push([row, col + 2]);
			}

			// Si hay al menos un vecino que es un camino
			if (neighbors.length > 0) {
				// Elegimos un vecino aleatorio
				const neighborIndex = this.getRandomInt(0, neighbors.length - 1);
				const [nRow, nCol] = neighbors[neighborIndex];

				// Eliminamos la pared entre la celda actual y el vecino
				this.grid[(row + nRow) / 2][(col + nCol) / 2] = "path";
				this.grid[nRow][nCol] = "path";

				// Añadimos las nuevas paredes a la lista
				for (const [dRow, dCol] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
					if (nRow + dRow >= 0 && nRow + dRow < this.rows && nCol + dCol >= 0 && nCol + dCol < this.cols) {
						walls.push([nRow + dRow, nCol + dCol]);
					}
				}
			}

			// Eliminamos la pared de la lista
			walls.splice(index, 1);
		}
	}

	private getRandomInt(min: number, max: number, step: number = 1): number {
		const range = (max - min) / step;
		return min + step * Math.floor(Math.random() * range);
	}

	private removeItemFromArray<T>(arr: T[], item: T): void {
		const index = arr.indexOf(item);
		if (index !== -1) {
			arr.splice(index, 1);
		}
	}
}
