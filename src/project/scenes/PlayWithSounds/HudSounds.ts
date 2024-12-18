
import { Container } from "@pixi/display";
// import { sound } from "@pixi/sound";
// import { Text, TextStyle } from "@pixi/text";
import { Tween } from "tweedle.js";
import { Manager } from "../../..";
import { DataManager } from "../../../engine/datamanager/DataManager";
import { SoundLib } from "../../../engine/sound/SoundLib";
// import { ToggleCheck } from "../../../engine/ui/toggle/ToggleCheck";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// import { Intermission } from "./Intermission";
import { PopUpAnimal } from "./PopUpAnimal";
import { AnimalSounds } from "./Scenes/AnimalSounds";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { SimpleButton } from "../../../engine/button/SimpleButton";

export class HudSounds extends PixiScene {

	public static readonly BUNDLES = ["playWithSounds"];

	private uiContainer: Container;
	private btnOpenPlay: SimpleButton;
	private btnBack: SimpleButton;
	private info: SimpleButton;
	public tunes: string[];
	currentAnimal: string;
	// private mute: ToggleCheck;
	// private soundPlus: SimpleButton;
	// private soundMinus: SimpleButton;

	constructor() {
		super();

		this.btnOpenPlay = new SimpleButton("b_7", () => this.playRandomSound());
		this.btnOpenPlay.scale.set(0.5);
		this.btnOpenPlay.position.set(500, 0)

		this.btnBack = new SimpleButton("button_1", () => this.waiting());
		this.btnBack.position.set(300, 0);
		this.btnBack.scale.set(0.3);

		this.info = new SimpleButton("questionMark", () => this.openPopup());
		this.info.scale.set(0.1);
		this.info.position.set(100, 0)

		this.uiContainer = new Container();
		this.uiContainer.addChild(
			this.btnOpenPlay,
			this.btnBack,
			this.info,
		);
		this.uiContainer.pivot.set(this.uiContainer.width / 2, this.uiContainer.height / 2);
		this.uiContainer.position.set(0, 0);

		this.addChild(this.uiContainer);

		this.tunes = [
			"rooster-sfx",
			"duck-sfx",
			"pig-sfx",
			"horse-sfx",
			"sheep-sfx",
			"cow-sfx"
		];
	}

	private waiting() {
		new Tween(this.uiContainer).to(10000).start().onComplete(this.backToStart.bind(this));
	}

	private backToStart() {
		Manager.changeScene(AnimalSounds);
	}

	private openPopup(): void {
		SoundLib.pauseMusic("farm-sfx");
		SoundLib.pauseMusic("chooserMusic");
		Manager.openPopup(PopUpAnimal);
	}

	public playRandomSound(): void {

		let audiopath = (this.tunes[Math.floor(Math.random() * this.tunes.length)])

		SoundLib.playMusic(audiopath, { loop: false, volume: 2 });

		DataManager.setValue("animal", audiopath);

		this.currentAnimal = DataManager.getValue("animal")
		this.emit("The animal was:" as any, this.currentAnimal);

		console.log(DataManager.getValue("animal"));
		console.log(this.currentAnimal)
	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.uiContainer, newW, newH, 1, 1, ScaleHelper.FIT);
	}

}