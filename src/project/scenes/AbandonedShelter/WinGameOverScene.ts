import { Container, Sprite, Text, TextStyle, filters } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Timer } from "../../../engine/tweens/Timer";
import { Tween, Easing } from "tweedle.js";

export class WinGameOverScene extends PixiScene {
	private gameContainer: Container = new Container();
	private titleText!: Text;
	private firstBG!: Sprite;
	private secondBG!: Sprite;
	private thirdBG!: Sprite;

	public static readonly BUNDLES = ["abandonedhouse"];

	constructor() {
		super();

		this.gameContainer.name = "WinGameOverScene";
		this.addChild(this.gameContainer);

		// 1) Fondo inicial
		this.firstBG = Sprite.from("gameoversuccess1");
		this.firstBG.anchor.set(0.5);
		this.firstBG.alpha = 1;
		this.gameContainer.addChild(this.firstBG);

		// 2) Texto de felicitación
		this.titleText = new Text(
			"¡FELICIDADES!",
			new TextStyle({
				fontFamily: "Arial",
				fontSize: 64,
				fill: "#ffffff",
				stroke: "#000000",
				strokeThickness: 6,
				dropShadow: true,
				dropShadowColor: "#000000",
				dropShadowBlur: 4,
				dropShadowDistance: 3,
				align: "center",
			})
		);
		this.titleText.anchor.set(0.5);
		this.titleText.y = -(this.firstBG.height / 2) - 80;
		this.gameContainer.addChild(this.titleText);

		// 3) Segundo fondo (oculto por ahora)
		this.secondBG = Sprite.from("gameoversuccess2");
		this.secondBG.anchor.set(0.5);
		this.secondBG.alpha = 0;
		this.secondBG.scale.set(0.8);
		this.gameContainer.addChild(this.secondBG);

		// 4) Pulso suave del texto
		new Tween(this.titleText.scale).to({ x: 1.1, y: 1.1 }, 1000).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start();

		// 5) Timer para pasar al segundo fondo
		new Timer()
			.to(2000)
			.onComplete(() => this.switchToSecondBG())
			.start();
	}

	private switchToSecondBG(): void {
		new Tween<{ a1: number; a2: number }>({ a1: 1, a2: 0 })
			.to({ a1: 0, a2: 1 }, 500)
			.easing(Easing.Quadratic.InOut)
			.onUpdate((p) => {
				this.firstBG.alpha = p.a1;
				this.secondBG.alpha = p.a2;
			})
			.onComplete(() => {
				this.gameContainer.removeChild(this.firstBG);
				// Espera breve y lanza la transición al tercer fondo
				new Timer()
					.to(1500)
					.onComplete(() => {
						this.gameContainer.removeChild(this.secondBG);

						this.switchToThirdBG();
					})
					.start();
			})
			.start();
	}

	private switchToThirdBG(): void {
		// 1) Crea el tercer fondo ("goodending") y uno previo ("homeBG") de transición
		const homeBG = Sprite.from("homeBG");
		homeBG.anchor.set(0.5);
		homeBG.alpha = 1;
		this.gameContainer.addChildAt(homeBG, 0); // detrás del resto

		this.thirdBG = Sprite.from("goodending");
		this.thirdBG.anchor.set(0.5);
		this.thirdBG.alpha = 0;
		this.thirdBG.scale.set(1.2); // leve zoom out inicial
		this.gameContainer.addChild(this.thirdBG);

		// 2) Agrega blur inicial al thirdBG (efecto oasis)
		const blurFilter = new filters.BlurFilter(8);
		this.thirdBG.filters = [blurFilter];

		// 3) Transición tipo oasis: blur → fade-in → scale → flash
		new Tween<{ alpha: number; scale: number; blur: number }>({
			alpha: 0,
			scale: 1.2,
			blur: 8,
		})
			.to({ alpha: 1, scale: 1.0, blur: 0 }, 3000)
			.easing(Easing.Quadratic.Out)
			.onUpdate((v) => {
				this.thirdBG.alpha = v.alpha;
				this.thirdBG.scale.set(v.scale);
				blurFilter.blur = v.blur;
			})
			.onComplete(() => {
				// 4) Opcional: elimina homeBG o lo deja como fondo permanente
				this.gameContainer.removeChild(homeBG);
				this.thirdBG.filters = [];

				// 5) Texto tipo Star Wars que sube y desaparece
				const crawlText = new Text(
					"The Peace When You're Done\n\nInspirado en Supernatural\n\nDesarrollado por Cacho Games \n\n Historia por Facundo Wegher y Luciano Dri \n\n Gracias por jugar! ",
					new TextStyle({
						fontFamily: "Pixelate-Regular",
						fontSize: 60,
						fill: "#ffffff",
						align: "center",
						wordWrap: true,
						wordWrapWidth: 550,
					})
				);
				crawlText.anchor.set(0.5);
				crawlText.alpha = 0;
				crawlText.y = 0; // empieza por debajo
				this.gameContainer.addChild(crawlText);

				// Animación de entrada: fade in + movimiento hacia arriba + fade out
				new Tween(crawlText).to({ alpha: 1 }, 500).easing(Easing.Quadratic.InOut).start();
			})

			.start();
	}

	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.gameContainer.x = w / 2;
		this.gameContainer.y = h / 2;

		if (this.firstBG.texture.valid) {
			this.titleText.y = -(this.firstBG.height * (this.gameContainer.scale.x / this.firstBG.scale.x)) / 2 - 80;
		}
		if (this.secondBG.texture.valid) {
			this.secondBG.position.set(0, 0);
		}
		if (this.thirdBG?.texture?.valid) {
			this.thirdBG.position.set(0, 0);
		}
	}
}
