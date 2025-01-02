import { Container, Sprite } from "pixi.js";

export class WorldMap extends Container {
	constructor() {
		super();

		const backgroundSprite1 = Sprite.from("background");
		backgroundSprite1.anchor.set(0.5);
		backgroundSprite1.cullable = false;
		this.addChild(backgroundSprite1);

		const backgroundSprite2 = Sprite.from("background");
		backgroundSprite2.position.set(0, backgroundSprite1.height);
		backgroundSprite2.anchor.set(0.5);
		backgroundSprite2.cullable = false;
		this.addChild(backgroundSprite2);

		const backgroundSprite3 = Sprite.from("background");
		backgroundSprite3.position.set(backgroundSprite1.width, backgroundSprite1.height);
		backgroundSprite3.anchor.set(0.5);
		backgroundSprite3.cullable = false;
		this.addChild(backgroundSprite3);

		const backgroundSprite4 = Sprite.from("background");
		backgroundSprite4.position.set(backgroundSprite1.width, 0);
		backgroundSprite4.anchor.set(0.5);
		backgroundSprite4.cullable = false;
		this.addChild(backgroundSprite4);
	}
}