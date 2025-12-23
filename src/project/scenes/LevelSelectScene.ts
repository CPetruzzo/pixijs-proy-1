/* eslint-disable @typescript-eslint/naming-convention */
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { LayoutType, LevelSelectionManager, WorldTypes } from "../../engine/levelselection/LevelSelectionManager";
import { DialogueOverlayManager } from "../../engine/dialog/DialogueOverlayManager";
import { Manager } from "../..";
import { Point } from "pixi.js";
import type { LevelSaveData, LevelConfig } from "./../../engine/levelselection/LevelModels";
import { LevelSelectGameScene } from "./LevelSelectGameScene";
import { DataManager } from "../../engine/datamanager/DataManager"; // IMPORTANTE

export class LevelSelectScene extends PixiScene {
	private levelManager: LevelSelectionManager;
	public static readonly BUNDLES = ["myfriend"];

	// Clave para guardar en DataManager
	private readonly PROGRESS_KEY = "LEVEL_PROGRESS_MAP";

	constructor() {
		super();
		DialogueOverlayManager.init(this);

		this.levelManager = new LevelSelectionManager();
		this.levelManager.x = 100;
		this.levelManager.y = 150;
		this.addChild(this.levelManager);

		this.levelManager.onLevelSelected = (cfg, _data) => {
			console.log(`Seleccionado: ${cfg.label} (ID: ${cfg.id})`);

			DialogueOverlayManager.talk(`Viajando al sector ${cfg.label}...`, {
				speed: 50,
			});
			DialogueOverlayManager.chainEvent(() => {
				Manager.changeScene(LevelSelectGameScene, { sceneParams: [cfg.id, cfg.zoneId] });
			});
		};

		// Creamos la grilla
		this.createWorld(WorldTypes.GRID);
	}

	private createWorld(type: WorldTypes = WorldTypes.GRID): void {
		// 1. Recuperar Progreso del DataManager
		let currentProgress = DataManager.getValue<Record<string, LevelSaveData>>(this.PROGRESS_KEY);

		// Si es la primera vez que se juega, inicializar
		if (!currentProgress) {
			console.log("No saved progress found. Initializing...");
			currentProgress = {
				// El nivel 1 siempre empieza desbloqueado
				lvl_1: { stars: 0, score: 0, completed: false, unlocked: true },
			};
			DataManager.setValue(this.PROGRESS_KEY, currentProgress);
			DataManager.save();
		}

		// 2. Definir Configuración (Estructura del juego)
		const levelsConfig: LevelConfig[] = [];

		if (type === WorldTypes.GRID) {
			const TOTAL_LEVELS = 35;
			for (let i = 0; i < TOTAL_LEVELS; i++) {
				const id = `lvl_${i + 1}`;
				const nextId = i < TOTAL_LEVELS - 1 ? `lvl_${i + 2}` : "";
				levelsConfig.push({
					id: id,
					label: (i + 1).toString(),
					zoneId: "forest",
					unlocks: nextId ? [nextId] : [],
				});
			}
		} else {
			// Ejemplo Branching (reutilizado de tu código anterior)
			levelsConfig.push(
				{ id: "lvl_1", label: "Start", zoneId: "base", gridX: 0, gridY: 2, unlocks: ["lvl_2a", "lvl_2b"] },
				{ id: "lvl_2a", label: "Upper", zoneId: "base", gridX: 1, gridY: 1, unlocks: ["lvl_3a"] },
				{ id: "lvl_3a", label: "Boss A", zoneId: "base", gridX: 2, gridY: 0, unlocks: ["lvl_final"] },
				{ id: "lvl_2b", label: "Lower", zoneId: "base", gridX: 1, gridY: 3, unlocks: ["lvl_3b"] },
				{ id: "lvl_3b", label: "Cave", zoneId: "base", gridX: 2, gridY: 3, unlocks: ["lvl_final"] },
				{ id: "lvl_final", label: "Final", zoneId: "base", gridX: 3, gridY: 2, unlocks: [] }
			);
		}

		// 3. PROCESAR DESBLOQUEOS
		// Aquí es donde ocurre la magia. Recorremos la configuración estática
		// y actualizamos el mapa de progreso dinámico basándonos en los padres completados.

		levelsConfig.forEach((cfg) => {
			// Asegurarnos que existe entrada en el progreso para este nivel (si no, la creamos bloqueada)
			if (!currentProgress[cfg.id]) {
				currentProgress[cfg.id] = { stars: 0, score: 0, completed: false, unlocked: false };
			}

			const myData = currentProgress[cfg.id];

			// Si este nivel está completado, desbloquear a sus hijos
			if (myData.completed) {
				cfg.unlocks.forEach((childId) => {
					// Inicializar hijo si no existe
					if (!currentProgress[childId]) {
						currentProgress[childId] = { stars: 0, score: 0, completed: false, unlocked: false };
					}
					// Desbloquear
					currentProgress[childId].unlocked = true;
				});
			}
		});

		// Guardamos los desbloqueos calculados (para que persistan los unlocks nuevos)
		DataManager.setValue(this.PROGRESS_KEY, currentProgress);
		// Opcional: DataManager.save(); // No es estrictamente necesario guardar en cada render, pero es seguro.

		// 4. Renderizar
		if (type === WorldTypes.GRID) {
			this.levelManager.buildLevels(levelsConfig, currentProgress, LayoutType.GRID, 5, new Point(120, 120));
		} else {
			this.levelManager.buildLevels(levelsConfig, currentProgress, LayoutType.SCATTERED, 0, new Point(150, 80));
		}
	}

	public override destroy(): void {
		DialogueOverlayManager.dispose();
		super.destroy();
	}
}
