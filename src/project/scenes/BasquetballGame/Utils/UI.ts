import { Container, Sprite, Text } from "pixi.js";
import { ToggleButton } from "./ToggleButton";
import { Manager } from "../../../..";
import { SettingsPopUp } from "../SettingsPopUp";

export class UI {
	public rightContainer: Container;
	public leftContainer: Container;
	public scoreText: Text;
	public score: number;
	public isPopupOpen: boolean;
	public isPaused: boolean;

	constructor() {
		this.rightContainer = new Container();
		this.rightContainer.name = "UI CONTAINER";

		this.leftContainer = new Container();
		this.leftContainer.name = "SCORE CONTAINER";

		this.score = 0;

		this.setupUIElements();
	}

	private setupUIElements(): void {
		const info = Sprite.from("info");
		info.anchor.set(0.5);
		info.position.set(-info.width, info.height);
		this.rightContainer.addChild(info);
		info.eventMode = "static";
		info.on("pointertap", () => this.openSettingsPopup());

		const pause = Sprite.from("pause");
		pause.anchor.set(0.5);
		pause.position.set(-pause.width * 2, pause.height);
		this.rightContainer.addChild(pause);

		// Ejemplo de uso
		const pausePosition = { x: -info.width * 2, y: info.height };
		const pauseButton = new ToggleButton("pauseOn", "pauseOff", pausePosition, this.rightContainer);
		this.rightContainer.addChild(pauseButton);

		const sound = Sprite.from("sound");
		sound.anchor.set(0.5);
		sound.position.set(-sound.width - info.width - info.width, sound.height);
		this.rightContainer.addChild(sound);

		// Crear texto de puntaje
		const scoreFrame = Sprite.from("scoreFrame");
		scoreFrame.anchor.set(0.5);
		scoreFrame.position.set(scoreFrame.width, scoreFrame.height);
		this.leftContainer.addChild(scoreFrame);

		this.scoreText = new Text(`Score: ${this.score}`, { fontSize: 130, fill: 0xf48e44, dropShadow: true, dropShadowColor: 0x000000, fontFamily: "Darling Coffee" });
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
