import { Sprite, Container, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager } from "../../..";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { MenuScene } from "./MenuScene";

export class LoaderScene extends PixiScene {
	public static readonly BUNDLES = ["package-1", "sfx", "music", "fallrungame"];

	private backgroundContainer: Container;
	private bleedingBackgroundContainer: Container;
	private video: HTMLVideoElement;

	constructor() {
		super();

		this.bleedingBackgroundContainer = new Container();
		this.backgroundContainer = new Container();

		this.addChild(this.bleedingBackgroundContainer);
		this.addChild(this.backgroundContainer);

		// Agregar fondo que sangra
		const bleedBG = Sprite.from("DODGE-BACKGROUND2");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		const background = Sprite.from("DODGE-BACKGROUND");
		background.position.set(-background.width * 0.5, -background.height * 0.5);
		// this.backgroundContainer.addChild(background);

		// Crear el elemento de video
		this.video = document.createElement("video");
		this.video.preload = "auto";
		this.video.src = "../../../../../preloader/initialvideo.mp4"; // Asegúrate de que esta ruta sea correcta
		this.video.muted = true;

		// Esperar a que el video esté listo
		this.video.addEventListener("canplaythrough", () => {
			this.video.play();
			const videoTexture = Texture.from(this.video);
			const videoSprite = new Sprite(videoTexture);
			videoSprite.anchor.set(0.5);
			// videoSprite.anchor.set(0.5, 0.325);
			videoSprite.scale.set(1.9, 2.4); // Ajusta la escala según tus necesidades
			this.backgroundContainer.addChild(videoSprite);
		});

		// Cambiar de escena cuando el video termine
		this.video.addEventListener("ended", () => {
			Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
