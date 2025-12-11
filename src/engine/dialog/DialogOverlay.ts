import { Container, Sprite, Graphics, Text, TextStyle, Texture, Point } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { Manager } from "../..";

export type OverlayMode = "cinematic" | "bubble";

export class DialogueOverlay extends Container {
	private background: Graphics;
	private portrait: Sprite;
	private letterContainer: Container;
	private letters: Text[] = [];
	private closeIndicator: Container;
	private textMask: Graphics;

	public isOpen: boolean = false;
	public isTyping: boolean = false;

	public typeSpeed: number = 30;
	public onTypingComplete?: () => void;

	// --- NUEVAS PROPIEDADES ---
	private currentMode: OverlayMode = "cinematic";
	// Posición objetivo en pantalla donde apuntará la burbuja
	private targetPos: Point = new Point(0, 0);
	// --------------------------

	// Scroll / layout globals
	private letterBaseY: number = 0;
	private visibleTextHeight: number = 0;
	private contentHeight: number = 0;
	private maxScroll: number = 0;
	private scrollOffset: number = 0;
	// Constante solo para el modo cinemático
	private readonly CINEMATIC_BOX_HEIGHT = 200;

	private activeScrollTween: any = null;

	constructor() {
		super();
		this.visible = false;
		this.interactive = true;

		this.background = new Graphics();
		this.addChild(this.background);

		this.portrait = Sprite.from("playerface");
		this.portrait.anchor.set(0, 1);
		this.addChild(this.portrait);

		this.letterContainer = new Container();
		this.addChild(this.letterContainer);

		this.closeIndicator = new Container();
		const arrow = new Text("▼", new TextStyle({ fill: "white", fontSize: 20 }));
		this.closeIndicator.addChild(arrow);
		this.closeIndicator.visible = false;
		this.addChild(this.closeIndicator);

		// Animación de la flecha (movida aquí para que solo se inicie una vez)
		new Tween(this.closeIndicator).to({ y: "+10" }, 500).yoyo(true).repeat(Infinity).easing(Easing.Quadratic.InOut).start();

		this.textMask = new Graphics();
		this.addChild(this.textMask);
		this.letterContainer.mask = this.textMask;
	}

	// --- NUEVO: Método para configurar el modo y posición antes de mostrar ---
	public configure(mode: OverlayMode, target?: { x: number; y: number }): void {
		this.currentMode = mode;
		if (target) {
			this.targetPos.set(target.x, target.y);
		}
		// Reiniciamos propiedades visuales
		this.background.clear();
		this.textMask.clear();
	}

	// El resize ahora decide qué layout dibujar
	public resize(): void {
		if (this.currentMode === "cinematic") {
			this.drawCinematicLayout();
		} else {
			this.drawBubbleLayout();
		}
		this.recalculateScrollLimits();
	}

	public setPortraitImage(newImage: string): void {
		try {
			this.portrait.texture = Texture.from(newImage);
		} catch (e) {
			console.warn(`Texture ${newImage} not found`);
		}
	}

	private drawCinematicLayout(): void {
		const w = Manager.width;
		const h = Manager.height;

		// Retrato visible en modo cinemático
		this.portrait.visible = true;

		// Ajuste de escala retrato
		if (navigator.userAgent.includes("Mobile")) {
			this.portrait.scale.set(0.15);
		} else {
			this.portrait.scale.set(0.3);
		}

		this.background.clear();
		this.background.beginFill(0x000000, 0.85);
		this.background.lineStyle(4, 0xffffff);
		this.background.drawRoundedRect(50, h - this.CINEMATIC_BOX_HEIGHT - 50, w - 100, this.CINEMATIC_BOX_HEIGHT, 15);
		this.background.endFill();

		this.portrait.x = 50;
		this.portrait.y = h - this.CINEMATIC_BOX_HEIGHT - 54;

		this.letterContainer.x = 80;
		this.letterBaseY = h - this.CINEMATIC_BOX_HEIGHT - 20;
		this.letterContainer.y = this.letterBaseY - this.scrollOffset;

		this.closeIndicator.x = w - 100;
		// Reseteamos la Y base del indicador antes de que la animación de Tween actúe
		this.closeIndicator.y = h - 50;

		this.textMask.clear();
		const maskX = 50 + 10;
		const maskY = h - this.CINEMATIC_BOX_HEIGHT - 50 + 10;
		const maskW = w - 100 - 20;
		const maskH = this.CINEMATIC_BOX_HEIGHT - 20;
		this.textMask.beginFill(0xffffff);
		this.textMask.drawRoundedRect(maskX, maskY, maskW, maskH, 8);
		this.textMask.endFill();

		this.visibleTextHeight = maskH;
	}

