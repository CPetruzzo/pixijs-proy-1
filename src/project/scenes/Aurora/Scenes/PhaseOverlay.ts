import { Text } from "pixi.js";
import { Graphics } from "pixi.js";
import { Container } from "pixi.js";
import type { TurnSide } from "../Managers/TurnManager";
import { Easing, Tween } from "tweedle.js";

export class PhaseOverlay extends Container {
	private phaseName: Text;
	private darkOverlayTop: Graphics;
	private darkOverlayBottom: Graphics;

	constructor(turn: TurnSide) {
		super();
		// Recuadros semitransparentes (tamaño fijo según tú):
		this.darkOverlayTop = new Graphics();
		this.darkOverlayTop.beginFill(0x000000, 0.5);
		this.darkOverlayTop.drawRect(0, 0, 800, 200);
		this.darkOverlayTop.endFill();
		this.addChild(this.darkOverlayTop);

		this.darkOverlayBottom = new Graphics();
		this.darkOverlayBottom.beginFill(0x000000, 0.5);
		this.darkOverlayBottom.drawRect(0, 315, 800, 200);
		this.darkOverlayBottom.endFill();
		this.addChild(this.darkOverlayBottom);

		// Texto de fase:
		this.phaseName = new Text(`Fase del ${turn}`, { fontSize: 50, fontFamily: "Pixelate-Regular" });
		this.phaseName.anchor.set(0.5);
		this.phaseName.y = 255;
		this.phaseName.alpha = 0;
		this.phaseName.x = 2000; // iniciar fuera a la derecha
		this.addChild(this.phaseName);
	}

	/**
	 * Llama a la animación de cambio de fase.
	 * @param onComplete Callback opcional que se invoca al terminar la animación de salida.
	 */
	public onChangePhase(onComplete?: () => void): void {
		this.animateChangePhase(onComplete);
	}

	/**
	 * Anima: entra desde x=2000 hasta x=380, espera un poco, sale a x=-1000.
	 * Cuando acaba la salida, invoca onComplete y quita este container de su padre.
	 */
	private animateChangePhase(onComplete?: () => void): void {
		// Posiciones fijas según tu UI:
		const enterXFrom = 900;
		const enterXTo = 380;
		const exitXTo = -100;
		const delayStay = 200; // ms de espera en el centro antes de salir
		console.log("delayStay", delayStay);

		// Entrada: desde enterXFrom → enterXTo
		// En PhaseOverlay.ts -> animateChangePhase
		const tweenIn = new Tween(this.phaseName).from({ x: enterXFrom }).to({ x: enterXTo, alpha: 1 }, 2000).easing(Easing.Quadratic.Out);

		const tweenOut = new Tween(this.phaseName)
			.to({ x: exitXTo, alpha: 0 }, 2000)
			.easing(Easing.Quadratic.In)
			.delay(200) // Reemplaza al setTimeout y espera 200ms antes de arrancar
			.onComplete(() => {
				onComplete?.();
				this.parent?.removeChild(this);
			});

		// Encadenar: cuando termine In, arranca Out
		tweenIn.chain(tweenOut).start();
	}
}
