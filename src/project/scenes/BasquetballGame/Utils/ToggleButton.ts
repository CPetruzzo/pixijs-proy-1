import type { SpriteSource } from "pixi.js";
import { Container, Sprite } from "pixi.js";

export class ToggleButton extends Container {
	public onSprite: Sprite;
	public offSprite: Sprite;

	constructor(onTexture: SpriteSource, offTexture: SpriteSource, position: { x: number; y: number }, parentContainer: { addChild: (arg0: Sprite) => void }) {
		super();
		// Crear el sprite para el estado "Off"
		this.offSprite = Sprite.from(offTexture);
		this.offSprite.anchor.set(0.5);
		this.offSprite.position.set(position.x, position.y);
		this.offSprite.eventMode = "none";
		this.offSprite.alpha = 0;

		// Crear el sprite para el estado "On"
		this.onSprite = Sprite.from(onTexture);
		this.onSprite.anchor.set(0.5);
		this.onSprite.position.set(position.x, position.y);
		this.onSprite.eventMode = "static";
		this.onSprite.alpha = 1;
		// Agregar los sprites al contenedor principal
		parentContainer.addChild(this.offSprite);
		parentContainer.addChild(this.onSprite);

		// Añadir eventos de interacción para los sprites
		this.onSprite.on("pointertap", () => {
			console.log("onSprite tapped - Switching to Off");
			this.toggleToOff();
		});
		this.offSprite.on("pointertap", () => {
			console.log("offSprite tapped - Switching to On");
			this.toggleToOn();
		});
	}

	public toggleToOn(): void {
		console.log("toggleToOn called");
		this.onSprite.alpha = 1;
		this.offSprite.alpha = 0;
		this.offSprite.eventMode = "none";
		this.onSprite.eventMode = "static";
	}

	public toggleToOff(): void {
		console.log("toggleToOff called");
		this.onSprite.alpha = 0;
		this.offSprite.alpha = 1;
		this.onSprite.eventMode = "none";
		this.offSprite.eventMode = "static";
		console.log("onSprite alpha:", this.onSprite.alpha, "| offSprite alpha:", this.offSprite.alpha);
	}
}
