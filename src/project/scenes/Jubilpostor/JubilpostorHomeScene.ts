/* eslint-disable prettier/prettier */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Graphics, Text, TextStyle } from "pixi.js";
import { Flag } from "./Flag";
import { JubilpostorGameScene } from "./JubilpostorGameScene";
import { Manager } from "../../..";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class JubilpostorHomeScene extends PixiScene {
	public static readonly BUNDLES = ["img", "jubilpostor"];

	private uiContainer: Container;
	private winSprite: Sprite;
	private restartButton: Graphics;
	private rulesButton: Graphics;
	private rulesOverlay: Container;
	private descText: Text;

	constructor() {
		super();
		this.name = "JubilpostorHomeScene";

		this.uiContainer = new Container();
		this.addChild(this.uiContainer);

		this.rulesOverlay = new Container();
		this.addChild(this.rulesOverlay);

		new Flag(this.uiContainer, 0, 0, "flag", 0.2, 1.1);
		SoundLib.playMusic("intro", { volume: 0.5, loop: true });

		this.winSprite = Sprite.from("win");
		this.winSprite.anchor.set(0.5);
		this.winSprite.scale.set(0.5);
		this.winSprite.x = -250;
		this.uiContainer.addChild(this.winSprite);

		this.restartButton = new Graphics();
		this.restartButton.beginFill(0x333333);
		this.restartButton.drawRoundedRect(-100, -25, 200, 50, 10);
		this.restartButton.endFill();
		this.restartButton.x = 250;
		this.restartButton.y = 0;
		this.restartButton.interactive = true;
		this.uiContainer.addChild(this.restartButton);

		const buttonStyle = new TextStyle({
			fontFamily: "DK Boarding House III",
			fontSize: 20,
			fill: 0xffffff,
		});
		const buttonText = new Text("¡Vamos a marchar!", buttonStyle);
		buttonText.anchor.set(0.5);
		buttonText.position.set(0, 0);
		this.restartButton.addChild(buttonText);

		this.restartButton.on("pointertap", () => {
			Manager.changeScene(JubilpostorGameScene, { transitionClass: FadeColorTransition });
		});

		// Botón de reglas del juego
		this.rulesButton = new Graphics();
		this.rulesButton.beginFill(0x555555);
		this.rulesButton.drawRoundedRect(-100, -25, 200, 50, 10);
		this.rulesButton.endFill();
		this.rulesButton.x = 250;
		this.rulesButton.y = 70;
		this.rulesButton.interactive = true;
		this.uiContainer.addChild(this.rulesButton);

		const rulesText = new Text("Reglas del juego", buttonStyle);
		rulesText.anchor.set(0.5);
		rulesText.position.set(0, 0);
		this.rulesButton.addChild(rulesText);

		this.rulesButton.on("pointertap", () => {
			this.showRulesOverlay();
		});

		const descStyle = new TextStyle({
			fontFamily: "DK Boarding House III",
			fontSize: 25,
			fill: 0x000000,
			lineHeight: 30,
			wordWrap: true,
			wordWrapWidth: 450,
			align: "center",
		});
		this.descText = new Text("Porque el que no apoya a un jubilado, no se quiere ni a sí mismo", descStyle);
		this.descText.anchor.set(0.5);
		this.descText.position.set(0, 135);
		this.uiContainer.addChild(this.descText);
	}

	private showRulesOverlay(): void {
		const overlayBg = new Graphics();
		overlayBg.beginFill(0x000000, 0.8);
		overlayBg.drawRect(-250, -350, 500, 600);
		overlayBg.endFill();
		overlayBg.interactive = true;
		this.rulesOverlay.addChild(overlayBg);

		const overlayTextStyle = new TextStyle({
			fontFamily: "DK Boarding House III",
			fontSize: 18,
			lineHeight: 28,
			fill: 0xffffff,
			wordWrap: true,
			wordWrapWidth: 460,
		});
		const overlayText = new Text(
			"Reglas del juego:\n" +
			"- Hay infiltrados en la marcha. Si no los identificas, desacreditan la protesta con entrevistas falsas.\n" +
			"- Tensión social sube si los infiltrados están cerca de jubilados. Si es muy alta, la policía intervendrá.\n" +
			"- Caos mediático aumenta con las intervenciones, atrayendo más reporteros.\n" +
			"- Si los reporteros entrevistan infiltrados, la desacreditación sube.\n" +
			"- Sobrevive desde las 17 hasta las 21 sin ser desacreditado para ganar.\n" +
			"- Los textos de los infiltrados se mostrarán en rojo, y ellos/as también estarán tintados de rojo.\n" +
			"- Deberás hacer clic sobre ellos para marcarlos y luego sacarlos de la marcha.\n" +
			"- Si se quedan demasiado tiempo, habrá demasiados medios cubriendo la marcha, lo que puede ser un arma de doble filo, ya que entrevistarlos llevará a una desacreditación mayor.",
			overlayTextStyle
		);
		overlayText.anchor.set(0.5);
		overlayText.position.set(0, -50);
		this.rulesOverlay.addChild(overlayText);

		const closeButton = new Graphics();
		closeButton.beginFill(0xff0000);
		closeButton.drawRoundedRect(-50, -20, 100, 40, 10);
		closeButton.endFill();
		closeButton.y = 250;
		closeButton.interactive = true;
		this.rulesOverlay.addChild(closeButton);

		const closeText = new Text("Cerrar", overlayTextStyle);
		closeText.anchor.set(0.5);
		closeText.position.set(0, 0);
		closeButton.addChild(closeText);

		closeButton.on("pointertap", () => {
			this.rulesOverlay.removeChildren()
		});
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, newW, newH, 1000, 800, ScaleHelper.FIT);
		this.uiContainer.x = newW / 2;
		this.uiContainer.y = newH / 2;

		if (this.rulesOverlay) {
			ScaleHelper.setScaleRelativeToIdeal(this.rulesOverlay, newW, newH, 1000, 800, ScaleHelper.FIT);
			this.rulesOverlay.x = newW / 2;
			this.rulesOverlay.y = newH / 2;
		}
	}
}
