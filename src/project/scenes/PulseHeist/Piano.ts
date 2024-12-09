/* eslint-disable @typescript-eslint/naming-convention */
import * as Tone from "tone";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import i18next from "i18next";

export class PianoGameScene extends PixiScene {
	private keys: Graphics[] = [];
	private whiteKeys: Graphics[] = [];
	private blackKeys: Graphics[] = [];
	private synth: Tone.Synth;
	private separators: Graphics[] = [];
	private gameContainer: Container = new Container();
	private currentDot: Graphics | null = null;
	private isGameStarted: boolean = false;
	private startButton: Graphics | null = null;
	private startContainer: Container = new Container();

	constructor() {
		super();
		this.synth = new Tone.Synth().toDestination();
		this.createPiano();
		this.addStartButton();
		this.addChild(this.gameContainer);
		this.addChild(this.startContainer);
	}

	private addStartButton(): void {
		this.startButton = new Graphics();
		this.startButton.beginFill(0x007bff).drawRoundedRect(0, 0, 150, 50, 10).endFill();
		this.startButton.eventMode = "dynamic";
		this.startButton.pivot.set(this.startButton.width * 0.5, this.startButton.height * 0.5);
		const textStyle = new TextStyle({ fill: "#ffffff", fontSize: 18, fontWeight: "bold" });
		const buttonText = new Text(i18next.t<string>("piano.start"), textStyle);
		buttonText.anchor.set(0.5);
		buttonText.x = this.startButton.width / 2;
		buttonText.y = this.startButton.height / 2;

		this.gameContainer.alpha = 0.3;
		this.startButton.addChild(buttonText);
		this.startButton.on("pointerdown", () => {
			this.startGame();
			this.gameContainer.alpha = 1;
			this.removeChild(this.startContainer);
		});

		this.startContainer.addChild(this.startButton);
	}

	private startGame(): void {
		this.isGameStarted = true;
		this.removeChild(this.startButton); // Elimina el botón de inicio
		this.startButton = null;
		Tone.start().then(() => {
			console.log("Tone.js audio context started");
		});
	}

	private createPiano(): void {
		const whiteKeyWidth = 60;
		const whiteKeyHeight = 230;
		const blackKeyWidth = 40;
		const blackKeyHeight = 130;

		// Estado para manejar clic sostenido
		let isMouseDown = false;

		// Listener global para manejar el estado del mouse
		this.gameContainer.eventMode = "dynamic";
		this.gameContainer.on("pointerdown", () => {
			isMouseDown = true;
		});
		this.gameContainer.on("pointerup", () => {
			isMouseDown = false;
		});
		this.gameContainer.on("pointerupoutside", () => {
			isMouseDown = false;
		});

		// Crear teclas blancas
		const whiteKeys = ["C", "D", "E", "F", "G", "A", "B", "C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6"];
		for (let i = 0; i < whiteKeys.length; i++) {
			const key = new Graphics();
			key.beginFill(0xffffff).drawRect(0, 0, whiteKeyWidth, whiteKeyHeight).endFill();
			key.x = i * whiteKeyWidth;
			key.eventMode = "static";

			// Sonido al presionar
			key.on("pointerdown", () => {
				if (this.isGameStarted) {
					this.playNote(whiteKeys[i], i);
				}
			});

			// Sonido al pasar con clic sostenido
			key.on("pointerover", () => {
				if (this.isGameStarted && isMouseDown) {
					this.playNote(whiteKeys[i], i);
				}
			});

			this.whiteKeys.push(key);
			this.keys.push(key);
			this.gameContainer.addChild(key);
		}

		// Crear teclas negras
		const blackKeysPositions = [1, 2, 4, 5, 6, 8, 9, 11, 12, 13];
		for (let i = 0; i < blackKeysPositions.length; i++) {
			const key = new Graphics();
			key.beginFill(0x000000).drawRect(0, 0, blackKeyWidth, blackKeyHeight).endFill();
			key.x = blackKeysPositions[i] * whiteKeyWidth - blackKeyWidth / 2;
			key.eventMode = "static";

			// Sonido al presionar
			key.on("pointerdown", () => {
				if (this.isGameStarted) {
					this.playBlackKey(blackKeysPositions[i], i);
				}
			});

			// Sonido al pasar con clic sostenido
			key.on("pointerover", () => {
				if (this.isGameStarted && isMouseDown) {
					this.playBlackKey(blackKeysPositions[i], i);
				}
			});

			this.blackKeys.push(key);
			this.keys.push(key);
			this.gameContainer.addChild(key);
		}

		this.createSeparators(whiteKeyWidth, whiteKeyHeight);
	}

	private createSeparators(keyWidth: number, keyHeight: number): void {
		for (let i = 1; i < this.whiteKeys.length; i++) {
			const separator = new Graphics();
			separator.lineStyle(2, 0x000000, 1);
			separator.moveTo(i * keyWidth, 0);
			separator.lineTo(i * keyWidth, keyHeight);
			this.separators.push(separator);
			this.gameContainer.addChild(separator);
		}
	}

	private playNote(note: string, index: number): void {
		const noteMap: { [key: string]: string } = {
			C: "C4",
			D: "D4",
			E: "E4",
			F: "F4",
			G: "G4",
			A: "A4",
			B: "B4",
			C5: "C5",
			D5: "D5",
			E5: "E5",
			F5: "F5",
			G5: "G5",
			A5: "A5",
			B5: "B5",
			C6: "C6",
		};
		this.synth.triggerAttackRelease(noteMap[note], "8n");
		this.showDot(this.whiteKeys[index]);
	}

	private playBlackKey(position: number, index: number): void {
		const blackKeyNotes: { [key: number]: string } = {
			1: "C#4",
			2: "D#4",
			4: "F#4",
			5: "G#4",
			6: "A#4",
			8: "C#5",
			9: "D#5",
			11: "F#5",
			12: "G#5",
			13: "A#5",
		};
		this.synth.triggerAttackRelease(blackKeyNotes[position], "8n");
		this.showDot(this.blackKeys[index]);
	}

	private showDot(key: Graphics): void {
		if (this.currentDot) {
			this.gameContainer.removeChild(this.currentDot);
		}
		this.currentDot = new Graphics();
		this.currentDot.beginFill(0xff0000).drawCircle(0, 0, 8).endFill();
		this.currentDot.x = key.x + key.width / 2;
		this.currentDot.y = key.y + (3 * key.height) / 4;
		this.gameContainer.addChild(this.currentDot);

		setTimeout(() => {
			if (this.currentDot) {
				this.gameContainer.removeChild(this.currentDot);
				this.currentDot = null;
			}
		}, 300);
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 950, 315, ScaleHelper.FIT);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.startContainer, _newW, _newH, 950, 315, ScaleHelper.FIT);
		this.startContainer.x = _newW * 0.5;
		this.startContainer.y = _newH * 0.5;

		const containerBounds = this.gameContainer.getLocalBounds();
		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);
	}
}
