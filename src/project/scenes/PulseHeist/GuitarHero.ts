import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import * as Tone from "tone";
// import Random from "../../../engine/random/Random";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

export class GuitarHeroScene extends PixiScene {
	private tracks: Graphics[] = [];
	private fallingNotes: Graphics[] = [];
	private activeNotes: Map<Graphics, number> = new Map();
	private targetLine: Graphics;
	private feedbackContainer: Container = new Container();
	private gameContainer: Container = new Container();
	private synth: Tone.Synth;
	private isGameRunning: boolean = false; // Para controlar el inicio del juego
	private startButton: Graphics;
	private pressedTracks: Set<number> = new Set();
	private readonly HIT_MARGIN: number = 50; // Margen de error en píxeles

	private readonly songNotes: { track: number; time: number; note: string }[] = [
		{ track: 0, time: 500, note: "C4" }, // "Cum"
		{ track: 0, time: 1000, note: "C4" }, // "ple"
		{ track: 1, time: 1500, note: "D4" }, // "a"
		{ track: 0, time: 2000, note: "C4" }, // "ños"
		{ track: 2, time: 3500, note: "F4" }, // "fe"
		{ track: 1, time: 4000, note: "E4" }, // "liz"
		{ track: 0, time: 4500, note: "C4" }, // "Cum"
		{ track: 0, time: 5000, note: "C4" }, // "ple"
		{ track: 1, time: 5500, note: "D4" }, // "a"
		{ track: 0, time: 6000, note: "C4" }, // "ños"
		{ track: 2, time: 6500, note: "G4" }, // "fe"
		{ track: 1, time: 7000, note: "F4" }, // "liz"
		{ track: 0, time: 7500, note: "C4" }, // "Que"
		{ track: 0, time: 8000, note: "C4" }, // "los"
		{ track: 2, time: 8500, note: "C5" }, // "cum"
		{ track: 1, time: 9000, note: "A4" }, // "plas"
		{ track: 2, time: 9500, note: "F4" }, // "fe"
		{ track: 1, time: 10000, note: "E4" }, // "liz"
		{ track: 0, time: 10500, note: "D4" }, // "liz"
		{ track: 2, time: 11000, note: "A#4" }, // "Que"
		{ track: 2, time: 11500, note: "A#4" }, // "los"
		{ track: 1, time: 12000, note: "A4" }, // "cum"
		{ track: 0, time: 12500, note: "F4" }, // "plas"
		{ track: 1, time: 13000, note: "G4" }, // "fe"
		{ track: 0, time: 13500, note: "F4" }, // "liz"
	];

	private songStartTime: number = 0;

	private startGame(): void {
		this.isGameRunning = true;
		this.startButton.visible = false;
		this.songStartTime = Date.now(); // Marca el tiempo de inicio de la canción

		// Programa las notas y arranca el transporte
		this.scheduleNotes();
		Tone.start();
		Tone.getTransport().start(); // Asegúrate de que el transporte está activo
	}

	private scheduleNotes(): void {
		const startTime = Tone.now();  // Get the current time from Tone.js
		this.songNotes.forEach(note => {
			const delay = note.time / 1000 - (startTime % 1); // Adjust delay for exact timing
			Tone.getTransport().schedule((_time) => {
				this.spawnNoteAtTrack(note.track);
			}, `+${delay}`);
		});
	}

	private spawnNoteAtTrack(trackIndex: number): void {
		const nextNote = this.songNotes.find(note => note.track === trackIndex && note.time >= Date.now() - this.songStartTime);

		if (!nextNote) return; // Asegúrate de que hay una nota asociada

		const note = new Graphics();
		note.beginFill(0xffffff).drawCircle(0, 0, 20).endFill();
		note.x = this.tracks[trackIndex].x + 40;
		note.y = 0;

		this.fallingNotes.push(note);
		this.activeNotes.set(note, trackIndex);
		this.gameContainer.addChild(note);

		// Asocia la nota musical con el gráfico
		(note as any)["note"] = nextNote.note; // Propiedad personalizada

		console.log(`Spawning note on track ${trackIndex} with sound ${nextNote.note}`);
	}

