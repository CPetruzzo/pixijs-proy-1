import type { Container, Point } from "pixi.js";

export interface PathWalkerOptions {
	speed?: number;
	tileSize?: number;
	smoothUpdates?: boolean; // TRUE: Evita tirones al recalcular. FALSE: Reinicio estricto.
}

export class PathWalker {
	private path: Point[] = [];
	private currentTargetIndex: number = 0;

	// Configuración
	private speed: number;
	private tileSize: number;
	private smoothUpdates: boolean;

	private isMoving: boolean = false;
	private onPathFinished: (() => void) | null = null;

	constructor(private targetEntity: Container, options: PathWalkerOptions = {}) {
		this.speed = options.speed || 5;
		this.tileSize = options.tileSize || 1; // Si es 1, funciona para coordenadas libres (sin grilla)
		this.smoothUpdates = options.smoothUpdates ?? true; // Por defecto fluido
	}

	public setPath(newPath: Point[], onComplete?: () => void): void {
		this.onPathFinished = onComplete || null;

		if (this.smoothUpdates && this.isMoving && this.path.length > this.currentTargetIndex) {
			// Objetivo actual en coordenadas de mundo
			const currentTargetTile = this.path[this.currentTargetIndex];

			// Buscar si nuestro objetivo actual existe en la nueva ruta (en los primeros 2-3 pasos)
			// Esto es crucial: A veces A* corta el primer nodo si ya lo pasamos un poco.
			let matchIndex = -1;

			// Solo miramos los primeros 3 nodos para no confundirnos con rutas circulares
			const searchLimit = Math.min(newPath.length, 3);

			for (let i = 0; i < searchLimit; i++) {
				if (newPath[i].x === currentTargetTile.x && newPath[i].y === currentTargetTile.y) {
					matchIndex = i;
					break;
				}
			}

			if (matchIndex !== -1) {
				// ¡EUREKA! Encontramos nuestro destino actual dentro de la nueva ruta.
				// 1. Reemplazamos la ruta vieja con la nueva.
				this.path = newPath;
				// 2. Ajustamos el índice para que siga apuntando a ESE mismo nodo que encontramos.
				//    Así el NPC no siente el cambio, solo sabe que después de este nodo, vendrán otros nuevos.
				this.currentTargetIndex = matchIndex;
				return;
			}
		}

		// Fallback: Reinicio completo si la ruta es totalmente diferente
		this.path = newPath;
		if (this.path.length > 1) {
			// A veces A* devuelve [Inicio, Destino]. Inicio es donde ya estamos.
			// Si el primer punto es extremadamente cercano a nosotros (mismo tile), saltamos al siguiente.
			const startNode = this.path[0];
			const startNodeX = startNode.x * this.tileSize;
			const startNodeY = startNode.y * this.tileSize;

			// Distancia al primer nodo
			const dx = startNodeX - this.targetEntity.x;
			const dy = startNodeY - this.targetEntity.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Si estamos a menos de medio tile del nodo de inicio, asumimos que ya estamos "ahí"
			// y apuntamos al siguiente para evitar volver atrás.
			if (dist < this.tileSize / 2 && this.path.length > 1) {
				this.currentTargetIndex = 1;
			} else {
				this.currentTargetIndex = 0; // Ojo: Aquí podría ser 0 si path[0] es un destino válido lejano
			}

			// Corrección habitual para A* que incluye el nodo start:
			// Si path[0] es mi tile actual, forzamos ir al 1.
			const currentGridX = Math.round(this.targetEntity.x / this.tileSize);
			const currentGridY = Math.round(this.targetEntity.y / this.tileSize);

			if (this.path[0].x === currentGridX && this.path[0].y === currentGridY && this.path.length > 1) {
				this.currentTargetIndex = 1;
			}

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

		// Aquí convertimos Tile -> Mundo.
		// Si tileSize es 1, targetCell.x ya es la posición en pixeles.
		const targetX = targetCell.x * this.tileSize;
		const targetY = targetCell.y * this.tileSize;

		const dx = targetX - this.targetEntity.x;
		const dy = targetY - this.targetEntity.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		// Movimiento
		if (distance < this.speed * dt) {
			// Llegamos al nodo ("Snap")
			this.targetEntity.x = targetX;
			this.targetEntity.y = targetY;

			this.currentTargetIndex++;

			if (this.currentTargetIndex >= this.path.length) {
				this.isMoving = false;
				if (this.onPathFinished) {
					this.onPathFinished();
				}
			}
		} else {
			// Avanzamos suavemente
			this.targetEntity.x += (dx / distance) * this.speed * dt;
			this.targetEntity.y += (dy / distance) * this.speed * dt;
		}
	}

	public stop(): void {
		this.isMoving = false;
		this.path = [];
	}
}
