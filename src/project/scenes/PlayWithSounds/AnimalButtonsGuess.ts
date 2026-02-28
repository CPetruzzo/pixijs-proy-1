import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Easing, Tween } from "tweedle.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class AnimalButtonsGuess extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];

	private gallo: Sprite;
	private pig: Sprite;
	private cow: Sprite;
	private horse: Sprite;
	private sheep: Sprite;
	private duck: Sprite;
	private cont: Container;

	constructor() {
		super();

		this.cont = new Container();

		this.gallo = Sprite.from("farmAnimals1");
		this.gallo.anchor.set(0.5);
		this.gallo.position.x = 0;
		this.gallo.scale.set(0.7);

		this.pig = Sprite.from("farmAnimals3");
		this.pig.anchor.set(0.5);
		this.pig.position.x = 300;
		this.pig.scale.set(0.7);

		this.cow = Sprite.from("farmAnimals0");
		this.cow.anchor.set(0.5);
		this.cow.position.x = 600;
		this.cow.scale.set(0.7);

		this.horse = Sprite.from("farmAnimals5");
		this.horse.anchor.set(0.5);
		this.horse.position.x = 900;
		this.horse.scale.set(0.7);

		this.sheep = Sprite.from("farmAnimals4");
		this.sheep.anchor.set(0.5);
		this.sheep.position.x = 1200;
		this.sheep.scale.set(0.7);

		this.duck = Sprite.from("farmAnimals6");
		this.duck.anchor.set(0.5);
		this.duck.position.x = 1500;
		this.duck.scale.set(0.7);

		this.cont.addChild(this.gallo, this.pig, this.cow, this.horse, this.sheep, this.duck);

		this.cont.pivot.set(this.cont.width / 2, this.cont.height / 2);

		this.addChild(this.cont);

		this.gallo.interactive = true;
		this.pig.interactive = true;
		this.sheep.interactive = true;
		this.horse.interactive = true;
		this.duck.interactive = true;
		this.cow.interactive = true;

		console.log("this.gallo.position.x", this.gallo.position.x);
		new Tween(this.gallo).from({ y: 1000, alpha: 0 }).to({ y: 0, alpha: 1 }, 1100).start().easing(Easing.Circular.Out);
		new Tween(this.pig).from({ y: 1000, alpha: 0 }).to({ y: 0, alpha: 1 }, 1200).start().easing(Easing.Circular.Out);
		new Tween(this.cow).from({ y: 1000, alpha: 0 }).to({ y: 0, alpha: 1 }, 1500).start().easing(Easing.Circular.Out);
		new Tween(this.horse).from({ y: 1000, alpha: 0 }).to({ y: 0, alpha: 1 }, 1900).start().easing(Easing.Circular.Out);
		new Tween(this.sheep).from({ y: 1000, alpha: 0 }).to({ y: 0, alpha: 1 }, 2400).start().easing(Easing.Circular.Out);
		new Tween(this.duck).from({ y: 1000, alpha: 0 }).to({ y: 0, alpha: 1 }, 2900).start().easing(Easing.Circular.Out);

		// ROOSTER
		this.gallo.on(
			"pointerdown",
			() => {
				new Tween(this.gallo)
					.to({ x: this.gallo.position.x, y: this.gallo.position.y, scale: { x: 1, y: 1 } }, 500)
					.yoyo()
					.repeat(1)
					.start();
				this.emit("CLICKED_ANIMAL" as any, "rooster");
			},
			this
		);
		this.gallo.on(
			"pointerout",
			() => {
				new Tween(this.gallo).to({ x: this.gallo.position.x, y: this.gallo.position.y, scale: { x: 0.7, y: 0.7 } }, 500).start();
			},
			this
		);

		// SHEEP
		this.sheep.on(
			"pointerdown",
			() => {
				new Tween(this.sheep)
					.to({ x: this.sheep.position.x, y: this.sheep.position.y, scale: { x: 1, y: 1 } }, 500)
					.yoyo()
					.repeat(1)
					.start();
				this.emit("CLICKED_ANIMAL" as any, "chooserSheep");
			},
			this
		);
		this.sheep.on(
			"pointerout",
			() => {
				new Tween(this.sheep).to({ x: this.sheep.position.x, y: this.sheep.position.y, scale: { x: 0.7, y: 0.7 } }, 500).start();
			},
			this
		);

		// HORSE
		this.horse.on(
			"pointerdown",
			() => {
				new Tween(this.horse)
					.to({ x: this.horse.position.x, y: this.horse.position.y, scale: { x: 1, y: 1 } }, 500)
					.yoyo()
					.repeat(1)
					.start();
				this.emit("CLICKED_ANIMAL" as any, "horseCloud");
			},
			this
		);
		this.horse.on(
			"pointerout",
			() => {
				new Tween(this.horse).to({ x: this.horse.position.x, y: this.horse.position.y, scale: { x: 0.7, y: 0.7 } }, 500).start();
			},
			this
		);

		// DUCK
		this.duck.on(
			"pointerdown",
			() => {
				new Tween(this.duck)
					.to({ x: this.duck.position.x, y: this.duck.position.y, scale: { x: 1, y: 1 } }, 500)
					.yoyo()
					.repeat(1)
					.start();
				this.emit("CLICKED_ANIMAL" as any, "duckCloud");
			},
			this
		);
		this.duck.on(
			"pointerout",
			() => {
				new Tween(this.duck).to({ x: this.duck.position.x, y: this.duck.position.y, scale: { x: 0.7, y: 0.7 } }, 500).start();
			},
			this
		);

		// PIG
		this.pig.on(
			"pointerdown",
			() => {
				new Tween(this.pig)
					.to({ x: this.pig.position.x, y: this.pig.position.y, scale: { x: 1, y: 1 } }, 500)
					.yoyo()
					.repeat(1)
					.start();
				this.emit("CLICKED_ANIMAL" as any, "pig");
			},
			this
		);
		this.pig.on(
			"pointerout",
			() => {
				new Tween(this.pig).to({ x: this.pig.position.x, y: this.pig.position.y, scale: { x: 0.7, y: 0.7 } }, 500).start();
			},
			this
		);

		// COW
		this.cow.on(
			"pointerdown",
			() => {
				new Tween(this.cow)
					.to({ x: this.cow.position.x, y: this.cow.position.y, scale: { x: 1, y: 1 } }, 500)
					.yoyo()
					.repeat(1)
					.start();
				this.emit("CLICKED_ANIMAL" as any, "cowCloud");
			},
			this
		);
		this.cow.on(
			"pointerout",
			() => {
				new Tween(this.cow).to({ x: this.cow.position.x, y: this.cow.position.y, scale: { x: 0.7, y: 0.7 } }, 500).start();
			},
			this
		);
	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.cont, newW, newH, 1, 1, ScaleHelper.FIT);
	}

	public interactiveNo(): void {
		this.gallo.interactive = false;
		this.pig.interactive = false;
		this.sheep.interactive = false;
		this.horse.interactive = false;
		this.duck.interactive = false;
		this.cow.interactive = false;
	}

	public interactiveYes(): void {
		this.gallo.interactive = true;
		this.pig.interactive = true;
		this.sheep.interactive = true;
		this.horse.interactive = true;
		this.duck.interactive = true;
		this.cow.interactive = true;
	}
}
