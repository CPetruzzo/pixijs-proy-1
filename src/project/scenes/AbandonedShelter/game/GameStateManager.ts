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

	// Estado de la linterna
	public batteryLevel = 3;
	public flashlightOn = true;

	// Objetos recogidos (IDs)
	public pickedItems = new Set<string>();

	public reset(): void {
		this.batteryLevel = 3;
		this.flashlightOn = true;
		this.pickedItems.clear();
	}
}
