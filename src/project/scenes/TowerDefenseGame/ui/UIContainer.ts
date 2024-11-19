import { Container, Text } from "pixi.js";
import type { GameStats } from "../utils/GameStats";

export class UIContainer extends Container {
	private pointsText: Text;
	private scoreText: Text;
	private towerCostText: Text; // New text field for tower cost

	constructor() {
		super();
		this.pointsText = new Text(`Puntos: 0`, { fill: "white" });
		this.scoreText = new Text(`Score: 0`, { fill: "yellow" });
		this.towerCostText = new Text(`Costo Torre: 50`, { fill: "red" }); // Initial tower cost

		this.pointsText.position.set(10, 10);
		this.scoreText.position.set(10, 40);
		this.towerCostText.position.set(10, 70); // Adjust position of tower cost text

		this.addChild(this.pointsText);
		this.addChild(this.scoreText);
		this.addChild(this.towerCostText); // Add to UI
	}

	// Actualizar la UI con los valores actuales
	public updateUI(gameStats: GameStats, towerCost: number): void {
		this.pointsText.text = `Puntos: ${gameStats.getPoints()}`;
		this.scoreText.text = `Score: ${gameStats.getScore()}`;
		this.towerCostText.text = `Costo Torre: ${towerCost}`; // Update tower cost display
	}
}
