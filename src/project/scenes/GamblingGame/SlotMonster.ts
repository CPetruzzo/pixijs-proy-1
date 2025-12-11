/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Sprite, Text, TextStyle, Graphics } from "pixi.js";
import { Tween, Easing } from "tweedle.js"; // Asegúrate de importar Easing
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { DataManager } from "../../../engine/datamanager/DataManager";
import { SoundLib } from "../../../engine/sound/SoundLib";

// NUEVO: Interfaz para extender el Sprite y guardar su clave de textura
interface SymbolSprite extends Sprite {
	symbolKey: string;
	initialScale?: number; // Para recordar el tamaño original
}

interface Reel {
	container: Container;
	symbols: SymbolSprite[]; // Usamos la interfaz extendida
	position: number;
	previousPosition: number;
	blurAmount: number;
}

// NUEVO: Definición de una línea de pago (qué posiciones verificar)
// ANTES (Causante del error):
// type PaylinePosition = { reelIdx: number, rowIdx: number };

// AHORA (Corregido para aceptar 'r' y 'row'):
type PaylinePosition = { r: number, row: number };
type Payline = PaylinePosition[];

const COLORS = {
	BG_DARK: 0x051114,
	PANEL_TEAL: 0x0f292d,
	ACCENT_GOLD: 0xf0e6b7,
	ACCENT_WHITE: 0xffffff,
	BTN_RED: 0x590808,
	REEL_BG: 0x161310,
	WIN_OVERLAY: 0x000000, // NUEVO color para el oscurecimiento
};

const STORAGE_KEYS = {
	CREDITS: "SLOT_MONSTER_CREDITS",
};

export class SlotMonster extends PixiScene {
	public static readonly BUNDLES = ["slots"];

	private gameContainer = new Container();
	private reelMask = new Graphics();
	private reels: Reel[] = [];
	// NUEVO: Capa para oscurecer el fondo al ganar
	private winOverlay = new Graphics();

	private uiContainer = new Container();
	private topBar = new Container();
	private leftPanel = new Container();
	private footerBar = new Container();
	private spinButtonContainer = new Container();

	private topBg = new Graphics();
	private leftBg = new Graphics();
	private footerBg = new Graphics();
	private reelAreaBg = new Graphics();

	private REEL_WIDTH = 160;
	private SYMBOL_SIZE = 160;
	private NUM_REELS = 5;
	private NUM_SYMBOLS = 3;

	private isSpinning = false;
	private currentBet = 2.00;

	private balanceText: Text;
	private betText: Text;
	private turboText: Text;

	private symbolKeys = [
		"slotghost", "slotpumpkin", "slotgoldcoin",
		"slotbat", "sloteye", "slotskull", "slotcandle"
	];

	// NUEVO: Lista para guardar los tweens de victoria y poder detenerlos
	private winTweens: Tween<any>[] = [];

	// NUEVO: Definimos las 3 líneas horizontales básicas
	// Definición de líneas de pago (Horizontales + Diagonales)
	private paylines: Payline[] = [
		// --- LÍNEAS HORIZONTALES (Ya las tenías) ---
		// 1. Fila Superior
		[{ r: 0, row: 0 }, { r: 1, row: 0 }, { r: 2, row: 0 }, { r: 3, row: 0 }, { r: 4, row: 0 }],
		// 2. Fila Media
		[{ r: 0, row: 1 }, { r: 1, row: 1 }, { r: 2, row: 1 }, { r: 3, row: 1 }, { r: 4, row: 1 }],
		// 3. Fila Inferior
		[{ r: 0, row: 2 }, { r: 1, row: 2 }, { r: 2, row: 2 }, { r: 3, row: 2 }, { r: 4, row: 2 }],

		// --- NUEVAS LÍNEAS DIAGONALES ---

		[{ r: 0, row: 0 }, { r: 1, row: 1 }, { r: 2, row: 2 }],
		[{ r: 0, row: 2 }, { r: 1, row: 1 }, { r: 2, row: 0 }],
		// 4. La "V" (Diagonal descendente y ascendente)
		// Empieza arriba izquierda -> baja al centro -> toca el fondo -> sube al centro -> termina arriba derecha
		[{ r: 0, row: 0 }, { r: 1, row: 1 }, { r: 2, row: 2 }, { r: 3, row: 1 }, { r: 4, row: 0 }],

		// 5. La "V Invertida" (Diagonal ascendente y descendente)
		// Empieza abajo izquierda -> sube al centro -> toca el techo -> baja al centro -> termina abajo derecha
		[{ r: 0, row: 2 }, { r: 1, row: 1 }, { r: 2, row: 0 }, { r: 3, row: 1 }, { r: 4, row: 2 }],
	];

