import { Container, Graphics, Text, TextStyle } from "pixi.js";

export class GameOverContainer extends Container {
	private respawnButton: Container;
	constructor(respawn: () => void) {
		super();
		const gameOverText = new Text("Game Over", new TextStyle({ fill: "red", fontSize: 50 }));
		gameOverText.anchor.set(0.5);
		this.visible = false;
		this.createRespawnButton(respawn);
	}

	private createRespawnButton(respawn: () => void): void {
		this.respawnButton = new Container();

		const buttonBg = new Graphics();
		buttonBg.beginFill(0x333333, 0.8);
		buttonBg.drawRoundedRect(0, 0, 150, 50, 10);
		buttonBg.endFill();
		this.respawnButton.addChild(buttonBg);

		const style = new TextStyle({
			fill: "white",
			fontSize: 20,
			fontFamily: "Arial",
		});
		const buttonText = new Text("Respawn", style);
		buttonText.anchor.set(0.5);
		this.respawnButton.addChild(buttonText);

		this.respawnButton.interactive = true;
		this.respawnButton.on("pointerdown", () => respawn());
		this.addChild(this.respawnButton);
	}

	public showRespawnButton(): void {
		this.visible = true;
		this.respawnButton.visible = true;
	}

	public hideRespawnButton(): void {
		this.visible = false;
		this.respawnButton.visible = false;
	}
}
