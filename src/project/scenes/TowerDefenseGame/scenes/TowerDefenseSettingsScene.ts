import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";

export class TowerDefenseSettingsScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private mainContainer = new Container();
	constructor() {
		super();

		this.addChild(this.mainContainer);
		const mainBG = Sprite.from("TD_settings");
		mainBG.anchor.set(0.5);
		this.mainContainer.addChild(mainBG);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.mainContainer, newW, newH, 740, 740, ScaleHelper.FIT);
		this.mainContainer.x = newW * 0.5;
		this.mainContainer.y = newH * 0.5;
	}
}
