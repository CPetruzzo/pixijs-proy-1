
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Text, TextStyle } from "@pixi/text";
import { Tween } from "tweedle.js";
import { Manager } from "../../../..";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { AnimalSounds } from "./AnimalSounds";
import { GuessShapes } from "./GuessShapes";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ToggleCheck } from "../../RunFall/Utils/toggle/ToggleCheck";
import { ToggleButton } from "../../BasquetballGame/Utils/ToggleButton";
import { Button } from "@pixi/ui";
import { SimpleButton } from "../../../../engine/button/SimpleButton";

export class Chooser extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];

	private cont: Container;
	private bg: Sprite;
	private sounds: Text;
	private guess: Text;
	private frame1: Sprite;
	private frame2: Sprite;
	private sheep: Sprite;
	private birds: Sprite;

	private soundContainer: Container;
	private guessContainer: Container;
	private mute: ToggleCheck;

	public toggled: boolean = true;
	muted: ToggleButton;
	soundPlus: Button;
	soundMinus: SimpleButton;

	constructor() {
		super();

		SoundLib.stopMusic("farm-sfx");
		SoundLib.playMusic("chooserMusic", { loop: true, volume: 0.5 });

		this.cont = new Container();

		this.soundContainer = new Container();
		this.soundContainer.position.set(500, 550);
		this.soundContainer.pivot.set(this.soundContainer.width / 2, this.soundContainer.height / 2);

		// const auxZero = new Graphics();
		// auxZero.beginFill(0xFF00FF);
		// auxZero.drawCircle(0, 0, 100);
		// auxZero.endFill();

		this.guessContainer = new Container();
		this.guessContainer.position.set(1400, 550);
		this.guessContainer.pivot.set(0.5);

		// const auxZero2 = new Graphics();
		// auxZero2.beginFill(0xFF00FF);
		// auxZero2.drawCircle(0, 0, 100);
		// auxZero2.endFill();

		// const auxZero3 = new Graphics();
		// auxZero3.beginFill(0xFF00FF);
		// auxZero3.drawCircle(this.cont.x, this.cont.y, 100);
		// auxZero3.endFill();

		const style = new TextStyle({
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
			wordWrapWidth: 160
		});

		this.sounds = new Text('Play with sounds', style);
		this.sounds.position.set(10, 250);
		this.sounds.anchor.set(0.5);

		this.soundContainer.interactive = true;
		this.soundContainer.on("pointerover",
			() => {
				SoundLib.playMusic("birds-sfx", { volume: 2, loop: false });
				this.soundContainer.scale.set(1.2);
			},
			this
		);
		this.soundContainer.on("pointerdown",
			() => {
				SoundLib.playMusic("birds-sfx", { volume: 2, loop: false });
				this.soundContainer.scale.set(1.2);
			},
			this
		);
		this.soundContainer.on("pointerout",
			() => {
				this.soundContainer.scale.set(1);
			},
			this
		);
		this.soundContainer.on("pointerup",
			() => {
				Manager.changeScene(AnimalSounds
					// , [], IntermissionDuck
				);

				SoundLib.playMusic("transitionDuck-sfx", { loop: false });
			},
			this
		);

		this.guess = new Text('Guess the shape', style);
		this.guess.position.set(10, 250);
		this.guess.anchor.set(0.5);

		this.guessContainer.interactive = true;
		this.guessContainer.on("pointerover",
			() => {
				SoundLib.playMusic("windTransition-sfx", { volume: 2, loop: false });
				this.guessContainer.scale.set(1.2);
			},
			this
		);
		this.guessContainer.on("pointerdown",
			() => {
				SoundLib.playMusic("windTransition-sfx", { volume: 2, loop: false });
				this.guessContainer.scale.set(1.2);
			},
			this
		);
		this.guessContainer.on("pointerout",
			() => {
				this.guessContainer.scale.set(1);
			},
			this
		);
		this.guessContainer.on("pointerup",
			() => {
				Manager.changeScene(GuessShapes
					// , [], IntermissionDuck
				);

				SoundLib.playMusic("transitionDuck-sfx", { loop: false });
			},
			this
		);

		this.frame1 = Sprite.from("frame1");
		this.frame1.scale.set(0.6);
		this.frame1.position.set(this.sounds.position.x - this.frame1.width / 2, this.sounds.position.y - this.frame1.height);
		this.frame1.alpha = 0.8;

		this.frame2 = Sprite.from("frame1");
		this.frame2.scale.set(0.6);
		this.frame2.position.set(this.guess.position.x - this.frame2.width / 2, this.guess.position.y - this.frame2.height)
		this.frame2.alpha = 0.8;

		this.sheep = Sprite.from("chooserSheep");
		this.sheep.scale.set(0.6);
		this.sheep.anchor.set(0.5)
		this.sheep.position.set(this.guess.position.x, this.guess.position.y - this.sheep.height / 1.5);

		this.birds = Sprite.from("chooserBirds");
		this.birds.scale.set(0.6);
		this.birds.anchor.set(0.5)
		this.birds.position.set(this.sounds.position.x, this.sounds.position.y - this.birds.height / 1.5);

		this.bg = Sprite.from("BG0");
		this.bg.scale.set(1, 1.46)

		this.soundContainer.addChild(
			this.frame1,
			this.sounds,
			this.birds,
			// auxZero
		)

		this.guessContainer.addChild(
			this.frame2,
			this.guess,
			this.sheep,
			// auxZero2
		)

		this.cont.addChild(
			this.bg,
			this.soundContainer,
			this.guessContainer,
			// auxZero3
		);
		this.cont.pivot.set(this.cont.width / 2, this.cont.height / 2);

		this.addChild(this.cont);

		new Tween(this.soundContainer)
			.from({ angle: -1 })
			.to({ angle: 1 }, 1000)
			.yoyo()
			.repeat(Infinity)
			.start();

		new Tween(this.guessContainer)
			.from({ angle: -1 })
			.to({ angle: 1 }, 1000)
			.yoyo()
			.repeat(Infinity)
			.start();

		this.mute = new ToggleCheck({
			buttonTexture: "b_4",
			checkTexture: "b_5",
			onToggleOn: () => {
				// SoundLib.pauseMusic
				SoundLib.muteMusic = true;
				SoundLib.muteSound = false;
			},
			onToggleOff: () => {
				// SoundLib.resumeMusic
				SoundLib.muteMusic = false;

				SoundLib.muteSound = false;
			},
			startingValue: false
		});
		this.mute.position.set(this.cont.width / 2 - 100, 10)
		this.mute.scale.set(0.4)

		// this.soundPlus = new SimpleButton(
		// 	"ui-placeholder-demo/button_plus.png", () => {
		// 		sound.volumeAll += 0.05;
		// 	}
		// )
		// this.soundPlus.scale.set(0.2);
		// this.soundPlus.position.set(this.mute.position.x + 350, this.mute.position.y + 65)

		// this.soundMinus = new SimpleButton(
		// 	"ui-placeholder-demo/button_minus.png", () => {
		// 		sound.volumeAll -= 0.05;
		// 	}
		// )
		// this.soundMinus.scale.set(0.2);
		// this.soundMinus.position.set(this.mute.position.x - 100, this.mute.position.y + 65)

		this.cont.addChild(
			this.mute,
			// this.soundPlus,
			// this.soundMinus
		)

	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.cont, newW, newH, 1, 1, ScaleHelper.FIT);
	}

	// private openPopup(): void {
	// 	SoundLib.pauseMusic("farm-sfx");
	// 	Manager.openPopup(PopUpSettings);
	// }
}