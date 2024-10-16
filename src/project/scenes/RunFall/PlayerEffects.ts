import { GlowFilter } from "@pixi/filter-glow";
import { Timer } from "../../../engine/tweens/Timer";
import { BlurFilter } from "pixi.js";

export class PlayerEffects {
	private player: any;
	private background: any;
	private blurFilter: BlurFilter;
	private stunFilter: GlowFilter;
	private glow: GlowFilter;

	constructor(player: any, background: any) {
		this.player = player;
		this.background = background;
		this.glow = new GlowFilter();
		this.blurFilter = new BlurFilter(20);
		this.stunFilter = new GlowFilter({ color: 0xfff888 });
	}

	public causeBlur(duration: number): void {
		this.background.filters = [this.blurFilter];

		new Timer()
			.to(duration)
			.start()
			.onComplete(() => {
				this.recoverFromBlur();
			});
	}

	public causeStun(duration: number): void {
		this.player.filters = [this.stunFilter];

		new Timer()
			.to(duration)
			.start()
			.onComplete(() => {
				this.stopFiltersOnCharacter();
			});
	}

	public speedingPowerUp(duration: number): void {
		this.player.filters = [this.glow];

		new Timer()
			.to(duration)
			.start()
			.onComplete(() => {
				this.stopFiltersOnCharacter();
			});
	}

	private recoverFromBlur(): void {
		this.background.filters = [];
	}

	private stopFiltersOnCharacter(): void {
		this.player.filters = [];
	}
}
