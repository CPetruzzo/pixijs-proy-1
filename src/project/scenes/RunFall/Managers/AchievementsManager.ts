// AchievementsManager.ts
import { EventEmitter } from "events";

/**
 * Estado que se evaluará para determinar si se desbloquean logros.
 */
export interface AchievementState {
	score: number;
	lives: number;
	coinsCollected: number; // Monedas recogidas
	enemyCollisions: number; // Choques contra enemigos
	obstacleCollisions: number; // Choques contra obstáculos
	potionsCollected: number; // Potions recogidas (I Have My Meds)
}

/**
 * Interfaz para cada logro.
 */
export interface Achievement {
	id: string;
	title: string;
	description: string;
	unlocked: boolean;
	/**
	 * Función que recibe el estado del juego y devuelve true si se cumple la condición para desbloquear el logro.
	 */
	checkCondition: (state: AchievementState) => boolean;
}

/**
 * Manager de logros (singleton). Se encarga de evaluar el estado actual del juego y emitir eventos cuando se desbloquea un logro.
 */
export class AchievementsManager extends EventEmitter {
	private static instance: AchievementsManager;
	private achievements: Achievement[] = [];

	// Constructor privado para evitar instanciación externa
	private constructor() {
		super();
		this.initializeAchievements();
	}

	/**
	 * Obtiene la instancia global de AchievementsManager.
	 */
	public static getInstance(): AchievementsManager {
		if (!AchievementsManager.instance) {
			AchievementsManager.instance = new AchievementsManager();
		}
		return AchievementsManager.instance;
	}

	/**
	 * Define el listado de logros con sus respectivas condiciones.
	 */
	private initializeAchievements(): void {
		this.achievements = [
			// Logros de monedas: Bounty Hunter (10, 50, 100)
			{
				id: "bounty_hunter_1",
				title: "Bounty Hunter I",
				description: "Recoge 10 monedas.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.coinsCollected >= 10,
			},
			{
				id: "bounty_hunter_2",
				title: "Bounty Hunter II",
				description: "Recoge 50 monedas.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.coinsCollected >= 50,
			},
			{
				id: "bounty_hunter_3",
				title: "Bounty Hunter III",
				description: "Recoge 100 monedas.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.coinsCollected >= 100,
			},

			// Logros de colisiones con enemigos: Meteor Crasher (10, 20, 50)
			{
				id: "meteor_crasher_1",
				title: "Meteor Crasher I",
				description: "Choca contra enemigos 10 veces.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.enemyCollisions >= 10,
			},
			{
				id: "meteor_crasher_2",
				title: "Meteor Crasher II",
				description: "Choca contra enemigos 20 veces.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.enemyCollisions >= 20,
			},
			{
				id: "meteor_crasher_3",
				title: "Meteor Crasher III",
				description: "Choca contra enemigos 50 veces.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.enemyCollisions >= 50,
			},

			// Logros de colisiones con obstáculos: Stumble Champion (10, 20, 50)
			{
				id: "stumble_champion_1",
				title: "Stumble Champion I",
				description: "Choca contra obstáculos 10 veces.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.obstacleCollisions >= 10,
			},
			{
				id: "stumble_champion_2",
				title: "Stumble Champion II",
				description: "Choca contra obstáculos 20 veces.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.obstacleCollisions >= 20,
			},
			{
				id: "stumble_champion_3",
				title: "Stumble Champion III",
				description: "Choca contra obstáculos 50 veces.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.obstacleCollisions >= 50,
			},

			// Logros de recoger potions: I Have My Meds (10, 20, 50)
			{
				id: "i_have_my_meds_1",
				title: "I Have My Meds I",
				description: "Recoge 1 potions.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.potionsCollected >= 1,
			},
			{
				id: "i_have_my_meds_2",
				title: "I Have My Meds II",
				description: "Recoge 20 potions.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.potionsCollected >= 20,
			},
			{
				id: "i_have_my_meds_3",
				title: "I Have My Meds III",
				description: "Recoge 50 potions.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.potionsCollected >= 50,
			},
		];
	}

	/**
	 * Se debe llamar a este método periódicamente (por ejemplo, en el loop de actualización)
	 * pasando el estado actual del juego. Evaluará cada logro y, si se cumple la condición,
	 * lo marcará como desbloqueado y emitirá el evento correspondiente.
	 *
	 * @param state Estado actual del juego.
	 */
	public update(state: AchievementState): void {
		this.achievements.forEach((achievement) => {
			if (!achievement.unlocked && achievement.checkCondition(state)) {
				achievement.unlocked = true;
				this.emit("achievementUnlocked", achievement);
				console.log(`Logro desbloqueado: ${achievement.title}`);
			}
		});
	}

	/**
	 * Devuelve el listado de logros, útil para mostrarlos en la UI.
	 */
	public getAchievements(): Achievement[] {
		return this.achievements;
	}
}
