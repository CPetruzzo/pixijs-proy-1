import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class LoseGameOverScene extends PixiScene {
	private gameContainer: Container = new Container();
	public static readonly BUNDLES = ["abandonedhouse"];
	constructor() {
		super();

		SoundLib.stopAllMusic();
		this.gameContainer.name = "GameOverScene";
		this.addChild(this.gameContainer);
		const gameOverBG = Sprite.from("gameover");
		gameOverBG.anchor.set(0.5);
		this.gameContainer.addChild(gameOverBG);
	}

	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.gameContainer.x = w / 2;
		this.gameContainer.y = h / 2;
	}
}
