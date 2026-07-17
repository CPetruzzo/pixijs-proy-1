/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/naming-convention */
import { Assets, Texture } from "pixi.js";

/**
 * Define la estructura de los datos que el juego espera.
 * El mod puede sobrescribir cualquier propiedad opcional.
 */
export interface GameConfig {
	gameTime: number;
	pointsPerOrder: number;
	hygienePenalty: number;
	ingredients: Array<{ id: string; label: string; url?: string }>;
}

export class ModManager {
	private static _instance: ModManager;
	private _currentConfig: GameConfig;

	// Configuración por defecto (hardcoded como fallback)
	private readonly DEFAULT_CONFIG: GameConfig = {
		gameTime: 180,
		pointsPerOrder: 10,
		hygienePenalty: 15,
		ingredients: [
			{ id: "jamon", label: "Jamón" },
			{ id: "pan", label: "Pan" },
			{ id: "agua", label: "Agua" },
			{ id: "granos", label: "Granos" },
		],
	};

	private constructor() {
		this._currentConfig = { ...this.DEFAULT_CONFIG };
	}

	public static get instance(): ModManager {
		if (!ModManager._instance) {
			ModManager._instance = new ModManager();
		}
		return ModManager._instance;
	}

	/**
	 * Carga un mod desde una URL de manifiesto JSON
	 */
	public async loadMod(url: string): Promise<void> {
		try {
			const response = await fetch(url);
			const modData = await response.json();

			// 1. Mezclar configuraciones (Merge)
			this._currentConfig = {
				...this.DEFAULT_CONFIG,
				...modData.settings,
			};

			// 2. Registrar Assets del Mod
			if (modData.ingredients) {
				for (const ing of modData.ingredients) {
					if (ing.url) {
						/**
						 * CORRECCIÓN: Según Assets.d.ts, add() requiere 2 argumentos:
						 * arg1: keysIn (el alias/id)
						 * arg2: assetsIn (la URL/source)
						 */
						Assets.add(ing.id, ing.url);

						await Assets.load(ing.id);
						console.log(`Mod: Ingrediente ${ing.id} cargado desde ${ing.url}`);
					}
				}
				// Actualizar lista de ingredientes
				this._currentConfig.ingredients = modData.ingredients;
			}

			console.log(`Mod "${modData.name}" cargado con éxito.`);
		} catch (error) {
			console.error("Error cargando el mod, usando config por defecto:", error);
			this._currentConfig = { ...this.DEFAULT_CONFIG };
		}
	}

	public getConfig(): GameConfig {
		return this._currentConfig;
	}

	/**
	 * Helper para obtener una textura, ya sea del juego base o del mod
	 */
	public getTexture(id: string): Texture {
		if (Assets.cache.has(id)) {
			return Assets.get(id);
		}
		// Fallback a una textura blanca si no existe
		return Texture.WHITE;
	}
}
