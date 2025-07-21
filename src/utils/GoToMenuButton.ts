import type { Container } from "pixi.js";
import { Graphics, Text, TextStyle } from "pixi.js";
import { CachoMenuScene } from "../project/scenes/CachoMenuScene";
import { Manager } from "..";

/**
 * Crea un botón flotante que envía al menú principal.
 * @param parent Contenedor padre, usualmente la escena.
 * @param x Posición X (default 10)
 * @param y Posición Y (default 10)
 */
export function addGoToMenuButton(parent: Container, x = 10, y = 10): void {
	const button = new Graphics();
	button.beginFill(0x222222, 0.7);
	const width = 120;
	const height = 40;
	button.drawRoundedRect(0, 0, width, height, 8);
	button.endFill();
	button.eventMode = "static";
	button.cursor = "pointer";
	button.x = x;
	button.y = y;

	const textStyle = new TextStyle({
		fontFamily: "Arial",
		fontSize: 14,
		fill: "#ffffff",
	});
	const label = new Text("GoToMenu", textStyle);
	label.anchor.set(0.5);
	label.x = width / 2;
	label.y = height / 2;
	button.addChild(label);

	button.on("pointerdown", () => {
		Manager.changeScene(CachoMenuScene, { sceneParams: [] });
	});

	parent.addChild(button);
}
