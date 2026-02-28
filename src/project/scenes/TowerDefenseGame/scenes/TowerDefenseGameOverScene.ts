import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Manager } from "../../../..";
import { TowerDefenseMenuScene } from "./TowerDefenseMainScene";
import { TowerDefenseScene } from "./TowerDefenseScene";
import { Tween } from "tweedle.js";

export class TowerDefenseGameOverScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private mainContainer = new Container();
	private background: Sprite;

	constructor() {
		super();

		this.background = Sprite.from("mainBG");
		this.background.anchor.set(0.5);
		this.addChild(this.background);

		this.addChild(this.mainContainer);
		const mainBG = Sprite.from("TD_gameover");
		mainBG.anchor.set(0.5);
		this.mainContainer.addChild(mainBG);

		const gameOver = Sprite.from("TD_resetBTN");
		gameOver.anchor.set(0.5);
		gameOver.y = 193;
		gameOver.x = -7;
		gameOver.alpha = 0;
		gameOver.eventMode = "static";
		this.mainContainer.addChild(gameOver);
		gameOver.on("pointerdown", () => {
			Manager.changeScene(TowerDefenseScene); // Reiniciar la escena
		});

		const menu = Sprite.from("TD_menu");
		menu.anchor.set(0.5);
		menu.x = -7;
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
		ScaleHelper.setScaleRelativeToIdeal(this.mainContainer, newW, newH, 766, 735, ScaleHelper.FIT);
		this.mainContainer.x = newW * 0.5;
		this.mainContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.background, newW, newH, 766, 736, ScaleHelper.FIT);
		this.background.x = newW * 0.5;
		this.background.y = newH * 0.5;
	}
}
