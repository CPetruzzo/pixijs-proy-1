import * as Tone from "tone";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import * as PIXI from "pixi.js";

export class PulseHeistGameScene extends PixiScene {
	private isOnBeat: boolean;
	private nodes: PIXI.Graphics[];
	private player: PIXI.Graphics;
	private currentNodeIndex: number;
	private errorSynth: Tone.Synth; // Síntesis para el sonido de error

	constructor() {
		super();

		this.isOnBeat = false;
		this.nodes = [];
		this.currentNodeIndex = 0;
		this.errorSynth = new Tone.Synth().toDestination(); // Sintetizador para error

		// Crear botón de inicio
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
			await this.startMusic();
			this.createScene();
			this.setupInput();

			// Remover botón de inicio después de iniciar
			startButton.remove();
		});
	}

	private async startMusic(): Promise<void> {
		await Tone.start();
		console.log("Audio ready!");

		const synth = new Tone.Synth().toDestination();

		// Loop que activa una ventana de sincronización con el ritmo
		const loop = new Tone.Loop((time) => {
			synth.triggerAttackRelease("C4", "8n", time);
			this.isOnBeat = true;

			// Desactivar el "beat" después de un corto intervalo
			setTimeout(() => (this.isOnBeat = false), 150); // Ventana de 150ms
		}, "4n");

		loop.start(0);
		Tone.Transport.start();
	}

	private createScene(): void {
		// Crear nodos
		for (let i = 0; i < 5; i++) {
			const node = new PIXI.Graphics();
			node.beginFill(0x66ccff).drawCircle(0, 0, 20).endFill();
			node.x = Math.random() * 800;
			node.y = Math.random() * 600;
			this.nodes.push(node);
			this.addChild(node);
		}

		// Crear el jugador (inicia en el primer nodo)
		this.player = new PIXI.Graphics();
		this.player.beginFill(0xff0000).drawCircle(0, 0, 15).endFill();
		this.addChild(this.player);
		this.updatePlayerPosition();
	}

	private setupInput(): void {
		window.addEventListener("keydown", (e) => {
			if (e.key === "ArrowRight" && this.isOnBeat) {
				this.moveToNextNode();
			} else if (e.key === "ArrowRight" && !this.isOnBeat) {
				this.playErrorSound(); // Reproduce sonido de error si no está en ritmo
				console.log("Missed the beat!");
			}
		});
	}

	private moveToNextNode(): void {
		this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodes.length;
		this.updatePlayerPosition();
		console.log("Moved to node:", this.currentNodeIndex);
	}

	private updatePlayerPosition(): void {
		const targetNode = this.nodes[this.currentNodeIndex];
		this.player.x = targetNode.x;
		this.player.y = targetNode.y;
	}

	// Reproduce un sonido de error
	private playErrorSound(): void {
		this.errorSynth.triggerAttackRelease("E4", "8n"); // Nota E4 para el error
	}
}
