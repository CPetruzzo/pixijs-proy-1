/* eslint-disable prettier/prettier */
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Text, TextStyle } from "@pixi/text";
import { Tween } from "tweedle.js";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { AnimalButtonSounds } from "../AnimalButtonSounds"; // por compatibilidad si tenés otra clase
import { HudSounds } from "../HudSounds";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";

export class AnimalSounds extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];

	private sceneContainer: Container;
	private bg: Sprite;
	private ui: HudSounds;
	private animalButtons: any;

	// Simon state (usamos ids de botones tal como los emite la botonera)
	private sequence: string[] = [];
	private playerIndex = 0;
	private mode: "idle" | "playing" | "waiting" | "gameover" = "idle";
	private millisBetweenNotes = 700;
	private readonly retriesAllowed = 1;
	private retriesLeft = this.retriesAllowed;

	// HUD texts
	private levelText: Text;
	private infoText: Text;

	// Start text fallback (visible start button)
	private startText: Text;

	// orden (coincide con lo que tu botonera emite; según logs son 'xxx-sfx')
	private static readonly ANIMAL_IDS = [
		"rooster-sfx", // gallo
		"pig-sfx",     // pig
		"cow-sfx",     // cow
		"horse-sfx",   // horse
		"sheep-sfx",   // sheep
		"duck-sfx",    // duck
	];

	constructor() {
		super();

		// --- contenedores y fondo ---
		this.sceneContainer = new Container();
		this.sceneContainer.pivot.set(this.sceneContainer.width * 0.5, this.sceneContainer.height * 0.5);

		this.bg = Sprite.from("BG10");
		this.bg.anchor.set(0.5);

		// --- HUD ---
		this.ui = new HudSounds();
		this.ui.position.set(-20, -250);
		this.ui.scale.set(0.8);

		const lvlStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 36,
			fill: "#ffffff",
			stroke: "#000000",
			strokeThickness: 5,
			align: "center",
		});
		const infoStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 28,
			fill: "#ffffff",
			stroke: "#000000",
			strokeThickness: 4,
			align: "center",
		});

		this.levelText = new Text("Level: 0", lvlStyle);
		this.levelText.position.set(-20, -180);
		this.levelText.anchor.set(0.5);

		this.infoText = new Text("Press Start", infoStyle);
		this.infoText.position.set(-20, -140);
		this.infoText.anchor.set(0.5);

		// --- Botonera de animales ---
		this.animalButtons = new (AnimalButtonSounds as any)();
		this.animalButtons.scale.set(0.8);
		this.animalButtons.position.set(80, 150);

		// --- Start Text (fallback interactivo) ---
		const startStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 42,
			fill: "#ffffff",
			stroke: "#0066cc",
			strokeThickness: 6,
			align: "center",
		});
		this.startText = new Text("▶ START", startStyle);
		this.startText.anchor.set(0.5);
		this.startText.position.set(0, 240);
		this.startText.interactive = true;
		this.startText.on("pointerdown", () => {
			console.log("[AnimalSounds] startText pressed -> calling startGame()");
			this.startGame();
		});

		// Ensamblado
		this.sceneContainer.addChild(this.bg, this.ui, this.animalButtons, this.levelText, this.infoText, this.startText);
		this.addChild(this.sceneContainer);

		// --- Listeners HUD ---
		this.ui.on("ButtonStart" as any, () => {
			console.log("[AnimalSounds] HUD ButtonStart event received");
			if (this.mode === "idle" || this.mode === "gameover") {
				this.startGame();
			}
		});
		this.ui.on("ButtonRetry" as any, () => {
			console.log("[AnimalSounds] HUD ButtonRetry event received");
			if (this.mode === "gameover") {
				this.startGame();
			}
		});
		this.ui.on("ButtonRestart" as any, () => {
			console.log("[AnimalSounds] HUD ButtonRestart event received");
			if (this.mode === "gameover") {
				this.startGame();
			}
		});

		// --- Listeners botones animales (responder al click del jugador) ---
		this.animalButtons.on("CLICKED_ANIMAL" as any, (id: string) => {
			console.log("[AnimalSounds] CLICKED_ANIMAL ->", id);
			this.onPlayerPress(String(id));
		});
		this.animalButtons.on("ANIMAL_CLICK" as any, (id: string) => {
			console.log("[AnimalSounds] ANIMAL_CLICK ->", id);
			this.onPlayerPress(String(id));
		});

		SoundLib.stopAllMusic();
		// SoundLib.playMusic("ambient", { loop: true, volume: 0.3 });

		// inicial
		this.setIdleState();
	}

	// ---------- Ciclo / Resize ----------
	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToScreen(this.sceneContainer, newW, newH, 1, 1, ScaleHelper.FILL);
		this.sceneContainer.x = newW * 0.5;
		this.sceneContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToScreen(this.animalButtons, newW, newH, 0.8, 0.1, ScaleHelper.FILL);

	}

	public override update(): void {
		// lógica basada en eventos/tweens
	}

	// ---------- Lógica Simon ----------

	private startGame(): void {
		console.log("[AnimalSounds] startGame()");
		this.sequence = [];
		this.playerIndex = 0;
		this.mode = "idle";
		this.retriesLeft = this.retriesAllowed;
		this.levelText.text = `Level: 0`;
		this.infoText.text = "Get ready!";
		this.startText.visible = false;
		this.addStepAndPlay();
	}

	private addStepAndPlay(): void {
		const next = this.getRandomAnimalId();
		this.sequence.push(next);
		this.levelText.text = `Level: ${this.sequence.length}`;
		console.log("[AnimalSounds] addStepAndPlay sequence =", this.sequence);
		this.playSequence();
	}

	private async playSequence(): Promise<void> {
		console.log("[AnimalSounds] playSequence() -> playing ", this.sequence);
		this.mode = "playing";
		this.infoText.text = "Playing...";
		this.disableButtons();

		await this.delay(300);

		for (const id of this.sequence) {
			console.log("[AnimalSounds] playStep ->", id);
			await this.playStep(id);
			await this.delay(this.millisBetweenNotes);
		}

		this.mode = "waiting";
		this.playerIndex = 0;
		this.infoText.text = "Your turn!";
		this.enableButtons();
	}

	private async playStep(id: string): Promise<void> {
		// highlight visual
		const display = this.getButtonDisplayById(id);
		if (display) {
			new Tween(display.scale)
				.to({ x: display.scale.x * 1.15, y: display.scale.y * 1.15 }, 140)
				.yoyo(true)
				.repeat(1)
				.start();
		}

		// play sound (intento seguro)
		await this.safePlaySound([id]);

		// esperar a que termine la animación/sonido — fallback
		return this.delay(450);
	}

	private onPlayerPress(id: string): void {
		console.log("[AnimalSounds] onPlayerPress()", { id, mode: this.mode, playerIndex: this.playerIndex, sequence: this.sequence });
		if (this.mode !== "waiting" || this.gameOver()) {
			console.log("[AnimalSounds] Ignoring press (not waiting or gameover)");
			return;
		}

		// deshabilito inmediatamente para evitar double clicks
		this.disableButtons();

		// feedback inmediato: highlight + sound
		const display = this.getButtonDisplayById(id);
		if (display) {
			new Tween(display.scale)
				.to({ x: display.scale.x * 1.12, y: display.scale.y * 1.12 }, 120)
				.yoyo(true)
				.repeat(1)
				.start();
		}
		// reproducir sonido del botón (no await para que el feedback sea rápido)
		this.safePlaySound([id]);

		const expected = this.sequence[this.playerIndex];
		if (id === expected) {
			// correcto
			this.playerIndex++;
			this.safePlaySound(["success-sfx", "success", "win-sfx"]);
			if (this.playerIndex >= this.sequence.length) {
				// completó nivel
				this.infoText.text = "Great!";
				setTimeout(() => {
					this.addStepAndPlay();
				}, 700);
			} else {
				// habilitar para siguiente input
				this.enableButtons();
			}
		} else {
			// fallo
			this.safePlaySound(["fail-sfx", "beep", "wrong-sfx"]);
			this.handleFail();
		}
	}

	private handleFail(): void {
		console.log("[AnimalSounds] handleFail(), retriesLeft before:", this.retriesLeft);
		this.retriesLeft--;
		this.disableButtons();

		if (this.retriesLeft >= 0) {
			// repetir misma secuencia
			this.infoText.text = `Wrong! Try again (${this.retriesLeft} left)`;
			this.flashAllButtons();
			setTimeout(() => {
				this.playSequence();
			}, 900);
		} else {
			// game over
			this.mode = "gameover";
			this.infoText.text = "Game Over!";
			this.safePlaySound(["gameover-sfx", "gameover", "fail-sfx"]);
			this.startText.visible = true;
		}
	}

	private setIdleState(): void {
		this.mode = "idle";
		this.levelText.text = `Level: ${this.sequence.length}`;
		this.infoText.text = "Press Start";
		this.startText.visible = true;
		this.disableButtons();
	}

	// ---------- Helpers ----------

	private getRandomAnimalId(): string {
		const list = AnimalSounds.ANIMAL_IDS;
		const idx = Math.floor(Math.random() * list.length);
		return list[idx];
	}

	/**
	 * Intenta reproducir una o varias claves de sonido de forma segura.
	 * Devuelve una Promise<void> para que pueda usarse con `await`,
	 * pero no está marcada como async (evita eslint@require-await).
	 */
	private safePlaySound(keyOrKeys: string | string[], opts?: any): Promise<void> {
		const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];

		for (const k of keys) {
			if (!k) { continue; }
			try {
				if (SoundLib && typeof SoundLib.playSound === "function") {
					try {
						SoundLib.playSound(k, opts);
						// si playSound no lanza, consideramos que funcionó
						return Promise.resolve();
					} catch (err) {
						// si falla, seguimos con la siguiente key
					}
				}
			} catch {
				// ignore
			}
		}

		// ninguna clave funcionó -> resolvemos de todos modos (sin lanzar)
		return Promise.resolve();
	}

	// intenta obtener el display object del botón por id
	private getButtonDisplayById(id: string): any | null {
		try {
			const anyBtn = this.animalButtons;
			const cont = anyBtn.children && anyBtn.children[0] ? anyBtn.children[0] : anyBtn;
			const order = AnimalSounds.ANIMAL_IDS;
			const idx = order.indexOf(id);
			if (idx === -1) { return null; }
			if (cont && cont.children && cont.children[idx]) {
				return cont.children[idx];
			}
		} catch (e) {
			// ignore
		}
		return null;
	}

	private flashAllButtons(): void {
		const anyBtn = this.animalButtons;
		const cont = anyBtn.children && anyBtn.children[0] ? anyBtn.children[0] : anyBtn;
		const children = cont && cont.children ? cont.children : [];
		for (const c of children) {
			const origX = c.x;
			new Tween(c)
				.from({ x: origX - 6 })
				// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
				.to({ x: origX + 6 }, 90)
				.yoyo(true)
				.repeat(2)
				.start();
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((res) => setTimeout(res, ms));
	}

	public getButtonsCount(): number {
		return AnimalSounds.ANIMAL_IDS.length;
	}

	private gameOver(): boolean {
		return this.mode === "gameover";
	}

	// Robust enable/disable buttons (usa methods de la botonera si existen, si no parchea children)
	private disableButtons(): void {
		try {
			if (this.animalButtons && typeof this.animalButtons.interactiveNo === "function") {
				this.animalButtons.interactiveNo();
				return;
			}
			// fallback: desactivar children
			const cont = this.animalButtons && (this.animalButtons.children && this.animalButtons.children[0] ? this.animalButtons.children[0] : this.animalButtons);
			if (cont && cont.children) {
				for (const c of cont.children) { c.interactive = false; }
			}
		} catch (e) {
			// ignore
		}
	}

	private enableButtons(): void {
		try {
			if (this.animalButtons && typeof this.animalButtons.interactiveYes === "function") {
				this.animalButtons.interactiveYes();
				return;
			}
			const cont = this.animalButtons && (this.animalButtons.children && this.animalButtons.children[0] ? this.animalButtons.children[0] : this.animalButtons);
			if (cont && cont.children) {
				for (const c of cont.children) { c.interactive = true; }
			}
		} catch (e) {
			// ignore
		}
	}
}
