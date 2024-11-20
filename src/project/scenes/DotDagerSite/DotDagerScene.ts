import { Container, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Tween } from "tweedle.js";
import { DagerButton } from "./DagerButton";

export class DotDagerScene extends PixiScene {
	public static readonly BUNDLES = ["dager"];
	private backgroundContainer: Container = new Container();
	private uiContainer: Container = new Container();

	constructor() {
		super();
		this.addChild(this.backgroundContainer, this.uiContainer);
		this.initializeScene();
		this.initializeUI();
	}

	public initializeScene(): void {
		// Crear un fondo
		const background = Sprite.from("dagerBG");
		this.backgroundContainer.addChild(background);
		// background.alpha = 0;

		// Agregar un texto interactivo
		const title = new Text("Dot Dager Landing Page", {
			fontSize: 48,
			fill: 0xffffff,
			align: "left",
			wordWrap: true,
			wordWrapWidth: 350,
		});
		title.anchor.set(0.5);
		title.x = 250;
		title.y = 250;
		this.backgroundContainer.addChild(title);

		// Agregar un texto interactivo
		const desc = new Text("Mi nombre es Mariano Villa pero si llegaste hasta acá seguro me conocés como el gran catador de conceptos filosóficos", {
			fontSize: 18,
			fill: 0xffffff,
			align: "left",
			wordWrap: true,
			wordWrapWidth: 340,
		});
		desc.anchor.set(0.5);
		desc.x = 255;
		desc.y = 390;
		this.backgroundContainer.addChild(desc);

		this.backgroundContainer.pivot.set(this.backgroundContainer.width * 0.5, this.backgroundContainer.height * 0.5);
	}

	private initializeUI(): void {
		const realButton = new DagerButton("Click Me", 150, 60, () => {
			alert("Button Clicked!");
			new Tween(realButton).to({ scale: 1.5 }, 500).start();
		});
		realButton.x = 180;
		realButton.y = 500;

		const realButton2 = new DagerButton("Click Me", 150, 60, () => {
			alert("Button Clicked!");
			new Tween(realButton2).to({ scale: 1.5 }, 500).start();
		});
		realButton2.x = 350;
		realButton2.y = 500;

		this.backgroundContainer.addChild(realButton, realButton2);

		const homeButton = new DagerButton("Inicio", 120, 40, () => {
			console.log("Inicio clickeado");
		});
		homeButton.y = 60;

		const projectsButton = new DagerButton("Proyectos", 120, 40, () => {
			console.log("Proyectos clickeado");
		});
		projectsButton.y = 60;

		const contactButton = new DagerButton("Contacto", 120, 40, () => {
			console.log("Contacto clickeado");
		});
		contactButton.y = 60;

		this.uiContainer.addChild(homeButton, projectsButton, contactButton);
	}
	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, _newW, _newH, 1920, 1080, ScaleHelper.FILL);
		this.backgroundContainer.x = _newW * 0.5;
		this.backgroundContainer.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, _newW * 0.3, _newH * 0.3, 1920, 1080, ScaleHelper.FIT);
		this.uiContainer.x = _newW;
	}
}
