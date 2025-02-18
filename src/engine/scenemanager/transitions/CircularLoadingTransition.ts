import { Easing, Tween } from "tweedle.js";
import { Graphics, Sprite, Texture } from "pixi.js"; // Asegúrate de tener Sprite y Texture
import { TransitionBase } from "./TransitionBase";
import { ScaleHelper } from "../../utils/ScaleHelper";
import type { ResolveOverride } from "../ITransition";
import { TweenUtils } from "../../tweens/tweenUtils";
import type { CircularGradientProgressOptions } from "../../progressbar/CircularGradientProgress";
import { CircularGradientProgress } from "../../progressbar/CircularGradientProgress";

export class CircularLoadingTransition extends TransitionBase {
	// Propiedades originales
	private readonly color: number = 0x000000; // color base en caso de usar fade
	private readonly fadeInTime: number = 500;
	private readonly fadeOutTime: number = 500;
	private readonly fade: Graphics;

	private readonly overallProgress: CircularGradientProgress;
	private readonly progressSettingsBase: CircularGradientProgressOptions;
	private readonly bundleProgressBars: Record<string, CircularGradientProgress> = {};

	// Nuevas propiedades para el fondo y el logo
	private readonly backgroundSprite: Sprite;
	private readonly logoSprite: Sprite;

	public constructor() {
		super();

		// 1. Crea el sprite de fondo y agrégalo primero para que quede detrás de todo.
		this.backgroundSprite = new Sprite(Texture.from("ruta/a/tu/imagen_fondo.jpg"));
		// Ajusta el anchor para centrarlo (así al escalar se mantiene centrado)
		this.backgroundSprite.anchor.set(0.5);
		this.addChild(this.backgroundSprite);

		// 2. (Opcional) Conserva el fade para efectos de transición. Se dibuja encima del fondo.
		this.fade = new Graphics();
		this.fade.interactive = true;
		this.fade.alpha = 0;
		this.addChild(this.fade);

		// 3. Crea el progress circulares (el indicador de carga)
		this.progressSettingsBase = {
			colors: 0xffffff,
			innerRadius: 300,
			outerRadius: 400,
			anchorX: 0.5,
			anchorY: 0.5,
			endCap: false,
			startCap: false,
			initialValue: 0,
		};

		this.overallProgress = new CircularGradientProgress(this.progressSettingsBase);
		this.overallProgress.alpha = 0;
		this.addChild(this.overallProgress);

		// 4. Crea el sprite del logo y agrégalo.
		this.logoSprite = new Sprite(Texture.from("../../../../preloader/cachogames.jpg"));
		this.logoSprite.anchor.set(0.5);
		this.addChild(this.logoSprite);

		console.log("¡Transition personalizada creada!");
		this.onResize(ScaleHelper.IDEAL_WIDTH, ScaleHelper.IDEAL_HEIGHT);
	}

	public override startCovering(): Promise<void> {
		const directingTween = new Tween(this.fade, this.tweens).to({ alpha: 1 }, this.fadeInTime).easing(Easing.Linear.None).start();

		new Tween(this.overallProgress, this.tweens).to({ alpha: 1 }, this.fadeInTime).delay(100).easing(Easing.Linear.None).start();

		return TweenUtils.promisify(directingTween).then();
	}

	public override startResolving(): Promise<ResolveOverride> {
		return Promise.resolve(undefined);
	}

	public override startUncovering(): Promise<void> {
		this.tweens.removeAll();

		new Tween(this.logoSprite, this.tweens)
			.to({ alpha: 0 }, this.fadeOutTime + 5500)
			.easing(Easing.Linear.None)
			.start();

		new Tween(this.overallProgress, this.tweens).to({ alpha: 0 }, this.fadeOutTime).easing(Easing.Elastic.Out).start();

		const directingTween = new Tween(this.fade, this.tweens).to({ alpha: 0 }, this.fadeOutTime).easing(Easing.Linear.None).start();

		return TweenUtils.promisify(directingTween).then();
	}

	public override onDownloadProgress(progress: number, bundlesProgress: Record<string, number>): void {
		// Actualiza el progreso general
		this.overallProgress.updateValue(progress, 300);

		// Si hay más de un bundle, muestra los indicadores secundarios.
		const keys = Object.keys(bundlesProgress).sort();
		if (keys.length === 1) {
			return;
		}

		for (let i = 0; i < keys.length; i++) {
			if (this.bundleProgressBars[keys[i]] === undefined) {
				const ciruclarSettings = { ...this.progressSettingsBase };
				ciruclarSettings.outerRadius = 290 - i * 30;
				ciruclarSettings.innerRadius = ciruclarSettings.outerRadius - 20;
				const bundleProgressBar = new CircularGradientProgress(ciruclarSettings);
				this.overallProgress.addChild(bundleProgressBar);
				this.bundleProgressBars[keys[i]] = bundleProgressBar;
			}
			this.bundleProgressBars[keys[i]].updateValue(bundlesProgress[keys[i]], 300);
		}
	}

	public override onResize(w: number, h: number): void {
		// Actualiza el sprite de fondo para que cubra toda la pantalla.
		this.backgroundSprite.x = w / 2;
		this.backgroundSprite.y = h / 2;
		const scale = Math.max(w / this.backgroundSprite.texture.width, h / this.backgroundSprite.texture.height);
		this.backgroundSprite.scale.set(scale);

		// Si sigues usando el fade, dibuja el rectángulo para cubrir toda la pantalla.
		this.fade.clear();
		this.fade.beginFill(this.color, 1);
		this.fade.drawRect(0, 0, w, h);
		this.fade.endFill();

		// Centra y escala el progress circular.
		ScaleHelper.setScaleRelativeToScreen(this.overallProgress, w, h, 0.5, 0.25);
		this.overallProgress.x = w / 2;
		this.overallProgress.y = h / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.logoSprite, w * 0.8, h * 0.8, 720, 1600, ScaleHelper.FIT);
		this.logoSprite.x = w / 2;
		this.logoSprite.y = h / 2;
		// Opcionalmente, ajusta la escala del logo si es necesario:
	}
}
