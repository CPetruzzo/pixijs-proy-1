/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Graphics, Sprite } from "pixi.js";
import { Easing, Tween } from "tweedle.js";
import { GlitchFilter } from "@pixi/filter-glitch";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { SoundLib } from "../../../../engine/sound/SoundLib";

interface Reel {
	container: Container;
	symbols: Sprite[];
	position: number;
	previousPosition: number;
	blurAmount: number;
}

export class SlotMachineScene extends PixiScene {
	public static readonly BUNDLES = ["abandonedhouse"];

	private reels: Reel[] = [];

	// — Configurables para la máscara —
	private readonly MASK_WIDTH = 480;
	private readonly MASK_HEIGHT = 450;
	private readonly MASK_X = 0;
	private readonly MASK_Y = 0;

	private REEL_WIDTH = 205;
	private SYMBOL_SIZE = 169;
	private NUM_REELS = 3;
	private NUM_SYMBOLS = 7;

	private maskGraphics: Graphics;
	private isSpinning = false;

	private reelsContainer = new Container();
	private decorContainer = new Container();

	private symbolKeys = [
		"slotghost", "slotpumpkin", "slotgoldcoin",
		"slotbat", "sloteye", "slotskull", "slotcandle",
	];

	private soulText: Sprite;
	private spinBtn: Sprite;
	private lossStreak = 0; // ◀– Nuevo

	constructor(_onComplete?: any) {
		super();

		this.interactive = true;

		this.addChild(this.reelsContainer);
		this.addChild(this.decorContainer);

		this.reelsContainer.pivot.set(this.MASK_WIDTH / 2 + 25, this.MASK_HEIGHT / 2);
		this.buildReels();

		this.maskGraphics = new Graphics()
			.beginFill(0xffffff)
			.drawRect(
				this.MASK_X - this.MASK_WIDTH / 2,
				this.MASK_Y - this.MASK_HEIGHT / 2,
				this.MASK_WIDTH * 2,
				this.MASK_HEIGHT * 2
			)
			.endFill();

		this.reelsContainer.addChild(this.maskGraphics);
		this.reelsContainer.mask = this.maskGraphics;

		const frame = Sprite.from("slotframe");
		frame.anchor.set(0.5);
		this.decorContainer.addChild(frame);

		// — Aquí el soulText visible desde el inicio —
		this.soulText = Sprite.from("soul");
		this.soulText.anchor.set(0.5);
		this.soulText.y = -410;
		frame.addChild(this.soulText);

		// --- resto sin cambios ---
		this.spinBtn = Sprite.from("slotspinbtn");
		this.spinBtn.anchor.set(0.5);
		this.spinBtn.interactive = true;
		const pos = 425;
		this.spinBtn.y = pos;
		this.spinBtn.on("pointerdown", () => {
			// sonido
			SoundLib.playSound("clickSFX", {});
			new Tween(this.spinBtn)
				.to({ y: 430 }, 300)
				.easing(Easing.Bounce.Out)
				.yoyo(true)
				.start()
				.onComplete(() => { this.spinBtn.y = pos; });
			this.startSpin(_onComplete);
		});
		this.decorContainer.addChild(this.spinBtn);
	}

	private buildReels(): void {
		for (let i = 0; i < this.NUM_REELS; i++) {
			const rc = new Container();
			const totalReelsW = this.REEL_WIDTH * this.NUM_REELS;
			const offsetX = (this.MASK_WIDTH - totalReelsW) / 2;
			rc.x = offsetX + i * this.REEL_WIDTH;
			this.reelsContainer.addChild(rc);

			const reel: Reel = { container: rc, symbols: [], position: 0, previousPosition: 0, blurAmount: 0 };

			for (let j = 0; j < this.NUM_SYMBOLS; j++) {
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

	public soulToCoin(): void {
		// — Al segundo, aplico el glitch —
		setTimeout(() => {
			this.soulText.filters = [new GlitchFilter()];
			// tras 500 ms quito el glitch y lo oculto
			setTimeout(() => {
				this.soulText.filters = [];
				this.soulText.visible = false;
			}, 750);
		}, 1500);
	}

	private startSpin(_onComplete?: any): void {
		if (this.isSpinning) { return; }
		this.isSpinning = true;
		SoundLib.playSound("wheel-spin", { volume: 0.5, speed: 0.3, loop: false });

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
				// en el último carrete:
				i === this.reels.length - 1
					? () => {
						this.isSpinning = false;
						this.checkWinLine(_onComplete);
					}
					: undefined
			);
		}
	}

	private checkWinLine(_onComplete?: any): void {
		const middleTextures = this.reels.map(r => r.symbols[1].texture);
		const first = middleTextures[0];
		const win = middleTextures.every(tex => tex === first);

		if (win) {
			console.log("¡GANASTE!", first);
			this.lossStreak = 0; // reset
			SoundLib.playSound("clickSFX", {});
			this.emit("winAHSlot"); // Emitimos el evento de victoria


			// … tu lógica de victoria
		}
		else {
			this.lossStreak++;
			console.log(`Llevas ${this.lossStreak} derrotas seguidas`);

			if (this.lossStreak >= 10) {
				this.lossStreak = 0;
				this.showSkeletonJumpscare();
			}
		}
	}

	/** Muestra un esqueleto inclinado con sonido y se desvanece */
	private showSkeletonJumpscare(): void {
		const skel = Sprite.from("AH_skeleton");
		skel.anchor.set(0.5);
		skel.scale.set(2.5);
		// Colócalo en el centro de la pantalla:
		skel.x = this.decorContainer.x + 300;
		skel.y = this.decorContainer.y + 800;
		skel.rotation = -Math.PI / 8; // 22.5° de tilt
		skel.alpha = 0;
		this.decorContainer.addChild(skel);

		// sonido
		SoundLib.playSound("scare2", {
			volume: 1,
			// start: 2.5,
			speed: 1.5
		});

		// fade in rápido, esperar un segundo, fade out
		new Tween(skel)
			.to({ alpha: 1 }, 200)
			.easing(Easing.Quadratic.Out)
			.onComplete(() => {
				setTimeout(() => {
					new Tween(skel)
						.to({ alpha: 0 }, 500)
						.easing(Easing.Quadratic.In)
						.onComplete(() => this.decorContainer.removeChild(skel))
						.start();
				}, 1000);
			})
			.start();
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
					const key = this.symbolKeys[Math.floor(Math.random() * this.symbolKeys.length)];
					s.texture = Sprite.from(key).texture;
				}
			}
		}
	}

	private tweenTo(
		object: any, property: string, target: number, time: number,
		easing: (k: number) => number, onChange?: any, onComplete?: any
	): void {
		new Tween(object).to({ [property]: target }, time)
			.easing(easing)
			.onUpdate(onChange)
			.onComplete(onComplete)
			.start();
	}

	private backout(amount: number) {
		return (t: number) => --t * t * ((amount + 1) * t + amount) + 1;
	}

	public override onResize(newW: number, newH: number): void {
		this.reelsContainer.x = newW / 2;
		this.reelsContainer.y = newH / 2;
		ScaleHelper.setScaleRelativeToIdeal(this.reelsContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);

		this.decorContainer.x = newW / 2;
		this.decorContainer.y = newH / 2;
		ScaleHelper.setScaleRelativeToIdeal(this.decorContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);

		const spinBtn = this.decorContainer.getChildAt(1) as Sprite;
		spinBtn.position.set(0, 425);
	}
}
