import { Graphics } from "pixi.js";
import { ObjectToDodge } from "./ObjectToDodge";

export class NegativeObjectToDodge extends ObjectToDodge {
	constructor() {
		super();

		const enemy = new Graphics();
		enemy.beginFill(0x0000ff);
		enemy.drawCircle(0, 0, 10);
		enemy.endFill();

		this.addChild(enemy);
	}
}
