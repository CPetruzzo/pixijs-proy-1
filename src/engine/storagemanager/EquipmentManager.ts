import { StorageManager } from "../../engine/storagemanager/StorageManager";
import type { Item } from "../../engine/storagemanager/Item";
import { ItemType } from "../../engine/storagemanager/Item";

export enum EquipmentSlots {
	MAIN_HAND = 0,
	HEAD = 1,
	BODY = 2,
}

export class EquipmentManager {
	public storage: StorageManager;

	constructor(storageKey: string = "player_equipment") {
		this.storage = new StorageManager(3, 100, storageKey);
	}

	public equipItem(item: Item): Item | null {
		const targetSlotIndex = this.getSlotForType(item.type);

		if (targetSlotIndex === -1) {
			console.warn("Este item no es equipable");
			return item;
		}

		const previousItem = this.storage.removeItemFromSlot(targetSlotIndex);
		this.storage.addItemToSlot(item, targetSlotIndex);
		return previousItem;
	}

	public unequip(slotIndex: EquipmentSlots): Item | null {
		return this.storage.removeItemFromSlot(slotIndex);
	}

	// --- NUEVO MÉTODO ---
	/**
	 * Intenta desequipar todo y moverlo al inventario objetivo.
	 * Retorna true si se desequipó todo, false si faltó espacio.
	 */
	public unequipAll(targetInventory: StorageManager): boolean {
		const equipmentSlots = this.storage.getSlots();
		let allUnequipped = true;

		// Recorremos todos los slots de equipamiento
		for (let i = 0; i < equipmentSlots.length; i++) {
			const item = equipmentSlots[i].item;

			if (item) {
				// 1. Intentamos agregarlo al inventario destino
				const added = targetInventory.addItemToFirstAvailableSlot(item);

				if (added) {
					// 2. Si entró, lo borramos del equipamiento
					this.storage.removeItemFromSlot(i);
				} else {
					// 3. Si no entró, marcamos que hubo un error (inventario lleno)
					allUnequipped = false;
				}
			}
		}

		return allUnequipped;
	}

	private getSlotForType(type: ItemType): number {
		switch (type) {
			case ItemType.WEAPON:
				return EquipmentSlots.MAIN_HAND;
			case ItemType.HELMET:
				return EquipmentSlots.HEAD;
			case ItemType.SHIELD:
				return EquipmentSlots.BODY;
			case ItemType.ARMOR:
				return EquipmentSlots.BODY;
			default:
				return -1;
		}
	}

	/**
	 * Retorna el ítem equipado según el tipo (ej: HELMET para la máscara)
	 */
	public getEquippedItem(type: ItemType): Item | null {
		const slotIndex = this.getSlotForType(type);
		if (slotIndex !== -1) {
			return this.getEquippedItemBySlot(slotIndex);
		}
		return null;
	}

	/**
	 * Retorna lo que haya en un slot específico (usando el enum EquipmentSlots)
	 */
	public getEquippedItemBySlot(slotIndex: EquipmentSlots): Item | null {
		const slots = this.storage.getSlots();
		if (slots[slotIndex]) {
			return slots[slotIndex].item;
		}
		return null;
	}
}
