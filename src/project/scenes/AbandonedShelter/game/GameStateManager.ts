// src/game/GameStateManager.ts
export class GameStateManager {
	private static _instance: GameStateManager;
	// eslint-disable-next-line prettier/prettier
	private constructor() { }

	public static get instance(): GameStateManager {
		if (!GameStateManager._instance) {
			GameStateManager._instance = new GameStateManager();
		}
		return GameStateManager._instance;
	}

	// --- Estado de Linterna ---
	public batteryLevel = 3;
	public flashlightOn = false;

	// --- Salud ---
	public healthPoints = 100;

	// --- Inventario ---
	public pickedItems = new Set<string>();
	public activeItem: string | null = null;

	// --- Estado de Enemigos ---
	/** Será true cuando el enemigo haya muerto/desintegrado */
	public enemyDefeated = false;
	public skullPicked = false;
	public gunGrabbed = false;
	public altarAvailable = false;
	public reset(): void {
		this.batteryLevel = 3;
		this.flashlightOn = false;
	}

	public resetObjects(): void {
		this.pickedItems.clear();
	}

	public fullHealth(): void {
		this.healthPoints = 100;
	}

	public setHP(healthPoints: number): void {
		this.healthPoints = healthPoints;
	}
}
