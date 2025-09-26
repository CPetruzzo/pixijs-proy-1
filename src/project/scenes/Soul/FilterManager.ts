import type { GlowFilterOptions } from "@pixi/filter-glow";
import { GlowFilter } from "@pixi/filter-glow";
import { Easing, Tween } from "tweedle.js";

export class FilterManager {
	private glow: GlowFilter;
	constructor() {
		this.glow = new GlowFilter();
	}

	public applyGlowFilter(applyTo: any, _params?: Partial<GlowFilterOptions>): void {
		this.glow = new GlowFilter({
			distance: _params.distance,
			outerStrength: _params.outerStrength,
			color: _params.color,
			alpha: _params.alpha,
			innerStrength: _params.innerStrength,
			knockout: _params.knockout,
			quality: _params.quality,
		});
		applyTo.filters = [this.glow];
		new Tween(this.glow)
			.to({ outerStrength: 0.8, distance: 25 }, 1000) // sube a 3 en 1s
			.yoyo(true) // vuelve a 0.5
			.repeat(Infinity) // repite siempre
			.easing(Easing.Quadratic.InOut)
			.start();
	}
}
