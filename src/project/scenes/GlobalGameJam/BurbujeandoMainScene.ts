import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
//  import { SoundLib } from "../../../engine/sound/SoundLib";
import { Manager } from "../../..";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { Easing, Tween } from "tweedle.js";
import { BubbleLoaderScene } from "./LoaderScene";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class BurbujeandoMainScene extends PixiScene {
	public static readonly BUNDLES = ["bubble", "sfx", "music"];
	private backgroundContainer: Container = new Container();
	private video: HTMLVideoElement;
	constructor() {
		super();

		this.addChild(this.backgroundContainer);

		SoundLib.playMusic("pinkocean", { loop: true, volume: 0.2 });

		const bG = Sprite.from("title");
		bG.anchor.set(0.5);
		bG.scale.set(1.2);
		bG.x = 1170;
		bG.y = 590;
		this.backgroundContainer.addChild(bG);

		const play = Sprite.from("play");
		play.anchor.set(0.5);
		play.scale.set(1.2);
		play.x = 1160;
		play.y = 937;
		this.backgroundContainer.addChild(play);

		this.video = document.createElement("video");
		this.video.preload = "auto";
		this.video.src = "../../../../../preloader/bubblevideo.mp4";
		this.video.muted = true;

		play.eventMode = "static";
		play.on("pointerover", () => {
			new Tween(play)
				.to({ scale: { x: 1.3, y: 1.3 } }, 500)
				.easing(Easing.Bounce.Out)
				.start();
			SoundLib.playSound("sfxBubble", { volume: 0.2 });
		});
		play.on("pointerout", () => {
			new Tween(play)
				.to({ scale: { x: 1.2, y: 1.2 } }, 500)
				.easing(Easing.Bounce.Out)
				.start();
		});
		play.on("pointertap", () => {
			new Tween(play)
				.to({ scale: { x: 1.3, y: 1.3 } }, 500)
				.easing(Easing.Bounce.Out)
				.start();
			SoundLib.playSound("sfxBubble", { volume: 0.2 });
			SoundLib.stopAllMusic();
			Manager.changeScene(BubbleLoaderScene, { transitionClass: FadeColorTransition });
		});

		this.backgroundContainer.pivot.set(this.backgroundContainer.width * 0.5, this.backgroundContainer.height * 0.5);
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, _newW, _newH, 2090, 1080, ScaleHelper.FILL);
		this.backgroundContainer.x = _newW * 0.5;
		this.backgroundContainer.y = _newH * 0.5;
	}
}
