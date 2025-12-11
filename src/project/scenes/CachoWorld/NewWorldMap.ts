import { Container, Sprite } from "pixi.js";

export class NewWorldMap extends Container {
	constructor() {
		super();
		// Agregar elementos específicos del mapa aquí
		const backgroundSprite1 = Sprite.from("house");
		backgroundSprite1.anchor.set(0.5);
		backgroundSprite1.cullable = false;
		this.addChild(backgroundSprite1);
	}
}
