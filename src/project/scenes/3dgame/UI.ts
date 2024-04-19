import type { Container } from "pixi.js";
import { Text, TextStyle } from "pixi.js";

export class UI {
	private container: Container;
	private explanationText: Text;

	constructor(container: Container) {
		this.container = container;

		const textStyle = new TextStyle({
			fill: "white",
			fontFamily: "Arial Rounded MT",
			stroke: "black",
			strokeThickness: 10,
			lineJoin: "round",
		});

		this.explanationText = new Text("", textStyle);
		this.container.addChild(this.explanationText);
	}

	public updateText(movementInstructions: string, carInstructions: string, carControlInstructions: string, generalInstructions: string): void {
		const text = `Movement Instructions:\n${movementInstructions}\n\nCar Instructions:\n${carInstructions}\n${carControlInstructions}\n\nGeneral Instructions:\n${generalInstructions}`;
		this.explanationText.text = text;
	}
}
