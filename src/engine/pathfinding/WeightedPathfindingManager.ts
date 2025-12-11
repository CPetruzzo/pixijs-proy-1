// engine/pathfinding/WeightedPathfindingManager.ts
import { Point } from "pixi.js";
import type { IMapProvider } from "./IMapProvider";

interface PathNode {
	x: number;
	y: number;
	g: number; // Costo desde el inicio
	f: number; // Costo total estimado (g + h)
	parent: PathNode | null;
}

export class WeightedPathfindingManager {
	// Singleton para facilitar acceso, o instanciable según prefieras
	private static instance: WeightedPathfindingManager;
	public static get shared(): WeightedPathfindingManager {
		return this.instance || (this.instance = new WeightedPathfindingManager());
	}

	/**
	 * ALGORITMO A*: Para mover una unidad de A -> B
	 */
	public findPath(map: IMapProvider, start: Point, end: Point): Point[] | null {
		// Validaciones básicas
		if (map.getMovementCost(end.x, end.y) === Infinity) {
			return null;
		}

		const openSet: PathNode[] = [];
		const closedSet = new Set<string>();

		const startNode: PathNode = { x: start.x, y: start.y, g: 0, f: 0, parent: null };
		openSet.push(startNode);

		while (openSet.length > 0) {
			// Ordenar por menor F (se puede optimizar con BinaryHeap)
			openSet.sort((a, b) => a.f - b.f);
			const current = openSet.shift()!;
			const key = `${current.x},${current.y}`;

			if (current.x === end.x && current.y === end.y) {
				return this.reconstructPath(current);
			}

			closedSet.add(key);

			for (const neighbor of this.getNeighbors(current, map)) {
				const neighborKey = `${neighbor.x},${neighbor.y}`;
				if (closedSet.has(neighborKey)) {
					continue;
				}

				const moveCost = map.getMovementCost(neighbor.x, neighbor.y);
				if (moveCost === Infinity) {
					continue;
				}

				const tentativeG = current.g + moveCost;

				const existingNode = openSet.find((n) => n.x === neighbor.x && n.y === neighbor.y);

				if (!existingNode || tentativeG < existingNode.g) {
					const h = Math.abs(neighbor.x - end.x) + Math.abs(neighbor.y - end.y); // Manhattan
					const newNode: PathNode = {
						x: neighbor.x,
						y: neighbor.y,
						g: tentativeG,
						f: tentativeG + h,
						parent: current,
					};

					if (!existingNode) {
						openSet.push(newNode);
					} else {
						existingNode.g = tentativeG;
						existingNode.f = tentativeG + h;
						existingNode.parent = current;
					}
				}
			}
		}
		return null;
	}

	/**
	 * ALGORITMO DIJKSTRA (Flood Fill): Para calcular Rango de Movimiento (Área Azul)
	 * Retorna un Set con las claves "x,y" alcanzables.
	 */
	public getReachableArea(map: IMapProvider, start: Point, maxMovement: number): Set<string> {
		const reachable = new Set<string>();
		const costSoFar = new Map<string, number>();

		const startKey = `${start.x},${start.y}`;
		const frontier: { pt: Point; priority: number }[] = [];

		frontier.push({ pt: start, priority: 0 });
		costSoFar.set(startKey, 0);

		while (frontier.length > 0) {
			frontier.sort((a, b) => a.priority - b.priority);
			const current = frontier.shift()!;

			// Añadir a resultados (excepto quizás el origen si quieres excluirlo)
			reachable.add(`${current.pt.x},${current.pt.y}`);

			// Si llegamos al límite de movimiento, no expandimos más desde aquí
			if (costSoFar.get(`${current.pt.x},${current.pt.y}`)! >= maxMovement) {
				continue;
			}

			for (const next of this.getNeighbors(current.pt, map)) {
				const moveCost = map.getMovementCost(next.x, next.y);
				if (moveCost === Infinity) {
					continue;
				}

				const currentCost = costSoFar.get(`${current.pt.x},${current.pt.y}`)!;
				const newCost = currentCost + moveCost;

				if (newCost <= maxMovement) {
					const nextKey = `${next.x},${next.y}`;
					if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)!) {
						costSoFar.set(nextKey, newCost);
						frontier.push({ pt: next, priority: newCost });
					}
				}
			}
		}

		return reachable;
	}

	private getNeighbors(node: { x: number; y: number }, map: IMapProvider): Point[] {
		const res: Point[] = [];
		const dirs = [
			[0, 1],
			[0, -1],
			[1, 0],
			[-1, 0],
		]; // 4 Direcciones

		for (const [dx, dy] of dirs) {
			const nx = node.x + dx;
			const ny = node.y + dy;
			if (nx >= 0 && nx < map.getWidth() && ny >= 0 && ny < map.getHeight()) {
				res.push(new Point(nx, ny));
			}
		}
		return res;
	}

	private reconstructPath(node: PathNode): Point[] {
		const path: Point[] = [];
		let curr: PathNode | null = node;
		while (curr) {
			path.push(new Point(curr.x, curr.y));
			curr = curr.parent;
		}
		return path.reverse();
	}
}
