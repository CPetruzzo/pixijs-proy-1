import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// Importamos tweens de Tweedle.js
import { Tween, Easing } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { GlowFilter } from "@pixi/filter-glow";

interface ReelAnimation {
	reel: Container;
	elapsed: number;
	duration: number;
	newSymbols: Text[];
	onComplete: () => void;
}

export class SlotScene extends PixiScene {
	private gameContainer: Container; // Contenedor principal del juego.
	private reels: Container[] = [];
	private symbols: string[] = ["🍒", "🔔", "🍋", "⭐", "7️⃣", "🍉"];
	private spinButton: Graphics;
	private isSpinning: boolean = false;
	private activeReelAnimations: ReelAnimation[] = [];

	// UI
	private money: number = 1000;
	private costPerSpin: number = 50;
	private winMultiplier: number = 10;
	private moneyText: Text;
	private resultText: Text;

	// Parámetros para el efecto de rueda
	private readonly centerY: number = 100; // Centro vertical relativo en el contenedor del carrete.
	private readonly baseX: number = 50; // Posición horizontal base de cada símbolo dentro del contenedor.
	private readonly radius: number = 100; // Radio para el cálculo de la posición vertical.
	// Los ángulos base para cada símbolo (3 símbolos): -90°, 0° y 90° en radianes.
	private readonly baseAngles: number[] = [-Math.PI / 2, 0, Math.PI / 2];
	// Ángulo total de rotación (2π para una vuelta completa).
	private readonly totalRotation: number = 2 * Math.PI;

	// Palanca (lever)
	private lever: Sprite;
	public static readonly BUNDLES = ["slots"];
	private frame: Sprite;
	private casinoBG: Sprite;

	constructor() {
		super();

		SoundLib.playMusic("casinoBGM", { volume: 0.3, loop: true });

		this.casinoBG = Sprite.from("casinoBG");
		this.casinoBG.anchor.set(0.5);
		this.casinoBG.scale.set(0.8);
		this.addChild(this.casinoBG);

		this.gameContainer = new Container();
		this.addChild(this.gameContainer);

		this.createSlotMachineFrame();

		this.createLights();

		this.createReels();
		this.createLever();
		this.createSpinButton();
		this.createMoneyUI();
		this.createResultUI();
	}

	private createSlotMachineFrame(): void {
		this.frame = Sprite.from("frame");
		this.frame.anchor.set(0.5);
		this.frame.scale.set(0.8);
		this.gameContainer.addChildAt(this.frame, 0);
	}

	private createLights(): void {
		const lightColors: number[] = [0xff0000, 0xffff00, 0x2eb4ff, 0x00ff00, 0xff0000, 0x2eb4ff, 0xffff00];
		const lightRadius = 30;

		const frameWidth = this.frame ? this.frame.width : 600;

		const margin = (frameWidth * 0.925) / (lightColors.length + 1);

		const yPos = this.frame ? this.frame.y - this.frame.height / 2 - lightRadius * 2 : 50;

		const glowFilters: GlowFilter[] = [];

		for (let i = 0; i < lightColors.length; i++) {
			const light = new Graphics();
			light.beginFill(lightColors[i]);
			light.drawCircle(0, 0, lightRadius);
			light.endFill();

			light.alpha = 0.1;

			light.x = (i + 1) * margin - this.frame.width / 2 + 26;
			light.y = yPos + 124;

			this.frame.addChild(light);

			const glow = new GlowFilter({
				distance: 15,
				outerStrength: 0,
				innerStrength: 0,
				quality: 0.5,
				color: lightColors[i],
			});

			light.filters = [glow];

			glowFilters.push(glow);
		}

		const maxGlow = 10;
		const durationUp = 100;
		const durationDown = 100;
		const delayBetween = 50;

		function animateWave(index: number): void {
			const currentGlow = glowFilters[index];
			new Tween(currentGlow)
				.to({ outerStrength: maxGlow }, durationUp)
				.easing(Easing.Quadratic.Out)
				.onComplete(() => {
					new Tween(currentGlow)
						.to({ outerStrength: 0 }, durationDown)
						.easing(Easing.Quadratic.In)
						.onComplete(() => {
							const nextIndex = (index + 1) % glowFilters.length;
							setTimeout(() => {
								animateWave(nextIndex);
							}, delayBetween);
						})
						.start();
				})
				.start();
		}
		animateWave(0);
	}

