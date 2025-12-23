/* eslint-disable @typescript-eslint/restrict-plus-operands */
import type { Graphics } from "pixi.js";

export class NavigationGrid {
	public grid: number[][] = [];
	public tileSize: number;
	public width: number;
	public height: number;

	constructor(worldWidth: number, worldHeight: number, tileSize: number) {
		this.width = worldWidth;
		this.height = worldHeight;
		this.tileSize = tileSize;
		this.createGrid();
	}

	private createGrid(): void {
		const cols = Math.ceil(this.width / this.tileSize);
		const rows = Math.ceil(this.height / this.tileSize);

		// Inicializar grilla vacía (0 = caminable)
		for (let x = 0; x < cols; x++) {
			this.grid[x] = [];
			for (let y = 0; y < rows; y++) {
				this.grid[x][y] = 0;
			}
		}
	}

	/**
	 * Escanea los obstáculos gráficos y marca las celdas correspondientes como bloqueadas (1).
	 */
	public registerObstacles(obstacles: Graphics[]): void {
		obstacles.forEach((obstacle) => {
			// Asumimos que los obstaculos tienen posición y (widthRect/heightRect o width/height)
			const x = obstacle.x;
			const y = obstacle.y;
			// Usamos una propiedad personalizada o las dimensiones del gráfico
			const w = (obstacle as any).widthRect || obstacle.width;
			const h = (obstacle as any).heightRect || obstacle.height;

			// Calcular rango de tiles afectados
			const startCol = Math.floor(x / this.tileSize);
			const endCol = Math.floor((x + w) / this.tileSize);
			const startRow = Math.floor(y / this.tileSize);
			const endRow = Math.floor((y + h) / this.tileSize);

			for (let i = startCol; i <= endCol; i++) {
				for (let j = startRow; j <= endRow; j++) {
					if (this.isValid(i, j)) {
						this.grid[i][j] = 1; // 1 = Obstáculo
					}
				}
			}
		});
	}

	public isValid(x: number, y: number): boolean {
		return x >= 0 && x < this.grid.length && y >= 0 && y < this.grid[0].length;
	}

	public getGridCoords(worldX: number, worldY: number): { x: number; y: number } {
		return {
			x: Math.floor(worldX / this.tileSize),
			y: Math.floor(worldY / this.tileSize),
		};
	}
}
