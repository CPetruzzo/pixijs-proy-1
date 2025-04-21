import { Container, Sprite } from "pixi.js";
import { Graphics, Text } from "pixi.js";
import { Tween } from "tweedle.js";

export class Trigger extends Container {
	public triggerZone: Graphics;
	public triggerText: Text | Sprite;

	constructor() {
		super();
	}

	public createTrigger(gameContainer: Container): void {
		this.triggerZone = new Graphics().beginFill(0xff0000, 0.001).drawRect(-125, -20, 150, 40).endFill();
		this.triggerZone.x = -500;
		this.triggerZone.y = 100;
		gameContainer.addChild(this.triggerZone);

		// this.triggerText = new Text("E", { fill: "#fff", fontSize: 48 });
		this.triggerText = Sprite.from("KeyE");
		this.triggerText.anchor.set(0.5);
		this.triggerText.position.set(this.triggerZone.x - this.triggerZone.width / 2 + 30, this.triggerZone.y - 30);
		this.triggerText.visible = false;
		new Tween(this.triggerText.scale).to({ x: 1.1, y: 1.1 }, 500).repeat(Infinity).yoyo(true).start();
		gameContainer.addChild(this.triggerText);
	}

	/**
	 * Crea una zona interactiva y un texto "E" para un contenedor padre.
	 * @param parent El container donde se añadirá la zona y el texto.
	 * @param x Posición X local dentro del parent.
	 * @param y Posición Y local dentro del parent.
	 * @param onActivate Callback que se ejecuta al hacer click.
	 */
	public createPointerTrigger(parent: Container, x: number, y: number, onActivate: () => void): void {
		// Zona invisible pero interactiva
		this.triggerZone = new Graphics().beginFill(0xff0000, 0.001).drawRect(-125, -20, 150, 40).endFill();
		this.triggerZone.position.set(x, y);
		this.triggerZone.eventMode = "static";
		this.triggerZone.on("pointerover", () => (this.triggerText.visible = true));
		this.triggerZone.on("pointerout", () => (this.triggerText.visible = false));
		this.triggerZone.on("pointerdown", onActivate);
		parent.addChild(this.triggerZone);

		// Texto "E" que aparece al pasar el mouse
		this.triggerText = new Text("Click To grab", { fill: "#ffffff", fontSize: 48 });
		this.triggerText.anchor.set(0.5);
		this.triggerText.position.set(x, y - 30);
		this.triggerText.visible = false;
		parent.addChild(this.triggerText);
	}
}
