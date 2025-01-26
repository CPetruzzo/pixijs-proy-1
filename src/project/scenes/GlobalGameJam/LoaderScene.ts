import { Sprite, Container, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { BurbujeandoGameScene } from "./BurbujeandoGameScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager } from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Easing, Tween } from "tweedle.js";

export class BubbleLoaderScene extends PixiScene {
	public static readonly BUNDLES = ["bubble"];

	private backgroundContainer: Container;
	private bleedingBackgroundContainer: Container;
	private video: HTMLVideoElement;

	constructor() {
		super();

		SoundLib.playMusic("intro", { loop: false, singleInstance: true, volume: 0.15 });

		this.bleedingBackgroundContainer = new Container();
		this.backgroundContainer = new Container();

		this.addChild(this.bleedingBackgroundContainer);
		this.addChild(this.backgroundContainer);

		const bleedBG = Sprite.from("title");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		this.video = document.createElement("video");
		this.video.preload = "auto";
		this.video.src = "../../../../../preloader/bubblevideo.mp4";
		this.video.muted = true;

		this.video.addEventListener("canplaythrough", () => {
			this.video.play();
			const videoTexture = Texture.from(this.video);
			const videoSprite = new Sprite(videoTexture);
			videoSprite.anchor.set(0.5);
			videoSprite.scale.set(2.38);
			this.backgroundContainer.addChild(videoSprite);
		});

		const bubble = Sprite.from("bubble");
		bubble.anchor.set(0.5);
		bubble.scale.set(0.35);
		bubble.alpha = 0.8;
		bubble.position.set(290, 290);
		this.addChild(bubble);
		new Tween(bubble.position)
			.to({ y: bubble.position.y - 20 }, 1000)
			.start()
			.repeat(Infinity)
			.yoyo(true);
		new Tween(bubble).to({ alpha: 0.8 }, 8000).easing(Easing.Bounce.Out).start();

		const bubble1 = Sprite.from("bubble");
		bubble1.anchor.set(0.5);
		bubble1.scale.set(0.2);
		bubble1.alpha = 0.8;
		bubble1.position.set(150, 350);
		this.addChild(bubble1);
		new Tween(bubble1.position)
			.to({ y: bubble1.position.y - 15 }, 1200)
			.start()
			.repeat(Infinity)
			.yoyo(true);
		new Tween(bubble1).to({ alpha: 0.8 }, 8000).easing(Easing.Bounce.Out).start();

		const bubble2 = Sprite.from("bubble");
		bubble2.anchor.set(0.5);
		bubble2.position.set(90, 300);
		bubble2.alpha = 0.8;
		bubble2.scale.set(0.13);
		this.addChild(bubble2);
		new Tween(bubble2.position)
			.to({ y: bubble2.position.y - 25 }, 800)
			.start()
			.repeat(Infinity)
			.yoyo(true);
		new Tween(bubble2).to({ alpha: 0.8 }, 8000).easing(Easing.Bounce.Out).start();

		const bubble4 = Sprite.from("bubble");
		bubble4.anchor.set(0.5);
		bubble4.position.set(80, 350);
		bubble4.alpha = 0.8;
		bubble4.scale.set(0.1);
		this.addChild(bubble4);
		new Tween(bubble4.position)
			.to({ y: bubble4.position.y - 15 }, 800)
			.start()
			.repeat(Infinity)
			.yoyo(true);
		new Tween(bubble4).to({ alpha: 0.8 }, 8000).easing(Easing.Bounce.Out).start();

		this.video.addEventListener("ended", () => {
			SoundLib.stopAllMusic();
			Manager.changeScene(BurbujeandoGameScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
