/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle, Graphics } from "pixi.js";
import { Manager } from "../../..";
import { Tween, Easing } from "tweedle.js";
import { MaskScene } from "./MaskScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class MaskMenuScene extends PixiScene {
	// Definimos el bundle requerido
	public static readonly BUNDLES = ["ggj2026", "donotdelete"];

	private background: Sprite;
	private uiContainer: Container;

	constructor() {
		super();

		// 1. Fondo del menú
		this.background = Sprite.from("streetintro");
		this.background.anchor.set(0.5);
		this.background.x = Manager.width / 2;
		this.background.y = Manager.height / 2;

		// Ajustamos el fondo para que cubra la pantalla (Cover)
		const scale = Math.max(Manager.width / this.background.width, Manager.height / this.background.height);
		this.background.scale.set(scale);
		this.addChild(this.background);

		// 2. Contenedor para la UI
		this.uiContainer = new Container();
		this.addChild(this.uiContainer);

		this.createTitle();
		this.createStartButton();
	}

	private createTitle(): void {
		const titleStyle = new TextStyle({
			fontFamily: "Arial", // O la fuente que uses en tus bundles
			fontSize: 72,
			fontWeight: "bold",
			fill: ["#d35400", "#f39c12"], // Degradado naranja calabaza
			stroke: "#000000",
			strokeThickness: 6,
			dropShadow: true,
			dropShadowColor: "#000000",
			dropShadowBlur: 4,
			dropShadowDistance: 6,
		});

		const title = new Text("BOO-LOOP", titleStyle);
		title.anchor.set(0.5);
		title.x = Manager.width / 2;
		title.y = Manager.height / 3;

		// Animación suave de flotado para el título
		new Tween(title)
			.to({ y: title.y + 20 }, 2000)
			.easing(Easing.Quadratic.InOut)
			.repeat(Infinity)
			.yoyo(true)
			.start();

		this.uiContainer.addChild(title);
	}

	private createStartButton(): void {
		const btnWidth = 300;
		const btnHeight = 80;

		const button = new Container();
		button.x = Manager.width / 2;
		button.y = (Manager.height / 3) * 2;
		button.interactive = true;
		button.cursor = "pointer";

		// Cuerpo del botón
		const bg = new Graphics();
		bg.beginFill(0x2c3e50); // Color oscuro elegante
		bg.lineStyle(4, 0xd35400); // Borde naranja
		bg.drawRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 15);
		bg.endFill();

		// Texto del botón
		const txtStyle = new TextStyle({
			fill: "#ffffff",
			fontSize: 28,
			fontWeight: "bold",
		});
		const txt = new Text("COMENZAR NOCHE", txtStyle);
		txt.anchor.set(0.5);

		button.addChild(bg, txt);
		this.uiContainer.addChild(button);

		// --- EVENTOS INTERACTIVOS ---

		// Efecto Hover (escala)
		button.on("pointerover", () => {
			new Tween(button.scale).to({ x: 1.1, y: 1.1 }, 200).easing(Easing.Back.Out).start();
		});

		button.on("pointerout", () => {
			new Tween(button.scale).to({ x: 1, y: 1 }, 200).easing(Easing.Linear.None).start();
		});

		// Evento de Click
		button.on("pointertap", () => {
			SoundLib.playSound("achive", { volume: 0.2 });
			this.startGame();
		});
	}

	private startGame(): void {
		// Opcional: Podrías añadir un efecto de sonido aquí
		// Iniciamos la transición a la escena de juego
		Manager.changeScene(MaskScene, { transitionClass: FadeColorTransition });
	}

	public override update(_dt: number): void {
		// Cualquier lógica extra que necesites por frame
	}
}
