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
		// Incrementa la distancia con base en dt (puedes ajustar la velocidad multiplicadora)
		this.distance += dt * 0.001; // Cambia el multiplicador según la escala deseada

		// Actualiza el texto mostrado
		this.distanceText.text = `Distancia: ${this.distance.toFixed(1)}`;
	}

	/**
	 * Guarda la distancia en localStorage cuando el jugador pierde.
	 */
	public saveScore(): void {
		// Obtén los puntajes anteriores del localStorage
		const savedScores = localStorage.getItem("highscores");
		let scores: number[] = savedScores ? JSON.parse(savedScores) : [];

		// Agrega el puntaje actual
		scores.push(this.distance);

		// Ordena los puntajes de mayor a menor y guarda solo los 5 mejores (opcional)
		scores = scores.sort((a, b) => b - a).slice(0, 5);

		// Guarda los puntajes actualizados en localStorage
		localStorage.setItem("highscores", JSON.stringify(scores));
	}

	/**
	 * Resetea la distancia (opcional, para reiniciar el juego).
	 */
	public resetScore(): void {
		this.distance = 0;
		this.distanceText.text = `Distancia: ${this.distance.toFixed(1)}`;
	}

	public getHighScores(): number[] {
		const savedScores = localStorage.getItem("highscores");
		return savedScores ? JSON.parse(savedScores) : [];
	}
}
