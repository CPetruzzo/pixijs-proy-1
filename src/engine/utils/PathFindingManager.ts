import { Point } from "pixi.js";

// Estructura interna para el cálculo (no se exporta si no es necesario)
class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}

export class PathfindingManager {
	private static instance: PathfindingManager;

	// eslint-disable-next-line prettier/prettier
	private constructor() { }

	public static getInstance(): PathfindingManager {
		if (!this.instance) {
			this.instance = new PathfindingManager();
		}
		return this.instance;
	}

	/**
	 * Calcula la ruta más corta entre A y B en una grilla.
	 * @param grid Matriz 2D donde 0 es caminable y 1 es obstáculo.
	 * @param start Posición de inicio {x, y}
	 * @param end Posición de destino {x, y}
	 * @param allowDiagonals (Opcional) Si se permite movimiento diagonal.
	 */
	public findPath(grid: number[][], start: Point, end: Point, allowDiagonals: boolean = false): Point[] | null {
		// Validaciones básicas de límites
		if (!this.isValid(grid, start) || !this.isValid(grid, end)) {
			console.warn("Pathfinding: Inicio o Fin fuera de límites o en obstáculo.");
			return null;
		}

		const startNode = new Node(start.x, start.y);
		const goalNode = new Node(end.x, end.y);

		const openSet: Node[] = [startNode];
		const closedSet: Node[] = [];

		while (openSet.length > 0) {
			// Optimización: Podrías usar un Binary Heap aquí para grids muy grandes
			const currentNode = openSet.reduce((prev, curr) => (curr.f < prev.f ? curr : prev));

			// Llegamos al destino
			if (currentNode.x === goalNode.x && currentNode.y === goalNode.y) {
				const path: Point[] = [];
				let curr: Node | null = currentNode;
				while (curr) {
					path.push(new Point(curr.x, curr.y));
					curr = curr.parent;
				}
				return path.reverse(); // Retornamos el camino desde inicio a fin
			}

			// Mover de Open a Closed
			openSet.splice(openSet.indexOf(currentNode), 1);
			closedSet.push(currentNode);

			const neighbors = this.getNeighbors(currentNode, grid, allowDiagonals);

			for (const neighbor of neighbors) {
				if (closedSet.some((n) => n.x === neighbor.x && n.y === neighbor.y)) {
					continue;
				}

				// Costo de movimiento (1 para ortogonal, 1.41 para diagonal)
				const moveCost = currentNode.x !== neighbor.x && currentNode.y !== neighbor.y ? Math.SQRT2 : 1;
				const tentativeG = currentNode.g + moveCost;

				const inOpenSet = openSet.find((n) => n.x === neighbor.x && n.y === neighbor.y);

				if (!inOpenSet) {
					neighbor.parent = currentNode;
					neighbor.g = tentativeG;
					neighbor.h = this.heuristic(neighbor, goalNode);
					neighbor.f = neighbor.g + neighbor.h;
					openSet.push(neighbor);
				} else if (tentativeG < inOpenSet.g) {
					// Encontramos un camino mejor a este vecino
					inOpenSet.parent = currentNode;
					inOpenSet.g = tentativeG;
					inOpenSet.f = inOpenSet.g + inOpenSet.h;
				}
			}
		}

		return null; // No se encontró camino
	}

	private getNeighbors(node: Node, grid: number[][], allowDiagonals: boolean): Node[] {
		const neighbors: Node[] = [];
		const directions = [
			{ x: 0, y: -1 }, // Arriba
			{ x: 0, y: 1 }, // Abajo
			{ x: -1, y: 0 }, // Izquierda
			{ x: 1, y: 0 }, // Derecha
		];

		if (allowDiagonals) {
			directions.push({ x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 });
		}

		for (const dir of directions) {
			const newX = node.x + dir.x;
			const newY = node.y + dir.y;

			if (this.isValid(grid, { x: newX, y: newY })) {
				neighbors.push(new Node(newX, newY));
			}
		}

		return neighbors;
	}

	private isValid(grid: number[][], point: { x: number; y: number }): boolean {
		return (
			point.x >= 0 && point.x < grid.length && point.y >= 0 && point.y < grid[0].length && grid[point.x][point.y] === 0 // Asumimos 0 es libre, 1 es obstáculo
		);
	}

	private heuristic(nodeA: Node, nodeB: Node): number {
		// Manhattan Distance (mejor para movimiento 4 direcciones)
		// return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);

		// Euclidean Distance (si usas diagonales)
		return Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
	}
}
