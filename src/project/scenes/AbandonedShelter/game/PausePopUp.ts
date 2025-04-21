import { Container, Graphics, Sprite } from "pixi.js";
import { GameStateManager } from "../game/GameStateManager";
import { Trigger } from "../classes/Trigger";

/**
 * Popup de pausa independiente de la scene. Muestra overlay, panel y grid de items recogidos.
 */
export class PausePopUp extends Container {
	private blocker: Graphics;
	private panel: Sprite;
	private closeTrigger: Trigger;
	public popupOpened: boolean = false;

	constructor() {
		super();
		const state = GameStateManager.instance;
		this.popupOpened = true;

		// fondo semi-transparente
		this.blocker = new Graphics().beginFill(0x000000, 0.8).drawRect(0, 0, window.innerWidth, window.innerHeight).endFill();
		this.blocker.interactive = true;
		this.addChild(this.blocker);

		// panel en el centro
		this.panel = Sprite.from("AH_pausemenu");
		this.panel.anchor.set(0.5);
		this.panel.x = window.innerWidth / 2;
		this.panel.y = window.innerHeight / 2;
		this.panel.scale.set(0.8);
		this.addChild(this.panel);

		// Grid de ítems recogidos
		const items = Array.from(state.pickedItems);
		const padding = 25;
		const cols = 3;
		const iconSize = 72;
		items.forEach((id, index) => {
			const texKey = `AH_${id}icon`;
			const icon = Sprite.from(texKey);
			icon.width = iconSize;
			icon.height = iconSize;
			const row = Math.floor(index / cols);
			const col = index % cols;
			icon.x = this.panel.x - this.panel.width / 2 + padding + col * (iconSize + padding);
			icon.y = this.panel.y - this.panel.height / 2 + padding + row * (iconSize + padding) + 300;
			icon.interactive = true;
			icon.cursor = "pointer";
			icon.on("pointerdown", () => {
				GameStateManager.instance.activeItem = id;
				console.log("GameStateManager.instance.activeItem", GameStateManager.instance.activeItem);
				this.close();
			});
			this.addChild(icon);
		});

		// Trigger para cerrar con clic en panel
		this.closeTrigger = new Trigger();
		this.closeTrigger.createPointerTrigger(this, this.panel.x, this.panel.y + this.panel.height / 2 - 30, () => this.close());

		this.pivot.set(this.width / 2, this.height / 2);
	}

	/**
	 * Cierra el popup removiéndolo de su parent.
	 */
	public close(): void {
		if (this.parent) {
			this.parent.removeChild(this);
			this.popupOpened = false;
			this.destroy({ children: true, texture: false, baseTexture: false });
		}
	}
}