	constructor() {
		super();

		this.addChild(this.uiContainer);
		this.addChild(this.gameContainer);
		this.addChild(this.spinButtonContainer);

		this.buildReels();
		this.buildUI();
		this.buildSpinButton();

		this.initializeEconomy();
	}

	private initializeEconomy(): void {
		let currentCredits = DataManager.getValue<number>(STORAGE_KEYS.CREDITS);
		if (currentCredits === null || currentCredits === undefined) {
			currentCredits = 1450.00;
			DataManager.setValue(STORAGE_KEYS.CREDITS, currentCredits);
			DataManager.save();
		}
		this.updateBalanceUI(currentCredits);
	}

	private buildReels(): void {
		const totalW = this.REEL_WIDTH * this.NUM_REELS;
		const totalH = this.SYMBOL_SIZE * this.NUM_SYMBOLS;

		this.reelAreaBg.alpha = 0.8;
		this.gameContainer.addChild(this.reelAreaBg);

		// NUEVO: Construimos el overlay de victoria, inicialmente invisible
		this.winOverlay.beginFill(COLORS.WIN_OVERLAY, 0.7); // 70% de opacidad
		this.winOverlay.drawRect(0, 0, totalW, totalH);
		this.winOverlay.endFill();
		this.winOverlay.alpha = 0;
		// Lo agregamos ANTES de los reels para que quede por detrás de los símbolos
		this.gameContainer.addChild(this.winOverlay);

		this.gameContainer.pivot.set(totalW / 2, totalH / 2);

		this.reelMask.beginFill(0xffffff);
		this.reelMask.drawRect(0, 0, totalW, totalH);
		this.reelMask.endFill();
		this.gameContainer.addChild(this.reelMask);
		this.gameContainer.mask = this.reelMask;

		for (let i = 0; i < this.NUM_REELS; i++) {
			const rc = new Container();
			rc.x = i * this.REEL_WIDTH;
			this.gameContainer.addChild(rc);

			const reel: Reel = {
				container: rc,
				symbols: [],
				position: 0,
				previousPosition: 0,
				blurAmount: 0,
			};

			// Usamos 4 símbolos para el efecto de scroll infinito
			for (let j = 0; j < this.NUM_SYMBOLS + 1; j++) {
				const key = this.symbolKeys[Math.floor(Math.random() * this.symbolKeys.length)];
				// MODIFICADO: Usamos la interfaz SymbolSprite y guardamos la clave
				const spr = Sprite.from(key) as SymbolSprite;
				spr.symbolKey = key;
				spr.anchor.set(0.5);
				spr.width = this.SYMBOL_SIZE * 0.85;
				spr.height = this.SYMBOL_SIZE * 0.85;
				// NUEVO: Guardamos la escala inicial para los efectos de pulso
				spr.initialScale = spr.scale.x;

				spr.x = this.REEL_WIDTH / 2;
				spr.y = j * this.SYMBOL_SIZE + this.SYMBOL_SIZE / 2;
				rc.addChild(spr);
				reel.symbols.push(spr);
			}
			this.reels.push(reel);
		}
	}

