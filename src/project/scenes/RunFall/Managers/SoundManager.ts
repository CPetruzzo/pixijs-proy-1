import { SoundLib } from "../../../../engine/sound/SoundLib";

export enum Sounds {
	COIN = "sound_collectable",
	ENEMY = "sound_hit",
	POWERUP = "sound_big_award",
	POTION = "sound_award",
	OBSTACLE = "sound_block",
	OPENPOUP = "sound6",
	CLOSEPOPUP = "sound1",
	START = "sound4",
	BG_MUSIC = "sound_BGM",
}

export class SoundManager extends SoundLib {
	public static sfxPlaying: boolean = true;
	public static musicPlaying: boolean = true;
	constructor() {
		super();
	}

	public static isSoundOn(): boolean {
		return this.sfxPlaying;
	}

	public static isMusicOn(): boolean {
		return this.musicPlaying;
	}
}