	// --- NUEVA LÓGICA PARA DIBUJAR BURBUJA ---
	private drawBubbleLayout(): void {
		// En modo burbuja, ocultamos el retrato grande
		this.portrait.visible = false;

		const bubbleWidth = 300;
		const bubbleHeight = 120; // Altura fija para simplificar el ejemplo
		const tailHeight = 20;
		const padding = 15;

		// Calculamos la posición de la caja (arriba del objetivo)
		// IMPORTANTE: targetPos debe estar en coordenadas de pantalla (Screen Coordinates)
		const boxX = this.targetPos.x - bubbleWidth / 2;
		const boxY = this.targetPos.y - bubbleHeight - tailHeight;

		this.background.clear();
		// Estilo blanco tipo "Pixel Art" como en tu referencia
		this.background.beginFill(0xffffff, 1);
		this.background.lineStyle(2, 0x000000); // Borde negro opcional

		// 1. Dibujar el rectángulo redondeado
		this.background.drawRoundedRect(boxX, boxY, bubbleWidth, bubbleHeight, 10);

		// 2. Dibujar la "colita" (triángulo) abajo al centro
		this.background.moveTo(this.targetPos.x - 10, boxY + bubbleHeight); // Esquina inferior izquierda de la colita
		this.background.lineTo(this.targetPos.x, this.targetPos.y); // Punta de la colita (el objetivo)
		this.background.lineTo(this.targetPos.x + 10, boxY + bubbleHeight); // Esquina inferior derecha de la colita
		// No cerramos el path para que no dibuje la línea superior del triángulo sobre la caja

		this.background.endFill();

		// Posicionamos el texto dentro de la burbuja
		this.letterContainer.x = boxX + padding;
		this.letterBaseY = boxY + padding;
		this.letterContainer.y = this.letterBaseY - this.scrollOffset;

		// Posicionamos el indicador de cerrar (flechita)
		this.closeIndicator.x = boxX + bubbleWidth - padding;
		this.closeIndicator.y = boxY + bubbleHeight - padding;

		// Máscara para el texto dentro de la burbuja
		this.textMask.clear();
		this.textMask.beginFill(0xff0000);
		this.textMask.drawRoundedRect(boxX + 5, boxY + 5, bubbleWidth - 10, bubbleHeight - 10, 5);
		this.textMask.endFill();

		this.visibleTextHeight = bubbleHeight - 10;
	}

	public show(text: string, highlightWord: string = "", highlightColor: string = "#ffff00"): void {
		// NOTA: Ya no llamamos a resize() aquí, el Manager lo llamará después de configurar.
		// this.resize();
		this.isOpen = true;
		this.visible = true;
		this.isTyping = true;
		this.closeIndicator.visible = false;

		this.letters.forEach((l) => l.destroy());
		this.letters = [];
		this.letterContainer.removeChildren();

		this.scrollOffset = 0;
		this.maxScroll = 0;

		this.typeText(text, highlightWord, highlightColor);
	}

	// Fuerza a mostrar todo el texto inmediatamente (skip)
	public showImmediate(): void {
		if (!this.isTyping) {
			return;
		}
		// Lógica simple: Detener recursión (flag handleado en revealChar)
		// Pero para simplificar en Pixi: podrías simplemente setear alpha = 1 a todos
		// y cancelar timeouts. Por ahora, dejaremos que typeSpeed controle la velocidad.
		this.typeSpeed = 0; // Ultrarápido
	}

	public hide(): void {
		this.isOpen = false;
		this.visible = false;
		this.letters.forEach((l) => l.destroy());
		this.letters = [];
		this.scrollOffset = 0;
		this.maxScroll = 0;

		if (this.activeScrollTween) {
			this.activeScrollTween.stop();
			this.activeScrollTween = null;
		}
	}

