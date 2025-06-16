/* eslint-disable @typescript-eslint/explicit-function-return-type */
// PathFinder.ts
import type { PlayerUnit } from "../Data/IUnit";

export interface IGrid {
	readonly width: number;
	readonly height: number;
	isWalkable(x: number, y: number): boolean;
	terrainCost(x: number, y: number): number; // e.g., 1 o 2
}

export type OccupationChecker = (x: number, y: number) => boolean;

export class PathFinder {
	private grid: IGrid;
	private isOccupied: OccupationChecker;

	constructor(grid: IGrid, isOccupied: OccupationChecker) {
		this.grid = grid;
		this.isOccupied = isOccupied;
	}

	/**
	 * Calcula el A* path desde unit.gridX,Y hasta targetX,Y.
	 * Excluye casillas ocupadas salvo quizá el destino (depende: aquí consideramos solo moverse a celdas vacías).
	 */
	public findPath(unit: PlayerUnit, targetX: number, targetY: number): Array<{ x: number; y: number }> | null {
		const cols = this.grid.width;
		const rows = this.grid.height;
		interface Node {
			x: number;
			y: number;
			g: number;
			h: number;
			f: number;
			parent: Node | null;
		}
		const start: Node = { x: unit.gridX, y: unit.gridY, g: 0, h: 0, f: 0, parent: null };
		const goal = { x: targetX, y: targetY };
		const open: Node[] = [start];
		const closed: Node[] = [];
		const key = (x: number, y: number) => `${x},${y}`;
		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		] as const;

		const visitedG = new Map<string, number>();
		visitedG.set(key(start.x, start.y), 0);

		while (open.length) {
			// sacar con menor f
			let idxMin = 0;
			for (let i = 1; i < open.length; i++) {
				if (open[i].f < open[idxMin].f) {
					idxMin = i;
				}
			}
			const curr = open.splice(idxMin, 1)[0];
			closed.push(curr);

			if (curr.x === goal.x && curr.y === goal.y) {
				// reconstruir path
				const path: Array<{ x: number; y: number }> = [];
				for (let c: Node | null = curr; c; c = c.parent) {
					path.push({ x: c.x, y: c.y });
				}
				return path.reverse();
			}

			for (const [dx, dy] of dirs) {
				const nx = curr.x + dx,
					ny = curr.y + dy;
				if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
					continue;
				}
				if (!this.grid.isWalkable(nx, ny)) {
					continue;
				}
				// bloquea si ocupado y no es origen
				if ((nx !== unit.gridX || ny !== unit.gridY) && this.isOccupied(nx, ny)) {
					continue;
				}
				const terrenoCost = this.grid.terrainCost(nx, ny);
				const tentativeG = curr.g + terrenoCost;
				if (tentativeG > unit.puntosDeMovimiento) {
					continue;
				}
				const keyStr = key(nx, ny);
				if (visitedG.has(keyStr) && tentativeG >= (visitedG.get(keyStr) ?? Infinity)) {
					continue;
				}
				// descartar si está en closed
				if (closed.some((n) => n.x === nx && n.y === ny)) {
					continue;
				}
				const h = Math.abs(nx - goal.x) + Math.abs(ny - goal.y);
				const node: Node = { x: nx, y: ny, g: tentativeG, h, f: tentativeG + h, parent: curr };
				visitedG.set(keyStr, tentativeG);
				open.push(node);
			}
		}
		return null;
	}

	/**
	 * Calcula todas las celdas alcanzables para unit (movementRange) con BFS/Dijkstra limitado por puntos de movimiento.
	 * Devuelve Set<string> de "x,y".
	 */
	public computeMovementRange(unit: PlayerUnit): Set<string> {
		const result = new Set<string>();
		interface Q {
			x: number;
			y: number;
			costSoFar: number;
		}
		const queue: Q[] = [{ x: unit.gridX, y: unit.gridY, costSoFar: 0 }];
		const visited = new Map<string, number>();
		const key = (x: number, y: number) => `${x},${y}`;
		visited.set(key(unit.gridX, unit.gridY), 0);
		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		] as const;

		while (queue.length) {
			const { x, y, costSoFar } = queue.shift()!;
			if (!(x === unit.gridX && y === unit.gridY)) {
				result.add(key(x, y));
			}
			for (const [dx, dy] of dirs) {
				const nx = x + dx,
					ny = y + dy;
				if (nx < 0 || nx >= this.grid.width || ny < 0 || ny >= this.grid.height) {
					continue;
				}
				if (!this.grid.isWalkable(nx, ny)) {
					continue;
				}
				// Si ocupado por otra unidad, saltar
				if ((nx !== unit.gridX || ny !== unit.gridY) && this.isOccupied(nx, ny)) {
					continue;
				}
				const terrenoCost = this.grid.terrainCost(nx, ny);
				const newCost = costSoFar + terrenoCost;
				if (newCost > unit.puntosDeMovimiento) {
					continue;
				}
				const k = key(nx, ny);
				const prev = visited.get(k);
				if (prev === undefined || newCost < prev) {
					visited.set(k, newCost);
					queue.push({ x: nx, y: ny, costSoFar: newCost });
				}
			}
		}
		return result;
	}
}
