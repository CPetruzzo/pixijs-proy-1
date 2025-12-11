import { Container, Sprite, Graphics, Text, TextStyle, Texture } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { Manager } from "../../../..";

export class DialogueOverlay extends Container {
	private background: Graphics;
	private portrait: Sprite;
	private letterContainer: Container;
	private letters: Text[] = [];
	private closeIndicator: Container;
	private textMask: Graphics;

	public isOpen: boolean = false;
	public isTyping: boolean = false;

	// Scroll / layout
	private readonly BOX_HEIGHT = 200;
	private letterBaseY: number = 0; // Y inicial del contenedor de letras (fijo)
	private visibleTextHeight: number = 0; // altura visible en px
	private contentHeight: number = 0; // altura total del contenido en px
	private maxScroll: number = 0; // cuánto podemos scrollear (content - visible)
	private scrollOffset: number = 0; // offset actual (0..maxScroll)

	// Tween activo (si existe)
	private activeScrollTween: any = null;

	constructor() {
		super();
		this.visible = false; // Empieza oculto

		// 1. Contenedor principal de UI (Fondo negro semitransparente)
		this.background = new Graphics();
		this.addChild(this.background);

		// 2. Retrato del personaje (playerface)
		this.portrait = Sprite.from("playerface");
		this.portrait.anchor.set(0, 1); // Anclado abajo-izquierda
		if (navigator.userAgent.includes("Mobile")) {
			this.portrait.scale.set(0.15);
		} else {
			this.portrait.scale.set(0.3);
		}
		this.addChild(this.portrait);

		// 3. Contenedor de texto
		this.letterContainer = new Container();
		this.addChild(this.letterContainer);

		// 4. Indicador de "Siguiente" (Flecha)
		this.closeIndicator = new Container();
		const arrow = new Text("▼", new TextStyle({ fill: "white", fontSize: 20 }));
		this.closeIndicator.addChild(arrow);
		this.closeIndicator.visible = false;
		this.addChild(this.closeIndicator);

		// Máscara para recortar texto que sale de la caja
		this.textMask = new Graphics();
		this.addChild(this.textMask);
		this.letterContainer.mask = this.textMask;

		// Ajustar posición inicial en pantalla (Bottom Center)
		this.resize();
	}

	public setPortraitImage(newImage: string): void {
		this.portrait.texture = Texture.from(newImage);
	}

	public resize(): void {
		const w = Manager.width;
		const h = Manager.height;

		// Dibujar caja
		this.background.clear();
		this.background.beginFill(0x000000, 0.85);
		this.background.lineStyle(4, 0xffffff);
		this.background.drawRoundedRect(50, h - this.BOX_HEIGHT - 50, w - 100, this.BOX_HEIGHT, 15);
		this.background.endFill();

		// Posicionar retrato (Izquierda de la caja, saliendo un poco por arriba)
		this.portrait.x = 0;
		this.portrait.y = h - this.BOX_HEIGHT - 54;

		// Posicionar contenedor de texto (x relativo al contenido)
		this.letterContainer.x = 80;
		// Guardamos baseY para poder scrollear sobre esa referencia
		this.letterBaseY = h - this.BOX_HEIGHT - 20;
		this.letterContainer.y = this.letterBaseY - this.scrollOffset;

		// Posicionar flecha
		this.closeIndicator.x = w - 100;
		this.closeIndicator.y = h - 50;
		new Tween(this.closeIndicator).to({ y: "+10" }, 500).yoyo(true).repeat(Infinity).easing(Easing.Quadratic.InOut).start();

		// Definir máscara — recorta dentro de la caja con un pequeño padding
		this.textMask.clear();
		const maskX = 50 + 10;
		const maskY = h - this.BOX_HEIGHT - 50 + 10;
		const maskW = w - 100 - 20;
		const maskH = this.BOX_HEIGHT - 20;
		this.textMask.beginFill(0xffffff);
		this.textMask.drawRoundedRect(maskX, maskY, maskW, maskH, 8);
		this.textMask.endFill();

		// Visible text height — lo usamos para calcular scroll
		this.visibleTextHeight = maskH;
		// Recalculate contentHeight / maxScroll if ya hay letras
		this.recalculateScrollLimits();
	}

	public show(text: string, highlightWord: string = "", highlightColor: string = "#ffff00"): void {
		this.isOpen = true;
		this.visible = true;
		this.isTyping = true;
		this.closeIndicator.visible = false;

		// Limpiar texto anterior
		this.letters.forEach((l) => l.destroy());
		this.letters = [];
		this.letterContainer.removeChildren();

		// reset scroll
		this.scrollOffset = 0;
		this.maxScroll = 0;

		// Iniciar efecto typewriter
		this.typeText(text, highlightWord, highlightColor);
	}

	public hide(): void {
		this.isOpen = false;
		this.visible = false;
		this.letters.forEach((l) => l.destroy());
		this.letters = [];
		// reset scroll
		this.scrollOffset = 0;
		this.maxScroll = 0;

		// cancelar tween si existe
		if (this.activeScrollTween) {
			try {
				this.activeScrollTween.stop();
				// eslint-disable-next-line prettier/prettier
			} catch (e) { }
			this.activeScrollTween = null;
		}
	}

