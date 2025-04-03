import { Container, Graphics, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// Importamos tweens de Tweedle.js
import { Tween, Easing } from "tweedle.js";

interface SpinAnimation {
	wheel: Container;
	elapsed: number;
	duration: number;
	onComplete: () => void;
}

export class RouletteScene extends PixiScene {
	private gameContainer: Container;
	private wheel: Container;
	private pointer: Graphics;
	private spinButton: Graphics;
	private isSpinning: boolean = false;
	public activeSpinAnimation: SpinAnimation | null = null;

	// UI
	private money: number = 1000;
	private costPerSpin: number = 50;
	private winMultiplier: number = 10;
	private moneyText: Text;
	private resultText: Text;

	// Parámetros de la ruleta
	private readonly wheelRadius: number = 200;
	private readonly segments: { number: number; color: number }[] = [];
	private readonly totalSegments: number = 12; // 12 segmentos
	private readonly twoPi: number = Math.PI * 2;
	// Almacenamos los Graphics de cada segmento para facilitar el resaltado
	private wedgeGraphics: Graphics[] = [];

	constructor() {
		super();
		this.gameContainer = new Container();
		this.addChild(this.gameContainer);

		this.createRouletteFrame();
		this.createWheel();
		this.createPointer();
		this.createSpinButton();
		this.createMoneyUI();
		this.createResultUI();

		// Centramos el contenedor principal
		this.gameContainer.pivot.set(this.gameContainer.width * 0.5, this.gameContainer.height * 0.5);
	}

	/**
	 * Crea un marco de fondo para la ruleta.
	 */
	private createRouletteFrame(): void {
		const frame = new Graphics();
		frame.beginFill(0x333333);
		frame.drawRoundedRect(0, 0, 600, 600, 20);
		frame.endFill();
		frame.alpha = 0.5;
		frame.x = 300;
		frame.y = 300;
		frame.pivot.set(frame.width * 0.5, frame.height * 0.5);
		this.gameContainer.addChildAt(frame, 0);
	}

	/**
	 * Crea la rueda de la ruleta con segmentos.
	 */
	private createWheel(): void {
		// Inicializa los segmentos: alterna colores (rojo y negro) y pinta el 0 de verde.
		for (let i = 0; i < this.totalSegments; i++) {
			let color = i % 2 === 0 ? 0xff0000 : 0x000000;
			if (i === 0) {
				color = 0x008000;
			}
			this.segments.push({ number: i, color: color });
		}

		this.wheel = new Container();
		this.wheel.x = 300;
		this.wheel.y = 300;
		this.gameContainer.addChild(this.wheel);

		const segmentAngle = this.twoPi / this.totalSegments;
		for (let i = 0; i < this.totalSegments; i++) {
			const seg = this.segments[i];
			const wedge = new Graphics();
			wedge.beginFill(seg.color);
			wedge.moveTo(0, 0);
			wedge.arc(0, 0, this.wheelRadius, i * segmentAngle, (i + 1) * segmentAngle, false);
			wedge.closePath();
			wedge.endFill();
			// Rota cada segmento para que el segmento 0 esté arriba.
			wedge.rotation = i * segmentAngle - Math.PI / 2;
			this.wheel.addChild(wedge);
			this.wedgeGraphics.push(wedge);

			// Calcula la posición del número en el sistema local del wedge.
			// Como el wedge ya está rotado, usamos un ángulo fijo:
			const angleForText = segmentAngle / 2 + Math.PI / 2;
			const textRadius = this.wheelRadius * 0.65;
			const numText = new Text(seg.number.toString(), { fontSize: 24, fill: 0xffffff });
			numText.anchor.set(0.5);
			numText.x = textRadius * Math.cos(angleForText);
			numText.y = textRadius * Math.sin(angleForText);
			// Si deseas que el texto se muestre derecho (sin la rotación del wedge)
			numText.rotation = -wedge.rotation;
			wedge.addChild(numText);
		}
	}

	/**
	 * Crea un puntero fijo que indica el segmento ganador.
	 */
	private createPointer(): void {
		this.pointer = new Graphics();
		this.pointer.beginFill(0xffff00);
		this.pointer.moveTo(0, 0);
		this.pointer.lineTo(-15, -30);
		this.pointer.lineTo(15, -30);
		this.pointer.lineTo(0, 0);
		this.pointer.endFill();
		// Posiciona el puntero en la parte superior de la rueda
		this.pointer.x = 300;
		this.pointer.y = 100;
		this.gameContainer.addChild(this.pointer);
	}

	/**
	 * Crea el botón para iniciar el spin.
	 */
	private createSpinButton(): void {
		this.spinButton = new Graphics();
		this.spinButton.beginFill(0xff0000);
		this.spinButton.drawRoundedRect(200, 520, 200, 50, 10);
		this.spinButton.endFill();
		this.spinButton.interactive = true;

		const buttonText = new Text("SPIN", { fontSize: 24, fill: "white" });
		buttonText.anchor.set(0.5);
		buttonText.x = 300;
		buttonText.y = 545;

		this.spinButton.addChild(buttonText);
		this.gameContainer.addChild(this.spinButton);

		this.spinButton.on("pointerdown", () => {
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
	 * Crea un placeholder para mostrar el resultado del spin.
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
		}, 3000);
	}

	/**
	 * Inicia el spin de la ruleta.
	 */
	private startSpin(): void {
		if (this.isSpinning) {
			return;
		}
		if (this.money < this.costPerSpin) {
			this.showResultMessage("Not enough money!", 0xff0000);
			return;
		}

		// Elimina cualquier resaltado previo
		const existingHighlight = this.gameContainer.getChildByName("highlight");
		if (existingHighlight) {
			this.gameContainer.removeChild(existingHighlight);
		}

		this.money -= this.costPerSpin;
		this.updateMoneyUI();
		this.isSpinning = true;

		// Calcula un giro aleatorio: varias vueltas completas + un extra aleatorio.
		const extraRotation = Math.random() * this.twoPi;
		const fullRotations = 5;
		const targetRotation = this.wheel.rotation + fullRotations * this.twoPi + extraRotation;

		new Tween(this.wheel)
			.to({ rotation: targetRotation }, 4000)
			.easing(Easing.Cubic.Out)
			.onComplete(() => {
				this.isSpinning = false;
				this.evaluateResult();
			})
			.start();
	}

	private evaluateResult(): void {
		// Normaliza la rotación a [0, 2π)
		const finalRotation = ((this.wheel.rotation % this.twoPi) + this.twoPi) % this.twoPi;
		// Sin offset adicional, ya que los wedges se dibujan con -Math.PI/2 para que 0 quede arriba.
		const pointerAngle = (this.twoPi - finalRotation) % this.twoPi;
		const segmentAngle = this.twoPi / this.totalSegments;
		const winningIndex = Math.floor(pointerAngle / segmentAngle);
		const winningSegment = this.segments[winningIndex];

		this.highlightWinningSegment(winningIndex);

		if (winningSegment.number === 0) {
			const winAmount = this.costPerSpin * this.winMultiplier;
			this.money += winAmount;
			this.showResultMessage(`WIN! Number: ${winningSegment.number} +$${winAmount}`, 0x00ff00);
		} else {
			this.showResultMessage(`LOSE! Number: ${winningSegment.number}`, 0xff0000);
		}
		this.updateMoneyUI();
	}

	/**
	 * Resalta visualmente el segmento ganador dibujando un borde sobre él.
	 */
	private highlightWinningSegment(index: number): void {
		const existingHighlight = this.gameContainer.getChildByName("highlight");
		if (existingHighlight) {
			this.gameContainer.removeChild(existingHighlight);
		}

		const segmentAngle = this.twoPi / this.totalSegments;
		const startAngle = index * segmentAngle;
		const endAngle = startAngle + segmentAngle;

		const highlight = new Graphics();
		highlight.name = "highlight";
		highlight.lineStyle(8, 0xffff00, 1);
		// Dibuja el arco justo en la periferia de la rueda
		highlight.arc(0, 0, this.wheelRadius, startAngle, endAngle);
		highlight.x = this.wheel.x;
		highlight.y = this.wheel.y;
		this.gameContainer.addChild(highlight);
	}

	public override update(_dt: number): void {
		// Tweedle.js actualiza los tweens internamente.
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 720, 720, ScaleHelper.FIT);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;
	}
}
