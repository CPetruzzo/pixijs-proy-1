import type { Sprite } from "pixi.js";
import { ToggleButton } from "./ToggleButton";
import { SoundManager, Sounds } from "../../RunFall/Managers/SoundManager";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export class SoundButton extends ToggleButton {
	public soundState: boolean;
	constructor(
		pausePosition: { x: number; y: number },
		parentContainer: {
			addChild: (arg0: Sprite) => void;
		}
	) {
		super("sound", "soundToggleOff", pausePosition, parentContainer);
	}

	public override toggleToOn(): void {
		console.log("toggleToOn called");
		this.onSprite.alpha = 1;
		this.offSprite.alpha = 0;
		this.offSprite.eventMode = "none";
		this.onSprite.eventMode = "static";
		this.soundState = false;
		// Lógica para desactivar la música
		SoundLib.muteSound = false;
		SoundManager.sfxPlaying = true;
		SoundManager.resumeMusic(Sounds.BASKET_MUSIC);
		SoundManager.musicPlaying = true;
	}

	public override toggleToOff(): void {
		console.log("toggleToOff called");
		this.onSprite.alpha = 0;
		this.offSprite.alpha = 1;
		this.onSprite.eventMode = "none";
		this.offSprite.eventMode = "static";
		console.log("onSprite alpha:", this.onSprite.alpha, "| offSprite alpha:", this.offSprite.alpha);
		this.soundState = true;
		// Lógica para activar la música
		SoundLib.muteSound = true;
		SoundManager.sfxPlaying = false;
		SoundManager.pauseMusic(Sounds.BASKET_MUSIC);
		SoundManager.musicPlaying = false;
	}
}