	private buildUI(): void {
		// (Sin cambios en este método, es igual al anterior)
		const styleValue = new TextStyle({ fontFamily: "Arial", fontSize: 28, fill: COLORS.ACCENT_WHITE, fontWeight: "900" });
		this.uiContainer.addChild(this.topBar);
		this.topBar.addChild(this.topBg);
		const topContent = new Container(); topContent.name = "content"; this.topBar.addChild(topContent);
		this.balanceText = new Text("€ 0,00", styleValue); this.balanceText.anchor.set(0, 0.5); topContent.addChild(this.balanceText);
		const jackpots = [{ label: "MAJOR", val: "400,00" }, { label: "MINOR", val: "100,00" }, { label: "MINI", val: "40,0" }];
		let xOffset = 0; jackpots.forEach((j) => { const cont = new Container(); const lbl = new Text(j.label, new TextStyle({ fontSize: 14, fill: COLORS.ACCENT_GOLD, fontWeight: "bold" })); const val = new Text(j.val, new TextStyle({ fontSize: 20, fill: COLORS.ACCENT_WHITE, fontWeight: "bold" })); lbl.anchor.set(0.5, 1); val.anchor.set(0.5, 0); val.y = 2; cont.addChild(lbl, val); cont.x = xOffset; xOffset += 120; topContent.addChild(cont); });
		this.uiContainer.addChild(this.leftPanel); this.leftPanel.addChild(this.leftBg);
		const leftContent = new Container(); leftContent.name = "content"; this.leftPanel.addChild(leftContent);
		const buyText = new Text("BUY\nBONUS", new TextStyle({ fontSize: 32, fill: COLORS.ACCENT_GOLD, fontWeight: "900", align: "center", dropShadow: true, dropShadowDistance: 2, dropShadowColor: 0x000000 })); const buyPrice = new Text("€200", new TextStyle({ fontSize: 32, fill: COLORS.ACCENT_WHITE, fontWeight: "bold" })); buyText.anchor.set(0.5); buyPrice.anchor.set(0.5); buyText.y = -30; buyPrice.y = 30; leftContent.addChild(buyText, buyPrice);
		this.leftPanel.eventMode = 'static'; this.leftPanel.cursor = 'pointer';
		this.uiContainer.addChild(this.footerBar); this.footerBar.addChild(this.footerBg);
		const footerContent = new Container(); footerContent.name = "content"; this.footerBar.addChild(footerContent);
		this.turboText = new Text("HOLD SPACE FOR TURBO", new TextStyle({ fontSize: 14, fill: 0x666666 })); this.turboText.anchor.set(0.5); footerContent.addChild(this.turboText);
		this.betText = new Text(`BET ${this.currentBet.toFixed(2).replace('.', ',')}`, new TextStyle({ fontSize: 22, fill: COLORS.ACCENT_GOLD, fontWeight: "bold" })); this.betText.anchor.set(1, 0.5); footerContent.addChild(this.betText);
	}

	private buildSpinButton(): void {
		// (Sin cambios aquí)
		const btn = new Graphics(); btn.beginFill(COLORS.BTN_RED); btn.lineStyle(2, 0x000000); btn.drawRoundedRect(-100, -35, 200, 70, 10); btn.endFill();
		btn.beginFill(0xffffff, 0.1); btn.drawRoundedRect(-95, -30, 190, 30, 8); btn.endFill();
		const txt = new Text("SPIN", new TextStyle({ fontSize: 36, fill: "white", fontWeight: "900", letterSpacing: 2, dropShadow: true, dropShadowDistance: 2 })); txt.anchor.set(0.5);
		this.spinButtonContainer.addChild(btn, txt); this.spinButtonContainer.eventMode = 'static'; this.spinButtonContainer.cursor = 'pointer';
		this.spinButtonContainer.on("pointerdown", () => { this.spinButtonContainer.scale.set(0.95); this.startSpin(); });
		this.spinButtonContainer.on("pointerup", () => this.spinButtonContainer.scale.set(1)); this.spinButtonContainer.on("pointerupoutside", () => this.spinButtonContainer.scale.set(1));
	}