	private createReels(): void {
		const reels = Sprite.from("reels");
		reels.anchor.set(0.5);
		reels.scale.set(0.82, 0.75);
		this.frame.addChild(reels);
		for (let i = 0; i < 3; i++) {
			const reel = new Container();
			reel.x = i * 200 - this.frame.width / 2 + 50;
			reel.y = 100 - this.frame.height / 2 + 200;
			this.frame.addChild(reel);
			this.reels.push(reel);
			this.populateReel(reel);
		}
	}

	private createLever(): void {
		this.lever = Sprite.from("lever");
		this.lever.scale.set(0.2, -0.2);
		this.lever.anchor.set(0.5);

		this.lever.pivot.set(0, 200);

		this.lever.x = 340;
		this.lever.y = 0;
		this.lever.rotation = -Math.PI;
		this.gameContainer.addChild(this.lever);
	}

	private animateLever(): void {
		const tweenPull = new Tween(this.lever).to({ rotation: 0 }, 300).easing(Easing.Quadratic.Out);

		const tweenReturn = new Tween(this.lever).to({ rotation: -Math.PI }, 100).easing(Easing.Quadratic.In);

		SoundLib.playSound("leverSFX", { volume: 0.3 });

		tweenPull.chain(tweenReturn);
		tweenPull.start();
	}

	private getSymbolProperties(index: number, angleOffset: number = 0): { x: number; y: number; scale: number; visible: boolean } {
		const baseAngle = this.baseAngles[index];
		const newAngle = baseAngle + angleOffset;
		const y = this.centerY + this.radius * Math.sin(newAngle);
		const x = this.baseX + 20 * Math.cos(newAngle);
		const scale = 0.7 + 0.3 * ((Math.cos(newAngle) + 1) / 2);
		const visible = Math.cos(newAngle) >= 0;
		return { x, y, scale, visible };
	}

	private populateReel(reel: Container): void {
		reel.removeChildren();
		for (let i = 0; i < 3; i++) {
			const symbol = new Text(this.getRandomSymbol(), { fontSize: 48, fill: "white" });
			const props = this.getSymbolProperties(i, 0);
			symbol.x = props.x + 100;
			symbol.y = props.y + 15;
			symbol.anchor.set(0.5);
			symbol.scale.set(props.scale);
			symbol.visible = props.visible;
			reel.addChild(symbol);
		}
	}

	private createSpinButton(): void {
		this.spinButton = new Graphics();
		this.spinButton.beginFill(0xff0000);
		this.spinButton.drawRoundedRect(145, 252, 100, 50, 10);
		this.spinButton.endFill();
		this.spinButton.interactive = true;

		const style = new TextStyle({
			fill: "#4fba61",
			fontFamily: "Verdana",
			fontWeight: "bolder",
			letterSpacing: 3,
			lineJoin: "round",
			strokeThickness: 1,
			fontSize: 24,
		});

		const buttonText = new Text("SPIN", style);
		buttonText.anchor.set(0.5);
		buttonText.x = 195;
		buttonText.y = 277;

		this.spinButton.addChild(buttonText);
		this.gameContainer.addChild(this.spinButton);

		this.spinButton.on("pointerdown", () => {
			this.animateLever();
			this.startSpin();
		});
	}

	private createMoneyUI(): void {
		const style = new TextStyle({
			fill: "yellow",
			fontFamily: "Verdana",
			fontWeight: "bolder",
			letterSpacing: 3,
			lineJoin: "round",
			strokeThickness: 1,
			fontSize: 32,
		});
		this.moneyText = new Text(`Money: $${this.money}`, style);
		this.moneyText.anchor.set(0, 0);
		this.moneyText.x = -250;
		this.moneyText.y = 255;
		this.gameContainer.addChild(this.moneyText);
	}

	private createResultUI(): void {
		this.resultText = new Text("", { fontSize: 48, fill: "white" });
		this.resultText.anchor.set(0.5);
		this.resultText.x = 0;
		this.resultText.y = 0;
		this.gameContainer.addChild(this.resultText);
	}

	private updateMoneyUI(): void {
		this.moneyText.text = `Money: $${this.money}`;
	}

