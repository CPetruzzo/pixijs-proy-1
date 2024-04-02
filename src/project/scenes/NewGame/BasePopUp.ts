import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Sprite } from "@pixi/sprite";
import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Manager } from "../../..";
import { Timer } from "../../../engine/tweens/Timer";
import { Button } from "@pixi/ui";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { DodgeScene } from "./DodgeScene";
import { Text } from "pixi.js";

interface HighscoreEntry {
	playerName: string;
	score: number;
}

const localStorageKey = "highscores";
let highscores: HighscoreEntry[] = [];

export interface PopupOptions {
	title: string;
	buttonLabels: string[];
	buttonCallbacks: (() => void)[];
}

export class BasePopup extends PixiScene {
	public static readonly BUNDLES = ["fallrungame", "sfx"];

	private fadeAndBlocker: Graphics;
	public background: Sprite;
	public buttons: Button[];
	public closing: boolean = false;
	public restart: boolean = false;
	public readonly level: any;
	public levelNumber: number;
	public pauseScene: boolean = false;
	public levelTime: number;
	private scoreText: Text;
	private score: number;
	private resetButton: Graphics;

	constructor(_score?: number) {
		super();

		this.fadeAndBlocker = new Graphics();
		this.fadeAndBlocker.beginFill(0x000000, 0.5);
		this.fadeAndBlocker.drawRect(0, 0, 1, 1);
		this.fadeAndBlocker.endFill();
		this.fadeAndBlocker.interactive = true;
		this.fadeAndBlocker.pivot.set(this.fadeAndBlocker.width * 0.5, this.fadeAndBlocker.height * 0.5);
		this.addChild(this.fadeAndBlocker);

		this.background = Sprite.from("package 1 background");
		this.background.anchor.set(0.5);
		this.background.scale.set(0.5);
		this.addChild(this.background);

		const buttonPopUp = new Graphics();
		buttonPopUp.beginFill(0x808080);
		buttonPopUp.drawRect(0, 0, 45, 45);
		buttonPopUp.endFill();
		this.background.addChild(buttonPopUp);
		buttonPopUp.eventMode = "static";
		buttonPopUp.on("pointertap", () => {
			this.closePopup();
		});

		if (_score) {
			this.score = _score;
			this.scoreText = new Text(`Score: ${this.score}`, { fontSize: 80, fill: 0xffffff });
			this.scoreText.anchor.set(0.5);
			this.scoreText.position.set(0, -this.background.height * 0.5);
			this.addChild(this.scoreText);
		}
	}

	// Método para manejar el clic en el botón de reinicio
	private handleResetClick(): void {
		// Lógica para reiniciar el juego, por ejemplo:
		this.restart = true; // Marca la bandera para reiniciar el juego
		this.closePopup(); // Cierra el popup para que el juego se reinicie
	}

	// Método para mostrar el cuadro de diálogo para ingresar el nombre del jugador
	private async showNameInputDialog(): Promise<string> {
		const playerName = prompt("Enter your name:");
		return playerName || "Player"; // Si no se ingresa un nombre, se usa "Player" por defecto
	}

	public override onStart(): void {

		// Recuperar highscores del localStorage al iniciar el popup
		const storedHighscores = localStorage.getItem(localStorageKey);
		if (storedHighscores) {
			highscores = JSON.parse(storedHighscores);
		}

		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);

		const elasticAnimation = new Tween(this.background).to({ scale: { x: 4.5, y: 4.5 } }, 1000).easing(Easing.Elastic.Out);

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
	}

	public async showHighscores(playerScore: number): Promise<void> {
		const playerName = await this.showNameInputDialog(); // Obtener el nombre del jugador

		const table = new Graphics();
		table.beginFill(0xffffff);
		table.drawRect(0, 0, 1000, 1000);
		table.endFill();
		table.pivot.set(table.width * 0.5, table.height * 0.5);
		table.position.set(this.background.x, this.background.y);
		this.background.addChild(table);

		const title = new Text("Highscores", { fontSize: 100, fill: 0x000000 });
		title.anchor.set(0.5);
		title.position.set(table.width * 0.5, 50);
		table.addChild(title);

		// Guardar el puntaje del jugador actual
		highscores.push({ playerName, score: playerScore });

		// Ordenar highscores por puntaje de mayor a menor
		highscores.sort((a, b) => b.score - a.score);

		// Guardar highscores en localStorage
		localStorage.setItem(localStorageKey, JSON.stringify(highscores));
		// Mostrar los highscores en la tabla
		const startY = 50;
		const lineHeight = 90;
		for (let i = 0; i < Math.min(highscores.length, 5); i++) {
			const entry = highscores[i];
			const entryText = new Text(`${entry.playerName}: ${entry.score}`, { fontSize: 80, fill: 0x000000 });
			entryText.anchor.set(0, 0.5);
			entryText.position.set(20, startY + i * lineHeight + 200);
			table.addChild(entryText);
			if (entry.score === playerScore) {
				// Tintar de rojo el puntaje actual del jugador
				entryText.tint = 0xff0000;
			}
		}

		// Mostrar el botón de reinicio
		this.resetButton = new Graphics();
		this.resetButton.beginFill(0x808080);
		this.resetButton.drawRect(0, 0, 350, 150);
		this.resetButton.endFill();
		this.resetButton.pivot.set(this.resetButton.width * 0.5, this.resetButton.height * 0.5);
		this.resetButton.eventMode = "static";
		this.resetButton.position.set(table.width * 0.5, table.height - 150); // Posiciona el botón según sea necesario
		this.resetButton.on("pointertap", this.handleResetClick, this); // Agrega un manejador de eventos al hacer clic en el botón
		table.addChild(this.resetButton); // Agrega el botón al contenedor del popup

		const tryagain = new Text("Try again", { fontSize: 80, fill: 0x000000 });
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
