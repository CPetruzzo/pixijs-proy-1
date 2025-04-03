import { Container, Sprite } from "pixi.js";
import { Easing, Tween } from "tweedle.js";

export class Flag extends Container {
	constructor(parentContainer: Container, posX: number, posY: number, asset: string, skew: number, scale: number = 0.25) {
		super();
		const flag = Sprite.from(asset);
		flag.anchor.set(0.5);
		flag.alpha = 0.8;
		flag.scale.set(scale);
		flag.position.set(posX, posY);
		parentContainer.addChild(flag);

		// Configuramos un inicio aleatorio para el skew (por ejemplo, entre 0 y un tercio del valor objetivo)
		flag.skew.x = Math.random() * (skew / 3);

		// Calculamos duraciones base y le sumamos un offset aleatorio entre -50 y +50 ms
		const skewDuration = 1000 + (Math.random() * 100 - 50);
		const posDuration = 2000 + (Math.random() * 100 - 50);

		// Tween para oscilar la propiedad skew.x (efecto de bandera al viento)
		new Tween(flag.skew).to({ x: skew }, skewDuration).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start();

		// Tween para oscilar la posición (ligero movimiento lateral y vertical)
		new Tween(flag.position)
			.to({ x: posX + 5, y: posY + 5 }, posDuration)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true)
			.repeat(Infinity)
			.start();
	}
}
