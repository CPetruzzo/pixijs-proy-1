import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import type { Item } from "../objects/Item";
import { Slot } from "../objects/Slot";

export class StorageManager {
	private slots: Slot[];

	constructor(slotCount: number, maxWeightPerSlot: number) {
		this.slots = Array.from({ length: slotCount }, () => new Slot(maxWeightPerSlot));
	}

	public addItemToSlot(item: Item, slotIndex: number): boolean {
		if (slotIndex < 0 || slotIndex >= this.slots.length) {
			return false;
		}
		return this.slots[slotIndex].addItem(item);
	}

	public removeItemFromSlot(slotIndex: number): Item | null {
		if (slotIndex < 0 || slotIndex >= this.slots.length) {
			return null;
		}
		return this.slots[slotIndex].removeItem();
	}

	public getSlots(): Slot[] {
		return this.slots;
	}

	public moveItemBetweenSlots(fromIndex: number, toIndex: number): boolean {
		if (fromIndex === toIndex) {
			return false;
		}

		const fromSlot = this.slots[fromIndex];
		const toSlot = this.slots[toIndex];

		if (!fromSlot.item) {
			return false;
		} // No hay ítem que mover
		if (toSlot.item) {
			return false;
		} // El slot destino ya está ocupado

		toSlot.item = fromSlot.item; // Mover ítem
		fromSlot.item = null; // Vaciar el slot original

		return true;
	}

	public updateSlot(slotContainer: Container, index: number): void {
		if (!slotContainer) {
			console.error(`Slot container for index ${index} not found.`);
			return;
		}

		// Limpia los elementos antiguos del contenedor del slot
		slotContainer.removeChildren();

		// Dibuja nuevamente el borde del slot
		const slotBox = new Graphics();
		slotBox.lineStyle(2, 0xffffff);
		slotBox.drawRect(index * 80 + 10, 50, 70, 70);
		slotContainer.addChild(slotBox);

		// Agrega el ítem si existe
		const slot = this.getSlots()[index];
		if (slot.item) {
			this.addItemToSlot(slot.item, index);
		}
	}

	public addItemToFirstAvailableSlot(item: Item): boolean {
		for (let i = 0; i < this.slots.length; i++) {
			if (!this.slots[i].item) {
				// Si el slot está vacío
				return this.addItemToSlot(item, i); // Añadir ítem al slot
			}
		}
		console.warn("No empty slot available to add the item.");
		return false; // No hay espacio
	}

	// Método para guardar el inventario en JSON
	public saveInventoryToJSON(): string {
		const inventory = this.slots
			.filter((slot) => slot.item !== null) // Solo los slots con ítems
			.map((slot) => slot.item); // Extraemos los ítems

		return JSON.stringify(inventory);
	}

	// Método para vaciar todos los slots
	public clear(): void {
		this.slots.forEach((slot) => slot.clear()); // Limpia cada slot
	}

	public loadInventoryFromJSON(): void {
		// Intenta obtener los datos del localStorage
		const inventoryJSON = localStorage.getItem("inventory");

		if (inventoryJSON) {
			try {
				// Intenta parsear el JSON y cargarlo
				const parsedData = JSON.parse(inventoryJSON);

				// Verifica si parsedData es un arreglo o un objeto válido antes de intentar iterar
				if (Array.isArray(parsedData)) {
					parsedData.forEach((itemData, index) => {
						// Lógica para agregar los items al inventario
						this.addItemToSlot(itemData, index);
					});
				} else {
					console.error("Invalid inventory data format.");
				}
			} catch (error) {
				console.error("Error parsing inventory data:", error);
			}
		} else {
			console.log("No inventory data found in localStorage.");
		}
	}
}
