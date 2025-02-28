import { EventEmitter } from "events";

/**
 * Estado que se evaluará para determinar si se desbloquean logros.
 */
export interface AchievementState {
	score: number;
	lives: number;
	coinsCollected: number; // Monedas recogidas en la partida actual
	cumulativeCoinsCollected: number; // Monedas acumuladas a lo largo de todas las partidas
	enemyCollisions: number; // Choques contra enemigos en la partida actual
	obstacleCollisions: number; // Choques contra obstáculos en la partida actual
	potionsCollected: number; // Potions recogidas en la partida actual
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
		this.loadAchievements();
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
			// Logros por partida (usando coinsCollected)
			{
				id: "bounty_hunter_1",
				title: "Bounty Hunter I",
				description: "Recoge 10 monedas en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.coinsCollected >= 10,
			},
			{
				id: "bounty_hunter_2",
				title: "Bounty Hunter II",
				description: "Recoge 50 monedas en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.coinsCollected >= 50,
			},
			// Logro acumulativo (usando cumulativeCoinsCollected)
			{
				id: "bounty_hunter_cumulative",
				title: "Bounty Hunter Cumulative",
				description: "Recoge 100 monedas en total a lo largo de todas las partidas.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.cumulativeCoinsCollected >= 100,
			},
			// Logros de colisiones contra enemigos (por partida)
			{
				id: "meteor_crasher_1",
				title: "My First Hit",
				description: "Choca contra enemigos 1 vez en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.enemyCollisions >= 1,
			},
			{
				id: "meteor_crasher_2",
				title: "Ok... twice now!",
				description: "Choca contra enemigos 2 veces en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.enemyCollisions >= 2,
			},
			{
				id: "meteor_crasher_3",
				title: "Meteor Party!",
				description: "Choca contra enemigos 3 veces en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.enemyCollisions >= 3,
			},
			// Logros de colisiones con obstáculos (por partida)
			{
				id: "stumble_champion_1",
				title: "Stumble Champion I",
				description: "Choca contra obstáculos 10 veces en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.obstacleCollisions >= 10,
			},
			{
				id: "stumble_champion_2",
				title: "Stumble Champion II",
				description: "Choca contra obstáculos 20 veces en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.obstacleCollisions >= 20,
			},
			{
				id: "stumble_champion_3",
				title: "Stumble Champion III",
				description: "Choca contra obstáculos 50 veces en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.obstacleCollisions >= 50,
			},
			// Logros de potions (por partida)
			{
				id: "i_have_my_meds_1",
				title: "I can handle this",
				description: "Recoge 1 potion en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.potionsCollected >= 1,
			},
			{
				id: "i_have_my_meds_2",
				title: "I Have My Meds I",
				description: "Recoge 2 potions en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.potionsCollected >= 2,
			},
			{
				id: "i_have_my_meds_3",
				title: "I Have My Meds II",
				description: "Recoge 5 potions en esta partida.",
				unlocked: false,
				checkCondition: (state: AchievementState) => state.potionsCollected >= 5,
			},
		];
	}

	/**
	 * Carga el estado de los logros guardados en localStorage.
	 */
	private loadAchievements(): void {
		const stored = localStorage.getItem("achievements");
		if (stored) {
			try {
				const storedData = JSON.parse(stored);
				this.achievements.forEach((achievement) => {
					if (storedData[achievement.id]) {
						achievement.unlocked = true;
					}
				});
			} catch (e) {
				console.error("Error al cargar achievements:", e);
			}
		}
	}

	/**
	 * Guarda el estado actual de los logros en localStorage.
	 */
	private saveAchievements(): void {
		const data: { [key: string]: boolean } = {};
		this.achievements.forEach((achievement) => {
			data[achievement.id] = achievement.unlocked;
		});
		localStorage.setItem("achievements", JSON.stringify(data));
	}

	/**
	 * Se debe llamar a este método periódicamente (por ejemplo, en el loop de actualización)
	 * pasando el estado actual del juego. Evaluará cada logro y, si se cumple la condición,
	 * lo marcará como desbloqueado, emitirá el evento correspondiente y guardará el estado.
	 *
	 * @param state Estado actual del juego.
	 */
	public update(state: AchievementState): void {
		this.achievements.forEach((achievement) => {
			if (!achievement.unlocked && achievement.checkCondition(state)) {
				achievement.unlocked = true;
				this.emit("achievementUnlocked", achievement);
				console.log(`Logro desbloqueado: ${achievement.title}`);
				this.saveAchievements();
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
