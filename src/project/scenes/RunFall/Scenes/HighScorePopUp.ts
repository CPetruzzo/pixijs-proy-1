import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Sprite } from "@pixi/sprite";
import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import { Keyboard } from "../../../../engine/input/Keyboard";
import { Manager } from "../../../..";
import { Timer } from "../../../../engine/tweens/Timer";
import type { Button } from "@pixi/ui";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { DodgeScene } from "./DodgeScene";
import { Text } from "pixi.js";

interface HighscoreEntry {
	playerName: string;
	score: number;
}

const localStorageKey = "highscores";
let highscores: HighscoreEntry[] = [];

export class HighScorePopUp extends PixiScene {
	// assets
	private fadeAndBlocker: Graphics;
	private resetButton: Graphics;
	public background: Sprite;
	public buttons: Button[];
	// leveldata
	public readonly level: any;
	public levelNumber: number;
	public levelTime: number;
	// booleans
	public closing: boolean = false;
	public restart: boolean = false;
	public pauseScene: boolean = false;

	constructor(_score?: number) {
		super();

		this.fadeAndBlocker = new Graphics();
		this.fadeAndBlocker.beginFill(0x000000, 0.5);
		this.fadeAndBlocker.drawRect(0, 0, 1500, 1500);
		this.fadeAndBlocker.endFill();
		this.fadeAndBlocker.interactive = true;
		this.fadeAndBlocker.pivot.set(this.fadeAndBlocker.width * 0.5, this.fadeAndBlocker.height * 0.5);
		this.addChild(this.fadeAndBlocker);
		this.fadeAndBlocker.scale.set(10);

		this.background = Sprite.from("popupimg");
		this.background.anchor.set(0.5);
		this.addChild(this.background);
	}

	// Método para manejar el clic en el botón de reinicio
	private handleResetClick(): void {
		this.restart = true;
		SoundLib.playSound("sound_confirm", { allowOverlap: false, singleInstance: true, loop: false });
		this.closePopup();
	}

	// Método para manejar el clic en el botón de cerrar
	private handleResetClickMenu(): void {
		SoundLib.playSound("sound_confirm", { allowOverlap: false, singleInstance: true, loop: false });
		this.closePopupMenu();
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async showNameInputDialog(): Promise<string> {
		const playerName = prompt("Enter your name:");
		return playerName || "Player"; // Si no se ingresa un nombre, se usa "Player" por defecto
	}

	public override onStart(): void {
		const storedHighscores = localStorage.getItem(localStorageKey);
		console.log('storedHighscores', storedHighscores)
		if (storedHighscores) {
			highscores = JSON.parse(storedHighscores);
		}

		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		const fadeScale = new Tween(this.fadeAndBlocker).to({ scale: { x: 35, y: 15 } });
		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);
		const elasticAnimation = new Tween(this.background).to({ scale: { x: 7, y: 7 } }, 1000).easing(Easing.Elastic.Out);

		elasticAnimation.onStart(() => {
			SoundLib.playSound("beep", {});
		});
		elasticAnimation.onComplete(() => {
			this.background.interactiveChildren = true;
			if (this.pauseScene) {
				Keyboard.shared.pressed.once("Escape", this.closePopup.bind(this));
			}
		});
		fadeAnimation.chain(elasticAnimation);
		fadeAnimation.start();
		fadeScale.chain(fadeAnimation);
		fadeScale.start();
	}

	public async showHighscores(playerScore: number): Promise<void> {
		const playerName = await this.showNameInputDialog();

		const title = new Text("Highscores", { fontSize: 100, fill: 0xffffff, fontFamily: "Darling Coffee" });
		title.anchor.set(0.5);
		title.position.set(this.background.width * 0.5, -330);
		this.background.addChild(title);

		// Guardar el puntaje del jugador actual
		highscores.push({ playerName, score: playerScore });

		highscores.sort((a, b) => b.score - a.score);
		localStorage.setItem(localStorageKey, JSON.stringify(highscores));

		// Mostrar los highscores en la tabla
		const startY = 50;
		const lineHeight = 90;
		for (let i = 0; i < Math.min(highscores.length, 5); i++) {
			const entry = highscores[i];
			const entryText = new Text(`${entry.playerName}: ${entry.score}`, { fontSize: 80, fill: 0xffffff, align: "center", fontFamily: "Darling Coffee" });
			entryText.anchor.set(0, 0.5);
			entryText.position.set(-220, startY + i * lineHeight - 220);
			this.background.addChild(entryText);
			if (entry.score === playerScore) {
				entryText.tint = 0xff0000;
				new Tween(entryText).to({ alpha: 0 }, 500).start().repeat(Infinity).yoyo(true).yoyoEasing(Easing.Linear.None);
				entryText.style.align = "center";
			}
		}

		// Mostrar el botón de reinicio
		this.resetButton = new Graphics();
		this.resetButton.beginFill(0x808080);
		this.resetButton.drawRoundedRect(0, 0, 380, 150, 50);
		this.resetButton.endFill();
		this.resetButton.pivot.set(this.resetButton.width * 0.5, this.resetButton.height * 0.5);
		this.resetButton.eventMode = "static";
		this.resetButton.position.set(this.background.width * 0.5, this.background.height + 350); // Posiciona el botón según sea necesario
		this.resetButton.on("pointertap", this.handleResetClick, this); // Agrega un manejador de eventos al hacer clic en el botón
		this.background.addChild(this.resetButton); // Agrega el botón al background

		const tryagain = new Text("Try Again", { fontSize: 70, fill: 0xffffff, fontFamily: "Darling Coffee" });
		tryagain.y = this.resetButton.height * 0.5;
		tryagain.x = this.resetButton.width * 0.5;
		tryagain.anchor.set(0.5)
		// tryagain.anchor.set(0.5);
		this.resetButton.addChild(tryagain);
	}

