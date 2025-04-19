// src/game/InventoryController.ts
import { GameStateManager } from "./GameStateManager";
import { EventEmitter } from "eventemitter3";

export class InventoryController extends EventEmitter {
	private state = GameStateManager.instance;

	public pick(itemId: string): void {
		if (!this.state.pickedItems.has(itemId)) {
			this.state.pickedItems.add(itemId);
			this.emit("picked", itemId);
		}
	}
}
