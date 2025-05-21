// src/scenes/SlotManager.ts
import { Container, Graphics, Text } from "pixi.js";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { Keyboard } from "../../../../engine/input/Keyboard";

interface ReelAnimation {
	reel: Container;
	elapsed: number;
	duration: number;
	newSymbols: Text[];
	onComplete: () => void;
}

export class SlotManager extends Container {
	private reels: Container[] = [];
	private symbols = ["🍒", "🔔", "🍋", "⭐", "7️⃣", "🍉"];
	private activeReelAnimations: ReelAnimation[] = [];
	private isSpinning = false;

	// UI internos
	private money = 1000;
	private costPerSpin = 50;
	private winMultiplier = 10;
	private moneyText: Text;
	private resultText: Text;

	// parámetros de rueda
	private centerY = 100;
	private baseX = 50;
	private radius = 100;
	private baseAngles = [-Math.PI / 2, 0, Math.PI / 2];
	private totalRotation = Math.PI * 2;

	constructor() {
		super();

		// 1) fondo negro semi‐opaco
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.8).drawRect(-400, -300, 800, 600).endFill();
		this.addChild(bg);

		// 2) 3 carretes
		for (let i = 0; i < 3; i++) {
			const reel = new Container();
			reel.x = i * 200 - 200;
			reel.y = 0;
			this.addChild(reel);
			this.reels.push(reel);
			this.populateReel(reel);
		}

		// 3) UI texto dinero
		this.moneyText = new Text(`$${this.money}`, { fill: "yellow", fontSize: 24 });
		this.moneyText.position.set(-380, -280);
		this.addChild(this.moneyText);

		// 4) UI resultado
		this.resultText = new Text("", { fill: "white", fontSize: 32 });
		this.resultText.position.set(0, 200);
		this.resultText.anchor.set(0.5);
		this.addChild(this.resultText);

		// 5) input click para girar
		this.interactive = true;
		if (Keyboard.shared.justReleased("Enter")) {
			this.startSpin();
		}
	}

	private populateReel(reel: Container): void {
		reel.removeChildren();
		for (let i = 0; i < 3; i++) {
			const sym = new Text(this.getRandomSymbol(), { fontSize: 48, fill: "white" });
			const { x, y, scale, visible } = this.getSymbolProperties(i, 0);
			sym.position.set(x, y);
			sym.anchor.set(0.5);
			sym.scale.set(scale);
			sym.visible = visible;
			reel.addChild(sym);
		}
	}

	private getSymbolProperties(idx: number, angleOff: number): any {
		const a = this.baseAngles[idx] + angleOff;
		return {
			x: this.baseX + 20 * Math.cos(a),
			y: this.centerY + this.radius * Math.sin(a),
			scale: 0.7 + 0.3 * ((Math.cos(a) + 1) / 2),
			visible: Math.cos(a) >= 0,
		};
	}

	private getRandomSymbol(): any {
		return this.symbols[Math.floor(Math.random() * this.symbols.length)];
	}

	private startSpin(): void {
		if (this.isSpinning || this.money < this.costPerSpin) {
			return;
		}
		this.money -= this.costPerSpin;
		this.moneyText.text = `$${this.money}`;
		SoundLib.playSound("leverSFX", {});
		this.isSpinning = true;
		let completed = 0;

		this.reels.forEach((r, i) => {
			setTimeout(() => {
				this.animateReel(r, () => {
					completed++;
					if (completed === 3) {
						this.isSpinning = false;
						this.checkOutcome();
					}
				});
			}, i * 300);
		});
	}

	private animateReel(reel: Container, onComplete: () => void): void {
		const newSyms: Text[] = [];
		for (let i = 0; i < 3; i++) {
			const t = new Text(this.getRandomSymbol(), { fontSize: 48, fill: "white" });
			t.anchor.set(0.5);
			newSyms.push(t);
		}
		const anim: ReelAnimation = {
			reel,
			elapsed: 0,
			duration: 3000,
			newSymbols: newSyms,
			onComplete,
		};
		this.activeReelAnimations.push(anim);
	}

	public update(dt: number): void {
		const done: ReelAnimation[] = [];
		for (const anim of this.activeReelAnimations) {
			anim.elapsed += dt * 16.66;
			const p = anim.elapsed / anim.duration;
			const angleOff = p * this.totalRotation;
			anim.reel.children.forEach((c, i) => {
				const props = this.getSymbolProperties(i, angleOff);
				(c as Text).position.set(props.x, props.y);
				(c as Text).scale.set(props.scale);
				c.visible = props.visible;
			});
			if (p >= 1) {
				anim.reel.removeChildren();
				anim.newSymbols.forEach((sym, i) => {
					const props = this.getSymbolProperties(i, 0);
					sym.position.set(props.x, props.y);
					sym.scale.set(props.scale);
					sym.visible = props.visible;
					anim.reel.addChild(sym);
				});
				anim.onComplete();
				done.push(anim);
			}
		}
		this.activeReelAnimations = this.activeReelAnimations.filter((a) => !done.includes(a));
	}

	private checkOutcome(): void {
		const results = this.reels.map((r) => (r.getChildAt(1) as Text).text);
		if (results.every((s) => s === results[0])) {
			const win = this.costPerSpin * this.winMultiplier;
			this.money += win;
			this.resultText.text = `You Win $${win}!`;
			this.resultText.style.fill = "#0f0";
		} else {
			this.resultText.text = "Try Again";
			this.resultText.style.fill = "#f00";
		}
		this.moneyText.text = `$${this.money}`;
		setTimeout(() => (this.resultText.text = ""), 2000);
	}
}