	constructor() {
		super();
		this.synth = new Tone.Synth().toDestination();
		this.createTracks();
		this.createTargetLine();
		this.createStartButton();
		this.addChild(this.gameContainer);
		this.addChild(this.feedbackContainer);
		this.addChild(this.startButton);
	}

	private onTrackPress(trackIndex: number, isPressed: boolean): void {
		if (isPressed) {
			this.pressedTracks.add(trackIndex);
			console.log(`Track ${trackIndex} pressed`);
			this.playNoteSound(trackIndex); // Toca la nota asociada
		} else {
			this.pressedTracks.delete(trackIndex);
			console.log(`Track ${trackIndex} released`);
		}
		this.updateFeedback();
	}

	public override update(_dt: number): void {
		if (this.isGameRunning) {
			this.updateNotes(_dt);
		}
	}

	private updateNotes(_dt: number): void {
		const speed = _dt / 3; // Velocidad de las notas
		const notesToRemove: Graphics[] = []; // Arreglo temporal para las notas a eliminar

		this.fallingNotes.forEach((note) => {
			note.y += speed;

			// Si la nota está dentro del margen de error
			if (Math.abs(note.y - this.targetLine.y) <= this.HIT_MARGIN) {
				const trackIndex = this.activeNotes.get(note);

				if (trackIndex !== undefined && this.pressedTracks.has(trackIndex)) {
					// Toca la nota si coincide
					this.playNoteSound(trackIndex);
					notesToRemove.push(note); // Marca como resuelta
				}
			}


			// Si la nota pasó completamente la línea sin ser presionada
			if (note.y > this.targetLine.y + this.HIT_MARGIN) {
				const trackIndex = this.activeNotes.get(note);
				console.log(`Note missed on track: ${trackIndex}`);
				this.updateFeedback(trackIndex, false); // Feedback rojo para fallo
				notesToRemove.push(note); // Eliminar nota
			}
		});

		// Eliminar las notas marcadas
		notesToRemove.forEach((note) => this.removeNote(note));
	}


	private removeNote(note: Graphics): void {
		const index = this.fallingNotes.indexOf(note);
		if (index !== -1) {
			this.fallingNotes.splice(index, 1); // Quitar la nota del arreglo
		}
		this.gameContainer.removeChild(note); // Quitar la nota de la escena
		this.activeNotes.delete(note); // Eliminar de activeNotes
	}

	private createTracks(): void {
		const trackWidth = 80;
		const trackHeight = 800;
		const trackCount = 3;

		for (let i = 0; i < trackCount; i++) {
			const track = new Graphics();
			track.beginFill(0x333333).drawRect(0, 0, trackWidth, trackHeight).endFill();
			track.x = i * (trackWidth + 10);
			track.eventMode = "static"; // Habilita eventos de interacción
			track.on("pointerdown", (_event) => this.onTrackPress(i, true));
			track.on("pointerup", (_event) => this.onTrackPress(i, false));
			this.tracks.push(track);
			this.gameContainer.addChild(track);
		}
	}


	private createTargetLine(): void {
		this.targetLine = new Graphics();
		this.targetLine.lineStyle(2, 0xff0000, 1);
		this.targetLine.moveTo(0, 0); // La línea comienza en (0, 0) relativa al contenedor
		this.targetLine.lineTo(this.tracks.length * 90, 0); // La línea se dibuja horizontalmente

		this.targetLine.y = 750; // Establece la posición vertical
		this.gameContainer.addChild(this.targetLine);
	}


