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
			console.log("Picked:", Array.from(this.getItems()));
		}
	}

	public drop(itemId: string, parent: Container, x: number, y: number, onDropped?: () => void): void {
		if (!this.state.pickedItems.has(itemId)) {
			console.warn(`No tienes el item '${itemId}' para soltarlo.`);
			return;
		}

		// 1) removemos del estado
		this.state.pickedItems.delete(itemId);
		this.emit("dropped", itemId);

		// 2) creamos el sprite del ícono en el mundo
		const textureMap: Record<string, string> = {
			battery: "AH_batteryicon",
			sacredgun: "AH_sacredgunicon",
			holywater: "AH_holywatericon",
			skull: "AH_skullicon",
			papiro: "AH_papiroicon",
		};
		const texKey = textureMap[itemId] ?? itemId;
		const droppedIcon = Sprite.from(texKey);
		droppedIcon.anchor.set(0.5);
		droppedIcon.scale.set(0.5);
		droppedIcon.position.set(x, y);
		droppedIcon.alpha = 0;
		parent.addChild(droppedIcon);

		// 3) animación de aparición
		new Tween(droppedIcon)
			.to({ alpha: 1, y: y - 10 }, 500)
			.easing(Easing.Quadratic.Out)
			.start()
			.onComplete(() => {
				// 4) opcional: callback tras finalizar
				onDropped?.();
			});

		console.log("Dropped:", Array.from(this.getItems()));
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
			holywater: "AH_holywatericon",
			skull: "AH_skullicon",
			papiro: "AH_papiroicon",

			// añade más items si los tuvieras…
		};
		const texKey = textureMap[id] ?? id;

		// 2) Creamos el sprite y escalamos
		const icon = Sprite.from(texKey);
		icon.scale.set(0.7);
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
