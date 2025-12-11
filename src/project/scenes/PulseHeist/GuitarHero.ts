/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import * as Tone from "tone";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

interface NoteData {
	graphic: Graphics;
	trackIndex: number;
	note: string;
	spawnTime: number;
	hitTime: number;
	wasHit: boolean;
	trail: Graphics[];
}

interface Particle {
	graphic: Graphics;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
}

type HitAccuracy = "perfect" | "good" | "ok" | "miss";

interface HitStats {
	perfect: number;
	good: number;
	ok: number;
	miss: number;
}

export class GuitarHeroScene extends PixiScene {
	private tracks: Graphics[] = [];
	private activeNotes: NoteData[] = [];
	private targetLine: Graphics;
	private feedbackContainer: Container = new Container();
	private gameContainer: Container = new Container();
	private uiContainer: Container = new Container();
	private trailContainer: Container = new Container();
	private particlesContainer: Container = new Container();
	private particles: Particle[] = [];

	private synth: Tone.Synth;
	private isGameRunning: boolean = false;
	private startButton: Graphics;
	private pressedTracks: Set<number> = new Set();

	// Configuración del juego
	private readonly FALL_TIME: number = 2000;
	private readonly NOTE_SPEED: number = 750 / this.FALL_TIME;

	// Márgenes de precisión (en píxeles desde el centro de la línea)
	private readonly PERFECT_MARGIN: number = 20;
	private readonly GOOD_MARGIN: number = 40;
	private readonly OK_MARGIN: number = 60;

	// Configuración visual
	private readonly TRACK_COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
	private readonly TRAIL_LENGTH = 5;
	private readonly TRAIL_SPACING = 15;

	// Perspectiva 3D
	private readonly TRACK_WIDTH_BOTTOM = 90; // Ancho en la parte inferior (cerca)
	private readonly TRACK_WIDTH_TOP = 40; // Ancho en la parte superior (lejos)
	private readonly TRACK_HEIGHT = 750;
	private readonly TRACK_SPACING = 10;

	// Estadísticas
	private hitStats: HitStats = { perfect: 0, good: 0, ok: 0, miss: 0 };
	private currentCombo: number = 0;
	private maxCombo: number = 0;
	private score: number = 0;

	// UI
	private comboText: Text;
	private scoreText: Text;
	private accuracyText: Text;
	private resultsContainer: Container = new Container();

	// Canción - "Cumpleaños Feliz" con tiempos ajustados a la melodía real
	private readonly songNotes: { track: number; time: number; note: string }[] = [
		{ track: 0, time: 1000, note: "C4" },
		{ track: 0, time: 1500, note: "C4" },
		{ track: 1, time: 2000, note: "D4" },
		{ track: 0, time: 2500, note: "C4" },
		{ track: 2, time: 3000, note: "F4" },
		{ track: 1, time: 3750, note: "E4" },

		{ track: 0, time: 4750, note: "C4" },
		{ track: 0, time: 5250, note: "C4" },
		{ track: 1, time: 5750, note: "D4" },
		{ track: 0, time: 6250, note: "C4" },
		{ track: 2, time: 6750, note: "G4" },
		{ track: 2, time: 7500, note: "F4" },

		{ track: 0, time: 8500, note: "C4" },
		{ track: 0, time: 9000, note: "C4" },
		{ track: 4, time: 9500, note: "C5" },
		{ track: 3, time: 10000, note: "A4" },
		{ track: 2, time: 10500, note: "F4" },
		{ track: 1, time: 11000, note: "E4" },
		{ track: 1, time: 11750, note: "D4" },

		{ track: 3, time: 12750, note: "A#4" },
		{ track: 3, time: 13250, note: "A#4" },
		{ track: 3, time: 13750, note: "A4" },
		{ track: 2, time: 14250, note: "F4" },
		{ track: 2, time: 14750, note: "G4" },
		{ track: 2, time: 15500, note: "F4" },
	];

