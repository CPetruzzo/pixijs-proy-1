import { SoundLib } from "../../../../engine/sound/SoundLib";

export enum Sounds {
	COIN = "sound_collectable",
	ENEMY = "sound_hit",
	POWERUP = "sound_big_award",
	POTION = "sound_award",
	OBSTACLE = "sound_block",
	OPENPOUP = "sound6",
	CLOSEPOPUP = "punchy5",
	START = "modern",
	BG_MUSIC = "sound_BGM",
	BASKET_MUSIC = "courtBGM",
	CHANGETAB = "immersive",
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
