/* eslint-disable prettier/prettier */
import * as Tone from "tone";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import * as PIXI from "pixi.js";

interface Interference {
	graphic: PIXI.Graphics;
	glow: PIXI.Graphics;
	frequency: number;
	pulsePhase: number;
	frequencyLabel: PIXI.Text;
	detectionRing: PIXI.Graphics;
}

export class PhantomFrequenciesScene extends PixiScene {
	private player: PIXI.Graphics;
	private playerGlow: PIXI.Graphics;
	private interference: Interference[];
	private frequencyVisualizer: PIXI.Graphics;
	private frequencyText: PIXI.Text;
	private scoreText: PIXI.Text;
	private feedbackText: PIXI.Text;
	private tutorialText: PIXI.Text;
	private currentFrequency: number;
	public targetFrequency: number;
	private synth: Tone.Synth;
	private dangerSynth: Tone.Synth;
	private successSynth: Tone.Synth;
	private frequencyLoop: Tone.Loop;
	private score: number;
	private particles: PIXI.Graphics[];
	private gameActive: boolean;
	private grid: PIXI.Graphics;
	private waveform: PIXI.Graphics;
	private readonly DETECTION_RANGE = 80;
	private readonly PERFECT_RANGE = 15;

	constructor() {
		super();

		this.interference = [];
		this.particles = [];
		this.currentFrequency = 440;
		this.targetFrequency = 440;
		this.score = 0;
		this.gameActive = false;

		// Sintetizadores con mejor diseño de sonido
		this.synth = new Tone.Synth({
			oscillator: { type: "sine" },
			envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.8 },
		}).toDestination();
		this.synth.volume.value = -12;

		this.dangerSynth = new Tone.Synth({
			oscillator: { type: "sawtooth" },
			envelope: { attack: 0.01, release: 0.15 },
		}).toDestination();
		this.dangerSynth.volume.value = -8;

