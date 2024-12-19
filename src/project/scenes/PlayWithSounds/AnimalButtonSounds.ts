
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Easing, Tween } from "tweedle.js";
// import { DataManager } from "../../../engine/datamanager/DataManager";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { HudSounds } from "./HudSounds";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class AnimalButtonSounds extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];
	public static readonly ROOSTER: string = "ROOSTERClicked";
	public static readonly COW: string = "COWClicked";
	public static readonly DUCK: string = "DUCKClicked";
	public static readonly SHEEP: string = "SHEEPClicked";
	public static readonly HORSE: string = "HORSEClicked";
	public static readonly PIG: string = "PIGClicked";

	private gallo: Sprite;
	private pig: Sprite;
	private cow: Sprite;
	private horse: Sprite;
	private sheep: Sprite;
	private duck: Sprite;
	private cont: Container;
	private tunes: HudSounds;


	constructor() {
		super();

		this.tunes = new HudSounds();

		this.cont = new Container();

		this.gallo = Sprite.from("farmAnimals1");
		this.gallo.anchor.set(0.5);
		this.gallo.position.set(0, 200);
		this.gallo.scale.set(0.7);
		new Tween(this.gallo).from({ x: 520, y: 0, alpha: 0 }).to({ x: this.gallo.position.x, alpha: 1 }, 1000).easing(Easing.Bounce.Out).start()

		this.pig = Sprite.from("farmAnimals3");
		this.pig.anchor.set(0.5);
		this.pig.position.set(300, 200);
		this.pig.scale.set(0.7);
		new Tween(this.pig).from({ x: 520, alpha: 0 }).to({ x: this.pig.position.x, alpha: 1 }, 1000).start().easing(Easing.Bounce.Out)

		this.cow = Sprite.from("farmAnimals0");
		this.cow.anchor.set(0.5);
		this.cow.position.set(600, 225);
		this.cow.scale.set(0.7);
		new Tween(this.cow).from({ x: 520, alpha: 0 }).to({ x: this.cow.position.x, alpha: 1 }, 1000).start().easing(Easing.Bounce.Out)

		this.horse = Sprite.from("farmAnimals5");
		this.horse.anchor.set(0.5);
		this.horse.position.set(900, 200);
		this.horse.scale.set(0.7);
		new Tween(this.horse).from({ x: 520, alpha: 0 }).to({ x: this.horse.position.x, alpha: 1 }, 1000).start().easing(Easing.Bounce.Out)

		this.sheep = Sprite.from("farmAnimals4");
		this.sheep.anchor.set(0.5);
		this.sheep.position.set(1200, 200);
		this.sheep.scale.set(0.7);
		new Tween(this.sheep).from({ x: 520, alpha: 0 }).to({ x: this.sheep.position.x, alpha: 1 }, 1000).start().easing(Easing.Bounce.Out)

		this.duck = Sprite.from("farmAnimals6");
		this.duck.anchor.set(0.5);
		this.duck.position.set(1500, 200);
		this.duck.scale.set(0.7);
		new Tween(this.duck).from({ x: 520, alpha: 0 }).to({ x: this.duck.position.x, alpha: 1 }, 1000).start().easing(Easing.Bounce.Out)

		this.cont.addChild(
			this.gallo,
			this.pig,
			this.cow,
			this.horse,
			this.sheep,
			this.duck
		);
		this.cont.pivot.set(this.cont.width / 2, this.cont.height / 2);

		this.addChild(this.cont);

		this.gallo.interactive = true;
		this.pig.interactive = true;
		this.sheep.interactive = true;
		this.horse.interactive = true;
		this.duck.interactive = true;
		this.cow.interactive = true;

		// ROOSTER 
		this.gallo.on("pointerdown", () => {
			new Tween(this.gallo)
				.to({ x: this.gallo.position.x, y: this.gallo.position.y, scale: { x: 0.8, y: 0.8 } }, 1000)
				.yoyo().repeat(1).start();
			SoundLib.playMusic(this.tunes.tunes[0], { loop: false })
			this.emit("CLICKED_ANIMAL" as any, "rooster-sfx");
		}
			, this
		);
		this.gallo.on("pointerout", () => {
			new Tween(this.gallo)
				.to({ x: this.gallo.position.x, y: this.gallo.position.y, scale: { x: 0.8, y: 0.8 } }, 2000)
				.start();
		}, this
		);

		// SHEEP 
		this.sheep.on(
			"pointerdown", () => {
				new Tween(this.sheep)
					.to({ x: this.sheep.position.x, y: this.sheep.position.y, scale: { x: 0.8, y: 0.8 } }, 1000)
					.yoyo().repeat(1).start();
				SoundLib.playMusic(this.tunes.tunes[4], { loop: false });
				this.emit("CLICKED_ANIMAL" as any, "sheep-sfx");
			}, this
		);
		this.sheep.on("pointerout", () => {
			new Tween(this.sheep)
				.to({ x: this.sheep.position.x, y: this.sheep.position.y, scale: { x: 0.7, y: 0.7 } }, 1000)
				.start();
		}, this
		);

		// HORSE 
		this.horse.on(
			"pointerdown",
			() => {
				new Tween(this.horse)
					.to({ x: this.horse.position.x, y: this.horse.position.y, scale: { x: 0.8, y: 0.8 } }, 1000)
					.yoyo().repeat(1).start();
				SoundLib.playMusic("horse-sfx", { loop: false });
				this.emit("CLICKED_ANIMAL" as any, "horse-sfx");
			},
			this
		);
		this.horse.on("pointerout", () => {
			new Tween(this.horse)
				.to({ x: this.horse.position.x, y: this.horse.position.y, scale: { x: 0.7, y: 0.7 } }, 1000)
				.start();
		}, this
		);

		// DUCK 
		this.duck.on(
			"pointerdown",
			() => {
				new Tween(this.duck)
					.to({ x: this.duck.position.x, y: this.duck.position.y, scale: { x: 0.8, y: 0.8 } }, 1000)
					.yoyo().repeat(1).start();
				SoundLib.playMusic("duck-sfx", { loop: false });
				this.emit("CLICKED_ANIMAL" as any, "duck-sfx");

			}, this
		);
		this.duck.on(
			"pointerout",
			() => {
				new Tween(this.duck)
					.to({ x: this.duck.position.x, y: this.duck.position.y, scale: { x: 0.7, y: 0.7 } }, 2000).start();
			}, this
		);


		// PIG

		this.pig.on(
			"pointerdown",
			() => {
				new Tween(this.pig)
					.to({ x: this.pig.position.x, y: this.pig.position.y, scale: { x: 0.8, y: 0.8 } }, 1000)
					.yoyo().repeat(1).start();
				SoundLib.playMusic("pig-sfx", { loop: false });
				this.emit("CLICKED_ANIMAL" as any, "pig-sfx");

			},
			this
		);
		this.pig.on(
			"pointerout",
			() => {
				new Tween(this.pig)
					.to({ x: this.pig.position.x, y: this.pig.position.y, scale: { x: 0.7, y: 0.7 } }, 2000).start();
			},
			this
		);


		// COW 


		this.cow.on(
			"pointerdown",
			() => {
				new Tween(this.cow)
					.to({ x: this.cow.position.x, y: this.cow.position.y, scale: { x: 0.8, y: 0.8 } }, 1000)
					.yoyo().repeat(1).start();
				SoundLib.playMusic("cow-sfx", { loop: false });
				this.emit("CLICKED_ANIMAL" as any, "cow-sfx");

			},
			this
		);
		this.cow.on(
			"pointerout",
			() => {
				new Tween(this.cow)
					.to({ x: this.cow.position.x, y: this.cow.position.y, scale: { x: 0.7, y: 0.7 } }, 2000).start();
			},
			this
		);



	}


	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.cont, newW, newH, 1, 1, ScaleHelper.FIT);
	}

}