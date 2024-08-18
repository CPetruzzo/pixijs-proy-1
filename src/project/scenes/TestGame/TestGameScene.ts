import { Sprite, Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class TestGameScene extends PixiScene {

	public static readonly BUNDLES = ["package-1"];
	constructor() {
		super();

		const spr = Sprite.from("player1");
		this.addChild(spr);

		const aux = new Graphics();
		aux.beginFill(0x00ffff, 1);
		aux.drawRect(0, 0, 15, 15);
		aux.endFill();
		this.addChild(aux);
	}
}