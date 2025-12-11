/* eslint-disable @typescript-eslint/naming-convention */
import * as Tone from "tone";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { BlurFilter, Container, Graphics, Rectangle, Sprite, Text, TextStyle } from "pixi.js";
import i18next from "i18next";
import { SheetMusicScroll } from "./SheetMusicScroll";

interface PianoKey {
	graphics: Graphics;
	note: string;
	isBlack: boolean;
	originalColor: number;
}

const OCTAVE_STRUCTURE = [
	{ note: "C", type: "white" },
	{ note: "C#", type: "black" },
	{ note: "D", type: "white" },
	{ note: "D#", type: "black" },
	{ note: "E", type: "white" },
	{ note: "F", type: "white" },
	{ note: "F#", type: "black" },
	{ note: "G", type: "white" },
	{ note: "G#", type: "black" },
	{ note: "A", type: "white" },
	{ note: "A#", type: "black" },
	{ note: "B", type: "white" },
];

export class PianoGameScene extends PixiScene {
	private synth: Tone.PolySynth;
	private mainContainer: Container = new Container();
	private pianoContainer: Container = new Container();
	private uiContainer: Container = new Container();
	private menuContainer: Container = new Container();

	private isGameStarted: boolean = false;
	private isMenuOpen: boolean = false;
	private keyMap: Map<Graphics, PianoKey> = new Map();

	private currentStartOctave: number = 4;
	private currentOctaveCount: number = 2;

	private readonly WHITE_KEY_WIDTH = 50;
	private readonly WHITE_KEY_HEIGHT = 200;
	private readonly BLACK_KEY_WIDTH = 30;
	private readonly BLACK_KEY_HEIGHT = 120;
	public static readonly BUNDLES = ["music"];
	private pianoBG: Sprite;
	private sheetMusic: SheetMusicScroll;

	constructor() {
		super();
		this.synth = new Tone.PolySynth(Tone.Synth, {
			oscillator: { type: "square6" },
			envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1.0 },
		}).toDestination();
		this.synth.volume.value = -8;

		this.pianoBG = Sprite.from("pianoGTold");
		this.pianoBG.scale.set(0.382);
		this.pianoBG.anchor.set(0.5);
		this.addChild(this.mainContainer);
		this.mainContainer.addChild(this.pianoBG);
		this.mainContainer.addChild(this.pianoContainer);
		this.mainContainer.addChild(this.uiContainer);
		this.mainContainer.addChild(this.menuContainer);

		this.setupInitialState();

		const pianoBG = Sprite.from("pianoGT");
		pianoBG.scale.set(0.382);
		pianoBG.anchor.set(0.5);
		this.mainContainer.addChild(pianoBG);

		const emptyScroll = Sprite.from("emptyScroll");
		emptyScroll.scale.set(0.375);
		emptyScroll.position.set(0, -150); // Ajustar según necesites
		emptyScroll.alpha = 0.7;
		emptyScroll.anchor.set(0.5);
		this.mainContainer.addChild(emptyScroll);

