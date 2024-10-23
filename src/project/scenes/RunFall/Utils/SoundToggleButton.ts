import { SoundManager, Sounds } from "../Managers/SoundManager";
import { Container, Sprite } from "pixi.js";

export class SoundToggleButton extends Container {
	public spr: Sprite;
	constructor(x: number, y: number) {
		super();
		this.spr = Sprite.from("golditem1");
		this.spr.eventMode = "static";
		this.spr.anchor.set(0.5);
		this.spr.scale.set(0.7);
		this.spr.on("pointerdown", () => this.toggleSound());
		this.addChild(this.spr);
		this.position.set(x, y);

		// Set initial button state based on musicPaused
		this.updateButtonState();
	}

	private toggleSound(): void {
		// Toggle music state using SoundManager
		if (SoundManager.isMusicOn()) {
			SoundManager.pauseMusic(Sounds.BG_MUSIC);
			SoundManager.musicPlaying = false;
		} else {
			SoundManager.resumeMusic(Sounds.BG_MUSIC);
			SoundManager.musicPlaying = true;
		}
		this.updateButtonState();
		SoundManager.playSound(Sounds.START, {}); // Play feedback sound
	}

	private updateButtonState(): void {
		// Update button alpha based on the current state of music
		this.alpha = SoundManager.isMusicOn() ? 1 : 0.5;
	}

	public getSprWidth(): number {
		return this.spr.width;
	}

	public getSprHeight(): number {
		return this.spr.height;
	}
}