	private gameStartTime: number = 0;
	private scheduledNotes: Set<number> = new Set();

	constructor() {
		super();
		this.synth = new Tone.Synth().toDestination();
		this.createTracks();
		this.createTargetLine();
		this.createUI();
		this.createStartButton();
		this.addChild(this.trailContainer);
		this.addChild(this.gameContainer);
		this.addChild(this.particlesContainer);
		this.addChild(this.feedbackContainer);
		this.addChild(this.uiContainer);
		this.addChild(this.startButton);
	}

	private startGame(): void {
		this.isGameRunning = true;
		this.startButton.visible = false;
		this.resultsContainer.visible = false;
		this.gameStartTime = Date.now();
		this.hitStats = { perfect: 0, good: 0, ok: 0, miss: 0 };
		this.currentCombo = 0;
		this.maxCombo = 0;
		this.score = 0;
		this.scheduledNotes.clear();
		this.particles = [];
		this.particlesContainer.removeChildren();
		this.trailContainer.removeChildren();
		this.activeNotes.forEach((noteData) => {
			this.gameContainer.removeChild(noteData.graphic);
			noteData.trail.forEach((t) => this.trailContainer.removeChild(t));
		});
		this.activeNotes = [];
		this.updateUI();

		Tone.start();
	}

	private createUI(): void {
		const textStyle = new TextStyle({
			fill: "#ffffff",
			fontSize: 28,
			fontWeight: "bold",
			align: "left",
			stroke: "#000000",
			strokeThickness: 5,
		});

		// Score
		this.scoreText = new Text("Score: 0", textStyle);
		this.scoreText.x = 10;
		this.scoreText.y = 10;
		this.uiContainer.addChild(this.scoreText);

		// Combo
		this.comboText = new Text("", textStyle);
		this.comboText.x = 10;
		this.comboText.y = 50;
		this.uiContainer.addChild(this.comboText);

		// Accuracy (se muestra temporalmente)
		const accuracyStyle = new TextStyle({
			fill: "#ffffff",
			fontSize: 48,
			fontWeight: "bold",
			align: "center",
			stroke: "#000000",
			strokeThickness: 6,
		});
		this.accuracyText = new Text("", accuracyStyle);
		this.accuracyText.anchor.set(0.5);
		this.accuracyText.visible = false;
		this.uiContainer.addChild(this.accuracyText);
	}