	private showResultMessage(message: string, color: number = 0xffffff): void {
		const style = new TextStyle({
			fill: "#4fba61",
			fontFamily: "Verdana",
			fontWeight: "bolder",
			letterSpacing: 3,
			lineJoin: "round",
			strokeThickness: 1,
			fontSize: 54,
		});
		this.resultText.style = style;
		this.resultText.text = message;
		this.resultText.style.fill = color;
		setTimeout(() => {
			this.resultText.text = "";
		}, 2000);
	}

	private startSpin(): void {
		if (this.isSpinning) {
			return;
		}

		if (this.money < this.costPerSpin) {
			this.showResultMessage("Not enough money!", 0xff0000);
			return;
		}

		this.money -= this.costPerSpin;
		this.updateMoneyUI();

		this.isSpinning = true;
		let spinsCompleted = 0;

		this.reels.forEach((reel, index) => {
			setTimeout(() => {
				this.animateReel(reel, () => {
					spinsCompleted++;
					if (spinsCompleted === this.reels.length) {
						this.isSpinning = false;
						this.checkOutcome();
					}
				});
			}, index * 500);
		});
	}

	private animateReel(reel: Container, onComplete: () => void): void {
		const newSymbols: Text[] = [];
		for (let i = 0; i < 3; i++) {
			const symbol = new Text(this.getRandomSymbol(), { fontSize: 48, fill: "white" });
			symbol.anchor.set(0.5);
			newSymbols.push(symbol);
		}

		const animation: ReelAnimation = {
			reel: reel,
			elapsed: 0,
			duration: 5000,
			newSymbols: newSymbols,
			onComplete: onComplete,
		};

		this.activeReelAnimations.push(animation);
	}

	public override update(dt: number): void {
		const toRemove: ReelAnimation[] = [];

		for (const anim of this.activeReelAnimations) {
			anim.elapsed += dt * 16.66;
			const progress = anim.elapsed / anim.duration;
			const angleOffset = progress * this.totalRotation;

			anim.reel.children.forEach((child, i) => {
				if (child instanceof Text) {
					const props = this.getSymbolProperties(i, angleOffset);
					child.x = props.x + 100;
					child.y = props.y + 15;
					child.scale.set(props.scale);
					child.visible = props.visible;
				}
			});

			if (progress >= 1) {
				anim.reel.removeChildren();
				anim.newSymbols.forEach((symbol, i) => {
					const props = this.getSymbolProperties(i, 0);
					symbol.x = props.x + 100;
					symbol.y = props.y + 15;
					symbol.anchor.set(0.5);
					symbol.scale.set(props.scale);
					symbol.visible = props.visible;
					anim.reel.addChild(symbol);
				});
				anim.onComplete();
				toRemove.push(anim);
			}
		}

		this.activeReelAnimations = this.activeReelAnimations.filter((anim) => !toRemove.includes(anim));

		this.reels.forEach((reel) => this.applyDeformation(reel));
	}

	private applyDeformation(reel: Container): void {
		const center = this.centerY;
		reel.children.forEach((child) => {
			if (child instanceof Text) {
				const offset = Math.abs(child.y - center);
				const factor = 1 - (offset / center) * 0.3;
				child.scale.x = factor;
				child.scale.y = 1 + (offset / center) * 0.1;
			}
		});
	}

	private getRandomSymbol(): string {
		return this.symbols[Math.floor(Math.random() * this.symbols.length)];
	}

	private checkOutcome(): void {
		const results = this.reels.map((reel) => {
			const symbol = reel.getChildAt(1) as Text;
			return symbol.text;
		});

		if (results.every((result) => result === results[0])) {
			const winAmount = this.costPerSpin * this.winMultiplier;
			this.money += winAmount;
			this.showResultMessage(`Win $${winAmount}!`, 0x00ff00);
			SoundLib.playSound("winSFX", { volume: 0.3 });
		} else {
			this.showResultMessage("Try Again", 0xff0000);
		}
		this.updateMoneyUI();
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.casinoBG, _newW, _newH, 800, 720, ScaleHelper.FILL);
		this.casinoBG.x = _newW * 0.5;
		this.casinoBG.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 800, 720, ScaleHelper.FIT);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;
	}
}