	public async showHighscoresMenu(): Promise<void> {

		const title = new Text("Highscores", { fontSize: 100, fill: 0xffffff, fontFamily: "Darling Coffee" });
		title.anchor.set(0.5);
		title.position.set(this.background.width * 0.5, -330);
		this.background.addChild(title);

		highscores.sort((a, b) => b.score - a.score);
		localStorage.setItem(localStorageKey, JSON.stringify(highscores));

		// Mostrar los highscores en la tabla
		const startY = 50;
		const lineHeight = 90;
		for (let i = 0; i < Math.min(highscores.length, 5); i++) {
			const entry = highscores[i];
			const entryText = new Text(`${entry.playerName}: ${entry.score}`, { fontSize: 80, fill: 0xffffff, align: "center", fontFamily: "Darling Coffee" });
			entryText.anchor.set(0, 0.5);
			entryText.position.set(-220, startY + i * lineHeight - 220);
			this.background.addChild(entryText);
		}

		// Mostrar el botón de reinicio
		this.resetButton = new Graphics();
		this.resetButton.beginFill(0x808080);
		this.resetButton.drawRoundedRect(0, 0, 350, 150, 50);
		this.resetButton.endFill();
		this.resetButton.pivot.set(this.resetButton.width * 0.5, this.resetButton.height * 0.5);
		this.resetButton.eventMode = "static";
		this.resetButton.position.set(this.background.width * 0.5, this.background.height + 350); // Posiciona el botón según sea necesario
		this.resetButton.on("pointertap", this.handleResetClickMenu, this); // Agrega un manejador de eventos al hacer clic en el botón
		this.background.addChild(this.resetButton); // Agrega el botón al background

		const tryagain = new Text("Close", { fontSize: 70, fill: 0xffffff, fontFamily: "Darling Coffee" });
		tryagain.y = this.resetButton.height * 0.5;
		tryagain.x = this.resetButton.width * 0.5;
		tryagain.anchor.set(0.5)
		// tryagain.anchor.set(0.5);
		this.resetButton.addChild(tryagain);
	}

	public override requestClose(_doSomething?: () => void): Promise<boolean> {
		this.closing = true;
		return new Promise((resolve) => {
			this.background.interactiveChildren = false;

			const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 0 }, 500);
			const elasticAnimation = new Tween(this.background).to({ scale: { x: 0, y: 0 } }, 1000).easing(Easing.Elastic.In);

			fadeAnimation.onComplete(() => {
				Keyboard.shared.pressed.off("Escape", this.closePopup.bind(this));
				this.closeHandler(_doSomething);
				resolve(true);

				if (this.restart) {
					Manager.changeScene(DodgeScene);
				}
			});

			elasticAnimation.chain(fadeAnimation);
			elasticAnimation.start();
		});
	}

	public closePopup(): void {
		if (this.closing) {
			return;
		}
		this.requestClose();
	}

	public closePopupMenu(): void {
		if (this.closing) {
			return;
		}
		this.requestClose();
	}

	public override onResize(_newW: number, _newH: number): void {
		this.fadeAndBlocker.width = _newW;
		this.fadeAndBlocker.height = _newH;

		ScaleHelper.setScaleRelativeToIdeal(this, _newW * 0.1, _newH * 0.1, 720, 1600, ScaleHelper.FIT);
		this.x = _newW * 0.5;
		this.y = _newH * 0.5;
	}

	public backToSelector(): void {
		SoundLib.playSound("beep", {});
		this.requestClose();
		new Timer()
			.to(1000)
			.start()
			.onComplete(() => {
				this.closeHandler();
				Manager.changeScene(DodgeScene);
			});
	}
}
