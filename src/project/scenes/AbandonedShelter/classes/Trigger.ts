import { Container } from "pixi.js";
import { Graphics, Text } from "pixi.js";

export class Trigger extends Container {
	public triggerZone: Graphics;
	public triggerText: Text;

	constructor() {
		super();
	}

	public createTrigger(gameContainer: Container): void {
		this.triggerZone = new Graphics().beginFill(0xff0000, 0.001).drawRect(-125, -20, 150, 40).endFill();
		this.triggerZone.x = -500;
		this.triggerZone.y = 100;
		gameContainer.addChild(this.triggerZone);

		this.triggerText = new Text("E", { fill: "#fff", fontSize: 48 });
		this.triggerText.anchor.set(0.5);
		this.triggerText.position.set(this.triggerZone.x - this.triggerZone.width / 2 + 30, this.triggerZone.y - 30);
		this.triggerText.visible = false;
		gameContainer.addChild(this.triggerText);
	}
}
