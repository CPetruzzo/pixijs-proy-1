// engine/pathfinding/IMapProvider.ts
export interface IMapProvider {
	/**
	 * Retorna el costo de entrar a la celda (x, y).
	 * Retorna Infinity si es un obstáculo o está fuera de límites.
	 * Ejemplo: Pasto = 1, Bosque = 2, Muro = Infinity.
	 */
	getMovementCost(x: number, y: number): number;

	/** Ancho del mapa en celdas */
	getWidth(): number;

	/** Alto del mapa en celdas */
	getHeight(): number;
}
