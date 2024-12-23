import { Container, Graphics } from "pixi.js";

export class NewWorldMap extends Container {
	constructor() {
		super();
		// Agregar elementos específicos del mapa aquí
		const background = new Graphics();
		background.beginFill(0x66ccff); // Color de fondo
		background.drawRect(0, 0, 800, 600); // Tamaño del fondo
		background.endFill();
		this.addChild(background);
	}
}
