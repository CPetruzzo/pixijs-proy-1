import * as Tone from "tone";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import * as PIXI from "pixi.js";

export class PhantomFrequenciesScene extends PixiScene {
	private player: PIXI.Graphics;
	private interference: PIXI.Graphics[];
	private frequencyVisualizer: PIXI.Graphics;
	private currentFrequency: number;
	private synth: Tone.Synth;
	private dangerSynth: Tone.Synth;
	private frequencyLoop: Tone.Loop;

	constructor() {
		super();

		this.interference = [];
		this.currentFrequency = 440; // Hz, inicial
		this.synth = new Tone.Synth().toDestination();
		this.dangerSynth = new Tone.Synth({
			oscillator: { type: "sine" },
			envelope: { attack: 0.1, release: 0.2 },
		}).toDestination();

		this.createStartButton();
	}

	private createStartButton(): void {
		const startButton = document.createElement("button");
		startButton.innerText = "Start Game";
		startButton.style.position = "absolute";
		startButton.style.top = "50%";
		startButton.style.left = "50%";
		startButton.style.transform = "translate(-50%, -50%)";
		startButton.style.padding = "10px 20px";
		startButton.style.fontSize = "18px";
		startButton.style.cursor = "pointer";

		document.body.appendChild(startButton);

		startButton.addEventListener("click", async () => {
			await this.startAudio();
			this.createScene();
			this.setupInput();
			startButton.remove();
		});
	}

	private async startAudio(): Promise<void> {
		await Tone.start();
		console.log("Audio initialized.");

		this.frequencyLoop = new Tone.Loop((time) => {
			this.synth.triggerAttackRelease(`${this.currentFrequency}Hz`, "8n", time);
		}, "2n");
		this.frequencyLoop.start(0);
		Tone.Transport.start();
	}

	private createScene(): void {
		// Crear fondo
		const background = new PIXI.Graphics();
		background.beginFill(0x000000).drawRect(0, 0, 800, 600).endFill();
		this.addChild(background);

		// Crear jugador
		this.player = new PIXI.Graphics();
		this.player.beginFill(0x00ff00).drawCircle(0, 0, 15).endFill();
		this.player.x = 400;
		this.player.y = 300;
		this.addChild(this.player);

		// Crear interferencias
		for (let i = 0; i < 5; i++) {
			const interference = new PIXI.Graphics();
			interference.beginFill(0xff0000).drawCircle(0, 0, 20).endFill();
			interference.x = Math.random() * 800;
			interference.y = Math.random() * 600;
			this.interference.push(interference);
			this.addChild(interference);
		}

		// Crear visualizador de frecuencia
		this.frequencyVisualizer = new PIXI.Graphics();
		this.frequencyVisualizer.beginFill(0x66ccff).drawRect(350, 580, 100, 10).endFill();
		this.addChild(this.frequencyVisualizer);
	}

	private setupInput(): void {
		window.addEventListener("keydown", (e) => {
			if (e.key === "ArrowUp") {
				this.adjustFrequency(10); // Aumentar frecuencia
			} else if (e.key === "ArrowDown") {
				this.adjustFrequency(-10); // Disminuir frecuencia
			} else if (e.key === "ArrowRight") {
				this.movePlayer(10, 0); // Mover a la derecha
			} else if (e.key === "ArrowLeft") {
				this.movePlayer(-10, 0); // Mover a la izquierda
			}
		});
	}

	private adjustFrequency(amount: number): void {
		this.currentFrequency += amount;
		this.updateFrequencyVisualizer();
		console.log("Current Frequency:", this.currentFrequency, "Hz");
	}

	private updateFrequencyVisualizer(): void {
		this.frequencyVisualizer.width = Math.min(400, Math.max(100, this.currentFrequency / 2));
	}

	private movePlayer(dx: number, dy: number): void {
		this.player.x += dx;
		this.player.y += dy;

		this.checkForDanger();
	}

	private checkForDanger(): void {
		for (const interference of this.interference) {
			const distance = Math.hypot(this.player.x - interference.x, this.player.y - interference.y);
			if (distance < 50) {
				this.triggerDanger();
				break;
			}
		}
	}

	private triggerDanger(): void {
		this.dangerSynth.triggerAttackRelease("C3", "8n");
		console.log("Danger nearby!");
	}
}
