import * as Tone from "tone";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Container, Graphics } from "pixi.js";

export class GuitarGameScene extends PixiScene {
	private strings: Graphics[]; // Las cuerdas de la guitarra
	private frets: Graphics[]; // Los trastes de la guitarra
	private synth: Tone.Synth; // Sintetizador para las notas
	private gameContainer: Container;

	constructor() {
		super();
		this.strings = [];
		this.frets = [];
		this.synth = new Tone.Synth().connect(Tone.Destination);
		this.gameContainer = new Container();
		this.createGuitar();
		this.setupInput();
		this.addChild(this.gameContainer);
	}

	private createGuitar(): void {
		const stringHeight = 14;
		const stringSpacing = 50; // Aumentamos el espacio entre cuerdas
		const fretWidth = 50; // Ancho de los trastes
		const numberOfStrings = 6; // Número de cuerdas en la guitarra
		const numberOfFrets = 12; // Número de trastes

		// Crear cuerdas (líneas)
		for (let i = 0; i < numberOfStrings; i++) {
			const string = new Graphics();
			string.lineStyle(stringHeight, 0xffffff, 1);
			string.moveTo(0, i * stringSpacing);
			string.lineTo(fretWidth * numberOfFrets, i * stringSpacing);
			this.strings.push(string);
			this.gameContainer.addChild(string);
		}

		// Crear trastes
		for (let i = 1; i <= numberOfFrets; i++) {
			const fret = new Graphics();
			fret.lineStyle(2, 0x333333, 1);
			fret.moveTo(i * fretWidth, 0);
			fret.lineTo(i * fretWidth, stringSpacing * (numberOfStrings - 1));
			this.frets.push(fret);
			this.gameContainer.addChild(fret);
		}

		// Agregar áreas de interacción para los trastes
		for (let i = 0; i < numberOfStrings; i++) {
			for (let j = 1; j <= numberOfFrets; j++) {
				const fretArea = new Graphics();
				// Agregar borde visible para depuración
				fretArea.beginFill(0xffffff, 0); // Hacemos que el área sea invisible
				fretArea.lineStyle(2, 0xff0000, 1); // Rojo para ver las áreas
				fretArea.drawRect(j * fretWidth - 5, i * stringSpacing - 10, fretWidth + 10, stringSpacing + 20);
				fretArea.eventMode = "static";
				fretArea.on("pointerdown", () => this.playNote(i, j));
				this.gameContainer.addChild(fretArea);
			}
		}
	}

	private playNote(stringIndex: number, fretIndex: number): void {
		const notes: string[][] = [
			["E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2", "C3", "C#3", "D3", "D#3"],
			["A2", "A#2", "B2", "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3"],
			["D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3", "C4", "C#4"],
			["G3", "G#3", "A3", "A#3", "B3", "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4"],
			["B3", "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4"],
			["E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4", "C5", "C#5", "D5", "D#5"],
		];

		const note = notes[stringIndex][fretIndex - 1]; // Fret 1 corresponde al primer índice
		console.log("Playing note:", note); // Verifica qué nota está siendo seleccionada
		if (note) {
			this.synth.triggerAttackRelease(note, "8n");
		}
	}

	private setupInput(): void {
		// Necesitamos hacer una llamada de usuario para desbloquear el audio en algunos navegadores
		window.addEventListener("click", () => {
			Tone.start()
				.then(() => {
					console.log("Audio unlocked");
				})
				.catch((err) => {
					console.error("Error unlocking audio", err);
				});
		});
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 500, 500, ScaleHelper.FIT); // Ajustamos la escala
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;

		const containerBounds = this.gameContainer.getLocalBounds();
		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);
	}
}
