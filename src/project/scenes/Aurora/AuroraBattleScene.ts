import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class AuroraBattleScene extends PixiScene {
	private worldContainer = new Container();
	constructor() {
		super();

		const mockup = Sprite.from("battle1");
		this.worldContainer.addChild(mockup);
	}
}
