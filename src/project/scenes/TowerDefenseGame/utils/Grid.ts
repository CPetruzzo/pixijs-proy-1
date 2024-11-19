import type { Container } from "pixi.js";
import { Graphics, Sprite, Texture } from "pixi.js";
import { GameConfig } from "../game/GameConfig";

export class Grid {
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

	/**
	 * Add a background sprite that fills the entire grid area.
	 */
	public static drawBackground(gridWidth: number, gridHeight: number, tileSize: number, container: Container): void {
		const backgroundTexture = Texture.from("bg"); // Reemplaza con tu recurso
		const backgroundSprite = Sprite.from(backgroundTexture);

		// Ajustar el tamaño del fondo a la grilla
		backgroundSprite.width = gridWidth * tileSize;
		backgroundSprite.height = gridHeight * tileSize;
		// backgroundSprite.scale.set(-1, 1);
		backgroundSprite.anchor.set(0.5);
		// Alinear el fondo con la grilla
		backgroundSprite.position.set(backgroundSprite.width * 0.5, backgroundSprite.height * 0.5);

		// Añadir el sprite al contenedor
		container.addChildAt(backgroundSprite, 0); // Se asegura que el fondo esté detrás de todo
	}

	public static drawGrid(grid: number[][], tileSize: number, container: Container): void {
		grid.forEach((row, y) => {
			row.forEach((cell, x) => {
				const tile = new Graphics();
				tile.lineStyle(1, 0x000000, 0);
				tile.beginFill(cell === 1 ? 0x333333 : GameConfig.colors.grid, 0);
				tile.drawRect(x * tileSize, y * tileSize, tileSize, tileSize);
				tile.endFill();
				container.addChild(tile);
			});
		});
	}
}
