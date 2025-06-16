import { Grid } from "./Grid";
import { Terrain } from "../Utils/Terrain";

export class GridInvasiones extends Grid {
	public override createGrid(): number[][] {
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
}
