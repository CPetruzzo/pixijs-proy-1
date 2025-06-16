// Terrain.ts
export class Terrain {
	/** Código único para esta clase de terreno */
	public readonly code: number;
	/** Nombre legible */
	public readonly name: string;
	/** Bonificación de defensa (por ejemplo +1) */
	public readonly defBonus: number;
	/** Bonificación de evasión (por ejemplo +0.1) */
	public readonly avoBonus: number;
	/** Coste de movimiento: cuántos puntosDeMovimiento resta moverse en esta casilla */
	public readonly moveCost: number;
	private constructor(code: number, name: string, defBonus: number, avoBonus: number, moveCost: number) {
		this.code = code;
		this.name = name;
		this.defBonus = defBonus;
		this.avoBonus = avoBonus;
		this.moveCost = moveCost;
	}

	// Instancias estáticas:
	public static readonly PLAIN = new Terrain(0, "Llanura", 0, 0, 1);
	public static readonly FOREST = new Terrain(1, "Bosque", 0, 0.5, 2);
	public static readonly MOUNTAIN = new Terrain(2, "Montaña", 5, 0.1, 4);
	public static readonly FORTRESS = new Terrain(3, "Fortaleza", 3, 0, 1);
	public static readonly OBSTACLE = new Terrain(99, "Obstáculo", 0, 0, Infinity); // no transitable

	public static readonly BUILDING = new Terrain(99, "Edificio", 5, 0, 1);
	public static readonly GATE = new Terrain(99, "Puerta", 5, 0, 1);

	/** Mapear código numérico a instancia Terrain */
	public static fromCode(code: number): Terrain {
		switch (code) {
			case Terrain.PLAIN.code:
				return Terrain.PLAIN;
			case Terrain.FOREST.code:
				return Terrain.FOREST;
			case Terrain.MOUNTAIN.code:
				return Terrain.MOUNTAIN;
			case Terrain.FORTRESS.code:
				return Terrain.FORTRESS;
			case Terrain.OBSTACLE.code:
				return Terrain.OBSTACLE;
			default:
				// si hay otros códigos, podrías manejarlos; por defecto tratamos como Plain:
				// console.warn(`Unknown terrain code ${code}, usando Plain por defecto.`);
				return Terrain.PLAIN;
		}
	}
}

export function getTerrainColor(terrain: Terrain): number {
	switch (terrain) {
		case Terrain.PLAIN:
			return 0x88cc88; // light green
		case Terrain.FOREST:
			return 0x339933; // darker green
		case Terrain.MOUNTAIN:
			return 0x888888; // gray
		case Terrain.FORTRESS:
			return 0x6666cc; // bluish
		case Terrain.OBSTACLE:
			return 0x333333; // dark gray
		default:
			return 0xaaaaaa; // fallback neutral
	}
}
