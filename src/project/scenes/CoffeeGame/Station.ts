import { Container, Sprite, Text } from "pixi.js";

export class Station extends Container {
	public bg: Sprite;
	constructor(public type: string, x: number, y: number) {
		super();
		this.x = x;
		this.y = y;
		this.bg = Sprite.from(`station-${type}`);
		this.bg.anchor.set(0.5);
		this.bg.scale.set(0.5);
		this.addChild(this.bg);
		const label = new Text(type, { fill: "#000", fontSize: 18 });
		label.anchor.set(0.5, -0.5);
		this.addChild(label);
	}
}
