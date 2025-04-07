import { PixiScene } from "../../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../../engine/utils/ScaleHelper";
import { Sprite } from "@pixi/sprite";
import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import { Keyboard } from "../../../../../engine/input/Keyboard";
import { Manager } from "../../../../..";
import { Timer } from "../../../../../engine/tweens/Timer";
import type { Button } from "@pixi/ui";
import { SoundLib } from "../../../../../engine/sound/SoundLib";
import { DodgeScene } from "../DodgeScene";
import { Container } from "pixi.js";
import { Text } from "pixi.js";
import { Sounds } from "../../Managers/SoundManager";
import { RunFallNameInputPopUp } from "./RunFallNameInputPopUp";
import { ref, get, remove } from "firebase/database";
import { set } from "firebase/database";
import { db } from "../../../../..";

interface HighscoreEntry {
	playerName: string;
	score: number;
}

const localStorageKey = "runfallhighscores";
// Puntajes locales (propios del dispositivo)
let localHighscores: HighscoreEntry[] = [];
// Puntajes globales (Firebase)
let globalHighscores: HighscoreEntry[] = [];

export class HighScorePopUp extends PixiScene {
	// assets
	private fadeAndBlocker: Graphics;
	private resetButton: Sprite;
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
	private startY: number = 150;
	// Contenedor para mostrar los puntajes
	private scoreListContainer: Container;
	// Pestañas
	private tabGlobal: Text;
	private tabLocal: Text;
	private isMenu: boolean = true;

	constructor(_score: number = 0, _isMenu: boolean = true) {
		super();

		this.isMenu = _isMenu;

		this.fadeAndBlocker = new Graphics();
		this.fadeAndBlocker.beginFill(0x000000, 0.5);
		this.fadeAndBlocker.drawRect(0, 0, 1500, 1500);
		this.fadeAndBlocker.endFill();
		this.fadeAndBlocker.interactive = true;
		this.fadeAndBlocker.pivot.set(this.fadeAndBlocker.width * 0.5, this.fadeAndBlocker.height * 0.5);
		this.addChild(this.fadeAndBlocker);
		this.fadeAndBlocker.scale.set(10);

		this.background = Sprite.from("highscore");
		this.background.anchor.set(0.5);
		this.addChild(this.background);

		this.scoreListContainer = new Container();
		this.background.addChild(this.scoreListContainer);
	}

	// Guarda el puntaje en Firebase
	public async saveScoreToFirebase(playerName: string, playerScore: number): Promise<void> {
		try {
			const newScoreRef = ref(db, `runfallhighscores/${Date.now()}`);
			await set(newScoreRef, { playerName, score: playerScore });
			console.log("Highscore guardado en Firebase");
		} catch (error) {
			console.error("Error al guardar el puntaje en Firebase:", error);
		}
	}

