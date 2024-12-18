
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { AnimalButtonSounds } from "../AnimalButtonSounds";
import { HudSounds } from "../HudSounds";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";

export class AnimalSounds extends PixiScene {
	public static readonly BUNDLES = ["playWithSounds"];

	private sceneContainer: Container;
	private bg: Sprite;
	private ui: HudSounds;
	private animalButtons: AnimalButtonSounds;

	constructor() {
		super();

		this.bg = Sprite.from("BG0");
		this.bg.scale.set(1, 1.46);

		this.ui = new HudSounds();
		this.ui.position.set(950, 900);
		this.ui.scale.set(0.8)

		this.animalButtons = new AnimalButtonSounds();
		this.animalButtons.position.set(1050, 150);

		this.sceneContainer = new Container();

		this.sceneContainer.addChild(
			this.bg,
			this.ui,
			this.animalButtons,
		);

		this.sceneContainer.pivot.set(this.sceneContainer.width / 2, this.sceneContainer.height / 2);

		this.addChild(this.sceneContainer);

	}

	public override onResize(newW: number, newH: number): void {
		this.position.set(newW / 2, newH / 2);
		ScaleHelper.setScaleRelativeToScreen(this.sceneContainer, newW, newH, 1, 1, ScaleHelper.FIT);
	}

	public override update(): void {
	}
}