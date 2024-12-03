import type { Container } from "pixi.js";
import { Sprite } from "pixi.js";
import { Manager } from "../../../..";
import { TowerDefenseScene } from "../scenes/TowerDefenseScene";

export class RestartButton {
	public static createRestartButton(uiRightContainer: Container, cleanupBeforeRestart: () => void): void {
		const resetBG = Sprite.from("resetButton");
		resetBG.anchor.set(0.5);
		resetBG.x = resetBG.width * 0.5 - resetBG.width;
		resetBG.y = resetBG.height * 0.5;

		const restartButton = Sprite.from("resetButtonPressed");
		restartButton.anchor.set(0.5);
		restartButton.x = restartButton.width * 0.5 - resetBG.width;
		restartButton.y = resetBG.height * 0.5;
		restartButton.interactive = true;

		restartButton.on("pointerdown", () => {
			cleanupBeforeRestart();
			Manager.changeScene(TowerDefenseScene);
		});

		uiRightContainer.addChild(resetBG, restartButton);
	}
}
