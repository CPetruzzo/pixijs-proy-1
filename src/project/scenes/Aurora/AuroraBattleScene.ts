import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

export class AuroraBattleScene extends PixiScene {
	private worldContainer = new Container();
	public static readonly BUNDLES = ["aurora-latest", "abandonedhouse"];

	constructor() {
		super();
		this.addChild(this.worldContainer);
		const mockup = Sprite.from("battle3");
		mockup.anchor.set(0.5);
		this.worldContainer.addChild(mockup);
	}

	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.worldContainer.x = w / 2;
		this.worldContainer.y = h / 2;
	}
}
