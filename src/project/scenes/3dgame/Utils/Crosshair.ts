import { Container, Graphics } from "pixi.js";

export class Crosshair extends Container {
	public crosshair: Graphics;
	constructor(circleRadius: number = 200, screenW: number, screenH: number) {
		super();
		this.createCrosshair(circleRadius, screenW, screenH);
	}

	private createCrosshair(circleRadius: number, screenW: number, screenH: number): void {
		this.crosshair = new Graphics();

		const cross = new Graphics();
		cross.lineStyle(2, 0xff0000, 1);
		// Línea horizontal
		cross.moveTo(-10, 0);
		cross.lineTo(10, 0);
		// Línea vertical
		cross.moveTo(0, -10);
		cross.lineTo(0, 10);
		this.crosshair.addChild(cross);

		// Para facilitar el posicionamiento, centraremos el gráfico en (0,0)
		// y luego posicionaremos el contenedor (crosshairContainer) en el centro de la pantalla.
		this.crosshair.x = 0;
		this.crosshair.y = 0;

		// Dibuja un rectángulo grande que cubra la pantalla, centrado en (0,0).
		// Esto se hace usando coordenadas negativas hasta positivas.
		this.crosshair.beginFill(0x000000, 0.8); // Color negro, opacidad 0.8 (ajustable)
		this.crosshair.drawRect(-screenW / 2, -screenH / 2, screenW, screenH);

		// Comienza a definir la forma a "restar" (el agujero)
		this.crosshair.beginHole();
		// Dibuja un círculo en el centro (0,0) con el radio deseado
		this.crosshair.drawCircle(0, 0, circleRadius);
		this.crosshair.endHole();

		this.crosshair.endFill();

		// Ahora, aseguramos que el contenedor del crosshair esté centrado en la pantalla.
		// Por ejemplo, en onResize podrías hacer:
		this.x = screenW / 2;
		this.y = screenH / 2;

		// Agrega el crosshair al contenedor
		this.addChild(this.crosshair);
	}
}
