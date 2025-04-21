// src/game/InventoryController.ts
import { Sprite, type Container } from "pixi.js";
import { GameStateManager } from "./GameStateManager";
import { EventEmitter } from "eventemitter3";
import { Easing, Tween } from "tweedle.js";

export class InventoryController extends EventEmitter {
	private state = GameStateManager.instance;
	public inventoryIcons: Sprite[] = [];

	public pick(itemId: string): void {
		if (!this.state.pickedItems.has(itemId)) {
			this.state.pickedItems.add(itemId);
			this.emit("picked", itemId);
			console.log(this.getItems());
		}
	}

	public getItems(): Set<string> {
		return this.state.pickedItems;
	}

	public showNewItem(id: string, parentContainer: Container): void {
		console.log("Item picked:", id);

		// 1) Mapa de id → textura
		const textureMap: Record<string, string> = {
			battery: "AH_batteryicon",
			sacredgun: "AH_sacredgunicon",
			holywater: "AH_holywatericon", // o "AH_holywatericon" si ese es tu key
			// añade más items si los tuvieras…
		};
		const texKey = textureMap[id] ?? id;

		// 2) Creamos el sprite y escalamos
		const icon = Sprite.from(texKey);
		icon.scale.set(0.5);
		icon.anchor.set(0.5);

		// 3) Calculamos posición en fila (por ejemplo, en uiLeftContainer, a la altura 20px)
		icon.y = 20;

		// 4) Lo añadimos al UI y al array
		parentContainer.addChild(icon);
		new Tween(icon)
			.to({ alpha: 0, y: -800 }, 1500)
			.start()
			.easing(Easing.Quadratic.Out)
			.onComplete(() => {
				parentContainer.removeChild(icon);
			});
		this.inventoryIcons.push(icon);
	}
}
