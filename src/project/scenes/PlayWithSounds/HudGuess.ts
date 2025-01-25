import { Container } from "@pixi/display";
import { Manager } from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// import { Intermission } from "./Intermission";
// import { PopUpAnimal } from "./PopUpAnimal";
import { PopUpGuess } from "./PopUpGuess";
import { Chooser } from "./Scenes/Chooser";
import { SimpleButton } from "../../../engine/button/SimpleButton";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class HudGuess extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];
	public static readonly START_EVENT: string = "ButtonStart";
	public static readonly PAUSE_EVENT: string = "ButtonPause";

	private uiContainer: Container;
	private btnOpenPlay: SimpleButton;
	private btnClose: SimpleButton;
	private btnOpenPopup3: SimpleButton;
	private btnPause: SimpleButton;

	constructor() {
		super();

		this.btnOpenPlay = new SimpleButton("b_7", () => this.startGuessing());
		this.btnOpenPlay.scale.set(0.5);
		this.btnOpenPlay.position.set(500, 0);

		this.btnPause = new SimpleButton("b_6", () => this.pauseGuessing());
		this.btnPause.scale.set(0.5);
		this.btnPause.position.set(500, 0);
		this.btnPause.visible = false;

		this.btnClose = new SimpleButton("button_1", () => this.backToStart());
		this.btnClose.position.set(300, 0);
		this.btnClose.scale.set(0.3);

		this.btnOpenPopup3 = new SimpleButton("questionMark", () => this.openPopup());
		this.btnOpenPopup3.scale.set(0.1);
		this.btnOpenPopup3.position.set(100, 0);

		this.uiContainer = new Container();
		this.uiContainer.addChild(this.btnOpenPlay, this.btnClose, this.btnOpenPopup3, this.btnPause);
		this.uiContainer.pivot.set(this.uiContainer.width / 2, this.uiContainer.height / 2);
		this.uiContainer.position.set(0, 0);

		this.addChild(this.uiContainer);
	}

	private startGuessing(): void {
		this.emit(HudGuess.START_EVENT as any);
		console.log(HudGuess.START_EVENT);
		this.btnOpenPlay.visible = false;
		this.btnPause.visible = true;
	}

	private pauseGuessing(): void {
		this.emit(HudGuess.PAUSE_EVENT as any);
		console.log(HudGuess.PAUSE_EVENT);
		this.btnOpenPlay.visible = true;
		this.btnPause.visible = false;
	}

	private backToStart(): void {
		Manager.changeScene(Chooser);
	}

	private openPopup(): void {
		SoundLib.pauseMusic("farm-sfx");
		Manager.openPopup(PopUpGuess);
	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.uiContainer, newW, newH, 1, 1, ScaleHelper.FIT);
	}
}
