import { Container, Sprite, Text } from "pixi.js";
import type { GameStats } from "../utils/GameStats";

export class UIContainer extends Container {
	private pointsText: Text;
	private scoreText: Text;
	private towerCostText: Text; // New text field for tower cost

	constructor() {
		super();
		this.pointsText = new Text(`Puntos: 0`, { fill: "white", fontFamily: "DK Boarding House III", align: "left" });
		this.pointsText.anchor.set(0.5);
		this.scoreText = new Text(`Score: 0`, { fill: "white", fontFamily: "DK Boarding House III", align: "left" });
		this.scoreText.anchor.set(0.5);
		this.towerCostText = new Text(`Costo Torre: 50`, { fill: "white", fontFamily: "DK Boarding House III", align: "left" }); // Initial tower cost
		this.towerCostText.anchor.set(0.5);

		const uiFrame = Sprite.from("uiFrame");
		uiFrame.anchor.set(0.5);
		uiFrame.scale.set(1.4);
		uiFrame.position.set(uiFrame.width * 0.39, uiFrame.height * 0.39);
		this.addChild(uiFrame);

		this.pointsText.position.set(0, -30);
		this.scoreText.position.set(0, 0);
		this.towerCostText.position.set(0, 30); // Adjust position of tower cost text

		uiFrame.addChild(this.pointsText);
		uiFrame.addChild(this.scoreText);
		uiFrame.addChild(this.towerCostText);
	}

	// Actualizar la UI con los valores actuales
	public updateUI(gameStats: GameStats, towerCost: number): void {
		this.pointsText.text = `Puntos: ${gameStats.getPoints()}`;
		this.scoreText.text = `Score: ${gameStats.getScore()}`;
		this.towerCostText.text = `Costo Torre: ${towerCost}`; // Update tower cost display
	}
}