	private createTracks(): void {
		const trackCount = 5;

		// Calcular el ancho total en la parte inferior
		const totalWidthBottom = trackCount * this.TRACK_WIDTH_BOTTOM + (trackCount - 1) * this.TRACK_SPACING;
		const totalWidthTop = trackCount * this.TRACK_WIDTH_TOP + (trackCount - 1) * this.TRACK_SPACING;

		// Offset para centrar
		const offsetBottom = -totalWidthBottom / 2;
		const offsetTop = -totalWidthTop / 2;

		for (let i = 0; i < trackCount; i++) {
			const track = new Graphics();

			// Calcular posiciones X para cada esquina
			const xBottomLeft = offsetBottom + i * (this.TRACK_WIDTH_BOTTOM + this.TRACK_SPACING);
			const xBottomRight = xBottomLeft + this.TRACK_WIDTH_BOTTOM;
			const xTopLeft = offsetTop + i * (this.TRACK_WIDTH_TOP + this.TRACK_SPACING);
			const xTopRight = xTopLeft + this.TRACK_WIDTH_TOP;

			// Dibujar trapecio (perspectiva)
			track.beginFill(this.TRACK_COLORS[i], 0.3);
			track.moveTo(xTopLeft, 0); // Top left
			track.lineTo(xTopRight, 0); // Top right
			track.lineTo(xBottomRight, this.TRACK_HEIGHT); // Bottom right
			track.lineTo(xBottomLeft, this.TRACK_HEIGHT); // Bottom left
			track.lineTo(xTopLeft, 0); // Close path
			track.endFill();

			// Bordes
			track.lineStyle(2, this.TRACK_COLORS[i], 1);
			track.moveTo(xTopLeft, 0);
			track.lineTo(xTopRight, 0);
			track.lineTo(xBottomRight, this.TRACK_HEIGHT);
			track.lineTo(xBottomLeft, this.TRACK_HEIGHT);
			track.lineTo(xTopLeft, 0);

			track.eventMode = "static";
			track.cursor = "pointer";

			// Hit area para el trapecio
			track.hitArea = {
				contains: (x: number, y: number) => {
					// Interpolación lineal para encontrar el ancho en la posición Y
					const ratio = y / this.TRACK_HEIGHT;
					const widthAtY = this.TRACK_WIDTH_TOP + (this.TRACK_WIDTH_BOTTOM - this.TRACK_WIDTH_TOP) * ratio;

					// Calcular posición X izquierda del track en esta Y
					const xLeftTop = offsetTop + i * (this.TRACK_WIDTH_TOP + this.TRACK_SPACING);
					const xLeftBottom = offsetBottom + i * (this.TRACK_WIDTH_BOTTOM + this.TRACK_SPACING);
					const xLeftAtY = xLeftTop + (xLeftBottom - xLeftTop) * ratio;
					const xRightAtY = xLeftAtY + widthAtY;

					return x >= xLeftAtY && x <= xRightAtY && y >= 0 && y <= this.TRACK_HEIGHT;
				},
			};

			track.on("pointerdown", () => this.onTrackPress(i, true));
			track.on("pointerup", () => this.onTrackPress(i, false));
			track.on("pointerupoutside", () => this.onTrackPress(i, false));

			this.tracks.push(track);
			this.gameContainer.addChild(track);
		}
	}

	private createTargetLine(): void {
		const trackCount = 5;
		const totalWidthBottom = trackCount * this.TRACK_WIDTH_BOTTOM + (trackCount - 1) * this.TRACK_SPACING;
		const offsetBottom = -totalWidthBottom / 2;

		this.targetLine = new Graphics();
		this.targetLine.lineStyle(4, 0xff0000, 1);
		this.targetLine.moveTo(offsetBottom - 20, 0);
		this.targetLine.lineTo(offsetBottom + totalWidthBottom + 20, 0);
		this.targetLine.y = 650;
		this.gameContainer.addChild(this.targetLine);
	}

	private createStartButton(): void {
		this.startButton = new Graphics();
		this.startButton.beginFill(0x00ff00).drawRoundedRect(0, 0, 200, 60, 10).endFill();
		this.startButton.eventMode = "static";
		this.startButton.cursor = "pointer";

		const textStyle = new TextStyle({
			fill: "#ffffff",
			fontSize: 24,
			fontWeight: "bold",
			align: "center",
		});
		const buttonText = new Text("¡Empezar!", textStyle);
		buttonText.anchor.set(0.5);
		buttonText.x = this.startButton.width / 2;
		buttonText.y = this.startButton.height / 2;

		this.startButton.addChild(buttonText);
		this.startButton.on("pointerdown", () => this.startGame());
	}

	private onTrackPress(trackIndex: number, isPressed: boolean): void {
		if (!this.isGameRunning) {
			return;
		}

		if (isPressed) {
			this.pressedTracks.add(trackIndex);
			this.checkNoteHit(trackIndex);
		} else {
			this.pressedTracks.delete(trackIndex);
		}
		this.updateFeedback();
	}

	private calculateAccuracy(distance: number): HitAccuracy {
		if (distance <= this.PERFECT_MARGIN) {
			return "perfect";
		}
		if (distance <= this.GOOD_MARGIN) {
			return "good";
		}
		if (distance <= this.OK_MARGIN) {
			return "ok";
		}
		return "miss";
	}

