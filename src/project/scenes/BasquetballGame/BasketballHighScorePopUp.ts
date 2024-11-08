import type { Button } from "@pixi/ui";
import { Graphics, Sprite, Text } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { Keyboard } from "../../../engine/input/Keyboard";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Sounds } from "../RunFall/Managers/SoundManager";
import { Manager } from "../../..";
import { BasquetballMainScene } from "./BasquetballMainScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";

interface HighscoreEntry {
	playerName: string;
	score: number;
}

const localStorageKey = "basketballHighscores";
let highscores: HighscoreEntry[] = [];

export class BasketballHighScorePopUp extends PixiScene {
	// assets
	private fadeAndBlocker: Graphics;
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
	public totalPoints: number;
	public doublesPoints: number = 10;
	public triplesPoints: number = 1;
	public cleanShotsPoints: number = 0;

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

		this.background = Sprite.from("gameoverBG");
		this.background.anchor.set(0.5);
		this.addChild(this.background);
	}

	// Método para manejar el clic en el botón de reinicio
	private handleResetClick(): void {
		this.restart = true;
		SoundLib.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopup();
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async showNameInputDialog(): Promise<string> {
		const playerName = prompt("Enter your name:");
		return playerName || "Player"; // Si no se ingresa un nombre, se usa "Player" por defecto
	}

	public override onStart(): void {
		const storedHighscores = localStorage.getItem(localStorageKey);
		console.log("storedHighscores", storedHighscores);
		if (storedHighscores) {
			highscores = JSON.parse(storedHighscores);
		}

		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		const fadeScale = new Tween(this.fadeAndBlocker).to({ scale: { x: 35, y: 15 } });
		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);
		const elasticAnimation = new Tween(this.background)
			.from({ scale: { x: 17, y: 17 }, y: 15000 })
			.to({ scale: { x: 17, y: 17 }, y: 0 }, 1000)
			.easing(Easing.Elastic.Out);

		elasticAnimation.onStart(() => {
			SoundLib.playSound(Sounds.OPENPOUP, {});
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

		// Guardar el puntaje del jugador actual
		highscores.push({ playerName, score: playerScore });

		highscores.sort((a, b) => b.score - a.score);
		localStorage.setItem(localStorageKey, JSON.stringify(highscores));

		// Mostrar los highscores en la tabla
		const startY = 60;
		const lineHeight = 90;
		for (let i = 0; i < Math.min(highscores.length, 5); i++) {
			const entry = highscores[i];
			const entryText = new Text(`${entry.playerName}: ${entry.score}`, {
				fontSize: 50,
				fill: 0xffffff,
				align: "center",
				dropShadow: true,
				fontFamily: "DK Boarding House III",
			});
			entryText.anchor.set(0.5, 0.5);
			entryText.position.set(0, startY + i * lineHeight - 220);
			this.background.addChild(entryText);
			if (entry.score === playerScore) {
				entryText.tint = 0xfdf178;
				new Tween(entryText).to({ alpha: 0 }, 500).start().repeat(Infinity).yoyo(true).yoyoEasing(Easing.Linear.None);
				entryText.style.align = "center";
			}
		}

		const returnbasket = Sprite.from("returnbasket");
		returnbasket.anchor.set(0.5);
		returnbasket.scale.set(1.1);
		returnbasket.x = 0;
		returnbasket.y = 310;
		returnbasket.eventMode = "static";
		returnbasket.on("pointertap", () => this.handleResetClick());
		this.background.addChild(returnbasket);
	}

	public showPlayerScore(): void {
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const createText = (content: string, fontSize: number, color: number, x: number, y: number, align: "left" | "right" = "left") => {
			const text = new Text(content, {
				fontSize,
				fill: color,
				dropShadow: true,
				dropShadowColor: 0x000000,
				align,
				fontFamily: "DK Boarding House III",
			});
			text.x = x;
			text.y = y;
			this.background.addChild(text);
			return text;
		};

		const baseX = -265;
		const pointsX = 170;
		const multiplierX = 220;

		// Display Doubles
		createText("Doubles", 50, 0xffffff, baseX, -170);
		createText(`${this.doublesPoints}`, 50, 0xffffff, pointsX, -170, "right");
		createText("x2", 20, 0xfdf178, multiplierX, -145, "right");

		// Display Triples
		createText("Triples", 50, 0xffffff, baseX, -80);
		createText(`${this.triplesPoints}`, 50, 0xffffff, pointsX, -80, "right");
		createText("x3", 20, 0xfdf178, multiplierX, -55, "right");

		// Display Clean Shots
		createText("Clean Shots", 50, 0xffffff, baseX, 20);
		createText(`${this.cleanShotsPoints}`, 50, 0xffffff, pointsX, 20, "right");
		createText("x5", 20, 0xfdf178, multiplierX, 55, "right");

		this.totalPoints = this.cleanShotsPoints * 5 + this.triplesPoints * 3 + this.doublesPoints * 2;
		// Display Total
		createText("Total", 50, 0xffffff, baseX, 120);
		createText(`${this.totalPoints}`, 50, 0xffffff, pointsX, 120, "right");

		// Add Return Button
		const returnBasket = Sprite.from("returnbasket");
		returnBasket.anchor.set(0.5);
		returnBasket.scale.set(1.1);
		returnBasket.position.set(0, 310);
		returnBasket.eventMode = "static";
		returnBasket.on("pointertap", () => this.handleResetClick());
		this.background.addChild(returnBasket);
	}

	public override requestClose(_doSomething?: () => void): Promise<boolean> {
		this.closing = true;
		return new Promise((resolve) => {
			this.background.interactiveChildren = false;

			const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 0 }, 500);
			const elasticAnimation = new Tween(this.background)
				.to(
					{
						scale: { x: 17, y: 17 },
						y: 15000,
						alpha: 0,
					},
					1000
				)
				.easing(Easing.Elastic.In);

			fadeAnimation.onComplete(() => {
				Keyboard.shared.pressed.off("Escape", this.closePopup.bind(this));
				this.closeHandler(_doSomething);
				resolve(true);

				if (this.restart) {
					Manager.changeScene(BasquetballMainScene, { transitionClass: FadeColorTransition, transitionParams: [] });
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

		ScaleHelper.setScaleRelativeToIdeal(this, _newW * 0.11, _newH * 0.11, 720, 1600, ScaleHelper.FIT);
		this.x = _newW * 0.5;
		this.y = _newH * 0.5;
	}
}