	private updateBalanceUI(val: number): void {
		if (this.balanceText) {
			const formatted = val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			this.balanceText.text = `€ ${formatted}`;
		}
	}

	// NUEVO: Método para limpiar animaciones previas
	private resetWinAnimations(): void {
		// 1. Detener todos los tweens activos
		this.winTweens.forEach(t => t.stop());
		this.winTweens = [];

		// 2. Ocultar el overlay oscuro
		new Tween(this.winOverlay).to({ alpha: 0 }, 300).start();

		// 3. Restaurar la escala de todos los símbolos
		this.reels.forEach(reel => {
			reel.symbols.forEach(sym => {
				sym.scale.set(sym.initialScale);
				// Asegurar que estén por detrás del overlay (aunque el overlay se oculte)
				sym.zIndex = 0;
			});
			// Reordenar por zIndex si fuera necesario, pero con el overlay apagado no hace falta
		});
	}

	private startSpin(): void {
		if (this.isSpinning) { return; }
		SoundLib.playSound("wheel-spin", { volume: 0.5, speed: 0.33, loop: false });

		const currentCredits = DataManager.getValue<number>(STORAGE_KEYS.CREDITS) || 0;
		if (currentCredits < this.currentBet) {
			console.log("No hay saldo suficiente!");
			return;
		}

		// NUEVO: Limpiar estado anterior antes de girar
		this.resetWinAnimations();

		const newBalance = currentCredits - this.currentBet;
		DataManager.setValue(STORAGE_KEYS.CREDITS, newBalance);
		DataManager.save();
		this.updateBalanceUI(newBalance);

		this.isSpinning = true;

		for (let i = 0; i < this.reels.length; i++) {
			const r = this.reels[i];
			const extra = Math.floor(Math.random() * 3);
			// Hacemos que gire bastante para asegurar aleatoriedad
			const target = r.position + 50 + i * 5 + extra;
			const time = 2000 + i * 300;

			this.tweenTo(r, "position", target, time, this.backout(0.4), null,
				i === this.reels.length - 1 ? () => { this.onSpinComplete(); } : undefined
			);
		}
	}

	// MODIFICADO: Lógica de fin de giro completa
	private onSpinComplete(): void {
		this.isSpinning = false;

		// ... dentro de onSpinComplete ...

		// 1. Capturar el estado visible de la grilla de forma PRECISA
		const gridState: SymbolSprite[][] = [];

		for (let i = 0; i < this.NUM_REELS; i++) {
			const reel = this.reels[i];
			gridState[i] = [];

			// Iteramos por las 3 filas visuales (0, 1, 2)
			for (let row = 0; row < this.NUM_SYMBOLS; row++) {
				// Calculamos la posición Y ideal donde DEBERÍA estar el símbolo de esta fila
				// Row 0 = 80px, Row 1 = 240px, Row 2 = 400px (basado en SYMBOL_SIZE 160)
				const idealY = row * this.SYMBOL_SIZE + this.SYMBOL_SIZE / 2;

				// Buscamos en el array de símbolos cuál es el que está visualmente más cerca de esta Y ideal
				let closestSym: SymbolSprite | null = null;
				let minDiff = Infinity;

				for (const sym of reel.symbols) {
					// Distancia absoluta entre la posición del sprite y la posición ideal
					const diff = Math.abs(sym.y - idealY);
					if (diff < minDiff) {
						minDiff = diff;
						closestSym = sym;
					}
				}

				// Asignamos el ganador. ¡Ahora gridState tiene exactamente lo que ves en pantalla!
				if (closestSym) {
					gridState[i][row] = closestSym;
				}
			}
		}

		// 2. Verificar victorias
		let totalWin = 0;
		const winningSprites: SymbolSprite[] = [];

		this.paylines.forEach(line => {
			const firstSymbolKey = gridState[line[0].r][line[0].row].symbolKey;
			let matchCount = 1;
			const currentLineSprites: SymbolSprite[] = [gridState[line[0].r][line[0].row]];

			// Revisar de izquierda a derecha (empezando del segundo carrete)
			for (let i = 1; i < line.length; i++) {
				const nextSymbol = gridState[line[i].r][line[i].row];
				if (nextSymbol.symbolKey === firstSymbolKey) {
					matchCount++;
					currentLineSprites.push(nextSymbol);
				} else {
					// Se rompió la racha
					break;
				}
			}

			// Si hay 3 o más coincidencias, es victoria
			if (matchCount >= 3) {
				console.log(`WIN on line! ${matchCount} of ${firstSymbolKey}`);
				// Pago simple para el ejemplo (se puede hacer una tabla compleja)
				totalWin += matchCount * 2;
				winningSprites.push(...currentLineSprites);
			}
		});


		// 3. Procesar resultados
		if (totalWin > 0) {
			const currentCredits = DataManager.getValue<number>(STORAGE_KEYS.CREDITS) || 0;
			const newBalance = currentCredits + totalWin;
			DataManager.setValue(STORAGE_KEYS.CREDITS, newBalance);
			DataManager.save();
			this.updateBalanceUI(newBalance);

			// 4. Activar animaciones de victoria
			this.animateWins(winningSprites);

		} else {
			console.log("No wins this time.");
		}
	}

