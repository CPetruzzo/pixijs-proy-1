import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Manager } from "../../../..";
import { TowerDefenseMenuScene } from "./TowerDefenseMainScene";
import { TowerDefenseScene } from "./TowerDefenseScene";
import { Tween } from "tweedle.js";
import { GameConfig } from "../game/GameConfig";

export class TowerDefenseGameOverScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private mainContainer = new Container();
	constructor() {
		super();

		this.addChild(this.mainContainer);
		const mainBG = Sprite.from("TD_gameover");
		mainBG.anchor.set(0.5);
		this.mainContainer.addChild(mainBG);

		const gameOver = Sprite.from("TD_resetBTN");
		gameOver.anchor.set(0.5);
		gameOver.y = 193;
		gameOver.x = 6;
		gameOver.alpha = 0;
		gameOver.eventMode = "static";
		this.mainContainer.addChild(gameOver);
		gameOver.on("pointerdown", () => {
			Manager.changeScene(TowerDefenseScene); // Reiniciar la escena
		});

		const menu = Sprite.from("TD_menu");
		menu.anchor.set(0.5);
		menu.x = 6;
		menu.y = 296;
		menu.eventMode = "static";
		menu.on("pointertap", () => {
			Manager.changeScene(TowerDefenseMenuScene);
		});
		this.mainContainer.addChild(menu);

		new Tween(mainBG).to({ alpha: 1 }, 500).start();
		new Tween(gameOver).to({ alpha: 1 }, 500).start();
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.mainContainer, newW, newH, GameConfig.idealWidth, GameConfig.idealHeight, ScaleHelper.FIT);
		this.mainContainer.x = newW * 0.5;
		this.mainContainer.y = newH * 0.5;
	}
}