	private getScoreForAccuracy(accuracy: HitAccuracy): number {
		const baseScores = { perfect: 100, good: 75, ok: 50, miss: 0 };
		const comboMultiplier = Math.min(Math.floor(this.currentCombo / 10) + 1, 4);
		return baseScores[accuracy] * comboMultiplier;
	}

	private checkNoteHit(trackIndex: number): void {
		let closestNote: NoteData | null = null;
		let minDistance = Infinity;

		this.activeNotes.forEach((noteData) => {
			if (noteData.trackIndex === trackIndex && !noteData.wasHit) {
				const distance = Math.abs(noteData.graphic.y - this.targetLine.y);
				if (distance < minDistance && distance <= this.OK_MARGIN) {
					minDistance = distance;
					closestNote = noteData;
				}
			}
		});

		if (closestNote) {
			const accuracy = this.calculateAccuracy(minDistance);
			closestNote.wasHit = true;

			this.hitStats[accuracy]++;
			const points = this.getScoreForAccuracy(accuracy);
			this.score += points;

			if (accuracy !== "miss") {
				this.currentCombo++;
				if (this.currentCombo > this.maxCombo) {
					this.maxCombo = this.currentCombo;
				}
				this.playNoteSound(closestNote.note);
				this.createParticleExplosion(closestNote.graphic.x, closestNote.graphic.y, trackIndex, accuracy);
			} else {
				this.currentCombo = 0;
			}

			this.showHitFeedback(trackIndex, accuracy);
			this.showAccuracyText(accuracy);
			this.removeNoteData(closestNote);
			this.updateUI();
		}
	}

	private createParticleExplosion(x: number, y: number, trackIndex: number, accuracy: HitAccuracy): void {
		const particleCount = accuracy === "perfect" ? 20 : accuracy === "good" ? 15 : 10;
		const trackColor = this.TRACK_COLORS[trackIndex];

		for (let i = 0; i < particleCount; i++) {
			const particle = new Graphics();
			const size = Math.random() * 4 + 3;
			particle.beginFill(trackColor);
			particle.drawCircle(0, 0, size);
			particle.endFill();
			particle.x = x;
			particle.y = y;

			const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
			const speed = Math.random() * 3 + 2;
			const vx = Math.cos(angle) * speed;
			const vy = Math.sin(angle) * speed;

			const maxLife = 500 + Math.random() * 300;

			this.particles.push({
				graphic: particle,
				vx: vx,
				vy: vy,
				life: 0,
				maxLife: maxLife,
			});

			this.particlesContainer.addChild(particle);
		}
	}

	private updateParticles(dt: number): void {
		const particlesToRemove: Particle[] = [];

		this.particles.forEach((particle) => {
			particle.life += dt;

			particle.graphic.x += particle.vx * (dt / 16);
			particle.graphic.y += particle.vy * (dt / 16);

			particle.vy += 0.15 * (dt / 16);

			const lifeRatio = particle.life / particle.maxLife;
			particle.graphic.alpha = 1 - lifeRatio;
			particle.graphic.scale.set(1 - lifeRatio * 0.5);

			if (particle.life >= particle.maxLife) {
				particlesToRemove.push(particle);
			}
		});

		particlesToRemove.forEach((particle) => {
			const index = this.particles.indexOf(particle);
			if (index !== -1) {
				this.particles.splice(index, 1);
			}
			this.particlesContainer.removeChild(particle.graphic);
		});
	}

	private showAccuracyText(accuracy: HitAccuracy): void {
		const colors = {
			perfect: "#FFD700",
			good: "#00FF00",
			ok: "#FFA500",
			miss: "#FF0000",
		};
		const texts = {
			perfect: "PERFECT!",
			good: "GOOD!",
			ok: "OK",
			miss: "MISS",
		};

		this.accuracyText.text = texts[accuracy];
		this.accuracyText.style.fill = colors[accuracy];
		this.accuracyText.visible = true;
		this.accuracyText.alpha = 1;
		this.accuracyText.scale.set(1);

		const startTime = Date.now();
		const animate = () => {
			const elapsed = Date.now() - startTime;
			if (elapsed < 500) {
				this.accuracyText.alpha = 1 - elapsed / 500;
				this.accuracyText.scale.set(1 + elapsed / 1000);
				requestAnimationFrame(animate);
			} else {
				this.accuracyText.visible = false;
			}
		};
		animate();
	}

