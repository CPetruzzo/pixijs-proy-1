import { Container } from "pixi.js";
import { ProgressBar } from "../../../engine/progressbar/ProgressBar";

export class UIContainerMiddle extends Container {
	public hpBar: ProgressBar;
	public currentPoints: number = 250;
	constructor() {
		super();

		this.hpBar = new ProgressBar({
			background: "bar_1",
			texture: "bar_2",
			cap: "bubbleknob",
			initialValue: this.currentPoints,
			maxValue: 500,
			minValue: 0,
		});
		this.hpBar.scale.set(0.3);
		this.hpBar.position.set(0, 100);

		this.addChild(this.hpBar);
	}
}
