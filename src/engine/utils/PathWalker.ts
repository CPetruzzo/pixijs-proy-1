import type { Container, Point } from "pixi.js";

export class PathWalker {
	private path: Point[] = [];
	private currentTargetIndex: number = 0;
	private speed: number = 0; // Pixeles por frame (o por segundo si usas delta en segundos)
	private isMoving: boolean = false;
	private onPathFinished: (() => void) | null = null;

	// Referencia al objeto visual y tamaño de celda
	constructor(private targetEntity: Container, private tileSize: number, speed: number = 5) {
		this.speed = speed;
	}

	public setPath(path: Point[], onComplete?: () => void): void {
		this.path = path;
		this.onPathFinished = onComplete || null;

		// Si el path tiene elementos, empezamos a mover hacia el índice 1 (el 0 es donde estamos)
		if (this.path.length > 1) {
			this.currentTargetIndex = 1;
			this.isMoving = true;
		} else {
			this.isMoving = false;
		}
	}

	public update(dt: number): void {
		if (!this.isMoving || this.path.length === 0) {
			return;
		}

		const targetCell = this.path[this.currentTargetIndex];
		const targetX = targetCell.x * this.tileSize;
		const targetY = targetCell.y * this.tileSize;

		const dx = targetX - this.targetEntity.x;
		const dy = targetY - this.targetEntity.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		// Si estamos muy cerca del objetivo (menos de lo que nos moveríamos en este frame)
		if (distance < this.speed * dt) {
			// "Snap" a la posición exacta
			this.targetEntity.x = targetX;
			this.targetEntity.y = targetY;

			this.currentTargetIndex++;

			// Verificamos si terminamos el camino
			if (this.currentTargetIndex >= this.path.length) {
				this.isMoving = false;
				if (this.onPathFinished) {
					this.onPathFinished();
				}
			}
		} else {
			// Normalizar y mover
			this.targetEntity.x += (dx / distance) * this.speed * dt;
			this.targetEntity.y += (dy / distance) * this.speed * dt;
		}
	}

	public stop(): void {
		this.isMoving = false;
		this.path = [];
	}
}