	private typeText(fullText: string, highlightWord: string, highlightColor: string): void {
		// Configuramos el estilo según el modo
		let fontSize = 30;
		let lineHeight = 40;
		let fontColor = 0xffffff; // Blanco por defecto (cinemático)

		if (this.currentMode === "bubble") {
			fontSize = 16; // Letra más pequeña para burbuja
			lineHeight = 20;
			fontColor = 0x000000; // Texto negro para fondo blanco
		}

		const style = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fontSize: fontSize,
			lineHeight: lineHeight,
			fill: fontColor,
			wordWrap: false, // Seguimos usando tu lógica manual de wrap
		});

		// ... (Lógica de word-wrap original se mantiene igual) ...
		// ADVERTENCIA: Aquí debes ajustar el `maxWidth` si es burbuja.
		let maxWidth: number;
		const words = fullText.split(" ");
		let x = 0;
		let y = 0;
		if (this.currentMode === "bubble") {
			maxWidth = 300 - 30; // Ancho burbuja - padding
		} else {
			// Tu lógica original para cinemático
			if (navigator.userAgent.includes("Mobile")) {
				maxWidth = Manager.width - 160;
			} else {
				maxWidth = Manager.width - 380;
			}
		}

		const charData: { char: string; x: number; y: number }[] = [];

		words.forEach((word) => {
			const wordTemp = new Text(word, style);
			const wordWidth = wordTemp.width;
			if (x + wordWidth > maxWidth) {
				x = 0;
				y += style.lineHeight;
			}
			wordTemp.destroy();
			for (let i = 0; i < word.length; i++) {
				charData.push({ char: word[i], x, y });
				const charTemp = new Text(word[i], style);
				x += charTemp.width;
				charTemp.destroy();
			}
			const spaceTemp = new Text(" ", style);
			x += spaceTemp.width;
			spaceTemp.destroy();
		});

		this.revealChar(0, charData, style, highlightWord, highlightColor);
	}

	private revealChar(index: number, data: any[], style: TextStyle, highlightWord: string, highlightColor: string): void {
		if (!this.isOpen) {
			return;
		}

		if (index >= data.length) {
			this.isTyping = false;
			this.recalculateScrollLimits();
			this.closeIndicator.visible = true;
			this.animateHighlight(highlightWord, highlightColor);

			// Avisar al manager que terminamos
			if (this.onTypingComplete) {
				this.onTypingComplete();
			}
			return;
		}

		const info = data[index];
		const letter = new Text(info.char, style.clone());
		letter.x = info.x;
		letter.y = info.y;
		letter.alpha = 0;

		this.letterContainer.addChild(letter);
		this.letters.push(letter);

		letter.alpha = 1;
		// Animación simple de aparición
		if (this.typeSpeed > 0) {
			new Tween(letter)
				.from({ y: info.y - 10 })
				.to({ y: info.y }, 150)
				.easing(Easing.Back.Out)
				.start();
		}

		// Si typeSpeed es 0, hacemos loop síncrono para 'instante' (cuidado con el stack si el texto es enorme)
		if (this.typeSpeed === 0) {
			this.revealChar(index + 1, data, style, highlightWord, highlightColor);
		} else {
			setTimeout(() => {
				this.revealChar(index + 1, data, style, highlightWord, highlightColor);
			}, this.typeSpeed);
		}
	}

	private recalculateScrollLimits(): void {
		// ... (Tu lógica original intacta) ...
		if (this.letters.length === 0) {
			this.contentHeight = 0;
			this.maxScroll = 0;
			this.scrollOffset = 0;
			return;
		}
		let maxY = 0;
		let minY = Number.POSITIVE_INFINITY;
		this.letters.forEach((l) => {
			if (l.y > maxY) {
				maxY = l.y;
			}
			if (l.y < minY) {
				minY = l.y;
			}
		});
		const lineHeight = 50;
		this.contentHeight = maxY + lineHeight - (minY === Infinity ? 0 : minY);
		this.maxScroll = Math.max(0, this.contentHeight - this.visibleTextHeight);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, this.maxScroll));
		this.letterContainer.y = this.letterBaseY - this.scrollOffset;
	}

	// Métodos de utilidad pública para scroll
	public scrollDown(): void {
		this.scrollBy(this.visibleTextHeight / 2);
	}
	public scrollUp(): void {
		this.scrollBy(-(this.visibleTextHeight / 2));
	}

	public scrollBy(deltaPx: number, duration: number = 240): void {
		// ... (Tu lógica original intacta) ...
		if (this.maxScroll <= 0) {
			return;
		}
		// if (this.isTyping) return; // Opcional: permitir scroll mientras escribe

		if (this.activeScrollTween) {
			this.activeScrollTween.stop();
			this.activeScrollTween = null;
		}

		const from = this.scrollOffset;
		const to = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + deltaPx));

		if (Math.abs(to - from) < 1) {
			this.scrollOffset = to;
			this.letterContainer.y = this.letterBaseY - this.scrollOffset;
			return;
		}

		const obj: any = { val: from };
		this.activeScrollTween = new Tween(obj)
			.to({ val: to }, duration)
			.easing(Easing.Quadratic.Out)
			.onUpdate(() => {
				this.scrollOffset = obj.val;
				this.letterContainer.y = this.letterBaseY - this.scrollOffset;
			})
			.onComplete(() => {
				this.scrollOffset = to;
				this.letterContainer.y = this.letterBaseY - this.scrollOffset;
				this.activeScrollTween = null;
			})
			.start();
	}

	private animateHighlight(word: string, color: string): void {
		// ... (Tu lógica original intacta) ...
		if (!word) {
			return;
		}
		const fullStr = this.letters
			.map((l) => l.text)
			.join("")
			.toLowerCase();
		const search = word.toLowerCase();
		let startIndex = fullStr.indexOf(search);
		while (startIndex !== -1) {
			for (let i = 0; i < search.length; i++) {
				const letter = this.letters[startIndex + i];
				if (letter) {
					(letter.style as any).fill = color;
					new Tween(letter)
						.to({ y: letter.y - 5 }, 300)
						.yoyo(true)
						.repeat(Infinity)
						.easing(Easing.Sinusoidal.InOut)
						.delay(i * 100)
						.start();
				}
			}
			startIndex = fullStr.indexOf(search, startIndex + 1);
		}
	}
}
