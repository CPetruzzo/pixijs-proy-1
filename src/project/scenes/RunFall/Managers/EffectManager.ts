import { GlowFilter } from "@pixi/filter-glow";
import { Timer } from "../../../../engine/tweens/Timer";
import type { Filter } from "pixi.js";
import { BlurFilter } from "pixi.js";

export class EffectManager {
	private player: any;
	private background: any;
	private blurFilter: BlurFilter;
	private stunFilter: GlowFilter;
	private glowFilter: GlowFilter;

	public glowInnerValue: number = 1;

	constructor(player: any, background?: any) {
		this.player = player;
		this.background = background;
		this.glowFilter = new GlowFilter({ innerStrength: this.glowInnerValue });
		this.blurFilter = new BlurFilter(20);
		this.stunFilter = new GlowFilter({ color: 0xfff888 });
	}

	public applyFilter(target: any, filter: Filter, duration: number, onComplete: () => void): void {
		if (target) {
			target.filters = [filter];
			new Timer().to(duration).start().onComplete(onComplete);
		}
	}

	private clearFilters(target: any): void {
		if (target) {
			target.filters = [];
		}
	}

	public causeBlur(duration: number): void {
		this.applyFilter(this.background, this.blurFilter, duration, () => this.clearFilters(this.background));
	}

	public causeStun(duration: number): void {
		this.applyFilter(this.player, this.stunFilter, duration, () => this.clearFilters(this.player));
	}

	public speedingPowerUp(duration: number): void {
		this.applyFilter(this.player, this.glowFilter, duration, () => this.clearFilters(this.player));
	}
}
