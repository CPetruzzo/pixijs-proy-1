// AttackRangeCalculator.ts
import type { PlayerUnit } from "./IUnit";

export class AttackRangeCalculator {
	private grid: { width: number; height: number; isWalkable(x: number, y: number): boolean };
	private getAllyAt: (x: number, y: number) => PlayerUnit | undefined;
	private getEnemyAt: (x: number, y: number) => PlayerUnit | undefined;

	constructor(
		grid: { width: number; height: number; isWalkable(x: number, y: number): boolean },
		getAllyAt: (x: number, y: number) => PlayerUnit | undefined,
		getEnemyAt: (x: number, y: number) => PlayerUnit | undefined
	) {
		this.grid = grid;
		this.getAllyAt = getAllyAt;
		this.getEnemyAt = getEnemyAt;
	}

	/**
	 * Devuelve Set<string> de "x,y" de celdas en rango, según unit.attackRange y bloqueos.
	 */
	public computeAttackRange(unit: PlayerUnit): Set<string> {
		const result = new Set<string>();
		interface Q {
			x: number;
			y: number;
			depth: number;
		}
		const maxRange = unit.attackRange;
		const rows = this.grid.width;
		const cols = this.grid.height;
		const visited = new Map<string, number>();
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const key = (x: number, y: number) => `${x},${y}`;
		const queue: Q[] = [{ x: unit.gridX, y: unit.gridY, depth: 0 }];
		visited.set(key(unit.gridX, unit.gridY), 0);
		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		] as const;

		while (queue.length) {
			const { x, y, depth } = queue.shift()!;
			if (depth >= maxRange) {
				continue;
			}
			for (const [dx, dy] of dirs) {
				const nx = x + dx,
					ny = y + dy;
				if (nx < 0 || nx >= rows || ny < 0 || ny >= cols) {
					continue;
				}
				if (!this.grid.isWalkable(nx, ny)) {
					continue;
				}
				const k = key(nx, ny);
				const ally = this.getAllyAt(nx, ny);
				const enemy = this.getEnemyAt(nx, ny);
				if (!unit.isEnemy) {
					// atacante aliado: bloquea paso aliados, incluye enemigo y no profundiza más
					if (ally) {
						continue;
					}
					if (enemy) {
						result.add(k);
						continue;
					}
				} else {
					// atacante enemigo: bloquea paso enemigos, incluye aliado y no profundiza
					if (enemy) {
						continue;
					}
					if (ally) {
						result.add(k);
						continue;
					}
				}
				// celda vacía: incluir y profundizar si no visitado con menor depth
				const nextDepth = depth + 1;
				const prev = visited.get(k);
				if (prev === undefined || nextDepth < prev) {
					visited.set(k, nextDepth);
					result.add(k);
					queue.push({ x: nx, y: ny, depth: nextDepth });
				}
			}
		}
		return result;
	}
}
