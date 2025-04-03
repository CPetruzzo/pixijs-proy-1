import { Container, Graphics, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// Importamos tweens de Tweedle.js
import { Tween, Easing } from "tweedle.js";

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
	private lever: Graphics;

	constructor() {
		super();
		// Creamos y agregamos el contenedor principal del juego.
		this.gameContainer = new Container();
		this.addChild(this.gameContainer);

		// Agregamos el placeholder gráfico para el marco de la tragamonedas.
		this.createSlotMachineFrame();

		this.createReels();
		this.createLever();
		this.createSpinButton();
		this.createMoneyUI();
		this.createResultUI();

		// Centramos el gameContainer.
		this.gameContainer.pivot.set(this.gameContainer.width * 0.5, this.gameContainer.height * 0.5);
	}

	/**
	 * Crea un placeholder gráfico para el marco de la tragamonedas.
	 */
	private createSlotMachineFrame(): void {
		const frame = new Graphics();
		frame.beginFill(0x333333);
		frame.drawRoundedRect(0, 0, 600, 500, 20);
		frame.endFill();
		frame.alpha = 0.5;
		frame.x = 300;
		frame.y = 250;
		frame.pivot.set(frame.width * 0.5, frame.height * 0.5);
		this.gameContainer.addChildAt(frame, 0);
	}

	private createReels(): void {
		for (let i = 0; i < 3; i++) {
			const reel = new Container();
			reel.x = i * 150;
			reel.y = 100;
			this.gameContainer.addChild(reel);
			this.reels.push(reel);
			this.populateReel(reel);
		}
	}

	/**
	 * Crea la palanca (lever) de la máquina tragamonedas.
	 * Se utiliza un Graphics para dibujar una palanca simple: una línea y una bola al final.
	 * Se configura el pivot en la parte superior para simular el punto de giro.
	 */
	private createLever(): void {
		this.lever = new Graphics();
		// Dibuja la "vara" de la palanca
		this.lever.lineStyle(4, 0xffffff);
		this.lever.moveTo(0, 0);
		this.lever.lineTo(0, 100);
		// Dibuja la bola al final
		this.lever.beginFill(0xff0000);
		this.lever.drawCircle(0, 100, 10);
		this.lever.endFill();

		// Se establece el pivot en la parte superior para rotar alrededor de este punto.
		this.lever.pivot.set(0, 0);
		// Posiciona la palanca en el contenedor (ajusta la posición según necesites)
		this.lever.x = 550;
		this.lever.y = 200;
		this.lever.rotation = -Math.PI;
		this.gameContainer.addChild(this.lever);
	}

	/**
	 * Anima la palanca usando Tweedle.js.
	 * Se rota la palanca desde su posición inicial (rotation = -Math.PI) hasta 0,
	 * y luego, mediante un tween encadenado, vuelve a rotation = -Math.PI de forma más rápida.
	 */
	private animateLever(): void {
		const tweenPull = new Tween(this.lever).to({ rotation: 0 }, 300).easing(Easing.Quadratic.Out);

		const tweenReturn = new Tween(this.lever).to({ rotation: -Math.PI }, 100).easing(Easing.Quadratic.In);

		// Encadena el tween de retorno al final del tween de tirón.
		tweenPull.chain(tweenReturn);
		tweenPull.start();
	}

	/**
	 * Calcula las propiedades de un símbolo según su índice y un offset angular.
	 */
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
		this.spinButton.drawRoundedRect(200, 400, 200, 50, 10);
		this.spinButton.endFill();
		this.spinButton.interactive = true;

		const buttonText = new Text("SPIN", { fontSize: 24, fill: "white" });
		buttonText.anchor.set(0.5);
		buttonText.x = 300;
		buttonText.y = 425;

		this.spinButton.addChild(buttonText);
		this.gameContainer.addChild(this.spinButton);

		// Al hacer clic, se anima la palanca y se inicia el spin.
		this.spinButton.on("pointerdown", () => {
			this.animateLever();
			this.startSpin();
		});
	}

	/**
	 * Crea la UI para mostrar el dinero actual.
	 */
	private createMoneyUI(): void {
		this.moneyText = new Text(`Money: $${this.money}`, { fontSize: 32, fill: "yellow" });
		this.moneyText.anchor.set(0, 0);
		this.moneyText.x = 20;
		this.moneyText.y = 20;
		this.gameContainer.addChild(this.moneyText);
	}

	/**
	 * Crea un placeholder para mostrar mensajes de resultado (ganar/perder).
	 */
	private createResultUI(): void {
		this.resultText = new Text("", { fontSize: 48, fill: "white" });
		this.resultText.anchor.set(0.5);
		this.resultText.x = 300;
		this.resultText.y = 480;
		this.gameContainer.addChild(this.resultText);
	}

	private updateMoneyUI(): void {
		this.moneyText.text = `Money: $${this.money}`;
	}

	private showResultMessage(message: string, color: number = 0xffffff): void {
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

	/**
	 * Inicia la animación de giro para un carrete, generando nuevos símbolos y asignando la animación.
	 */
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

	/**
	 * En cada frame actualizamos la animación de giro de cada carrete y actualizamos Tweedle.js.
	 */
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

	/**
	 * Aplica un efecto de deformación adicional a cada símbolo (para suavizar el efecto en los extremos).
	 */
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

	/**
	 * Revisa el resultado del spin comparando el símbolo central (índice 1) de cada carrete.
	 * Si son iguales, el jugador gana; si no, pierde.
	 */
	private checkOutcome(): void {
		const results = this.reels.map((reel) => {
			const symbol = reel.getChildAt(1) as Text;
			return symbol.text;
		});

		if (results.every((result) => result === results[0])) {
			const winAmount = this.costPerSpin * this.winMultiplier;
			this.money += winAmount;
			this.showResultMessage(`Win $${winAmount}!`, 0x00ff00);
		} else {
			this.showResultMessage("Try Again", 0xff0000);
		}
		this.updateMoneyUI();
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 720, 720, ScaleHelper.FIT);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;
	}
}