	// NUEVO: Función para animar los símbolos ganadores
	private animateWins(winningSprites: SymbolSprite[]): void {
		// Usar un Set para evitar duplicados si un símbolo es parte de dos líneas ganadoras
		const uniqueSprites = new Set(winningSprites);
		SoundLib.playSound("clickSFX", {});

		// 1. Mostrar el overlay oscuro suavemente
		new Tween(this.winOverlay).to({ alpha: 1 }, 500).start();

		// 2. Animar cada sprite ganador
		uniqueSprites.forEach(spr => {
			// Traer el sprite al frente (por encima del overlay oscuro)
			spr.zIndex = 10;
			// Necesitamos habilitar el ordenamiento por zIndex en el contenedor padre
			spr.parent.sortableChildren = true;

			// Efecto de Pulso (Agrandar y achicar en bucle)
			const pulseUp = new Tween(spr.scale)
				.to({ x: spr.initialScale * 1.15, y: spr.initialScale * 1.15 }, 400)
				.easing(Easing.Quadratic.Out);

			const pulseDown = new Tween(spr.scale)
				.to({ x: spr.initialScale, y: spr.initialScale }, 400)
				.easing(Easing.Quadratic.In);

			// Encadenar los tweens para que hagan un bucle
			pulseUp.chain(pulseDown);
			pulseDown.chain(pulseUp);

			pulseUp.start();

			// Guardar referencias para poder detenerlos luego
			this.winTweens.push(pulseUp, pulseDown);
		});
	}


	public override update(_dt: number): void {
		for (const r of this.reels) {
			// Calculamos el blur basado en la velocidad actual
			r.blurAmount = (r.position - r.previousPosition) * 8;

			for (let j = 0; j < r.symbols.length; j++) {
				const s = r.symbols[j];

				// 1. Calculamos dónde estaba el símbolo en el frame ANTERIOR
				const prevY = ((r.previousPosition + j) % r.symbols.length) * this.SYMBOL_SIZE;

				// 2. Calculamos dónde está el símbolo AHORA
				const yPos = ((r.position + j) % r.symbols.length) * this.SYMBOL_SIZE;

				// Posicionamos el sprite visualmente
				s.y = yPos - this.SYMBOL_SIZE + (this.SYMBOL_SIZE / 2);

				// 3. DETECCIÓN DE WRAP (Vuelta completa)
				// Si la posición Y actual es MENOR que la anterior (y el reel avanza hacia adelante),
				// significa que el símbolo acaba de saltar de abajo hacia arriba.
				// ESE es el momento exacto para cambiar la textura.
				if (yPos < prevY && r.position > r.previousPosition) {
					const newKey = this.symbolKeys[Math.floor(Math.random() * this.symbolKeys.length)];
					s.texture = Sprite.from(newKey).texture;
					s.symbolKey = newKey; // Actualizamos la clave para la lógica de ganar
				}
			}

			// IMPORTANTE: Actualizamos la posición previa AL FINAL de todo el procesamiento del reel
			r.previousPosition = r.position;
		}
	}

