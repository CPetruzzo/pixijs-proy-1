import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Text } from "@pixi/text";
import { Easing, Tween } from "tweedle.js";
import { Manager } from "../../../..";
import { DataManager } from "../../../../engine/datamanager/DataManager";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { Timer } from "../../../../engine/tweens/Timer";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { AnimalButtonsGuess } from "../AnimalButtonsGuess";
import { HudGuess } from "../HudGuess";
import { Nubes } from "../Nubes";
import { FinishGuessScene } from "./FinishGuessScene";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ProgressBar } from "../../../../engine/progressbar/ProgressBar";

export class GuessShapes extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];

	private sceneContainer: Container;
	private bg: Sprite;
	private ui: HudGuess;
	private animalButtons: AnimalButtonsGuess;
	private nubes: Nubes[];
	private movingContainer: Container;
	private gameSpeed: number = 6500;

	private timePassed: number = 0;
	private shapes: string[];
	public currentAnimal: string;

	public globalTimePassed: number = 0;
	public gameOver: boolean = false;
	public currentPoints: number = 0;
	private pointsOnScreen: Text;
	public alreadyClicked: boolean = false;
	public leftTime: number;
	private progress: ProgressBar;
	private maxPoints: number = 600;
	private win: boolean = false;
	public start: boolean = false;
	public pause: boolean = false;

	constructor() {
		super();

		this.movingContainer = new Container();
		this.movingContainer.position.set(0, -600);

		this.bg = Sprite.from("BG9");
		this.bg.scale.set(1.05, 0.81);

		this.ui = new HudGuess();
		this.ui.position.set(1680, 160);
		this.ui.scale.set(0.8);
		this.ui.on("ButtonStart" as any, () => {
			this.start = true;
			this.pause = false;
			this.animalButtons.interactiveYes();
		});
		this.ui.on("ButtonPause" as any, () => {
			this.pause = true;
			this.animalButtons.interactiveNo();
		});

		this.animalButtons = new AnimalButtonsGuess();
		this.animalButtons.position.set(1100, 750);
		this.animalButtons.on("CLICKED_ANIMAL" as any, (clicked: string) => {
			if (!this.alreadyClicked) {
				if (clicked == this.currentAnimal) {
					this.gameSpeed -= 500;
					this.alreadyClicked = true;
					this.currentPoints += 50;
					if (this.currentPoints >= this.maxPoints) {
						this.currentPoints = this.maxPoints;
						this.win = true;
					}
					this.pointsOnScreen.text = `${this.currentPoints}` + "Points";
					this.animalButtons.interactiveNo();
					SoundLib.playSound("success-sfx", { loop: false });
					Timer.delay(this.leftTime, () => {
						this.alreadyClicked = false;
						this.animalButtons.interactiveYes();
					});
				} else {
					this.gameSpeed = 6500;
					SoundLib.playSound("beep", { loop: false });
					this.alreadyClicked = true;
					this.pointsOnScreen.text = `${this.currentPoints}` + "Points";
					this.animalButtons.interactiveNo();
					Timer.delay(this.leftTime, () => {
						this.alreadyClicked = false;
						this.animalButtons.interactiveYes();
					});
				}
			}
		});

		this.progress = new ProgressBar({
			background: "bar_1",
			texture: "bar_2",
			cap: "s1",
			initialValue: this.currentPoints,
			maxValue: this.maxPoints,
			minValue: 0,
		});
		this.progress.scale.set(0.3);
		this.progress.position.set(1000, 100);

		this.sceneContainer = new Container();
		this.sceneContainer.addChild(this.bg, this.ui, this.animalButtons, this.progress);
		this.sceneContainer.pivot.set(this.sceneContainer.width / 2, this.sceneContainer.height / 2);

		this.addChild(this.sceneContainer, this.movingContainer);

		this.nubes = [];

		this.shapes = ["chooserSheep", "horseCloud", "cowCloud", "duckCloud", "rooster", "pig"];

		let currentPoints: number;
		this.pointsOnScreen = new Text(`${currentPoints}` + "Points", { fontSize: 40, fontFamily: "Arial" });
		this.pointsOnScreen.text = `${this.currentPoints}` + "Points";
		this.pointsOnScreen.position.set(this.sceneContainer.width / 2, 50);
		// this.sceneContainer.addChild(this.pointsOnScreen)
	}

	public override update(dt: number): void {
		// Si ya ganaste, hacer la transición una sola vez
		if (this.win && !this.gameOver) {
			this.gameOver = true;
			// guardo tiempo en DataManager (milisegundos)
			DataManager.setValue("timeTaken", this.globalTimePassed);
			// FinalPoints ya lo venía seteando; por si acaso lo guardo otra vez
			DataManager.setValue("FinalPoints", this.currentPoints);

			Manager.changeScene(FinishGuessScene);
			return;
		}

		if (this.pause) {
			return;
		}

		this.leftTime = this.gameSpeed - this.timePassed;

		this.timePassed += dt;
		this.globalTimePassed += dt;

		this.progress.updateValue(this.currentPoints, 200);
		DataManager.setValue("FinalPoints", this.currentPoints);

		if (this.timePassed > this.gameSpeed && this.start) {
			this.globalTimePassed += dt;
			this.timePassed = 0;
			const newCloud = this.shapes[Math.floor(Math.random() * this.shapes.length)];

			const cloud = new Nubes(newCloud);
			cloud.alpha = 0.8;

			DataManager.setValue("animal", newCloud);
			cloud.position.x = 600;
			cloud.scale.set(0.3);

			this.moveUp(cloud);

			this.nubes.push(cloud);
			this.movingContainer.addChild(cloud);

			if (this.globalTimePassed > 1000) {
				this.globalTimePassed = 0;
			}
		}

		this.currentAnimal = DataManager.getValue("animal");

		for (const nube of this.nubes) {
			nube.speed.x = -0.2;
			nube.update(dt);
		}
	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.sceneContainer, newW, newH, 1, 1, ScaleHelper.FIT);
	}

	private moveUp(cloud: Nubes): void {
		new Tween(cloud).from({ y: 400 }).to({ y: 300 }, 1000).easing(Easing.Sinusoidal.In).start().onComplete(this.moveDown.bind(this));
	}

	private moveDown(cloud: Nubes): void {
		new Tween(cloud).from({ y: 300 }).to({ y: 400 }, 1000).easing(Easing.Sinusoidal.In).start().onComplete(this.moveUp.bind(this));
	}
}
