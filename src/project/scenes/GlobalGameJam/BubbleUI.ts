import { Container, Text } from "pixi.js";

export class UIContainerRight extends Container {
	private distanceText: Text;
	private distance: number = 0;

	constructor() {
		super();

		this.distanceText = new Text(`Distancia: ${this.distance.toFixed(1)}`, {
			fill: "white",
			fontFamily: "DK Boarding House III",
			align: "left",
			fontSize: 50,
			lineHeight: 50,
			dropShadow: true,
			dropShadowColor: "black",
		});
		this.distanceText.anchor.set(1, 0.5);

		this.distanceText.position.set(20 + this.distanceText.width, 50);

		this.addChild(this.distanceText);
	}

	public updateScore(dt: number): void {
		this.distance += dt * 0.001;
		this.distanceText.text = `Distancia: ${this.distance.toFixed(1)}`;
	}

	public saveScore(): void {
		const savedScores = localStorage.getItem("highscores");
		let scores: number[] = savedScores ? JSON.parse(savedScores) : [];

		scores.push(this.distance);

		scores = scores.sort((a, b) => b - a).slice(0, 5);

		localStorage.setItem("highscores", JSON.stringify(scores));
	}

	public resetScore(): void {
		this.distance = 0;
		this.distanceText.text = `Distancia: ${this.distance.toFixed(1)}`;
	}

	public getHighScores(): number[] {
		const savedScores = localStorage.getItem("highscores");
		return savedScores ? JSON.parse(savedScores) : [];
	}
}
