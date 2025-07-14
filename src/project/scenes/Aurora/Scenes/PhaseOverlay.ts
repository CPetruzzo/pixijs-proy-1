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

		// Entrada: desde enterXFrom → enterXTo
		new Tween(this.phaseName)
			.from({ x: enterXFrom })
			.to({ x: enterXTo, alpha: 1 }, 2000)
			.start()
			.easing(Easing.Quadratic.Out)
			.onComplete(() => {
				// Después de entrar, esperar delayStay ms y luego salida
				setTimeout(() => {
					new Tween(this.phaseName)
						.from({ x: enterXTo })
						.easing(Easing.Quadratic.In)
						.to({ x: exitXTo, alpha: 0 }, 2000)
						.start()
						.onComplete(() => {
							// Al terminar salida:
							if (onComplete) {
								onComplete();
							}
							if (this.parent) {
								this.parent.removeChild(this);
							}
						});
				}, delayStay);
			});
	}
}
