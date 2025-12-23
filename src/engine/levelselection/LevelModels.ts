// LevelModels.ts

// Interfaz base para la data de guardado de un nivel
export interface LevelSaveData {
	stars: number;
	score: number;
	completed: boolean;
	unlocked: boolean;
	// Puedes extender esto con: timeElapsed, secretsFound, etc.
	[key: string]: any;
}

// Configuración inmutable de un nivel (título, dificultad, requisitos)
export interface LevelConfig {
	id: string;
	label: string; // "1-1", "Zona A", "Boss"
	zoneId: string;

	// Coordenadas lógicas para layouts manuales (opcional)
	gridX?: number;
	gridY?: number;

	// IDs de los niveles que este nivel desbloquea al completarse (Ramificación)
	unlocks: string[];

	// Requisitos especiales (opcional)
	requiredStarsToEnter?: number;
}
