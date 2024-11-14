import type { Sprite } from "pixi.js";
import { ToggleButton } from "./ToggleButton";

export class PauseButton extends ToggleButton {
	public paused: boolean;
	constructor(
		pausePosition: { x: number; y: number },
		parentContainer: {
			addChild: (arg0: Sprite) => void;
		}
	) {
		super("pauseOn", "pauseOff", pausePosition, parentContainer);
	}

	public override toggleToOn(): void {
		console.log("toggleToOn called");
		this.onSprite.alpha = 1;
		this.offSprite.alpha = 0;
		this.offSprite.eventMode = "none";
		this.onSprite.eventMode = "static";
		this.paused = false;
	}

	public override toggleToOff(): void {
		console.log("toggleToOff called");
		this.onSprite.alpha = 0;
		this.offSprite.alpha = 1;
		this.onSprite.eventMode = "none";
		this.offSprite.eventMode = "static";
		console.log("onSprite alpha:", this.onSprite.alpha, "| offSprite alpha:", this.offSprite.alpha);
		this.paused = true;
	}
}