	private spawnNote(trackIndex: number, note: string, hitTime: number): void {
		const noteGraphic = new Graphics();
		noteGraphic.beginFill(0xffffff);
		noteGraphic.drawCircle(0, 0, 25);
		noteGraphic.endFill();
		noteGraphic.lineStyle(3, 0x000000);
		noteGraphic.drawCircle(0, 0, 25);

		const startY = 0;
		noteGraphic.x = this.getTrackCenterX(trackIndex, startY);
		noteGraphic.y = startY;
		noteGraphic.scale.set(this.getNoteScale(startY));

		const noteData: NoteData = {
			graphic: noteGraphic,
			trackIndex: trackIndex,
			note: note,
			spawnTime: Date.now(),
			hitTime: hitTime,
			wasHit: false,
			trail: [],
		};

		this.activeNotes.push(noteData);
		this.gameContainer.addChild(noteGraphic);
	}

	private getTrackCenterX(trackIndex: number, yPosition: number): number {
		// Interpolación lineal basada en la posición Y
		const ratio = yPosition / this.TRACK_HEIGHT;

		const trackCount = 5;
		const totalWidthBottom = trackCount * this.TRACK_WIDTH_BOTTOM + (trackCount - 1) * this.TRACK_SPACING;
		const totalWidthTop = trackCount * this.TRACK_WIDTH_TOP + (trackCount - 1) * this.TRACK_SPACING;
		const offsetBottom = -totalWidthBottom / 2;
		const offsetTop = -totalWidthTop / 2;

		// Ancho del track en esta posición Y
		const widthAtY = this.TRACK_WIDTH_TOP + (this.TRACK_WIDTH_BOTTOM - this.TRACK_WIDTH_TOP) * ratio;

		// Posición X izquierda del track en esta Y
		const xLeftTop = offsetTop + trackIndex * (this.TRACK_WIDTH_TOP + this.TRACK_SPACING);
		const xLeftBottom = offsetBottom + trackIndex * (this.TRACK_WIDTH_BOTTOM + this.TRACK_SPACING);
		const xLeft = xLeftTop + (xLeftBottom - xLeftTop) * ratio;

		// Centro del track
		return xLeft + widthAtY / 2;
	}

	private getNoteScale(yPosition: number): number {
		// Escala basada en la profundidad (más grande cerca, más pequeño lejos)
		const ratio = yPosition / this.TRACK_HEIGHT;
		const minScale = 0.4; // Escala en la parte superior
		const maxScale = 1.0; // Escala en la parte inferior
		return minScale + (maxScale - minScale) * ratio;
	}

	private updateNoteTrail(noteData: NoteData): void {
		const trackColor = this.TRACK_COLORS[noteData.trackIndex];

		if (noteData.graphic.y > this.TRAIL_SPACING) {
			const trailY = noteData.graphic.y - this.TRAIL_SPACING;
			const trailSegment = new Graphics();
			const trailScale = this.getNoteScale(trailY);

			trailSegment.beginFill(trackColor, 0.4);
			trailSegment.drawCircle(0, 0, 20);
			trailSegment.endFill();
			trailSegment.x = this.getTrackCenterX(noteData.trackIndex, trailY);
			trailSegment.y = trailY;
			trailSegment.scale.set(trailScale);

			noteData.trail.push(trailSegment);
			this.trailContainer.addChild(trailSegment);

			if (noteData.trail.length > this.TRAIL_LENGTH) {
				const oldSegment = noteData.trail.shift();
				if (oldSegment) {
					this.trailContainer.removeChild(oldSegment);
				}
			}
		}

		noteData.trail.forEach((segment, index) => {
			const fadeRatio = index / noteData.trail.length;
			segment.alpha = fadeRatio * 0.4;
		});
	}

