import { Container, Sprite, Graphics, Text, TextStyle } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class OverlayScene extends PixiScene {
	private backgroundContainer = new Container();
	private uiContainer = new Container();
	private background!: Sprite;
	private overlay!: Sprite;

	// cuadro y letras
	private textBox!: Graphics;
	private letterContainer = new Container();
	private letters: Text[] = [];

	public static readonly BUNDLES = ["abandonedhouse"];
	private closeText: Text;
	private arrow: Text;
	private spr: string;

	constructor(_spr: string = "playerProfile") {
		super();

		this.addChild(this.backgroundContainer);
		this.addChild(this.uiContainer);

		// fondo principal
		this.background = Sprite.from("playerProfile");
		this.background.anchor.set(0.5);
		// this.backgroundContainer.addChild(this.background);

		// overlay (perfil, etc)
		this.spr = _spr || "playerProfile";
		this.overlay = Sprite.from(this.spr);
		this.overlay.scale.set(0.6);
		this.overlay.anchor.set(0.5);
		if (this.spr === "llorona") {
			this.overlay.x = 600;
		} else {
			this.overlay.x = -500;
		}
		this.overlay.y = 250;
		this.backgroundContainer.addChild(this.overlay);

		// cuadro semitransparente
		this.textBox = new Graphics().beginFill(0x000000, 0.6).drawRoundedRect(-300, 100, 600, 200, 16).endFill();
		this.backgroundContainer.addChild(this.textBox);

		// contenedor de letras
		this.letterContainer.x = 0;
		this.letterContainer.y = 0;
		this.uiContainer.addChild(this.letterContainer);
	}

	/**
	 * Escribe el texto con efecto typewriter + wave.
	 * Además resalta `highlightWord` en `highlightColor` y
	 * lo hace “bailar” indefinidamente al final.
	 *
	 * @param fullText Texto a mostrar (puede incluir '\n').
	 * @param highlightWord Palabra a resaltar y animar.
	 * @param highlightColor Color hexadecimal (ej. "#ff0000").
	 * @param charDelay Retraso entre letras en ms.
	 */
	public typeText(fullText: string, highlightWord: string, highlightColor = "#ff0000", charDelay = 50): void {
		// 1) Limpiar anterior
		this.letters.forEach((l) => l.destroy());
		this.letters = [];
		this.letterContainer.removeChildren();

		// 2) Estilo base, una sola vez
		const baseStyle = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fontSize: 40,
			fill: "#FFFFFF",
			wordWrap: false,
		});
		const wrapWidth = 580;
		const startX = -290;
		const startY = 110;
		const lineHeight = 48;

		// 3) Wrap manual
		const words = fullText.split(" ");
		const lines: string[] = [];
		let currentLine = "";
		for (const word of words) {
			const test = currentLine ? `${currentLine} ${word}` : word;
			const metrics = new Text(test, baseStyle);
			if (metrics.width <= wrapWidth) {
				currentLine = test;
			} else {
				lines.push(currentLine);
				currentLine = word;
			}
		}
		if (currentLine) {
			lines.push(currentLine);
		}

		// 4) Crear Text por carácter, usando baseStyle.clone()
		let y = startY;
		for (const line of lines) {
			let x = startX;
			for (const char of line) {
				// clono el estilo para que no se comparta
				const letterStyle = baseStyle.clone();
				const letter = new Text(char, letterStyle);
				letter.anchor.set(0, 0);
				letter.x = x;
				letter.y = y;
				letter.alpha = 0;
				this.letterContainer.addChild(letter);
				this.letters.push(letter);
				x += letter.width;
			}
			y += lineHeight;
		}
		// 5) Revelar letra a letra
		this.revealChar(0, charDelay, fullText, highlightWord, highlightColor);
	}

	private revealChar(index: number, delay: number, fullText: string, highlightWord: string, highlightColor: string): void {
		if (index >= this.letters.length) {
			// ¡Terminamos de revelar!, ahora animar la palabra highlight
			this.animateHighlight(highlightWord, highlightColor);
			this.showCloseIndicator();

			return;
		}
		const letter = this.letters[index];
		// 1) Aparecer + pequeño bounce
		letter.alpha = 1;
		new Tween(letter)
			.to({ y: letter.y - 10 }, 150)
			.easing(Easing.Quadratic.Out)
			.yoyo(true)
			.repeat(1)
			.start();

		// 2) Siguiente letra
		setTimeout(() => this.revealChar(index + 1, delay, fullText, highlightWord, highlightColor), delay);
	}

	/** Encuentra y anima la palabra resaltada indefinidamente */
	private animateHighlight(word: string, color: string): void {
		const textFlat = this.letters.map((l) => l.text).join("");
		const wordLower = word.toLowerCase();
		const flatLower = textFlat.toLowerCase();

		let pos = flatLower.indexOf(wordLower);
		while (pos !== -1) {
			// para cada letra de esa palabra...
			for (let i = 0; i < word.length; i++) {
				const letter = this.letters[pos + i];
				letter.style.fill = color;
				// animación continua de wave
				new Tween(letter)
					.to({ y: letter.y - 10 }, 300)
					.easing(Easing.Sinusoidal.InOut)
					.yoyo(true)
					.repeat(Infinity)
					.delay(i * 100) // onda progresiva
					.start();
			}
			// buscar siguiente ocurrencia
			pos = flatLower.indexOf(wordLower, pos + word.length);
		}
	}

	/** muestra “Enter” y una flecha descendente animada */
	private showCloseIndicator(): void {
		// estilo pequeño
		const style = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fontSize: 30,
			fill: "#FFFFFF",
		});
		// Texto “Enter”
		this.closeText = new Text("Enter", style);
		this.closeText.anchor.set(0.5, 0);
		this.closeText.x = 0;
		this.closeText.y = this.textBox.y + this.textBox.height * 2;
		this.uiContainer.addChild(this.closeText);

		// Flecha ↓
		this.arrow = new Text("↓", style);
		this.arrow.anchor.set(0.5, 0);
		this.arrow.x = 0;
		this.arrow.y = this.closeText.y + 40;
		this.uiContainer.addChild(this.arrow);

		// tween infinito de la flecha
		new Tween(this.arrow)
			.to({ y: this.arrow.y + 10 }, 500)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true)
			.repeat(Infinity)
			.start();
	}
}
