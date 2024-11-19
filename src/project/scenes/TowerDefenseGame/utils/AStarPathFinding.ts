import { Node } from "../models/Node";

export class AStarPathfinding {
	static findPath(grid: number[][], start: Node, goal: Node): Node[] | null {
		const openSet: Node[] = [start];
		const closedSet: Set<string> = new Set();

		const key = (node: Node) => `${node.x},${node.y}`;
		start.g = 0;
		start.h = this.heuristic(start, goal);
		start.f = start.g + start.h;

		while (openSet.length > 0) {
			openSet.sort((a, b) => a.f - b.f);
			const current = openSet.shift()!;

			if (current.equals(goal)) {
				return this.reconstructPath(current);
			}

			closedSet.add(key(current));

			const neighbors = this.getNeighbors(grid, current);
			for (const neighbor of neighbors) {
				if (closedSet.has(key(neighbor))) continue;

				const tentativeG = current.g + 1;
				if (tentativeG < neighbor.g || !openSet.some((n) => n.equals(neighbor))) {
					neighbor.g = tentativeG;
					neighbor.h = this.heuristic(neighbor, goal);
					neighbor.f = neighbor.g + neighbor.h;
					neighbor.parent = current;

					if (!openSet.some((n) => n.equals(neighbor))) {
						openSet.push(neighbor);
					}
				}
			}
		}

		return null;
	}

	private static reconstructPath(current: Node): Node[] {
		const path: Node[] = [];
		while (current) {
			path.unshift(current);
			current = current.parent!;
		}
		return path;
	}

	private static getNeighbors(grid: number[][], node: Node): Node[] {
		const directions = [
			{ x: 0, y: -1 }, // Up
			{ x: 0, y: 1 },  // Down
			{ x: -1, y: 0 }, // Left
			{ x: 1, y: 0 },  // Right
		];

		return directions
			.map((dir) => new Node(node.x + dir.x, node.y + dir.y))
			.filter((neighbor) =>
				neighbor.x >= 0 &&
				neighbor.x < grid[0].length &&
				neighbor.y >= 0 &&
				neighbor.y < grid.length &&
				grid[neighbor.y][neighbor.x] === 0
			);
	}

	private static heuristic(node: Node, goal: Node): number {
		return Math.abs(node.x - goal.x) + Math.abs(node.y - goal.y); // Manhattan distance
	}
}
