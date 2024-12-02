import { Container, Sprite, Text } from "pixi.js";
import type { GameStats } from "../utils/GameStats";

export class UIContainer extends Container {
	private pointsText: Text;
	private scoreText: Text;
	private towerCostText: Text;
	private totalDamageText: Text; // Nuevo campo para el daño total

	constructor() {
		super();

		this.pointsText = new Text(`Puntos: 0`, { fill: "white", fontFamily: "DK Boarding House III", align: "left" });
		this.pointsText.anchor.set(0.5);

		this.scoreText = new Text(`Score: 0`, { fill: "white", fontFamily: "DK Boarding House III", align: "left" });
		this.scoreText.anchor.set(0.5);

		this.towerCostText = new Text(`Costo Torre: 50`, { fill: "white", fontFamily: "DK Boarding House III", align: "left" });
		this.towerCostText.anchor.set(0.5);

		this.totalDamageText = new Text(`Daño Total: 0`, { fill: "white", fontFamily: "DK Boarding House III", align: "left" });
		this.totalDamageText.anchor.set(0.5); // Inicializa con 0

		const uiFrame = Sprite.from("uiFrame");
		uiFrame.anchor.set(0.5);
		uiFrame.scale.set(1.4);
		uiFrame.position.set(uiFrame.width * 0.39, uiFrame.height * 0.39);
		this.addChild(uiFrame);

		this.pointsText.position.set(0, -45);
		this.scoreText.position.set(0, -15);
		this.towerCostText.position.set(0, 15);
		this.totalDamageText.position.set(0, 45); // Posición para el daño total

		uiFrame.addChild(this.pointsText);
		uiFrame.addChild(this.scoreText);
		uiFrame.addChild(this.towerCostText);
		uiFrame.addChild(this.totalDamageText); // Agrega el texto al contenedor
	}

	// Actualizar la UI con los valores actuales
	public updateUI(gameStats: GameStats, towerCost: number, totalDamage: number): void {
		this.pointsText.text = `Puntos: ${gameStats.getPoints()}`;
		this.scoreText.text = `Score: ${gameStats.getScore()}`;
		this.towerCostText.text = `Costo Torre: ${towerCost}`;
		this.totalDamageText.text = `Daño Total: ${totalDamage}`; // Actualiza el daño total
	}
}
