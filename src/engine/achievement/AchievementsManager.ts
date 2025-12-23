import { EventEmitter } from "events";

/**
 * Interfaz genérica para definir un Logro.
 * @template T El tipo de datos del estado del juego (Game State).
 */
export interface Achievement<T> {
	id: string; // Identificador único (ej: "first_blood")
	title: string; // Título visible
	description: string; // Descripción visible
	icon: string; // Nombre de la textura/imagen asociada
	unlocked: boolean; // Estado actual
	hidden?: boolean; // Opcional: Si es verdadero, no se muestra hasta desbloquearse

	/**
	 * Función que recibe el estado genérico T y decide si se desbloquea.
	 */
	condition: (state: T) => boolean;
}

/**
 * Manager Genérico de Logros.
 * Funciona como un Singleton por conveniencia, pero permite configurar "namespaces" para distintos juegos.
 */
export class AchievementsManager<T = any> extends EventEmitter {
	private static instance: AchievementsManager<any>;

	private achievements: Map<string, Achievement<T>> = new Map();
	private storageKey: string = "generic_game_achievements";
	public isDirty: boolean = false; // Para evitar guardar si no hubo cambios

	private constructor() {
		super();
	}

	/**
	 * Obtiene la instancia del manager.
	 * Se puede tipar al usarla: AchievementsManager.getInstance<MyGameState>();
	 */
	public static getInstance<T>(): AchievementsManager<T> {
		if (!AchievementsManager.instance) {
			AchievementsManager.instance = new AchievementsManager<T>();
		}
		return AchievementsManager.instance;
	}

	/**
	 * Configura el manager para un juego específico.
	 * @param storageKey Clave para guardar en localStorage (ej: "runfall_save_data")
	 * @param definitions Lista de logros a registrar.
	 */
	public setup(storageKey: string, definitions: Achievement<T>[]): void {
		this.storageKey = storageKey;
		this.achievements.clear();

		// 1. Registrar definiciones (estado base)
		definitions.forEach((def) => {
			// Aseguramos que empiecen bloqueados a menos que la definición diga lo contrario
			this.achievements.set(def.id, { ...def, unlocked: def.unlocked || false });
		});

		// 2. Cargar progreso guardado
		this.load();
	}

	/**
	 * Evalúa el estado del juego contra todos los logros bloqueados.
	 * @param state Objeto con el estado actual del juego.
	 */
	public update(state: T): void {
		let changed = false;

		this.achievements.forEach((achievement) => {
			if (!achievement.unlocked) {
				// Ejecutamos la condición definida en el logro
				if (achievement.condition(state)) {
					this.unlock(achievement.id);
					changed = true;
				}
			}
		});

		if (changed) {
			this.save();
		}
	}

	/**
	 * Fuerza el desbloqueo de un logro por ID.
	 */
	public unlock(id: string): void {
		const achievement = this.achievements.get(id);
		if (achievement && !achievement.unlocked) {
			achievement.unlocked = true;
			this.emit("achievementUnlocked", achievement);
			this.save();
		}
	}

	/**
	 * Devuelve la lista de logros (útil para la UI).
	 */
	public getAll(): Achievement<T>[] {
		return Array.from(this.achievements.values());
	}

	/**
	 * Devuelve solo los desbloqueados.
	 */
	public getUnlocked(): Achievement<T>[] {
		return this.getAll().filter((a) => a.unlocked);
	}

	// --- Persistencia ---

	private save(): void {
		const data: Record<string, boolean> = {};
		this.achievements.forEach((a) => {
			if (a.unlocked) {
				data[a.id] = true;
			}
		});
		localStorage.setItem(this.storageKey, JSON.stringify(data));
	}

	private load(): void {
		const stored = localStorage.getItem(this.storageKey);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				// Solo actualizamos el booleano 'unlocked', manteniendo la definición original
				for (const id in data) {
					const achievement = this.achievements.get(id);
					if (achievement && data[id] === true) {
						achievement.unlocked = true;
					}
				}
			} catch (e) {
				console.warn("AchievementsManager: Error loading save data", e);
			}
		}
	}

	/**
	 * Reinicia todos los logros (útil para debugging o borrar partida).
	 */
	public resetProgress(): void {
		this.achievements.forEach((a) => (a.unlocked = false));
		localStorage.removeItem(this.storageKey);
	}
}
