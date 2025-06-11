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

	// Lista de claves de textura
	private symbolKeys = [
		"slotghost", "slotpumpkin", "slotgoldcoin",
		"slotbat", "sloteye", "slotskull", "slotcandle",
	];

	private soulText: Sprite;
	private spinBtn: Sprite;
	private lossStreak = 0;

	constructor(_onComplete?: any) {
		super();

		this.interactive = true;

		this.addChild(this.reelsContainer);
		this.addChild(this.decorContainer);

		// Centramos el pivot de los carretes para poder aplicar shake
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
			// tras 750 ms quito el glitch y lo oculto
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

	/**
	 * Revisa **solo** la fila central de los 3 carretes.
	 * Emite “winAHSlot” si los tres símbolos centrales coinciden.
	 */
	private checkWinLine(_onComplete?: any): void {
		const N = this.NUM_SYMBOLS;

		// Tomamos únicamente la fila central (índice 1)
		const middleRowTextures: any[] = [];

		for (const r of this.reels) {
			// Redondeamos la posición para evitar decimales
			const rawPos = Math.round(r.position);
			// Normalizamos a [0..N-1]
			const pos = ((rawPos % N) + N) % N;
			// Calculamos qué índice j de `symbols[j]` está en la fila central:
			// si (pos + j) % N == 1  →  j = (1 - pos) mod N
			const idxMiddle = ((1 - pos) + N) % N;
			middleRowTextures.push(r.symbols[idxMiddle].texture);
		}

		// Verificamos si los tres símbolos centrales son idénticos
		const [tex0, tex1, tex2] = middleRowTextures;
		if (tex0 === tex1 && tex1 === tex2) {
			console.log("¡GANASTE en la fila central con símbolo:", tex0);
			this.lossStreak = 0; // reiniciar racha
			SoundLib.playSound("clickSFX", {});
			this.emit("winAHSlot");
			return;
		}

		// Si NO hubo victoria en la fila central
		this.lossStreak++;
		console.log(`Llevas ${this.lossStreak} derrotas seguidas`);

		if (this.lossStreak >= 2) {
			this.lossStreak = 0;
			this.showJumpscare();
		}
	}

	/**
	 * Muestra un esqueleto inclinado con sonido que se desvanece.
	 * Luego emite el evento "curse" para que la escena padre muestre el OverlayScene.
	 * Finalmente, hace shake y llama a forceWinAnimated().
	 */
	private showJumpscare(): void {
		const skel = Sprite.from("ghost_handsup");
		skel.anchor.set(0.5);
		skel.scale.set(2.9);
		// Lo colocamos en el centro de `decorContainer`
		skel.x = this.decorContainer.x + 300;
		skel.y = this.decorContainer.y + 800;
		skel.rotation = -Math.PI / 8; // tilt de 22.5°
		skel.alpha = 0;
		this.decorContainer.addChild(skel);

		// sonido
		SoundLib.playSound("scare2", {
			volume: 1,
			speed: 1.5
		});

		// Fade in rápido, esperar 1 s, luego fade out y `removeChild`
		new Tween(skel)
			.to({ alpha: 1 }, 200)
			.easing(Easing.Quadratic.Out)
			.onComplete(() => {
				setTimeout(() => {
					new Tween(skel)
						.to({ alpha: 0 }, 400)
						.easing(Easing.Quadratic.In)
						.onComplete(() => {
							this.decorContainer.removeChild(skel);

							// *** EN VEZ DE CREAR UN Text LOCAL, emitimos el evento "curse" ***
							this.emit("curse");

							// *** Shake de cámara ***
							this.shakeCamera().then(() => {
								// *** Forzamos la victoria con animación ***
								this.forceWinAnimated();
							});
						})
						.start();
				}, 100);
			})
			.start();
	}

	/**
	 * Shake de cámara sobre reelsContainer (~500 ms). Resuelve la promesa cuando termina.
	 */
	private shakeCamera(): Promise<void> {
		return new Promise((resolve) => {
			const originalX = this.reelsContainer.x;
			const originalY = this.reelsContainer.y;

			const shakes = 8;
			let count = 0;
			SoundLib.playSound("sound_hit", { volume: 0.5, loop: false });

			const doOneShake = (): void => {
				if (count >= shakes) {
					this.reelsContainer.x = originalX;
					this.reelsContainer.y = originalY;
					resolve();
					return;
				}
				count++;

				const dx = (Math.random() - 0.5) * 20;
				const dy = (Math.random() - 0.5) * 20;

				new Tween(this.reelsContainer)
					.to({ x: originalX + dx, y: originalY + dy }, 50)
					.easing(Easing.Linear.None)
					.onComplete(() => {
						new Tween(this.reelsContainer)
							.to({ x: originalX, y: originalY }, 50)
							.easing(Easing.Linear.None)
							.onComplete(() => {
								setTimeout(doOneShake, 20);
							})
							.start();
					})
					.start();
			};

			doOneShake();
		});
	}

	/**
	 * Fuerza una victoria instantánea con animación (solo para debug).
	 */
	public forceWinAnimated(): void {
		const N = this.NUM_SYMBOLS;

		// 1) Elegimos un índice de símbolo al azar
		const forcedIndex = Math.floor(Math.random() * N);
		const forcedKey = this.symbolKeys[forcedIndex];
		const forcedTexture = Sprite.from(forcedKey).texture;

		// 2) Calculamos targetPositions
		const targetPositions: number[] = [];
		for (const r of this.reels) {
			let foundIdx = r.symbols.findIndex(s => s.texture === forcedTexture);
			if (foundIdx < 0) {
				foundIdx = 0;
				r.symbols[0].texture = forcedTexture;
			}
			let basePos = ((1 - foundIdx) % N + N) % N;
			const vueltasExtra = 3;
			basePos += N * vueltasExtra;
			targetPositions.push(basePos);
		}

		// 3) Animamos cada carrete
		this.isSpinning = true;
		SoundLib.playSound("wheel-spin", { volume: 0.5, speed: 0.4, loop: false });

		for (let i = 0; i < this.reels.length; i++) {
			const r = this.reels[i];
			const target = targetPositions[i];
			const duration = 2000 + i * 500;
			this.tweenTo(
				r,
				"position",
				target,
				duration,
				this.backout(0.5),
				undefined,
				i === this.reels.length - 1
					? () => {
						this.isSpinning = false;
						this.lossStreak = 0;
						this.emit("winAHSlot");
					}
					: undefined
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
