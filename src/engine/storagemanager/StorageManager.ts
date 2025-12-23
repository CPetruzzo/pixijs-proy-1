import { Item } from "./Item";
import type { ItemData } from "./Item";
import { Slot } from "./Slot";

export class StorageManager {
	private slots: Slot[];
	// Callbacks para notificar a la UI cuando algo cambia
	private listeners: Array<() => void> = [];
	private storageKey: string;

	constructor(slotCount: number, maxWeightPerSlot: number, storageKey: string = "inventory") {
		this.slots = Array.from({ length: slotCount }, () => new Slot(maxWeightPerSlot));
		this.storageKey = storageKey;
	}

	public getSlots(): Slot[] {
		return this.slots;
	}

	// --- Sistema de Eventos ---
	public subscribe(callback: () => void): void {
		this.listeners.push(callback);
	}

	private notifyChange(): void {
		this.listeners.forEach((callback) => callback());
		// this.saveInventoryToJSON(); // Auto-guardado opcional
	}

	// --- Lógica de Inventario ---

	public addItemToSlot(item: Item, slotIndex: number): boolean {
		if (slotIndex < 0 || slotIndex >= this.slots.length) {
			return false;
		}

		const success = this.slots[slotIndex].addItem(item);
		if (success) {
			this.notifyChange();
		}
		return success;
	}

	public removeItemFromSlot(slotIndex: number): Item | null {
		if (slotIndex < 0 || slotIndex >= this.slots.length) {
			return null;
		}

		const item = this.slots[slotIndex].removeItem();
		if (item) {
			this.notifyChange();
		}
		return item;
	}

	public moveItemBetweenSlots(fromIndex: number, toIndex: number): boolean {
		if (fromIndex === toIndex) {
			return false;
		}
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= this.slots.length || toIndex >= this.slots.length) {
			return false;
		}

		const fromSlot = this.slots[fromIndex];
		const toSlot = this.slots[toIndex];

		if (!fromSlot.item) {
			return false;
		}

		// LÓGICA DE SWAP (INTERCAMBIO) ACTUALIZADA
		// Guardamos temporalmente el item de origen
		const itemMoving = fromSlot.item;

		// Intercambiamos: lo que había en destino pasa al origen
		// (Si destino era null, origen se vuelve null, lo cual es correcto)
		fromSlot.item = toSlot.item;

		// Ponemos el item que movíamos en el destino
		toSlot.item = itemMoving;

		this.notifyChange();
		return true;
	}

	public addItemToFirstAvailableSlot(item: Item): boolean {
		for (let i = 0; i < this.slots.length; i++) {
			if (this.slots[i].isEmpty) {
				const success = this.addItemToSlot(item, i);

				// notifyChange ya se llama dentro de addItemToSlot
				return success;
			}
		}
		console.warn("Inventory full.");
		return false;
	}

	public clear(): void {
		this.slots.forEach((slot) => slot.clear());
		// AHORA SÍ llamamos a notifyChange para que la UI se actualice al pulsar el botón de Debug
		this.notifyChange();
	}

	// --- Persistencia ---

	// Método para guardar el inventario en JSON (Ligeramente simplificado)
	public saveInventoryToJSON(): void {
		const inventoryData = this.slots.map((slot) => (slot.item ? slot.item.toJSON() : null));
		localStorage.setItem(this.storageKey, JSON.stringify(inventoryData));
		// Ya no devolvemos el string, solo guardamos.
	}

	public loadInventoryFromJSON(): void {
		const data = localStorage.getItem(this.storageKey);
		if (!data) {
			return;
		}

		try {
			const parsed: (ItemData | null)[] = JSON.parse(data);

			if (Array.isArray(parsed)) {
				this.clear(); // Limpiamos slots actuales

				parsed.forEach((itemData, index) => {
					if (itemData && index < this.slots.length) {
						// **CAMBIO CLAVE:** Usamos el método estático para reconstruir la instancia
						const itemInstance = Item.fromJSON(itemData);
						this.slots[index].item = itemInstance;
					}
				});
				this.notifyChange();
			}
		} catch (e) {
			console.error("Failed to load inventory:", e);
		}
	}

	// ... (código anterior)

	/**
	 * Compacta el inventario: mueve todos los objetos al principio
	 * eliminando los huecos vacíos.
	 */
	public organize(): void {
		// 1. Extraemos todos los items válidos (ignoramos nulls)
		const allItems = this.slots.map((slot) => slot.item).filter((item) => item !== null);

		// 2. Limpiamos todos los slots
		this.slots.forEach((slot) => slot.clear());

		// 3. Volvemos a llenar en orden
		allItems.forEach((item, index) => {
			if (index < this.slots.length) {
				this.slots[index].item = item;
			}
		});

		this.notifyChange();
	}
}
