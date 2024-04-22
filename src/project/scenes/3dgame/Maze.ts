export class Maze {
	public width: number;
	public height: number;
	public grid: boolean[][];

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.grid = [];

		// Inicializar el grid
		for (let i = 0; i < height; i++) {
			this.grid[i] = [];
			for (let j = 0; j < width; j++) {
				this.grid[i][j] = false;
			}
		}

		this.generateMaze(0, 0);
	}

	private generateMaze(x: number, y: number): void {
		const directions = [
			[1, 0],
			[0, 1],
			[-1, 0],
			[0, -1],
		]; // Derecha, Abajo, Izquierda, Arriba
		directions.sort(() => Math.random() - 0.5);

		for (let i = 0; i < directions.length; i++) {
			const [dx, dy] = directions[i];
			const nx = x + dx;
			const ny = y + dy;

			if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && !this.grid[ny][nx]) {
				this.grid[y][x] = true; // Marcar la celda como visitada
				this.grid[ny][nx] = true; // Marcar la nueva celda como visitada
				this.generateMaze(nx, ny); // Recursivamente generar desde la nueva celda
			}
		}
	}

	public printMaze(): void {
		for (let i = 0; i < this.height; i++) {
			let row = "";
			for (let j = 0; j < this.width; j++) {
				row += this.grid[i][j] ? " " : "#"; // ' ' para celdas visitadas, '#' para celdas no visitadas
			}
			console.log(row);
		}
	}
}
