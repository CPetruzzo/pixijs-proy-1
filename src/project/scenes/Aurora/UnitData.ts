/* eslint-disable @typescript-eslint/naming-convention */
import type { UnitConfig } from "./IUnit";

/**
 * Lista de configuraciones para todas las unidades en el juego.
 * Cada objeto sigue la interfaz UnitConfig.
 */
export const PlayerData: UnitConfig[] = [
	// Aliados
	{
		id: "Soldado",
		textureKey: "colonial1",
		gridX: 6,
		gridY: 7,
		puntosDeMovimiento: 6,
		attackRange: 1,
		strength: 10,
		defense: 5,
		avoid: 0.04,
		maxHealthPoints: 50,
		isEnemy: false,
	},
	{
		id: "Comandante",
		textureKey: "colonial1",
		gridX: 5,
		gridY: 7,
		puntosDeMovimiento: 5,
		attackRange: 2,
		strength: 7,
		defense: 3,
		avoid: 0.04,
		maxHealthPoints: 30,
		isEnemy: false,
	},
	// Enemigos
	{
		id: "J. Calchaquí",
		textureKey: "quilmes1",
		gridX: 5,
		gridY: 1,
		puntosDeMovimiento: 4,
		attackRange: 1,
		strength: 8,
		defense: 3,
		avoid: 0.1,
		maxHealthPoints: 50,
		isEnemy: true,
	},
	{
		id: "Kilme",
		textureKey: "quilmes1",
		gridX: 6,
		gridY: 1,
		puntosDeMovimiento: 4,
		attackRange: 1,
		strength: 8,
		defense: 2,
		avoid: 0.02,
		maxHealthPoints: 20,
		isEnemy: true,
	},
	// ... puedes agregar más unidades aquí ...
];