		this.sheetMusic = new SheetMusicScroll();
		const melody = [""];
		this.sheetMusic.addMelody(melody);
		this.sheetMusic.position.set(-350, -215); // Ajustar según necesites
		this.mainContainer.addChild(this.sheetMusic);
	}

	private setupInitialState(): void {
		this.createStartButton();
		this.createSettingsButton();
		this.createMenu();
		this.menuContainer.visible = false;
		this.renderPiano(this.currentStartOctave, this.currentOctaveCount);
		this.pianoContainer.alpha = 0.5;
		this.pianoContainer.eventMode = "none";
	}

	// --- ESTILOS DE TEXTO ---
	private getButtonTextStyle(fontSize: number = 18): TextStyle {
		return new TextStyle({
			fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', // Fuente limpia
			fontSize: fontSize,
			fontWeight: "bold",
			fill: "#ffffff",
			dropShadow: true,
			dropShadowColor: "#000000",
			dropShadowBlur: 3,
			dropShadowAngle: Math.PI / 2,
			dropShadowDistance: 2,
			align: "center", // Importante para alineación multilínea si ocurriera
		});
	}

	// --- HELPER DE UI CENTRAL (LA SOLUCIÓN AL PROBLEMA) ---
	private createButton(label: string, w: number, h: number, color: number, fontSize: number = 16): Graphics {
		const btn = new Graphics();

		// 1. Dibujamos el rectángulo desde 0,0 hasta w,h
		btn.beginFill(color);
		btn.drawRoundedRect(0, 0, w, h, 10); // Bordes más redondeados (10px)
		btn.endFill();

		// 2. Definimos el Pivot en el CENTRO del rectángulo para que rote/escale desde ahí
		btn.pivot.set(w / 2, h / 2);

		// 3. Sombra falsa (dibujada debajo del botón principal para profundidad)
		// Dibujamos un borde exterior o sombra sólida
		btn.lineStyle(2, 0x000000, 0.2);
		btn.drawRoundedRect(0, 0, w, h, 10);

		// --- CORRECCIÓN DE TEXTO ---
		const txt = new Text(label, this.getButtonTextStyle(fontSize));

		// A. El punto de anclaje del texto es SU propio centro
		txt.anchor.set(0.5);

		// B. La posición del texto es el CENTRO del rectángulo (w/2, h/2)
		// Antes estaba en (0,0) y por eso salía arriba a la izquierda
		txt.position.set(w / 2, h / 2);

		btn.addChild(txt);
		btn.eventMode = "static";
		btn.cursor = "pointer";

		// Animaciones simples de hover
		btn.on("pointerover", () => {
			btn.alpha = 0.9;
			btn.scale.set(1.05);
		});
		btn.on("pointerout", () => {
			btn.alpha = 1;
			btn.scale.set(1);
		});

		return btn;
	}

	// --- UI: Botón de Inicio ---
	private createStartButton(): void {
		// Color azul vibrante y texto más grande
		const btn = this.createButton(i18next.t("piano.start") || "START", 200, 60, 0x007bff, 24);
		btn.name = "startBtn";

		btn.on("pointerdown", async () => {
			if (!this.isGameStarted) {
				await Tone.start();
				this.isGameStarted = true;
				this.pianoContainer.alpha = 1;
				this.pianoContainer.eventMode = "static";
				// Animación de salida
				this.uiContainer.removeChild(btn);
			}
		});

		this.uiContainer.addChild(btn);
	}

	// --- UI: Botón de Ajustes ---
	private createSettingsButton(): void {
		const btn = new Graphics();
		// Fondo gris oscuro circular/redondeado
		btn.beginFill(0x333333).drawRoundedRect(0, 0, 50, 50, 12).endFill();
		btn.lineStyle(2, 0xffffff, 0.2).drawRoundedRect(0, 0, 50, 50, 12);

		const icon = new Text("⚙️", { fontSize: 28 });
		icon.anchor.set(0.5);

		// Centramos el icono en el botón de 50x50
		icon.position.set(25, 25);

		btn.addChild(icon);

		btn.eventMode = "static";
		btn.cursor = "pointer";
		// Posición inicial (se sobreescribe en onResize)
		btn.x = 0;
		btn.y = 0;

		btn.on("pointerdown", () => this.toggleMenu());
		btn.on("pointerover", () => (btn.alpha = 0.8));
		btn.on("pointerout", () => (btn.alpha = 1));

		this.uiContainer.addChild(btn);
		(this as any).settingsBtn = btn;
	}

	// --- UI: Menú ---
	private createMenu(): void {
		const width = 340;
		const height = 300;

		const bg = new Graphics();
		bg.beginFill(0xffffff); // Fondo blanco limpio
		bg.lineStyle(4, 0x333333, 1); // Borde grueso
		bg.drawRoundedRect(0, 0, width, height, 20);
		bg.endFill();

		// Sombra suave para todo el menú
		bg.filters = [new BlurFilter(0.5)];

		const titleStyle = new TextStyle({
			fontFamily: "Arial, Helvetica, sans-serif",
			fontSize: 24,
			fontWeight: "900",
			fill: "#333333",
			letterSpacing: 1,
		});

		const title = new Text("RANGO TECLADO", titleStyle);
		title.anchor.set(0.5); // Centrado
		title.x = width / 2;
		title.y = 35; // Margen superior
		bg.addChild(title);

		const options = [
			{ label: "Pequeño (1 Oct)", octaves: 1, start: 4 },
			{ label: "Normal (2 Oct)", octaves: 2, start: 4 },
			{ label: "Grande (3 Oct)", octaves: 3, start: 3 },
			{ label: "Completo (4 Oct)", octaves: 4, start: 2 },
		];

		let currentY = 80;
		const buttonHeight = 45;
		const gap = 10;

		options.forEach((opt) => {
			// Botones gris pizarra
			const btn = this.createButton(opt.label, 260, buttonHeight, 0x5a6268, 16);

			// Alineación: Mitad del ancho del menú
			btn.x = width / 2;
			btn.y = currentY + buttonHeight / 2; // Compensamos el pivot del botón

			btn.on("pointerdown", () => {
				this.currentOctaveCount = opt.octaves;
				this.currentStartOctave = opt.start;
				this.renderPiano(this.currentStartOctave, this.currentOctaveCount);
				this.toggleMenu();
			});

			bg.addChild(btn);
			currentY += buttonHeight + gap;
		});

		this.menuContainer.addChild(bg);
		// Pivot en el centro del menú para que aparezca centrado en pantalla
		this.menuContainer.pivot.set(width / 2, height / 2);
	}

	public override update(_dt: number): void {
		this.sheetMusic.update(_dt / 60); // Convertir a segundos
	}
	private toggleMenu(): void {
		this.isMenuOpen = !this.isMenuOpen;
		this.menuContainer.visible = this.isMenuOpen;
		this.pianoContainer.eventMode = this.isMenuOpen ? "none" : "static";

		// Efecto visual simple al abrir
		if (this.isMenuOpen) {
			this.menuContainer.scale.set(0.9);
			// Pequeña animación si tuvieras un ticker, aquí lo hacemos estático por simplicidad
			this.menuContainer.scale.set(1);
		}
	}

	// --- Render Piano (Igual que antes pero robusto) ---
	private renderPiano(startOctave: number, octaveCount: number): void {
		this.pianoContainer.removeChildren();
		this.keyMap.clear();

		const whiteKeysContainer = new Container();
		const blackKeysContainer = new Container();
		this.pianoContainer.addChild(whiteKeysContainer);
		this.pianoContainer.addChild(blackKeysContainer);

		const notesToGenerate: Array<{ note: string; type: string }> = [];

		for (let i = 0; i < octaveCount; i++) {
			const currentOct = startOctave + i;
			OCTAVE_STRUCTURE.forEach((noteData) => {
				notesToGenerate.push({
					note: `${noteData.note}${currentOct}`,
					type: noteData.type,
				});
			});
		}
		notesToGenerate.push({ note: `C${startOctave + octaveCount}`, type: "white" });

		let currentX = 0;

		this.pianoContainer.hitArea = new Rectangle(-1000, -1000, 5000, 3000); // HitArea masiva
		this.pianoContainer.on("pointerup", () => {
			this.releaseAllVisuals();
		});
		this.pianoContainer.on("pointerupoutside", () => {
			this.releaseAllVisuals();
		});

		notesToGenerate.forEach((n) => {
			if (n.type === "white") {
				const key = this.createKey(n.note, true);
				key.x = currentX;
				whiteKeysContainer.addChild(key);
				currentX += this.WHITE_KEY_WIDTH;
			} else {
				const key = this.createKey(n.note, false);
				key.x = currentX - this.BLACK_KEY_WIDTH / 2;
				blackKeysContainer.addChild(key);
			}
		});

		this.pianoContainer.pivot.set(currentX / 2, this.WHITE_KEY_HEIGHT / 2);
	}

	private createKey(note: string, isWhite: boolean): Graphics {
		const key = new Graphics();
		const w = isWhite ? this.WHITE_KEY_WIDTH : this.BLACK_KEY_WIDTH;
		const h = isWhite ? this.WHITE_KEY_HEIGHT : this.BLACK_KEY_HEIGHT;
		const color = isWhite ? 0xffffff : 0x000000;

		key.beginFill(color);
		key.lineStyle(1, isWhite ? 0x999999 : 0x222222);

		// Dibujamos teclas redondeadas abajo solamente (simulación realista)
		// Movemos a posición (0,0)
		key.moveTo(0, 0);
		key.lineTo(w, 0);
		key.lineTo(w, h - 5);
		key.quadraticCurveTo(w, h, w - 5, h); // Esquina curva inferior derecha
		key.lineTo(5, h);
		key.quadraticCurveTo(0, h, 0, h - 5); // Esquina curva inferior izquierda
		key.lineTo(0, 0);
		key.endFill();

		this.keyMap.set(key, { graphics: key, note, isBlack: !isWhite, originalColor: color });
		key.eventMode = "static";

		const play = (): void => {
			if (!this.isGameStarted || this.isMenuOpen) {
				return;
			}
			this.animateKey(key, true);
			this.synth.triggerAttackRelease(note, "8n");
			this.sheetMusic.addNote(note);
		};

		key.on("pointerdown", play);
		key.on("pointerup", () => this.animateKey(key, false));
		key.on("pointerout", () => this.animateKey(key, false));
		key.on("pointerover", (e) => {
			if (e.buttons === 1) {
				play();
			}
		});

		if (isWhite && note.startsWith("C")) {
			const keyTextStyle = new TextStyle({
				fontFamily: "Courier New",
				fontSize: 12,
				fill: "#777777",
			});
			const txt = new Text(note, keyTextStyle);
			txt.anchor.set(0.5, 1);
			txt.position.set(w / 2, h - 10);
			key.addChild(txt);
		}

		return key;
	}

	private animateKey(key: Graphics, pressed: boolean): void {
		const data = this.keyMap.get(key);
		if (!data) {
			return;
		}
		key.tint = pressed ? (data.isBlack ? 0x555555 : 0xcccccc) : 0xffffff;
	}

	private releaseAllVisuals(): void {
		this.keyMap.forEach((_, key) => (key.tint = 0xffffff));
	}

	public override onResize(newW: number, newH: number): void {
		// Escalar la escena para que quepa bien
		ScaleHelper.setScaleRelativeToIdeal(this.mainContainer, newW, newH, 740, 570, ScaleHelper.FIT);
		this.mainContainer.position.set(newW / 2, newH / 2);

		// UI Responsive: Posicionar el engranaje arriba a la derecha RELATIVO al contenedor escalado
		if ((this as any).settingsBtn) {
			const btn = (this as any).settingsBtn as Graphics;
			// Calculamos el borde derecho lógico del área de juego
			// Asumimos un área base de 800x600 (definido en setScaleRelativeToIdeal arriba)
			const halfW = 400; // 800 / 2
			const halfH = 300; // 600 / 2

			btn.x = halfW - 40; // 40px desde la derecha
			btn.y = -halfH + 40; // 40px desde arriba
		}
	}
}
