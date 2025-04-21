// src/game/FlashlightController.ts
import { GameStateManager } from "./GameStateManager";
import { EventEmitter } from "eventemitter3";

export class FlashlightController extends EventEmitter {
	private state = GameStateManager.instance;
	private _elapsed: number = 0; // ← inicializamos

	public toggle(): void {
		if (this.state.batteryLevel <= 0) {
			return;
		}
		this.state.flashlightOn = !this.state.flashlightOn;
		this.emit("changed", this.state);
	}

	public update(dt: number): void {
		if (!this.state.flashlightOn) {
			return;
		}

		this._elapsed += dt;
		if (this._elapsed >= 5000) {
			this._elapsed -= 5000;
			this.state.batteryLevel = Math.max(0, this.state.batteryLevel - 1);
			if (this.state.batteryLevel === 0) {
				this.state.flashlightOn = false;
			}
			this.emit("changed", this.state);
		}
	}
}
