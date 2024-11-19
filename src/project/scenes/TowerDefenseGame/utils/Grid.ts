import { Container, Graphics } from "pixi.js";
import { GameConfig } from "../game/GameConfig";

export class Grid {
	public static createGridWithObstacles(rows: number, cols: number): number[][] {
		const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

		// Add some obstacles
		grid[1][0] = 1;
		grid[1][1] = 1;
		grid[1][2] = 1;
		grid[1][3] = 1;
		grid[1][4] = 1;
		grid[1][5] = 1;
		grid[1][6] = 1;
		grid[1][7] = 1;
		grid[1][8] = 1;
		grid[2][8] = 1;
		grid[3][8] = 1;
		grid[4][8] = 1;
		grid[5][8] = 1;
		grid[6][8] = 1;
		grid[7][8] = 1;
		grid[8][8] = 1;
		grid[8][7] = 1;
		grid[8][6] = 1;
		grid[8][5] = 1;
		grid[8][4] = 1;
		grid[8][3] = 1;
		grid[8][2] = 1;
		grid[8][1] = 1;
		grid[8][0] = 1;

		return grid;
	}

	public static drawGrid(grid: number[][], tileSize: number, container: Container): void {
		grid.forEach((row, y) => {
			row.forEach((cell, x) => {
				const tile = new Graphics();
				tile.lineStyle(1, 0x000000, 0);
				tile.beginFill(cell === 1 ? 0x333333 : GameConfig.colors.grid);
				tile.drawRect(x * tileSize, y * tileSize, tileSize, tileSize);
				tile.endFill();
				container.addChild(tile);
			});
		});
	}
}
