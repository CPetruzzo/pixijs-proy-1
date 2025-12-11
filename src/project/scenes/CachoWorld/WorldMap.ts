import { Container, Sprite } from "pixi.js";

export class WorldMap extends Container {
	constructor() {
		super();

		const backgroundSprite1 = Sprite.from("background");
		backgroundSprite1.anchor.set(0.5);
		backgroundSprite1.scale.set(3);
		backgroundSprite1.cullable = false;
		this.addChild(backgroundSprite1);
	}
}
