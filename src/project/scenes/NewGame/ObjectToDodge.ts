import { Graphics } from "pixi.js";
import { PhysicsContainer } from "../../../utils/PhysicsContainer";

export class ObjectToDodge extends PhysicsContainer {
	constructor() {
		super();

		const enemy = new Graphics();
		enemy.beginFill(0xffffff, 0.5);
		enemy.drawCircle(0, 0, 5);
		enemy.endFill();

		this.addChild(enemy);

	}
}