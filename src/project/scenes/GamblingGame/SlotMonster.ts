/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Sprite, Text, TextStyle, Graphics } from "pixi.js";
import { Tween } from "tweedle.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

interface Reel {
	container: Container;
	symbols: Sprite[];
	position: number;
	previousPosition: number;
	blurAmount: number;
}

export class SlotMonster extends PixiScene {
	public static readonly BUNDLES = ["abandonedhouse"];

	private gameContainer = new Container();
	private reels: Reel[] = [];

	private REEL_WIDTH = 160;
	private SYMBOL_SIZE = 150;
	private NUM_REELS = 5;
	private NUM_SYMBOLS = 4;

	private isSpinning = false;
	private spinButton: Sprite;
	private spinText: Text;

	// UI elements
	private uiContainer = new Container();
	private topContainer = new Container();
	private leftContainer = new Container();
	private footerContainer = new Container();

	private balanceText: Text;
	private betText: Text;
	private majorText: Text;
	private minorText: Text;
	private miniText: Text;
	private buyBonusText: Text;
	private turboHintText: Text;

	// Array de claves de textura para los símbolos
	private symbolKeys = [
		"slotghost",
		"slotpumpkin",
		"slotgoldcoin",
		"slotbat",
		"sloteye",
		"slotskull",
		"slotcandle",
	];

	constructor() {
		super();

		// Añadimos los containers principales
		this.addChild(this.gameContainer);
		this.addChild(this.uiContainer); // UI encima de la gameContainer

		// Fijamos pivote al centro del área de reels
		const totalW = this.REEL_WIDTH * this.NUM_REELS;
		const totalH = this.SYMBOL_SIZE * 3;
		this.gameContainer.pivot.set(totalW / 2, totalH / 2);

		// Construimos carretes
		this.buildReels();

		// Construimos UI (placeholders)
		this.createUI();

		// Creamos botón SPIN (dejé visual simple — lo puedes cambiar por una textura/círculo)
		this.spinButton = Sprite.from("slotghost"); // textura temporal
		this.spinButton.anchor.set(0.5);
		this.spinButton.width = 200;
		this.spinButton.height = 60;
		this.spinButton.tint = 0xaa0000;
		this.spinButton.interactive = true;
		this.spinButton.on("pointerdown", () => this.startSpin());
		this.uiContainer.addChild(this.spinButton);

		this.spinText = new Text(
			"SPIN",
			new TextStyle({
				fontSize: 28,
				fill: "white",
				fontWeight: "bold",
			})
		);
		this.spinText.anchor.set(0.5);
		this.uiContainer.addChild(this.spinText);
	}