		this.successSynth = new Tone.Synth({
			oscillator: { type: "triangle" },
			envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.5 },
		}).toDestination();
		this.successSynth.volume.value = -10;

		this.createStartButton();
	}

	private createStartButton(): void {
		const startButton = document.createElement("button");
		startButton.innerText = "🎮 Iniciar Phantom Frequencies";
		startButton.style.cssText = `
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			padding: 15px 35px;
			font-size: 20px;
			font-weight: bold;
			cursor: pointer;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			border: none;
			border-radius: 50px;
			box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
			transition: all 0.3s ease;
		`;

		startButton.onmouseover = () => {
			startButton.style.transform = "translate(-50%, -50%) scale(1.05)";
			startButton.style.boxShadow = "0 15px 40px rgba(102, 126, 234, 0.6)";
		};

		startButton.onmouseout = () => {
			startButton.style.transform = "translate(-50%, -50%) scale(1)";
			startButton.style.boxShadow = "0 10px 30px rgba(102, 126, 234, 0.4)";
		};

		document.body.appendChild(startButton);

		startButton.addEventListener("click", async () => {
			await this.startAudio();
			this.createScene();
			this.setupInput();
			this.gameActive = true;
			startButton.remove();
		});
	}

	private async startAudio(): Promise<void> {
		await Tone.start();
		console.log("Audio inicializado.");

		this.frequencyLoop = new Tone.Loop((time) => {
			if (this.gameActive) {
				this.synth.triggerAttackRelease(`${this.currentFrequency}Hz`, "16n", time);
			}
		}, "4n");
		this.frequencyLoop.start(0);
		Tone.Transport.start();
	}

	private createScene(): void {
		// Fondo degradado
		const background = new PIXI.Graphics();
		background.beginFill(0x0a0e27);
		background.drawRect(0, 0, 800, 600);
		background.endFill();
		this.addChild(background);

		// Grid de fondo
		this.grid = new PIXI.Graphics();
		this.drawGrid();
		this.addChild(this.grid);

		// Waveform visual
		this.waveform = new PIXI.Graphics();
		this.addChild(this.waveform);

		// Crear jugador con glow
		this.playerGlow = new PIXI.Graphics();
		this.playerGlow.beginFill(0x00ff88, 0.3);
		this.playerGlow.drawCircle(0, 0, 30);
		this.playerGlow.endFill();
		this.playerGlow.filters = [new PIXI.filters.BlurFilter(8)];
		this.addChild(this.playerGlow);

		this.player = new PIXI.Graphics();
		this.player.beginFill(0x00ff88);
		this.player.drawCircle(0, 0, 12);
		this.player.endFill();
		this.player.beginFill(0xffffff, 0.8);
		this.player.drawCircle(0, 0, 6);
		this.player.endFill();
		this.player.x = 400;
		this.player.y = 300;
		this.addChild(this.player);

		this.playerGlow.x = this.player.x;
		this.playerGlow.y = this.player.y;

		// Crear interferencias con frecuencias aleatorias
		const frequencies = [220, 330, 440, 550, 660, 770];
		for (let i = 0; i < 6; i++) {
			// Ring de detección (invisible inicialmente)
			const detectionRing = new PIXI.Graphics();
			detectionRing.lineStyle(2, 0xffff00, 0);
			detectionRing.drawCircle(0, 0, this.DETECTION_RANGE);
			detectionRing.lineStyle(0);

			const glow = new PIXI.Graphics();
			glow.beginFill(0xff3366, 0.4);
			glow.drawCircle(0, 0, 40);
			glow.endFill();
			glow.filters = [new PIXI.filters.BlurFilter(12)];

			const interference = new PIXI.Graphics();
			interference.lineStyle(3, 0xff3366, 1);
			interference.drawCircle(0, 0, 18);
			interference.lineStyle(0);
			interference.beginFill(0xff3366, 0.6);
			interference.drawCircle(0, 0, 8);
			interference.endFill();

			const x = 150 + (i % 3) * 250;
			const y = 150 + Math.floor(i / 3) * 300;

			detectionRing.x = x;
			detectionRing.y = y;
			glow.x = x;
			glow.y = y;
			interference.x = x;
			interference.y = y;

			// Label de frecuencia
			const label = new PIXI.Text("???", {
				fontFamily: "monospace",
				fontSize: 18,
				fill: 0xff6688,
				fontWeight: "bold",
			});
			label.anchor.set(0.5);
			label.x = x;
			label.y = y + 35;

			this.addChild(detectionRing);
			this.addChild(glow);
			this.addChild(interference);
			this.addChild(label);

			this.interference.push({
				graphic: interference,
				glow: glow,
				frequency: frequencies[i],
				pulsePhase: Math.random() * Math.PI * 2,
				frequencyLabel: label,
				detectionRing: detectionRing,
			});
		}

		// UI Panel
		const uiPanel = new PIXI.Graphics();
		uiPanel.beginFill(0x1a1f3a, 0.9);
		uiPanel.drawRoundedRect(50, 20, 700, 80, 10);
		uiPanel.endFill();
		this.addChild(uiPanel);

		// Visualizador de frecuencia mejorado
		this.frequencyVisualizer = new PIXI.Graphics();
		this.addChild(this.frequencyVisualizer);

		// Texto de frecuencia
		this.frequencyText = new PIXI.Text(`Frecuencia: ${this.currentFrequency} Hz`, {
			fontFamily: "monospace",
			fontSize: 24,
			fill: 0x66ccff,
			fontWeight: "bold",
		});
		this.frequencyText.x = 70;
		this.frequencyText.y = 35;
		this.addChild(this.frequencyText);

		// Texto de puntuación
		this.scoreText = new PIXI.Text(`Puntos: ${this.score}`, {
			fontFamily: "monospace",
			fontSize: 24,
			fill: 0x00ff88,
			fontWeight: "bold",
		});
		this.scoreText.x = 600;
		this.scoreText.y = 35;
		this.addChild(this.scoreText);

		// Instrucciones
		const instructions = new PIXI.Text("WASD: Mover en todas direcciones | ↑↓: Ajustar frecuencia | Espacio: Detectar", {
			fontFamily: "monospace",
			fontSize: 16,
			fill: 0x8899cc,
		});
		instructions.x = 70;
		instructions.y = 70;
		this.addChild(instructions);

		// Texto de feedback
		this.feedbackText = new PIXI.Text("", {
			fontFamily: "monospace",
			fontSize: 28,
			fill: 0xffffff,
			fontWeight: "bold",
			stroke: 0x000000,
			strokeThickness: 4,
		});
		this.feedbackText.anchor.set(0.5);
		this.feedbackText.x = 400;
		this.feedbackText.y = 300;
		this.feedbackText.alpha = 0;
		this.addChild(this.feedbackText);

		// Tutorial inicial
		this.tutorialText = new PIXI.Text(
			"🎯 OBJETIVO: Acércate a los círculos rojos\n" +
			"Muévete con WASD en todas direcciones\n" +
			"Ajusta tu frecuencia (↑↓) para igualar la del objetivo\n" +
			"Presiona ESPACIO cuando coincida y estés cerca\n\n" +
			"¡Empieza moviéndote hacia un círculo rojo!",
			{
				fontFamily: "monospace",
				fontSize: 18,
				fill: 0xffdd00,
				fontWeight: "bold",
				align: "center",
				stroke: 0x000000,
				strokeThickness: 3,
			}
		);
		this.tutorialText.anchor.set(0.5);
		this.tutorialText.x = 400;
		this.tutorialText.y = 300;
		this.addChild(this.tutorialText);

		// Ocultar tutorial después de 10 segundos
		setTimeout(() => {
			if (this.tutorialText) {
				this.removeChild(this.tutorialText);
			}
		}, 10000);
	}

	private drawGrid(): void {
		this.grid.clear();
		this.grid.lineStyle(1, 0x1a2847, 0.5);
		for (let x = 0; x < 800; x += 40) {
			this.grid.moveTo(x, 0);
			this.grid.lineTo(x, 600);
		}
		for (let y = 0; y < 600; y += 40) {
			this.grid.moveTo(0, y);
			this.grid.lineTo(800, y);
		}
	}

	private setupInput(): void {
		const keys = { w: false, s: false, a: false, d: false, up: false, down: false };

		window.addEventListener("keydown", (e) => {
			if (!this.gameActive) {
				return;
			}

			switch (e.key.toLowerCase()) {
				// Movimiento con WASD
				case "w":
					if (!keys.w) {
						keys.w = true;
						this.movePlayer(0, -15);
					}
					break;
				case "s":
					if (!keys.s) {
						keys.s = true;
						this.movePlayer(0, 15);
					}
					break;
				case "a":
					if (!keys.a) {
						keys.a = true;
						this.movePlayer(-15, 0);
					}
					break;
				case "d":
					if (!keys.d) {
						keys.d = true;
						this.movePlayer(15, 0);
					}
					break;
				// Ajuste de frecuencia con flechas
				case "arrowup":
					if (!keys.up) {
						keys.up = true;
						this.adjustFrequency(20);
					}
					e.preventDefault();
					break;
				case "arrowdown":
					if (!keys.down) {
						keys.down = true;
						this.adjustFrequency(-20);
					}
					e.preventDefault();
					break;
				case " ":
					e.preventDefault();
					this.detectFrequency();
					break;
			}
		});

		window.addEventListener("keyup", (e) => {
			switch (e.key.toLowerCase()) {
				case "w":
					keys.w = false;
					break;
				case "s":
					keys.s = false;
					break;
				case "a":
					keys.a = false;
					break;
				case "d":
					keys.d = false;
					break;
				case "arrowup":
					keys.up = false;
					break;
				case "arrowdown":
					keys.down = false;
					break;
			}
		});
	}

	private adjustFrequency(amount: number): void {
		this.currentFrequency = Math.max(200, Math.min(1000, this.currentFrequency + amount));
		this.updateFrequencyVisualizer();
		this.frequencyText.text = `Frecuencia: ${this.currentFrequency} Hz`;
	}

	private updateFrequencyVisualizer(): void {
		this.frequencyVisualizer.clear();

		const barWidth = ((this.currentFrequency - 200) / 800) * 300;
		const gradient = this.frequencyVisualizer.beginFill(0x66ccff, 0.3);
		console.log('gradient', gradient)
		this.frequencyVisualizer.drawRoundedRect(400, 65, barWidth, 8, 4);
		this.frequencyVisualizer.endFill();

		this.frequencyVisualizer.beginFill(0x66ccff);
		this.frequencyVisualizer.drawRoundedRect(400, 65, barWidth, 8, 4);
		this.frequencyVisualizer.endFill();
	}

	private movePlayer(dx: number, dy: number): void {
		// Límites más amplios para que el jugador pueda alcanzar todos los objetivos
		this.player.x = Math.max(30, Math.min(770, this.player.x + dx));
		this.player.y = Math.max(130, Math.min(570, this.player.y + dy));
		this.playerGlow.x = this.player.x;
		this.playerGlow.y = this.player.y;

		this.checkProximity();
	}

	private checkProximity(): void {
		let closestInterference: Interference | null = null;
		let closestDistance = Infinity;

		// Resetear todos los rings y labels
		for (const interference of this.interference) {
			interference.detectionRing.alpha = 0;
			interference.frequencyLabel.text = "???";
			interference.frequencyLabel.style.fill = 0xff6688;
		}

		// Encontrar el más cercano
		for (const interference of this.interference) {
			const distance = Math.hypot(this.player.x - interference.graphic.x, this.player.y - interference.graphic.y);

			if (distance < closestDistance) {
				closestDistance = distance;
				closestInterference = interference;
			}
		}

		// Mostrar feedback del más cercano
		if (closestInterference && closestDistance < this.DETECTION_RANGE) {
			// Mostrar ring de detección
			closestInterference.detectionRing.alpha = 0.6;

			// Mostrar frecuencia
			closestInterference.frequencyLabel.text = `${closestInterference.frequency} Hz`;

			const freqDiff = Math.abs(this.currentFrequency - closestInterference.frequency);

			if (freqDiff < this.PERFECT_RANGE) {
				// Perfecto - verde
				closestInterference.frequencyLabel.style.fill = 0x00ff88;
				closestInterference.detectionRing.lineStyle(3, 0x00ff88, 0.8);
			} else if (freqDiff < 50) {
				// Cerca - amarillo
				closestInterference.frequencyLabel.style.fill = 0xffdd00;
				closestInterference.detectionRing.lineStyle(3, 0xffdd00, 0.6);
			} else {
				// Lejos - rojo
				closestInterference.frequencyLabel.style.fill = 0xff3366;
				closestInterference.detectionRing.lineStyle(3, 0xff3366, 0.4);
			}

			closestInterference.detectionRing.clear();
			closestInterference.detectionRing.drawCircle(0, 0, this.DETECTION_RANGE);

			if (freqDiff < 50) {
				this.dangerSynth.triggerAttackRelease("C3", "16n");
			}
		}
	}

	private detectFrequency(): void {
		let detected = false;
		let bestMatch: { interference: Interference; diff: number } | null = null;

		for (const interference of this.interference) {
			const distance = Math.hypot(this.player.x - interference.graphic.x, this.player.y - interference.graphic.y);

			if (distance < this.DETECTION_RANGE) {
				const freqDiff = Math.abs(this.currentFrequency - interference.frequency);

				if (!bestMatch || freqDiff < bestMatch.diff) {
					bestMatch = { interference, diff: freqDiff };
				}
			}
		}

		if (bestMatch) {
			if (bestMatch.diff < this.PERFECT_RANGE) {
				// Detección perfecta
				this.score += 100;
				this.showFeedback("¡PERFECTO! +100", 0x00ff88);
				this.successSynth.triggerAttackRelease("C5", "8n");
				this.createSuccessParticles(bestMatch.interference.graphic.x, bestMatch.interference.graphic.y);
				this.respawnInterference(bestMatch.interference);
				detected = true;
			} else if (bestMatch.diff < 50) {
				// Detección cercana
				this.score += 25;
				this.showFeedback(`Cerca: ${Math.round(bestMatch.diff)}Hz de diferencia +25`, 0xffdd00);
				this.successSynth.triggerAttackRelease("G4", "16n");
				detected = true;
			} else {
				// Muy lejos
				this.showFeedback(`Demasiado lejos: ${Math.round(bestMatch.diff)}Hz de diferencia`, 0xff6688);
			}
		}

		if (!detected && !bestMatch) {
			this.score = Math.max(0, this.score - 10);
			this.showFeedback("Fuera de rango -10", 0xff3366);
			this.dangerSynth.triggerAttackRelease("C2", "32n");
		}

		this.scoreText.text = `Puntos: ${this.score}`;
	}

	private showFeedback(text: string, color: number): void {
		this.feedbackText.text = text;
		this.feedbackText.style.fill = color;
		this.feedbackText.alpha = 1;
		this.feedbackText.scale.set(1);

		// Animación de fade out
		const fadeOut = (): void => {
			this.feedbackText.alpha -= 0.02;
			this.feedbackText.scale.set(this.feedbackText.scale.x + 0.01);

			if (this.feedbackText.alpha > 0) {
				requestAnimationFrame(fadeOut);
			}
		};

		setTimeout(() => fadeOut(), 500);
	}

	private respawnInterference(interference: Interference): void {
		interference.graphic.x = 100 + Math.random() * 600;
		interference.graphic.y = 150 + Math.random() * 400;
		interference.glow.x = interference.graphic.x;
		interference.glow.y = interference.graphic.y;
		interference.detectionRing.x = interference.graphic.x;
		interference.detectionRing.y = interference.graphic.y;
		interference.frequencyLabel.x = interference.graphic.x;
		interference.frequencyLabel.y = interference.graphic.y + 35;
		interference.frequency = 200 + Math.floor(Math.random() * 8) * 100;
		interference.frequencyLabel.text = "???";
	}

	private createSuccessParticles(x: number, y: number): void {
		for (let i = 0; i < 12; i++) {
			const particle = new PIXI.Graphics();
			particle.beginFill(0x00ff88);
			particle.drawCircle(0, 0, 3);
			particle.endFill();
			particle.x = x;
			particle.y = y;

			const angle = (Math.PI * 2 * i) / 12;
			const speed = 3 + Math.random() * 2;
			(particle as any).vx = Math.cos(angle) * speed;
			(particle as any).vy = Math.sin(angle) * speed;
			(particle as any).life = 30;

			this.particles.push(particle);
			this.addChild(particle);
		}
	}

	public override update(deltaSeconds: number): void {
		super.update(deltaSeconds);

		if (!this.gameActive) {
			return;
		}

		// Animar interferencias
		for (const interference of this.interference) {
			interference.pulsePhase += deltaSeconds * 2;
			const scale = 1 + Math.sin(interference.pulsePhase) * 0.15;
			interference.glow.scale.set(scale);
		}

		// Actualizar partículas
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const particle = this.particles[i];
			particle.x += (particle as any).vx;
			particle.y += (particle as any).vy;
			(particle as any).life--;
			particle.alpha = (particle as any).life / 30;

			if ((particle as any).life <= 0) {
				this.removeChild(particle);
				this.particles.splice(i, 1);
			}
		}

		// Animar waveform
		this.drawWaveform();
	}

	private drawWaveform(): void {
		this.waveform.clear();
		this.waveform.lineStyle(2, 0x667eea, 0.4);

		const time = Date.now() / 1000;
		const freq = this.currentFrequency / 100;

		this.waveform.moveTo(0, 550 + Math.sin(time * freq) * 20);
		for (let x = 0; x < 800; x += 10) {
			const y = 550 + Math.sin((time + x / 100) * freq) * 20;
			this.waveform.lineTo(x, y);
		}
	}

	public override onResize(_w: number, _h: number): void {
		// Manejar redimensionamiento si es necesario
	}
}
