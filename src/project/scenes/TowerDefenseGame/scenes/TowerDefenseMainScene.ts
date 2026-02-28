import { TowerDefenseSettingsScene } from "./TowerDefenseSettingsScene";
import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Manager } from "../../../..";
import { TowerDefenseScene } from "./TowerDefenseScene";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export class TowerDefenseMenuScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private mainContainer = new Container();
	private background: Sprite;
	constructor() {
		super();

		this.background = Sprite.from("mainBG");
		this.background.anchor.set(0.5);
		this.addChild(this.background);

		SoundLib.playMusic("TD_MAIN_BGM", { loop: true, volume: 0.2 });
		this.addChild(this.mainContainer);
		const mainBG = Sprite.from("TD_menuBG");
		mainBG.anchor.set(0.5);
		this.mainContainer.addChild(mainBG);

		const play = Sprite.from("TD_play");
		play.anchor.set(0.5);
		play.x = -7;
		play.y = 92;
		play.eventMode = "static";
		play.on("pointertap", () => {
			SoundLib.playSound("sword-slide", {});
			Manager.changeScene(TowerDefenseScene);
		});
		this.mainContainer.addChild(play);

		const settings = Sprite.from("TD_settingsBTN");
		settings.anchor.set(0.5);
		settings.x = -5;
		settings.y = 192;
		settings.eventMode = "static";
		settings.on("pointertap", () => {
			Manager.changeScene(TowerDefenseSettingsScene);
		});
		this.mainContainer.addChild(settings);
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