	private buildReels(): void {
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

			for (let j = 0; j < this.NUM_SYMBOLS; j++) {
				// Elegimos textura aleatoria de symbolKeys
				const key = this.symbolKeys[Math.floor(Math.random() * this.symbolKeys.length)];
				const spr = Sprite.from(key);
				spr.width = this.SYMBOL_SIZE;
				spr.height = this.SYMBOL_SIZE;
				spr.x = (this.REEL_WIDTH - this.SYMBOL_SIZE) / 2;
				spr.y = j * this.SYMBOL_SIZE;
				rc.addChild(spr);
				reel.symbols.push(spr);
			}

			this.reels.push(reel);
		}
	}

	private createUI(): void {
		// Top bar (balance + jackpots)
		this.uiContainer.addChild(this.topContainer);

		// background panel style
		const panelBg = new Graphics();
		panelBg.beginFill(0x0b2a2f); // azul oscuro
		panelBg.drawRoundedRect(0, 0, 1, 1, 8); // tamaño real en onResize
		panelBg.endFill();
		this.topContainer.addChild(panelBg);
		panelBg.name = "topBg";

		const labelStyle = new TextStyle({
			fontSize: 22,
			fill: "#f8e9b7", // dorado claro
			fontWeight: "bold",
		});
		const valueStyle = new TextStyle({
			fontSize: 30,
			fill: "#ffffff",
			fontWeight: "bold",
		});

		this.balanceText = new Text("€ 000,00", valueStyle);
		this.balanceText.anchor.set(0.5);
		this.topContainer.addChild(this.balanceText);

		// Jackpot panels
		this.majorText = new Text("MAJOR\n400,00", labelStyle);
		this.majorText.anchor.set(0.5);
		this.topContainer.addChild(this.majorText);

		this.minorText = new Text("MINOR\n100,00", labelStyle);
		this.minorText.anchor.set(0.5);
		this.topContainer.addChild(this.minorText);

		this.miniText = new Text("MINI\n40,0", labelStyle);
		this.miniText.anchor.set(0.5);
		this.topContainer.addChild(this.miniText);

		// Left panel (BUY BONUS)
		this.uiContainer.addChild(this.leftContainer);
		const leftBg = new Graphics();
		leftBg.beginFill(0x163133);
		leftBg.drawRoundedRect(0, 0, 1, 1, 10);
		leftBg.endFill();
		this.leftContainer.addChild(leftBg);
		leftBg.name = "leftBg";

		this.buyBonusText = new Text("BUY\nBONUS\n€200", new TextStyle({
			fontSize: 28,
			fill: "#f8e9b7",
			fontWeight: "bold",
			align: "center",
		}));
		this.buyBonusText.anchor.set(0.5);
		this.leftContainer.addChild(this.buyBonusText);

		// Footer (bet, hint, auto / spin area)
		this.uiContainer.addChild(this.footerContainer);
		const footerBg = new Graphics();
		footerBg.beginFill(0x081a1d);
		footerBg.drawRect(0, 0, 1, 1);
		footerBg.endFill();
		this.footerContainer.addChild(footerBg);
		footerBg.name = "footerBg";

		this.betText = new Text("BET 2,00", new TextStyle({
			fontSize: 20,
			fill: "#f8e9b7",
			fontWeight: "bold",
		}));
		this.betText.anchor.set(0, 0.5);
		this.footerContainer.addChild(this.betText);

		this.turboHintText = new Text("HOLD SPACE KEY FOR TURBO SPIN", new TextStyle({
			fontSize: 18,
			fill: "#cfd8d8",
		}));
		this.turboHintText.anchor.set(0.5, 0.5);
		this.footerContainer.addChild(this.turboHintText);

		// Auto/spin controls placeholder (circle + +/-)
		const autoContainer = new Container();
		autoContainer.name = "autoContainer";
		this.footerContainer.addChild(autoContainer);

		const autoCircle = new Graphics();
		autoCircle.lineStyle(6, 0xd4b24a);
		autoCircle.drawCircle(0, 0, 40);
		autoContainer.addChild(autoCircle);

		const autoLabel = new Text("AUTO", new TextStyle({
			fontSize: 14,
			fill: "#f8e9b7",
			fontWeight: "bold",
		}));
		autoLabel.anchor.set(0.5, 0.5);
		autoContainer.addChild(autoLabel);
		// Guardamos referencia para posicionar en onResize
		this.footerContainer.getChildAt(1).name = "autoContainer"; // not strictly necessary
	}

	private startSpin(): void {
		if (this.isSpinning) { return; }
		this.isSpinning = true;

		for (let i = 0; i < this.reels.length; i++) {
			const r = this.reels[i];
			const extra = Math.floor(Math.random() * 3);
			const target = r.position + 10 + i * 5 + extra;
			const time = 2500 + i * 600 + extra * 600;
			this.tweenTo(
				r,
				"position",
				target,
				time,
				this.backout(0.5),
				undefined,
				i === this.reels.length - 1 ? () => (this.isSpinning = false) : undefined
			);
		}
	}

	public override update(_dt: number): void {
		for (const r of this.reels) {
			r.blurAmount = (r.position - r.previousPosition) * 8;
			r.previousPosition = r.position;

			for (let j = 0; j < r.symbols.length; j++) {
				const s = r.symbols[j];
				const prevY = s.y;
				s.y = ((r.position + j) % r.symbols.length) * this.SYMBOL_SIZE - this.SYMBOL_SIZE;
				if (s.y < 0 && prevY > this.SYMBOL_SIZE) {
					// Reemplazamos la textura por otra aleatoria
					const key = this.symbolKeys[Math.floor(Math.random() * this.symbolKeys.length)];
					s.texture = Sprite.from(key).texture;
				}
			}
		}
	}

	private tweenTo(
		object: any,
		property: string,
		target: number,
		time: number,
		easing: (k: number) => number,
		onChange?: (t: any) => void,
		onComplete?: (t: any) => void
	): void {
		new Tween(object)
			.to({ [property]: target }, time)
			.easing(easing)
			.onUpdate(onChange)
			.onComplete(onComplete)
			.start();
	}

	private backout(amount: number) {
		return (t: number) => --t * t * ((amount + 1) * t + amount) + 1;
	}

	public override onResize(newW: number, newH: number): void {
		// Centro de la escena
		this.gameContainer.x = newW / 2;
		this.gameContainer.y = newH / 2;

		// Escalado del juego (reels)
		ScaleHelper.setScaleRelativeToIdeal(
			this.gameContainer,
			newW * 0.5,
			newH * 0.5,
			this.REEL_WIDTH * this.NUM_REELS,
			this.SYMBOL_SIZE * 3,
			ScaleHelper.FIT
		);

		// Reposicionamos y escalamos la UI (top / left / footer)
		const padding = 5;
		const topHeight = 100;
		const leftWidth = 160;
		const footerHeight = 80;

		// UI container al frente centrado
		this.uiContainer.x = 0;
		this.uiContainer.y = 0;

		// TOP
		this.topContainer.x = padding;
		this.topContainer.y = padding;
		const topBg: any = this.topContainer.getChildByName("topBg");
		if (topBg) {
			const topW = newW - padding * 2;
			(topBg.clear)();
			topBg.beginFill(0x0b2a2f);
			topBg.drawRoundedRect(0, 0, topW, topHeight, 8);
			topBg.endFill();
		}
		// Colocamos textos dentro del top bar
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const slot = (i: number) => padding + 20 + i * ((newW - padding * 2) / 4);
		this.balanceText.x = slot(0) + 60;
		this.balanceText.y = this.topContainer.y + topHeight / 2;

		this.majorText.x = slot(1) + 40;
		this.majorText.y = this.topContainer.y + topHeight / 2;
		this.minorText.x = slot(2) + 30;
		this.minorText.y = this.topContainer.y + topHeight / 2;
		this.miniText.x = slot(3) + 20;
		this.miniText.y = this.topContainer.y + topHeight / 2;

		// LEFT
		this.leftContainer.x = padding;
		this.leftContainer.y = this.topContainer.y + topHeight + padding;
		const leftBg: any = this.leftContainer.getChildByName("leftBg");
		if (leftBg) {
			(leftBg.clear)();
			leftBg.beginFill(0x163133);
			leftBg.drawRoundedRect(0, 0, leftWidth, newH - topHeight - footerHeight - padding * 4, 10);
			leftBg.endFill();
		}
		this.buyBonusText.x = this.leftContainer.x + leftWidth / 2;
		this.buyBonusText.y = this.leftContainer.height * 0.5;

		// FOOTER
		this.footerContainer.x = 0;
		this.footerContainer.y = newH - footerHeight - padding;
		const footerBg: any = this.footerContainer.getChildByName("footerBg");
		if (footerBg) {
			(footerBg.clear)();
			footerBg.beginFill(0x081a1d);
			footerBg.drawRect(0, 0, newW, footerHeight);
			footerBg.endFill();
		}
		this.betText.x = padding;
		this.betText.y = this.footerContainer.y + footerHeight / 2;

		this.turboHintText.x = newW / 2;
		this.turboHintText.y = this.footerContainer.y + footerHeight / 2;

		// Auto control (circle) en footer, a la derecha
		const autoContainer = this.footerContainer.getChildByName("autoContainer");
		if (autoContainer) {
			// posición local dentro del footer: cerca del borde derecho
			const rightMargin = 80; // ajusta distancia al borde
			autoContainer.x = newW - rightMargin; // newW es el ancho del footer
			autoContainer.y = footerHeight / 2;   // centrar verticalmente en el footer

			// si pusiste pivot en el container, quizás quieras reajustar la x:
			// autoContainer.x = newW - rightMargin - autoContainer.pivot.x;
		}

		// Reposicionar spin button y texto encima del footer
		this.spinButton.x = newW / 2;
		this.spinButton.y = newH - footerHeight - 40;
		this.spinText.x = this.spinButton.x;
		this.spinText.y = this.spinButton.y;
	}
}