	private typeText(fullText: string, highlightWord: string, highlightColor: string): void {
		const style = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fontSize: 40,
			lineHeight: 50,
			fill: 0xffffff,
			wordWrap: false, // calculamos el salto manual abajo
		});
		if (navigator.userAgent.includes("Mobile")) {
			style.fontSize = 20;
			style.lineHeight = 30;
		}

		const words = fullText.split(" ");
		let x = 0;
		let y = 0;
		let maxWidth: number;
		if (navigator.userAgent.includes("Mobile")) {
			maxWidth = Manager.width - 160; // Ajusta este ancho a tu caja de texto
		} else {
			maxWidth = Manager.width - 380;
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
				const charTemp = new Text(word[i], style);
				const charWidth = charTemp.width;

				charData.push({ char: word[i], x, y });

				x += charWidth;
				charTemp.destroy();
			}

			const spaceTemp = new Text(" ", style);
			x += spaceTemp.width;
			spaceTemp.destroy();
		});

		// Iniciar revelado recursivo con los datos calculados
		this.revealChar(0, charData, style, highlightWord, highlightColor);
	}

	private revealChar(index: number, data: any[], style: TextStyle, highlightWord: string, highlightColor: string): void {
		if (!this.isOpen) {
			return;
		} // Si se cerró abruptamente

		if (index >= data.length) {
			// terminado de escribir
			this.isTyping = false;
			// recalcular alturas y scroll
			this.recalculateScrollLimits();
			this.closeIndicator.visible = true;
			// animar resaltado si corresponde
			this.animateHighlight(highlightWord, highlightColor);
			return;
		}

		const info = data[index];
		const letter = new Text(info.char, style.clone());
		letter.x = info.x;
		letter.y = info.y;
		letter.alpha = 0; // Empieza invisible

		this.letterContainer.addChild(letter);
		this.letters.push(letter);

		// Tween de entrada (Bounce)
		letter.alpha = 1;
		new Tween(letter)
			.from({ y: info.y - 10 })
			.to({ y: info.y }, 150)
			.easing(Easing.Back.Out)
			.start();

		// Siguiente letra (velocidad de tipeo)
		setTimeout(() => {
			this.revealChar(index + 1, data, style, highlightWord, highlightColor);
		}, 30); // 30ms entre letras
	}

	/** Recalcula contentHeight, maxScroll y ajusta letterContainer.y si hace falta */
	private recalculateScrollLimits(): void {
		if (this.letters.length === 0) {
			this.contentHeight = 0;
			this.maxScroll = 0;
			this.scrollOffset = 0;
			return;
		}
		// Encontrar el Y máximo ocupado por las letras
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
		// contentHeight en pixels (incluimos lineHeight aprox)
		const lineHeight = 50;
		this.contentHeight = maxY + lineHeight - (minY === Infinity ? 0 : minY);
		// calcular max scroll
		this.maxScroll = Math.max(0, this.contentHeight - this.visibleTextHeight);
		// ajustar scrollOffset para que esté dentro de rango
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, this.maxScroll));
		// aplicar offset al contenedor
		this.letterContainer.y = this.letterBaseY - this.scrollOffset;
	}

	/** Indica si hay scroll disponible (contenido mayor que la caja) */
	public canScroll(): boolean {
		return this.maxScroll > 0;
	}

	/** Indica si ya estamos al final (abajo) del scroll */
	public isAtBottom(): boolean {
		return this.scrollOffset >= this.maxScroll - 0.5; // tolerancia pequeña
	}

	/** Scrollea una cantidad (en px). Si deltaPx es negativo sube, positivo baja.
	 *  Animado con tween. */
	public scrollBy(deltaPx: number, duration: number = 240): void {
		if (this.maxScroll <= 0) {
			return;
		}
		// Solo permitir scroll cuando terminó el tipeo (opcional)
		if (this.isTyping) {
			return;
		}

		// Cancelar tween activo si existe
		if (this.activeScrollTween) {
			try {
				this.activeScrollTween.stop();
				// eslint-disable-next-line prettier/prettier
			} catch (e) { }
			this.activeScrollTween = null;
		}

		const from = this.scrollOffset;
		const to = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + deltaPx));

		// Si no hay cambio, return
		if (Math.abs(to - from) < 1) {
			// ajustar final por si quedó fuera de rango
			this.scrollOffset = to;
			this.letterContainer.y = this.letterBaseY - this.scrollOffset;
			return;
		}

		// Tween "manual" (interpolando un objeto para facilitar stop)
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

	/** Helper: scroll de "paso" hacia abajo (una fracción de la visible area) */
	public scrollStepDown(): void {
		const step = Math.round(this.visibleTextHeight) || 50;
		this.scrollBy(step);
	}

	/** Helper: scroll de "paso" hacia arriba (una fracción de la visible area) */
	public scrollStepUp(): void {
		const step = Math.round(this.visibleTextHeight * 0.8) || 50;
		// IMPORTANT: subir = delta negativo
		this.scrollBy(-step);
	}

	private animateHighlight(word: string, color: string): void {
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
					// Efecto Wave
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
