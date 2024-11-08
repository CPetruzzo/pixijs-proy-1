import { Container, Sprite, Text } from "pixi.js";
import { ToggleButton } from "./ToggleButton";
import { Manager } from "../../../..";
import { SettingsPopUp } from "../SettingsPopUp";
import { CounterTimer } from "./CounterTimer";

export class UI {
	public rightContainer: Container;
	public leftContainer: Container;
	public leftDownContainer: Container;
	public scoreText: Text;
	public score: number;
	public isPopupOpen: boolean;
	public isPaused: boolean;
	public timeContainer: Container;
	public counterTime: CounterTimer;

	constructor() {
		this.rightContainer = new Container();
		this.rightContainer.name = "UI CONTAINER";

		this.leftContainer = new Container();
		this.leftContainer.name = "SCORE CONTAINER";

		this.leftDownContainer = new Container();
		this.leftDownContainer.name = "POWERUPS CONTAINER";

		this.timeContainer = new Container();
		this.timeContainer.name = "TIME CONTAINER";

		this.score = 0;

		this.setupUIElements();
		this.counterTime = new CounterTimer(50);
		this.timeContainer.addChild(this.counterTime);
	}

	private setupUIElements(): void {
		const info = Sprite.from("info");
		info.anchor.set(0.5);
		info.position.set(-info.width * 0.5, info.height * 0.5);
		this.rightContainer.addChild(info);
		info.eventMode = "static";
		info.on("pointertap", () => this.openSettingsPopup());

		const pause = Sprite.from("pause");
		pause.anchor.set(0.5);
		pause.position.set(-pause.width * 1.5, pause.height * 0.5);
		this.rightContainer.addChild(pause);

		// Ejemplo de uso
		const pausePosition = { x: -info.width * 1.5, y: info.height * 0.5 };
		const pauseButton = new ToggleButton("pauseOn", "pauseOff", pausePosition, this.rightContainer);
		this.rightContainer.addChild(pauseButton);
		pauseButton.on("pointertap", () => {
			this.isPaused = true;
		});

		const sound = Sprite.from("sound");
		sound.anchor.set(0.5);
		sound.position.set(-sound.width * 2.5, sound.height * 0.5);
		this.rightContainer.addChild(sound);

		// Crear texto de puntaje
		const scoreFrame = Sprite.from("scoreFrame");
		scoreFrame.anchor.set(0.5);
		scoreFrame.scale.set(1.5);
		scoreFrame.position.set(scoreFrame.width * 0.5, scoreFrame.height * 0.5);
		this.leftContainer.addChild(scoreFrame);

		const framebasket1 = Sprite.from("framebasket");
		framebasket1.anchor.set(0.5);
		framebasket1.scale.set(1);
		framebasket1.position.set(-framebasket1.width * 0.5, -framebasket1.height * 0.5);
		this.leftDownContainer.addChild(framebasket1);

		const framebasket2 = Sprite.from("framebasket");
		framebasket2.anchor.set(0.5);
		framebasket2.scale.set(1);
		framebasket2.position.set(-framebasket2.width * 1.5, -framebasket2.height * 0.5);
		this.leftDownContainer.addChild(framebasket2);

		const framebasket3 = Sprite.from("framebasket");
		framebasket3.anchor.set(0.5);
		framebasket3.scale.set(1);
		framebasket3.position.set(-framebasket3.width * 2.5, -framebasket3.height * 0.5);
		this.leftDownContainer.addChild(framebasket3);

		const timeFrame = Sprite.from("framebasket");
		timeFrame.anchor.set(0.5);
		timeFrame.scale.set(1);
		timeFrame.position.set(0, timeFrame.height * 0.5);
		this.timeContainer.addChild(timeFrame);

		this.scoreText = new Text(`Score: ${this.score}`, {
			fontSize: 210,
			fill: 0xfdf178,
			dropShadowDistance: 15,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
		});
		this.scoreText.position.set(scoreFrame.x, scoreFrame.y);
		this.scoreText.anchor.set(0.5);

		this.leftContainer.addChild(this.scoreText);
	}

	public updateScore(points: number): void {
		this.score += points;
		this.scoreText.text = `Score: ${this.score}`;
	}

	private async openSettingsPopup(): Promise<void> {
		this.isPopupOpen = true;
		this.isPaused = true;

		try {
			const popupInstance = await Manager.openPopup(SettingsPopUp);
			if (popupInstance instanceof SettingsPopUp) {
				popupInstance.showButtons();
			}
			if (popupInstance instanceof SettingsPopUp) {
				popupInstance.on("RESUME_PAUSE", () => {
					console.log("cerrate loco");
					this.isPaused = false;
					this.isPopupOpen = false;
				});
			}
		} catch (error) {
			console.error("Error opening settings popup:", error);
		}
	}
}