	private removeNoteData(noteData: NoteData): void {
		const index = this.activeNotes.indexOf(noteData);
		if (index !== -1) {
			this.activeNotes.splice(index, 1);
		}
		this.gameContainer.removeChild(noteData.graphic);

		noteData.trail.forEach((segment: Graphics) => {
			this.trailContainer.removeChild(segment);
		});
	}

	private updateUI(): void {
		this.scoreText.text = `Score: ${this.score}`;

		if (this.currentCombo > 0) {
			const comboMultiplier = Math.min(Math.floor(this.currentCombo / 10) + 1, 4);
			this.comboText.text = `Combo: ${this.currentCombo}x  (${comboMultiplier}x multiplier)`;
			this.comboText.visible = true;
		} else {
			this.comboText.visible = false;
		}
	}

	private showHitFeedback(trackIndex: number, accuracy: HitAccuracy): void {
		const colors = {
			perfect: 0xffd700,
			good: 0x00ff00,
			ok: 0xffa500,
			miss: 0xff0000,
		};

		const feedback = new Graphics();
		feedback.beginFill(colors[accuracy]);
		feedback.drawCircle(0, 0, 30);
		feedback.endFill();
		feedback.alpha = 0.8;
		feedback.x = this.getTrackCenterX(trackIndex, this.targetLine.y);
		feedback.y = this.targetLine.y;
		feedback.scale.set(this.getNoteScale(this.targetLine.y));

		this.feedbackContainer.addChild(feedback);

		const startTime = Date.now();
		const animate = () => {
			const elapsed = Date.now() - startTime;
			if (elapsed < 300) {
				feedback.alpha = 0.8 * (1 - elapsed / 300);
				const baseScale = this.getNoteScale(this.targetLine.y);
				feedback.scale.set(baseScale * (1 + elapsed / 300));
				requestAnimationFrame(animate);
			} else {
				this.feedbackContainer.removeChild(feedback);
			}
		};
		animate();
	}

	private updateFeedback(): void {
		this.tracks.forEach((track, index) => {
			if (this.pressedTracks.has(index)) {
				track.alpha = 0.8;
			} else {
				track.alpha = 1;
			}
		});
	}

	private playNoteSound(note: string): void {
		try {
			this.synth.triggerAttackRelease(note, "8n");
		} catch (error) {
			console.error(`Error playing note ${note}:`, error);
		}
	}

	public override update(_dt: number): void {
		if (!this.isGameRunning) {
			return;
		}

		const currentTime = Date.now() - this.gameStartTime;

		this.songNotes.forEach((songNote, index) => {
			const spawnTime = songNote.time - this.FALL_TIME;
			if (currentTime >= spawnTime && !this.scheduledNotes.has(index)) {
				this.scheduledNotes.add(index);
				this.spawnNote(songNote.track, songNote.note, songNote.time);
			}
		});

		const notesToRemove: NoteData[] = [];

		this.activeNotes.forEach((noteData) => {
			if (noteData.wasHit) {
				return;
			}

			noteData.graphic.y += this.NOTE_SPEED * _dt;
			noteData.graphic.x = this.getTrackCenterX(noteData.trackIndex, noteData.graphic.y);
			noteData.graphic.scale.set(this.getNoteScale(noteData.graphic.y));
			this.updateNoteTrail(noteData);

			if (noteData.graphic.y > this.targetLine.y + this.OK_MARGIN) {
				this.hitStats.miss++;
				this.currentCombo = 0;
				this.showHitFeedback(noteData.trackIndex, "miss");
				notesToRemove.push(noteData);
				this.updateUI();
			}
		});

		notesToRemove.forEach((noteData) => this.removeNoteData(noteData));

		this.updateParticles(_dt);

		if (currentTime > this.songNotes[this.songNotes.length - 1].time + 2000 && this.activeNotes.length === 0) {
			this.endGame();
		}
	}

