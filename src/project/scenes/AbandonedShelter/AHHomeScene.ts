import { ColorMatrixFilter, Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { CRTFilter } from "@pixi/filter-crt";
import { GlitchFilter } from "@pixi/filter-glitch";
import { Tween } from "tweedle.js";
import { Manager } from "../../..";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { SoundLib } from "../../../engine/sound/SoundLib";
import Random from "../../../engine/random/Random";
import { AbandonedShelterScene } from "./AbandonedShelterScene";
import { Keyboard } from "../../../engine/input/Keyboard";

export class AHHomeScene extends PixiScene {
	private backgroundContainer = new Container();
	private uiContainer = new Container();
	private background!: Sprite;
	private homeBGWindows!: Sprite;

	public static readonly BUNDLES = ["abandonedhouse"];

	private cm: ColorMatrixFilter;
	private crt: CRTFilter;
	private glitch!: GlitchFilter;

	// transición inicial
	private transitionTimer = 0;
	private readonly transitionDuration = 5000; // ms
	private readonly startVignette = 0.6;
	private readonly startLineWidth = 5;
	private readonly startLineContrast = 0.8;
	private glitchTriggered = false;
	private filtersRemoved = false;

	// en la clase AHHomeScene, junto a las propiedades:
	// private windowFlickerFilter = new ColorMatrixFilter();

	constructor() {
		super();

		SoundLib.playMusic("homeBGM", { volume: 0.1, loop: true });

		this.addChild(this.backgroundContainer);
		this.addChild(this.uiContainer);

		// fondo principal
		this.background = Sprite.from("homeBG");
		this.background.anchor.set(0.5);
		this.backgroundContainer.addChild(this.background);

		// filtros iniciales
		this.cm = new ColorMatrixFilter();
		this.cm.blackAndWhite(true);
		this.cm.polaroid(true);

		this.crt = new CRTFilter({
			lineWidth: this.startLineWidth,
			lineContrast: this.startLineContrast,
			vignetting: this.startVignette,
			vignettingAlpha: 1,
			seed: 0.5,
		});
		this.crt.time = 1;

		this.background.filters = [this.cm, this.crt];

		// título

		// ventana con flicker
		this.homeBGWindows = Sprite.from("homeBGWindows");
		this.homeBGWindows.anchor.set(0.5);
		this.backgroundContainer.addChild(this.homeBGWindows);
		this.startWindowFlicker();

		const title = Sprite.from("AH_title");
		title.alpha = 0;
		title.x = -400;
		title.y = -300;
		title.anchor.set(0.5);
		this.backgroundContainer.addChild(title);
		new Tween(title).delay(5000).to({ alpha: 1 }, 1500).start();

		// botón START
		const start = Sprite.from("AH_start");
		start.alpha = 0;
		start.scale.set(0.3);
		start.y = 300;
		start.anchor.set(0.5);
		this.background.addChild(start);

		// animación de aparición y pulso
		const startTime = 7500;
		const tweenTime = 1000;
		new Tween(start)
			.delay(startTime)
			.to({ alpha: 1 }, tweenTime)
			.onComplete(() => {
				new Tween(start).to({ alpha: 0.5 }, tweenTime).repeat(Infinity).yoyo(true).start();

				start.eventMode = "static";
				start.cursor = "pointer";
				start.on("pointertap", () => {
					SoundLib.stopMusic("homeBGM");
					Manager.changeScene(AbandonedShelterScene, { transitionClass: FadeColorTransition });
				});
			})
			.start();
	}

	/** Inicia el ciclo de flicker aleatorio */
	private startWindowFlicker(): void {
		this.scheduleWindowFlicker();
	}

	/** Parpadea con pausas aleatorias */
	private scheduleWindowFlicker(): void {
		// tiempo hasta próximo parpadeo (entre 0.2s y 1.5s)
		const delay = Random.shared.random(200, 1500);
		setTimeout(() => {
			// duración del apagón (entre 50ms y 250ms)
			const offDuration = Random.shared.random(50, 250);
			this.homeBGWindows.alpha = 0;
			setTimeout(() => {
				this.homeBGWindows.alpha = 1;
				// reinicia ciclo
				this.scheduleWindowFlicker();
			}, offDuration);
		}, delay);
	}

	public override update(dt: number): void {
		super.update(dt);

		// animación CRT
		this.crt.time += dt * 5;

		// transición de zoom + filtros
		if (this.transitionTimer < this.transitionDuration) {
			this.transitionTimer += dt;
			const t = Math.min(this.transitionTimer / this.transitionDuration, 1);

			// zoom
			const scale = 1 + 0.05 * t;
			this.background.scale.set(scale);
			this.homeBGWindows.scale.set(scale);

			// desvanecer filtros
			this.crt.vignetting = this.startVignette * (1 - t);
			this.crt.lineWidth = this.startLineWidth * (1 - t);
			this.crt.lineContrast = this.startLineContrast * (1 - t);

			// glitch justo antes de terminar
			if (!this.glitchTriggered && t > 0.95) {
				this.glitchTriggered = true;
				this.glitch = new GlitchFilter({ slices: 5, offset: 20 });
				this.background.filters = [this.glitch];
				this.homeBGWindows.filters = [this.glitch];
				setTimeout(() => {
					if (!this.filtersRemoved) {
						this.background.filters = [];
						this.homeBGWindows.filters = [];
						this.filtersRemoved = true;
					}
				}, 100);
			}
		}

		if (Keyboard.shared.justReleased("Enter")) {
			SoundLib.stopMusic("homeBGM");
			Manager.changeScene(AbandonedShelterScene, { transitionClass: FadeColorTransition });
		}
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.backgroundContainer.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, newW, newH, 1536, 1024, ScaleHelper.FILL);
		this.uiContainer.position.set(newW / 2, newH / 2);
	}
}
