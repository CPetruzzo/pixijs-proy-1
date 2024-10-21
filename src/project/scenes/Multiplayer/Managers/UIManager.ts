import { Text, Container } from "pixi.js";

export class UIManager {
	private playerText: Text;
	private opponentText: Text;

	constructor(container: Container) {
		this.playerText = new Text("Jugador: ", { fontSize: 24, fill: 0x000000 });
		this.opponentText = new Text("Rival: ", { fontSize: 24, fill: 0x000000 });

		this.playerText.x = 10;
		this.playerText.y = 10;
		this.opponentText.x = 10;
		this.opponentText.y = 40;

		container.addChild(this.playerText);
		container.addChild(this.opponentText);
	}

	public updatePlayerSymbols(playerSymbol: string, opponentSymbol: string) {
		this.playerText.text = `Jugador: ${playerSymbol}`;
		this.opponentText.text = `Rival: ${opponentSymbol}`;
	}
}
