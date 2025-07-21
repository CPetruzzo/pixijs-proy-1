/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Sprite, Text, TextStyle } from "pixi.js";
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

		// Añadimos el container principal
		this.addChild(this.gameContainer);

		// Fijamos pivote al centro del área de reels
		const totalW = this.REEL_WIDTH * this.NUM_REELS;
		const totalH = this.SYMBOL_SIZE * 3;
		this.gameContainer.pivot.set(totalW / 2, totalH / 2);

		// Construimos carretes
		this.buildReels();

		// Creamos botón SPIN
		this.spinButton = Sprite.from("slotghost"); // puedes usar otra textura o un gráfico
		this.spinButton.anchor.set(0.5);
		this.spinButton.width = 200;
		this.spinButton.height = 60;
		this.spinButton.tint = 0xaa0000;
		this.spinButton.interactive = true;
		this.spinButton.on("pointerdown", () => this.startSpin());
		this.addChild(this.spinButton);

		this.spinText = new Text(
			"SPIN",
			new TextStyle({
				fontSize: 28,
				fill: "white",
				fontWeight: "bold",
			})
		);
		this.spinText.anchor.set(0.5);
		this.addChild(this.spinText);
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

		// Escalado si lo deseas
		ScaleHelper.setScaleRelativeToIdeal(
			this.gameContainer,
			newW,
			newH,
			this.REEL_WIDTH * this.NUM_REELS,
			this.SYMBOL_SIZE * 3,
			ScaleHelper.FIT
		);

		// Reposicionamos botón y texto
		this.spinButton.x = newW / 2;
		this.spinButton.y = newH - 80;
		this.spinText.x = this.spinButton.x;
		this.spinText.y = this.spinButton.y;
	}
}