	private createResultsScreen(): void {
		this.resultsContainer.removeChildren();

		const bg = new Graphics();
		bg.beginFill(0x000000, 0.85);
		bg.drawRoundedRect(0, 0, 500, 600, 20);
		bg.endFill();
		bg.x = -250;
		bg.y = -300;
		this.resultsContainer.addChild(bg);

		const titleStyle = new TextStyle({
			fill: "#FFD700",
			fontSize: 48,
			fontWeight: "bold",
			align: "center",
			stroke: "#000000",
			strokeThickness: 6,
		});

		const title = new Text("¡Juego Terminado!", titleStyle);
		title.anchor.set(0.5);
		title.y = -250;
		this.resultsContainer.addChild(title);

		const statsStyle = new TextStyle({
			fill: "#ffffff",
			fontSize: 32,
			fontWeight: "bold",
			align: "center",
			stroke: "#000000",
			strokeThickness: 4,
		});

		const totalNotes = this.songNotes.length;
		const accuracy = (((this.hitStats.perfect + this.hitStats.good + this.hitStats.ok) / totalNotes) * 100).toFixed(1);

		const stats = [
			`Score Final: ${this.score}`,
			`Precisión: ${accuracy}%`,
			``,
			`Perfect: ${this.hitStats.perfect}`,
			`Good: ${this.hitStats.good}`,
			`Ok: ${this.hitStats.ok}`,
			`Miss: ${this.hitStats.miss}`,
			``,
			`Mejor Combo: ${this.maxCombo}x`,
		];

		let yPos = -150;
		stats.forEach((stat) => {
			const text = new Text(stat, statsStyle);
			text.anchor.set(0.5);
			text.y = yPos;
			this.resultsContainer.addChild(text);
			yPos += 45;
		});

		this.resultsContainer.visible = true;
	}

	private endGame(): void {
		this.isGameRunning = false;
		this.startButton.visible = true;
		this.createResultsScreen();

		const buttonText = this.startButton.children[0] as Text;
		buttonText.text = "¡Jugar de nuevo!";
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.trailContainer, newW, newH, 640, 840, ScaleHelper.FIT);
		this.trailContainer.x = newW * 0.5;
		this.trailContainer.y = newH * 0.5;
		const containerBounds = this.gameContainer.getLocalBounds();
		this.trailContainer.pivot.set(0, containerBounds.height * 0.5);

		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, 640, 840, ScaleHelper.FIT);
		this.gameContainer.x = newW * 0.5;
		this.gameContainer.y = newH * 0.5;
		this.gameContainer.pivot.set(0, containerBounds.height * 0.5);

		ScaleHelper.setScaleRelativeToIdeal(this.particlesContainer, newW, newH, 640, 840, ScaleHelper.FIT);
		this.particlesContainer.x = newW * 0.5;
		this.particlesContainer.y = newH * 0.5;
		this.particlesContainer.pivot.set(0, containerBounds.height * 0.5);

		ScaleHelper.setScaleRelativeToIdeal(this.feedbackContainer, newW, newH, 640, 840, ScaleHelper.FIT);
		this.feedbackContainer.x = newW * 0.5;
		this.feedbackContainer.y = newH * 0.5;
		this.feedbackContainer.pivot.set(0, containerBounds.height * 0.5);

		this.startButton.x = newW * 0.5 - this.startButton.width / 2;
		this.startButton.y = newH * 0.8;

		this.accuracyText.x = newW * 0.5;
		this.accuracyText.y = newH * 0.3;

		this.resultsContainer.x = newW * 0.5;
		this.resultsContainer.y = newH * 0.5;
	}
}
