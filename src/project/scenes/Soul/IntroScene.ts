import { BlurFilter, Container, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Easing, Tween } from "tweedle.js";
import {
	Manager,
	// pixiRenderer
} from "../../..";
import { MyFriendGameScene } from "./SoulGameScene";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { filters } from "@pixi/sound";

export class IntroScene extends PixiScene {
	public static readonly BUNDLES = ["myfriend", "abandonedhouse"];
	private worldContainer: Container = new Container();
	private handPointer: Sprite;

	constructor() {
		super();

		SoundLib.playMusic("introSoul", {
			loop: false,
			speed: 1.4,
			filters: [new filters.ReverbFilter(5, 2), new filters.TelephoneFilter()],
			volume: 0.1,
		});

		// test de voz de telefono
		// SoundLib.playSound("hello", { filters: [new filters.TelephoneFilter()] });

		this.addChild(this.worldContainer);
		const backlayer = Sprite.from("backlayer");
		backlayer.anchor.set(0.5);
		const charlayer = Sprite.from("charlayer");
		charlayer.anchor.set(0.5);
		const doglayer = Sprite.from("doglayer");
		doglayer.anchor.set(0.5);
		doglayer.alpha = 0;

		const soulTitle = new Text("Soul", { fontFamily: "Spirituality", fontSize: 200, lineHeight: 300, fontWeight: "bold", fill: 0xffffff });
		soulTitle.anchor.set(0.5);
		soulTitle.y = -450;
		soulTitle.alpha = 0;
		// 1) Creamos y guardamos la referencia al BlurFilter
		const blurFilter = new BlurFilter(50);
		doglayer.filters = [blurFilter];

		const start = Sprite.from("start");
		start.anchor.set(0.5);
		start.y = 600;
		start.alpha = 0;
		start.eventMode = "none";
		start.on("pointertap", () => {
			Manager.changeScene(MyFriendGameScene);
		});

		// 2) Tween de charlayer
		new Tween(charlayer)
			.from({ y: 700 })
			.to({ y: 0 }, 15000)
			.start()
			.easing(Easing.Cubic.Out)
			.onComplete(() => {
				new Tween(doglayer).to({ alpha: 1 }, 4000).easing(Easing.Exponential.Out).start();
				new Tween(blurFilter)
					.to({ blur: 0 }, 4000)
					.easing(Easing.Exponential.Out)
					.start()
					.onComplete(() => {
						new Tween(soulTitle).to({ alpha: 1 }, 1500).start();
						new Tween(start)
							.to({ alpha: 1 }, 5500)
							.start()
							.onComplete(() => {
								start.cursor = "pointer";
								start.eventMode = "static";
								new Tween(start).to({ alpha: 0.5 }, 1000).repeat(Infinity).yoyo(true).start();
							});
					});
			});

		// ------------- Agregar el sprite de “handPointer” -------------
		this.handPointer = Sprite.from("handPointer");
		this.handPointer.scale.set(0.2);
		this.handPointer.anchor.set(1, 0.11);
		this.handPointer.interactive = false; // ¡Muy importante! Desactiva la interactividad.
		this.handPointer.eventMode = "none"; // Asegura que no capture ningún evento.
		// this.addChild(this.handPointer); // Lo ponemos encima de todos

		this.worldContainer.addChild(backlayer, charlayer, doglayer, soulTitle, start);
	}

	public override update(_dt: number): void {
		// // a) Ocultamos el cursor del sistema
		// pixiRenderer.pixiRenderer.view.style.cursor = "none";
		// // b) Obtenemos la posición global del puntero desde renderer.events.pointer.global
		// const globalPos = pixiRenderer.pixiRenderer.events.pointer.global;
		// this.handPointer.visible = true;
		// this.handPointer.position.set(globalPos.x, globalPos.y);
	}

	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 1024, 1536, ScaleHelper.forceHeight);
		this.worldContainer.x = w * 0.5;
		this.worldContainer.y = h * 0.5;
	}
}
