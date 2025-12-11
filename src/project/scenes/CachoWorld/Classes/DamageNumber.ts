import { Text, TextStyle } from "pixi.js";
import { Tween, Easing } from "tweedle.js";

export class DamageNumber extends Text {
	private tween: Tween<DamageNumber>;

	constructor(damage: number, x: number, y: number) {
		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 24,
			fill: "red",
			fontWeight: "bold",
			stroke: "black",
			strokeThickness: 3,
		});

		super(`-${damage}`, textStyle);
		this.anchor.set(0.5);
		this.x = x;
		this.y = y;
		this.alpha = 1;

		// Create tween animation
		this.tween = new Tween(this)
			.to({ y: y - 50, alpha: 0 }, 1000) // Move up 50 pixels and fade out in 1 second
			.easing(Easing.Quadratic.Out) // Smooth easing
			.onComplete(() => {
				// Remove from parent when complete
				if (this.parent) {
					this.parent.removeChild(this);
				}
				this.destroy();
			})
			.start();
	}

	public override destroy(_options?: any): void {
		// Stop tween if still running
		if (this.tween) {
			this.tween.stop();
		}
		super.destroy(_options);
	}
}
