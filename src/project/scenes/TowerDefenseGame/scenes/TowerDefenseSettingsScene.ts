import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Manager } from "../../../..";
import { TowerDefenseMenuScene } from "./TowerDefenseMainScene";

export class TowerDefenseSettingsScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private mainContainer = new Container();
	private background: Sprite;

	constructor() {
		super();

		this.background = Sprite.from("mainBG");
		this.background.anchor.set(0.5);
		this.addChild(this.background);

		this.addChild(this.mainContainer);
		const mainBG = Sprite.from("TD_settings");
		mainBG.anchor.set(0.5);
		this.mainContainer.addChild(mainBG);

		const settingsBack = Sprite.from("settingsBack");
		settingsBack.anchor.set(0.5);
		settingsBack.x = 177;
		settingsBack.y = 206;
		this.mainContainer.addChild(settingsBack);

		settingsBack.eventMode = "static";
		settingsBack.on("pointertap", () => {
			Manager.changeScene(TowerDefenseMenuScene);
		});
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.mainContainer, newW, newH, 766, 736, ScaleHelper.FIT);
		this.mainContainer.x = newW * 0.5;
		this.mainContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.background, newW, newH, 766, 736, ScaleHelper.FIT);
		this.background.x = newW * 0.5;
		this.background.y = newH * 0.5;
	}
}
