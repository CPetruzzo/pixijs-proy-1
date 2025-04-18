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
import { NameInputPopUp } from "./Utils/NameInputPopUp";

interface HighscoreEntry {
	playerName: string;
	score: number;
}

import { ref, get } from "firebase/database";
import { set } from "firebase/database";
import { db } from "../../..";
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

	public override onStart(): void {
		const storedHighscores = localStorage.getItem(localStorageKey);
		console.log("storedHighscores", storedHighscores);
		if (storedHighscores) {
			const parsedData = JSON.parse(storedHighscores);
			if (Array.isArray(parsedData) && parsedData.every((item) => "playerName" in item && "score" in item)) {
				highscores = parsedData as HighscoreEntry[];
			} else {
				console.warn("Los datos de highscores no tienen la estructura esperada.");
				highscores = [];
			}
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

	public async saveScoreToFirebase(playerName: string, playerScore: number): Promise<void> {
		try {
			const newScoreRef = ref(db, `basketballHighscores/${Date.now()}`);
			await set(newScoreRef, { playerName, score: playerScore });
			console.log("Highscore guardado en Firebase");
		} catch (error) {
			console.error("Error al guardar el puntaje en Firebase:", error);
		}
	}

	public async fetchHighscoresFromFirebase(): Promise<HighscoreEntry[]> {
		try {
			const firebaseHighscoresRef = ref(db, "basketballHighscores");
			const snapshot = await get(firebaseHighscoresRef);
			if (snapshot.exists()) {
				const scores = snapshot.val() as Record<string, HighscoreEntry>;
				return Object.values(scores).sort((a, b) => b.score - a.score);
			} else {
				console.log("No hay *highscores* en Firebase.");
				return [];
			}
		} catch (error) {
			console.error("Error al cargar los *highscores* desde Firebase:", error);
			return [];
		}
	}

	public async showHighscores(playerScore: number): Promise<void> {
		const playerName = NameInputPopUp.playerName || "Jugador Anónimo"; // Nombre del jugador
		console.log(`Player Name: ${playerName}`);

		// Guardar el puntaje en Firebase
		await this.saveScoreToFirebase(playerName, playerScore);

		// Cargar *highscores* desde Firebase
		highscores = await this.fetchHighscoresFromFirebase();

		// Mostrar los *highscores* ordenados en la tabla
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

		// Botón para volver al menú
		const returnBasket = Sprite.from("returnbasket");
		returnBasket.anchor.set(0.5);
		returnBasket.scale.set(1.1);
		returnBasket.x = 0;
		returnBasket.y = 310;
		returnBasket.eventMode = "static";
		returnBasket.on("pointertap", () => this.handleResetClick());
		this.background.addChild(returnBasket);
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
		createText(`${this.doublesPoints} `, 50, 0xffffff, pointsX, -170, "right");
		createText("x2", 20, 0xfdf178, multiplierX, -145, "right");

		// Display Triples
		createText("Triples", 50, 0xffffff, baseX, -80);
		createText(`${this.triplesPoints} `, 50, 0xffffff, pointsX, -80, "right");
		createText("x3", 20, 0xfdf178, multiplierX, -55, "right");

		// Display Clean Shots
		createText("Clean Shots", 50, 0xffffff, baseX, 20);
		createText(`${this.cleanShotsPoints} `, 50, 0xffffff, pointsX, 20, "right");
		createText("x5", 20, 0xfdf178, multiplierX, 55, "right");

		this.totalPoints = this.cleanShotsPoints * 5 + this.triplesPoints * 3 + this.doublesPoints * 2;
		// Display Total
		createText("Total", 50, 0xffffff, baseX, 120);
		createText(`${this.totalPoints} `, 50, 0xffffff, pointsX, 120, "right");

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