	public override onResize(newW: number, newH: number): void {
		// (El resto del método onResize es igual, solo añadimos el redimensionado del overlay)
		const topBarHeight = 80;
		const footerHeight = 80;
		const leftPanelWidth = Math.max(180, newW * 0.15);

		this.topBg.clear(); this.topBg.beginFill(COLORS.PANEL_TEAL); this.topBg.drawRect(0, 0, newW, topBarHeight); this.topBg.endFill();
		this.footerBg.clear(); this.footerBg.beginFill(COLORS.BG_DARK); this.footerBg.drawRect(0, 0, newW, footerHeight); this.footerBg.endFill(); this.footerBar.y = newH - footerHeight;
		const leftH = newH - topBarHeight - footerHeight;
		this.leftBg.clear(); this.leftBg.beginFill(COLORS.PANEL_TEAL); this.leftBg.drawRect(0, 0, leftPanelWidth, leftH); this.leftBg.endFill();
		this.leftBg.lineStyle(2, COLORS.ACCENT_GOLD, 0.3); this.leftBg.moveTo(10, 10).lineTo(leftPanelWidth - 10, 10).lineTo(leftPanelWidth - 10, leftH - 10).lineTo(10, leftH - 10).closePath();
		this.leftPanel.y = topBarHeight;

		const tContent: any = this.topBar.getChildByName("content"); if (tContent) { tContent.y = topBarHeight / 2; this.balanceText.x = 20; let jpX = newW - 400; for (const child of tContent.children) { if (child !== this.balanceText) { child.x = jpX; jpX += 130; } } }
		const lContent: any = this.leftPanel.getChildByName("content"); if (lContent) { lContent.x = leftPanelWidth / 2; lContent.y = leftH / 2; }
		const fContent: any = this.footerBar.getChildByName("content"); if (fContent) { fContent.y = footerHeight / 2; this.turboText.x = leftPanelWidth + (newW - leftPanelWidth) / 2; this.betText.x = newW - 30; }

		const availableW = newW - leftPanelWidth;
		const availableH = newH - topBarHeight - footerHeight;
		this.gameContainer.x = leftPanelWidth + availableW / 2;
		this.gameContainer.y = topBarHeight + availableH / 2;

		const gameW = this.REEL_WIDTH * this.NUM_REELS;
		const gameH = this.SYMBOL_SIZE * this.NUM_SYMBOLS;

		this.reelAreaBg.clear(); this.reelAreaBg.beginFill(COLORS.REEL_BG); this.reelAreaBg.drawRect(0, 0, gameW, gameH); this.reelAreaBg.endFill();

		// NUEVO: Redimensionar el overlay de victoria si cambia la pantalla
		this.winOverlay.clear();
		this.winOverlay.beginFill(COLORS.WIN_OVERLAY, 0.7);
		this.winOverlay.drawRect(0, 0, gameW, gameH);
		this.winOverlay.endFill();

		const scaleX = (availableW * 0.9) / gameW;
		const scaleY = (availableH * 0.9) / gameH;
		const scale = Math.min(scaleX, scaleY, 1.2);

		this.gameContainer.scale.set(scale);

		this.spinButtonContainer.x = this.gameContainer.x;
		this.spinButtonContainer.y = newH - footerHeight / 2;
		this.spinButtonContainer.scale.set(Math.min(scale, 1));
	}

	private tweenTo(obj: any, prop: string, target: number, time: number, easing: any, onUpdate: any, onComplete: any): void {
		new Tween(obj).to({ [prop]: target }, time).easing(easing).onUpdate(onUpdate).onComplete(onComplete).start();
	}

	private backout(amount: number) {
		return (t: number) => --t * t * ((amount + 1) * t + amount) + 1;
	}
}