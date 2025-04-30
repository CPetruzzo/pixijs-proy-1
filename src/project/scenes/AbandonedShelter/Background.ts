import { ColorMatrixFilter, Container, Sprite } from "pixi.js";

export class Background extends Container {
	private background: Sprite;
	private gameContainer: Container;

	constructor(asset: string, parentContainer: Container, frontLayerContainer: Container) {
		super();

		this.createBackground(asset, parentContainer);
		this.createFrontLayer(frontLayerContainer);
	}

	public createBackground(asset: string, parentContainer: Container): void {
		this.gameContainer = parentContainer;
		this.background = Sprite.from(asset);
		this.background.anchor.set(0.5);
		this.gameContainer.addChildAt(this.background, 0);
	}

	private createFrontLayer(frontLayerContainer: Container): void {
		const frontlayer = Sprite.from("AH_frontlayer");
		frontlayer.scale.set(0.8, 1.2);
		frontlayer.anchor.set(0.5);
		frontlayer.position.x -= 1150;

		const frontlayer2 = Sprite.from("AH_frontlayer");
		frontlayer2.scale.set(0.8, 1.2);
		frontlayer2.anchor.set(0.5);
		frontlayer2.position.x += 1150;

		const cm = new ColorMatrixFilter();
		cm.brightness(1.3, false);
		// cm.blackAndWhite(true);
		const cmbase = new ColorMatrixFilter();
		cmbase.contrast(50, false);
		cmbase.desaturate();
		frontlayer.filters = [cmbase];
		frontlayer2.filters = [cmbase];

		frontLayerContainer.addChild(frontlayer);
		frontLayerContainer.addChild(frontlayer2);
	}
}
