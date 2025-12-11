import { TowerDefenseSettingsScene } from "./TowerDefenseSettingsScene";
import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Manager } from "../../../..";
import { TowerDefenseScene } from "./TowerDefenseScene";
import { GameConfig } from "../game/GameConfig";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export class TowerDefenseMenuScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private mainContainer = new Container();
	constructor() {
		super();

		SoundLib.playMusic("TD_MAIN_BGM", { loop: true, volume: 0.2 });
		this.addChild(this.mainContainer);
		const mainBG = Sprite.from("TD_menuBG");
		mainBG.anchor.set(0.5);
		this.mainContainer.addChild(mainBG);

		const play = Sprite.from("TD_play");
		play.anchor.set(0.5);
		play.x = 6;
		play.y = 92;
		play.eventMode = "static";
		play.on("pointertap", () => {
			Manager.changeScene(TowerDefenseScene);
		});
		this.mainContainer.addChild(play);

		const settings = Sprite.from("TD_settingsBTN");
		settings.anchor.set(0.5);
		settings.x = 6;
		settings.y = 192;
		settings.eventMode = "static";
		settings.on("pointertap", () => {
			Manager.changeScene(TowerDefenseSettingsScene);
		});
		this.mainContainer.addChild(settings);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.mainContainer, newW, newH, GameConfig.idealWidth, GameConfig.idealHeight, ScaleHelper.FIT);
		this.mainContainer.x = newW * 0.5;
		this.mainContainer.y = newH * 0.5;
	}
}
