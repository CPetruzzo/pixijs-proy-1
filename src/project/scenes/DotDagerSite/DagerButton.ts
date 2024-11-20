import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Easing, Tween } from "tweedle.js";

export class DagerButton extends Container {
	private buttonBackground: Graphics;
	private buttonText: Text;
	private initialWidth: number;
	private initialHeight: number;

	constructor(label: string, width: number, height: number, onClick: () => void) {
		super();

		this.initialWidth = width;
		this.initialHeight = height;

		// Crear el fondo del botón
		this.buttonBackground = new Graphics();
		this.buttonBackground.lineStyle(2, 0x42f5d7); // Línea de borde
		this.buttonBackground.beginFill(0x121212); // Fondo oscuro
		this.buttonBackground.drawRoundedRect(-width / 2, -height / 2, width, height, 12);
		this.buttonBackground.endFill();
		this.addChild(this.buttonBackground);

		// Crear el texto del botón
		const style = new TextStyle({
			fill: "#42f5d7", // Texto en color turquesa
			fontSize: 16,
			fontWeight: "bold",
			fontFamily: "Poppins, Arial, sans-serif",
		});
		this.buttonText = new Text(label, style);
		this.buttonText.anchor.set(0.5);
		this.addChild(this.buttonText);

		// Manejar eventos
		this.eventMode = "static";
		this.on("pointerdown", () => {
			onClick();
			new Tween(this.buttonBackground).to({ alpha: 0.5 }, 100).yoyo(true).repeat(1).start();
		});

		this.on("pointerover", () => {
			new Tween(this.buttonBackground)
				.to({ width: this.initialWidth * 1.1, height: this.initialHeight * 1.1 }, 200)
				.easing(Easing.Quadratic.InOut)
				.start();
		});

		this.on("pointerout", () => {
			new Tween(this.buttonBackground).to({ width: this.initialWidth, height: this.initialHeight }, 200).easing(Easing.Quadratic.InOut).start();
		});
	}

	public setLabel(label: string): void {
		this.buttonText.text = label;
	}
}
