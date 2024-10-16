import { Container, Graphics, Text, TextStyle } from "pixi.js";

export class Button extends Container {
	private buttonBackground: Graphics;
	private buttonText: Text;

	constructor(label: string, width: number, height: number, onClick: () => void) {
		super();

		// Crear el fondo del botón
		this.buttonBackground = new Graphics();
		this.buttonBackground.beginFill(0x252525);
		this.buttonBackground.drawRoundedRect(-width / 2, -height / 2, width, height, 10);
		this.buttonBackground.endFill();
		this.addChild(this.buttonBackground);

		// Crear el texto del botón
		const style = new TextStyle({ fill: "#ffffff", fontFamily: "Darling Coffee" });
		this.buttonText = new Text(label, style);
		this.buttonText.anchor.set(0.5);
		this.addChild(this.buttonText);

		// Manejar el evento de clic
		this.eventMode = "static";
		this.on("pointerdown", onClick);
		this.alpha = 0.5;
	}

	public setLabel(label: string): void {
		this.buttonText.text = label;
	}
}
