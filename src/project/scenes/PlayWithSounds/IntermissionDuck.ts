// import { Container } from "@pixi/display";
// import { Graphics } from "@pixi/graphics";
// import { Sprite } from "@pixi/sprite";
// // import { Easing, Tween } from "tweedle.js";
// // import { IScene } from "../../../engine/scenemanager/IScene";
// import { ITransition } from "../../../engine/scenemanager/ITransition";
// // import { SoundLib } from "../../../engine/sound/SoundLib";
// import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";


// export class IntermissionDuck extends PixiScene implements ITransition {
// 	private readonly color: number;
// 	// private readonly fadeInTime: number;
// 	// private readonly fadeOutTime: number;
// 	private readonly fade: Graphics;
// 	private intermissionContainer: Container;
// 	private duck: Sprite;

// 	public constructor(color: number = 0xffffff, fadeInTime: number = 1000, fadeOutTime: number = 100) {
// 		super();

// 		this.intermissionContainer = new Container();
// 		this.intermissionContainer.pivot.set(0.5);

// 		this.color = color;
// 		// this.fadeInTime = fadeInTime;
// 		// this.fadeOutTime = fadeOutTime;
// 		this.fade = new Graphics();
// 		this.fade.interactive = true;
// 		this.fade.alpha = 0;
// 		this.intermissionContainer.addChild(this.fade);

// 		this.duck = Sprite.from("duck");
// 		// this.duck.anchor.set(0.8);
// 		this.duck.position.set(this.intermissionContainer.width / 2, this.intermissionContainer.height / 2);
// 		this.intermissionContainer.addChild(this.duck);

// 		this.addChild(this.intermissionContainer);
// 	}

// 	// public startCovering(whenCovered: () => void): void {
// 	// 	SoundLib.playMusic("transitionDuck-sfx", { loop: false });
// 	// 	new Tween(this.duck)
// 	// 		.from({
// 	// 			x: this.intermissionContainer.width / 2,
// 	// 			y: this.intermissionContainer.height / 2,
// 	// 			alpha: 0,
// 	// 			scale: { x: 0, y: 0 },
// 	// 		})
// 	// 		.to({
// 	// 			x: this.intermissionContainer.width / 2 - 650,
// 	// 			y: this.intermissionContainer.height / 2 - 650,
// 	// 			alpha: 1,
// 	// 			scale: { x: 5, y: 5 }
// 	// 		},
// 	// 			this.fadeInTime / 2)
// 	// 		.start();
// 	// 	new Tween(this.fade)
// 	// 		.to({ alpha: 0 },
// 	// 			this.fadeInTime / 2)
// 	// 		.easing(Easing.Linear.None)
// 	// 		.onComplete(whenCovered)
// 	// 		.start();
// 	// }


// 	// public startResolving(whenResolved: (overrideScene?: new (...args: any[]) => IScene) => void): void {
// 	// 	whenResolved();
// 	// }

// 	// public startUncovering(whenUncovered: () => void): void {
// 	// 	// SoundLib.playMusic("transitionDuck-sfx", { loop: false });
// 	// 	// new Tween(this.duck).from({ alpha: 1, scale: { x: 2, y: 2 } }).to({ alpha: 0, scale: { x: 0, y: 0 } }, this.fadeOutTime).start();
// 	// 	new Tween(this.fade).to({ alpha: 0 }, this.fadeOutTime).easing(Easing.Linear.None).onComplete(whenUncovered).start();
// 	// }

// 	public override onResize(w: number, h: number): void {
// 		// this.position.set(w / 2, h / 2);
// 		this.fade.clear();
// 		this.fade.beginFill(this.color, 1);
// 		this.fade.drawRect(0, 0, w, h);
// 		this.fade.endFill();

// 		this.duck.width = w;
// 		this.duck.height = h;
// 	}

// }