	private createStartButton(): void {
		this.startButton = new Graphics();
		this.startButton.beginFill(0x00ff00).drawRoundedRect(0, 0, 150, 50, 10).endFill();
		this.startButton.eventMode = "static";

		const textStyle = new TextStyle({
			fill: "#ffffff",
			fontSize: 20,
			align: "center",
		});
		const buttonText = new Text("Start", textStyle);
		buttonText.anchor.set(0.5);
		buttonText.x = this.startButton.width / 2;
		buttonText.y = this.startButton.height / 2;

		this.startButton.addChild(buttonText);
		this.startButton.on("pointerdown", () => this.startGame());
	}

	// private spawnNote(): void {
	// 	if (!this.isGameRunning) return;

	// 	const randomTrack = Math.floor(Math.random() * this.tracks.length);
	// 	const note = new Graphics();
	// 	note.beginFill(0xffffff).drawCircle(0, 0, 20).endFill();
	// 	note.x = this.tracks[randomTrack].x + 40;
	// 	note.y = 0;

	// 	console.log(`Spawning note at track ${randomTrack}, position (${note.x}, ${note.y})`);
	// 	this.fallingNotes.push(note);
	// 	this.activeNotes.set(note, randomTrack);
	// 	this.gameContainer.addChild(note);

	// 	const randomSpeed = Random.shared.randomInt(250, 1000);

	// 	setTimeout(() => this.spawnNote(), randomSpeed); // Intervalo ajustable
	// }

	// private checkCollision(_note: Graphics, trackIndex: number | undefined): void {
	// 	if (trackIndex === undefined) return;

	// 	if (this.pressedTracks.has(trackIndex)) {
	// 		// Feedback verde para acierto
	// 		this.updateFeedback(trackIndex, true);
	// 		console.log(`Correct note pressed on track: ${trackIndex}`);
	// 	} else {
	// 		console.log(`Note missed or wrong track: ${trackIndex}`);
	// 	}
	// }

	private updateFeedback(trackIndex?: number, isCorrect?: boolean): void {
		this.feedbackContainer.removeChildren(); // Limpia el contenedor de feedback

		this.tracks.forEach((track, index) => {
			const feedbackPoint = new Graphics();
			const isPressed = this.pressedTracks.has(index);

			if (isPressed) {
				feedbackPoint.beginFill(isCorrect && trackIndex === index ? 0x00ff00 : 0xff0000);
				feedbackPoint.drawCircle(0, 0, 20).endFill();
				feedbackPoint.x = track.x + 20; // Centra el punto en el track
				feedbackPoint.y = this.targetLine.y; // Coloca el punto justo encima de la línea roja
				this.feedbackContainer.addChild(feedbackPoint);
			}
		});
	}

	private playNoteSound(trackIndex: number): void {
		const fallingNote = this.fallingNotes.find(note => this.activeNotes.get(note) === trackIndex);
		if (fallingNote && (fallingNote as any)["note"]) {
			const noteToPlay = (fallingNote as any)["note"];
			this.synth.triggerAttackRelease(noteToPlay, "8n");
			console.log(`Playing note: ${noteToPlay} on track ${trackIndex}`);
		} else {
			console.log(`No matching note to play for track ${trackIndex}`);
		}
	}


	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, 640, 840, ScaleHelper.FIT);
		this.gameContainer.x = newW * 0.5;
		this.gameContainer.y = newH * 0.5;
		const containerBounds = this.gameContainer.getLocalBounds();
		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);

		ScaleHelper.setScaleRelativeToIdeal(this.feedbackContainer, newW, newH, 640, 840, ScaleHelper.FIT);
		this.feedbackContainer.x = newW * 0.5;
		this.feedbackContainer.y = newH * 0.5;
		this.feedbackContainer.pivot.set(containerBounds.width * 0.5 - 20, containerBounds.height * 0.5);

		this.startButton.x = newW * 0.5 - this.startButton.width / 2;
		this.startButton.y = newH * 0.8;
	}
}
