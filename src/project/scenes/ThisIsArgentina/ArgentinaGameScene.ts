import { Manager } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Aborigen } from "./Classes/Aborigen";

export class GameScene extends PixiScene {
	private aborigen: Aborigen;

	constructor() {
		super();
		this.createScene();
	}

	private createScene(): void {
		this.aborigen = new Aborigen();
		this.aborigen.x = Manager.width * 0.5;
		this.aborigen.y = Manager.height * 0.5;
		this.addChild(this.aborigen);
	}

	public override update(_dt: number): void { }
}