	// Obtiene los puntajes globales desde Firebase
	public async fetchHighscoresFromFirebase(): Promise<HighscoreEntry[]> {
		try {
			const firebaseHighscoresRef = ref(db, "runfallhighscores");
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

	// Actualiza Firebase para mantener solo los 10 mejores puntajes
	public async updateHighscoresInFirebase(): Promise<void> {
		try {
			const firebaseHighscoresRef = ref(db, "runfallhighscores");
			const snapshot = await get(firebaseHighscoresRef);
			if (!snapshot.exists()) {
				return;
			}

			const scores = snapshot.val() as Record<string, HighscoreEntry>;
			const keys = Object.keys(scores);
			console.log("keys", keys);

			if (keys.length > 10) {
				const sortedKeys = keys.sort((a, b) => scores[a].score - scores[b].score);
				const numToRemove = keys.length - 10;
				const keysToRemove = sortedKeys.slice(0, numToRemove);
				for (const key of keysToRemove) {
					const deleteRef = ref(db, `runfallhighscores/${key}`);
					await remove(deleteRef);
					console.log(`Highscore con key ${key} eliminado`);
				}
			}
		} catch (error) {
			console.error("Error al actualizar los highscores en Firebase:", error);
		}
	}

	// Método para manejar el clic en el botón de reinicio
	private handleResetClick(): void {
		this.restart = true;
		SoundLib.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopup();
	}

	private handleResetClickMenu(): void {
		SoundLib.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopupMenu();
	}

	// Método de entrada para solicitar el nombre (solo para la run)
	// eslint-disable-next-line @typescript-eslint/require-await
	public async showNameInputDialog(): Promise<string> {
		const playerName = prompt("Enter your name:");
		return playerName || "Player";
	}

	// onStart se ejecuta cuando se inicia la escena
	public override onStart(): void {
		// Carga los datos locales desde localStorage
		const storedLocal = localStorage.getItem(localStorageKey);
		console.log("storedHighscores (local)", storedLocal);
		if (storedLocal) {
			localHighscores = JSON.parse(storedLocal);
		}

		this.background.interactiveChildren = false;
		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		const fadeScale = new Tween(this.fadeAndBlocker).to({ scale: { x: 35, y: 15 } });
		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);
		const elasticAnimation = new Tween(this.background)
			.from({ scale: { x: 9, y: 9 }, y: 15000 })
			.to({ scale: { x: 9, y: 9 }, y: 0 }, 500)
			.easing(Easing.Exponential.Out);

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

		this.createTabs();
		// Por defecto, carga la pestaña Global
		this.activateTab("global");

		this.addResetButton(this.isMenu);
	}

	// Crea las pestañas (Global y Local)
	private createTabs(): void {
		const styleInactive = { fontSize: 17, fill: 0xffffff, fontFamily: "Daydream" };
		const styleActive = { fontSize: 17, fill: 0xe99f96, fontFamily: "Daydream" };

		this.tabGlobal = new Text("Global", styleActive);
		this.tabLocal = new Text("Local", styleInactive);

		this.tabGlobal.anchor.set(0.5);
		this.tabLocal.anchor.set(0.5);
		this.tabGlobal.position.set(-55, -157);
		this.tabLocal.position.set(57, -157);

		this.tabGlobal.interactive = true;
		this.tabGlobal.eventMode = "static";
		this.tabLocal.interactive = true;
		this.tabLocal.eventMode = "static";

		this.tabGlobal.on("pointertap", () => {
			SoundLib.playSound("switch", { volume: 0.2 });
			this.activateTab("global");
		});
		this.tabLocal.on("pointertap", () => {
			SoundLib.playSound("switch", { volume: 0.2 });
			this.activateTab("local");
		});

		this.background.addChild(this.tabGlobal);
		this.background.addChild(this.tabLocal);
	}

	// Cambia la pestaña y carga los datos correspondientes
	private activateTab(tab: "global" | "local"): void {
		if (tab === "global") {
			this.tabGlobal.style.fill = 0xe99f96;
			this.tabLocal.style.fill = 0xffffff;
			this.loadGlobalHighscores();
		} else {
			this.tabGlobal.style.fill = 0xffffff;
			this.tabLocal.style.fill = 0xe99f96;
			this.loadLocalHighscores();
		}
	}

	// Carga y muestra los puntajes globales (Firebase)
	private async loadGlobalHighscores(): Promise<void> {
		this.scoreListContainer.removeChildren();
		await this.updateHighscoresInFirebase();
		globalHighscores = await this.fetchHighscoresFromFirebase();
		this.displayScores(globalHighscores);
		this.addResetButton(this.isMenu);
	}

	// Carga y muestra los puntajes locales (del dispositivo)
	private loadLocalHighscores(): void {
		this.scoreListContainer.removeChildren();
		localHighscores.sort((a, b) => b.score - a.score);
		this.displayScores(localHighscores);
		this.addResetButton(this.isMenu);
	}

	// Muestra los puntajes en el contenedor
	private displayScores(scores: HighscoreEntry[]): void {
		const lineHeight = 90;
		const maxEntries = 5;
		for (let i = 0; i < Math.min(scores.length, maxEntries); i++) {
			const entry = scores[i];
			const entryText = new Text(`${entry.playerName}: ${entry.score}`, {
				fontSize: 20,
				fill: 0xffffff,
				align: "center",
				dropShadow: true,
				fontFamily: "Daydream",
			});
			entryText.anchor.set(0.5, 0.5);
			entryText.position.set(0, this.startY + i * lineHeight - 220);
			this.scoreListContainer.addChild(entryText);
		}
	}

	// Agrega el botón para volver al menú
	private addResetButton(isMenu: boolean): void {
		this.resetButton = Sprite.from("return");
		this.resetButton.anchor.set(0.5);
		this.resetButton.scale.set(0.8);
		this.resetButton.eventMode = "static";
		this.resetButton.position.set(0, 450);
		if (isMenu) {
			this.resetButton.on("pointertap", this.handleResetClickMenu, this);
		} else {
			this.resetButton.on("pointertap", this.handleResetClick, this);
		}
		this.scoreListContainer.addChild(this.resetButton);
	}

	// Método utilizado al finalizar una run:
	// Solicita el nombre del jugador, guarda el puntaje y luego muestra el leaderboard (pestaña global)
	public async showHighscores(playerScore: number): Promise<void> {
		// Solicita el nombre (o usa el almacenado en RunFallNameInputPopUp)
		const playerName = RunFallNameInputPopUp.playerName || (await this.showNameInputDialog());
		console.log(`Player Name: ${playerName}`);

		// Actualiza los puntajes locales en este dispositivo
		localHighscores.push({ playerName, score: playerScore });
		localHighscores.sort((a, b) => b.score - a.score);
		if (localHighscores.length > 10) {
			localHighscores = localHighscores.slice(0, 10);
		}
		localStorage.setItem(localStorageKey, JSON.stringify(localHighscores));

		// Guarda el puntaje en Firebase y actualiza los datos globales
		await this.saveScoreToFirebase(playerName, playerScore);
		await this.updateHighscoresInFirebase();
		globalHighscores = await this.fetchHighscoresFromFirebase();

		// Por defecto, se activa la pestaña global para mostrar el puntaje
		this.activateTab("global");
	}

	// Método para mostrar el leaderboard desde el menú (sin solicitar nombre ni guardar puntajes)
	public async showHighscoresMenu(): Promise<void> {
		// No se solicita nombre ni se guarda, solo se actualiza y muestra el leaderboard global
		await this.updateHighscoresInFirebase();
		globalHighscores = await this.fetchHighscoresFromFirebase();
		this.scoreListContainer.removeChildren();
		this.displayScores(globalHighscores);
		this.addResetButton(this.isMenu);
	}

	public override requestClose(_doSomething?: () => void): Promise<boolean> {
		this.closing = true;
		return new Promise((resolve) => {
			this.background.interactiveChildren = false;
			const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 0 }, 500);
			const elasticAnimation = new Tween(this.background)
				.from({ scale: { x: 9, y: 9 }, y: 0 })
				.to({ scale: { x: 9, y: 9 }, y: 15000 }, 500)
				.easing(Easing.Exponential.In);
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
