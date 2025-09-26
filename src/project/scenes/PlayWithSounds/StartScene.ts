import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Text, TextStyle } from "@pixi/text";
import { Tween } from "tweedle.js";

import { Manager } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SimpleButton } from "../../../engine/button/SimpleButton";

import { AnimalSounds } from "./Scenes/AnimalSounds";
import { Chooser } from "./Scenes/Chooser";

// ==========================
// Constantes de estilo
// ==========================
const TITLE_STYLE = new TextStyle({
	align: "center",
	dropShadow: true,
	dropShadowAlpha: 0.3,
	dropShadowAngle: 7.1,
	dropShadowBlur: 4,
	dropShadowDistance: 6,
	fill: "#d6cdcd",
	fontFamily: "Courier New",
	fontSize: 65,
	fontStyle: "oblique",
	fontVariant: "small-caps",
	fontWeight: "bolder",
	lineHeight: 60,
	lineJoin: "round",
	padding: 5,
	stroke: "#582d2d",
	strokeThickness: 24,
	wordWrapWidth: 160,
});

export class StartScene extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];

	// ==========================
	// Propiedades privadas
	// ==========================
	private cont: Container;
	private bg: Sprite;
	private text: Text;
	private btnOpenPopup: SimpleButton;
	private animals: AnimalSounds;

	constructor() {
		super();

		// --------------------------
		// Sonido
		// --------------------------
		SoundLib.stopAllMusic();
		SoundLib.playMusic("farm-sfx", { loop: true });

		// --------------------------
		// Escenario y contenedor
		// --------------------------
		this.cont = new Container();
		this.cont.pivot.set(this.cont.width * 0.5, this.cont.height * 0.5);

		this.bg = Sprite.from("BG10");
		this.bg.anchor.set(0.5);
		this.cont.addChild(this.bg);

		// --------------------------
		// Texto título
		// --------------------------
		this.text = new Text("Who's that animal?", TITLE_STYLE);
		this.text.anchor.set(0.5);
		this.text.position.set(0, 100);

		this.cont.addChild(this.text);

		// --------------------------
		// Botón jugar
		// --------------------------
		this.btnOpenPopup = new SimpleButton("btnPlay", () => this.showGames());
		this.btnOpenPopup.position.set(0, 250);
		this.cont.addChild(this.btnOpenPopup);

		// --------------------------
		// Animales (fuera de contenedor central si hace falta)
		// --------------------------
		this.animals = new AnimalSounds();
		this.animals.position.set(-250, -50);

		// --------------------------
		// Agrego contenedor principal
		// --------------------------
		this.addChild(this.cont);

		// --------------------------
		// Animaciones
		// --------------------------
		new Tween(this.text).from({ angle: -3 }).to({ angle: 3 }, 500).yoyo().repeat(Infinity).start();

		new Tween(this.btnOpenPopup).from({ angle: -5 }).to({ angle: 5 }, 500).yoyo().repeat(Infinity).start();
	}

	// ==========================
	// Métodos privados
	// ==========================
	private showGames(): void {
		Manager.changeScene(Chooser);
	}

	// ==========================
	// Overrides
	// ==========================
	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToScreen(this.cont, newW, newH, 1, 1, ScaleHelper.FILL);
		this.cont.x = newW * 0.5;
		this.cont.y = newH * 0.5;
	}
}
