/* eslint-disable prettier/prettier */
// Eliminamos la importación de "pixi.js"

export enum ItemType {
	GENERIC = "generic",
	WEAPON = "weapon",
	HELMET = "helmet",
	SHIELD = "shield",
	ARMOR = "armor",
}

// Puedes mantener tus Enums, pero asegúrate de que los nombres y las imágenes
// estén correctamente mapeados, ya que "SWORD" apunta a dos nombres distintos
// en tu código original. Por simplicidad, los mantengo, pero recomiendo revisar
// el mapping de MANA y SWORD.
export enum ItemNames {
	SWORD = "Iron Sword",
	POTION = "Health Potion", // Cambiado de 'Mana Potion' para evitar ambigüedad con MANA
	MANA = "Mana Potion",
	GOLD = "Gold Coin",
}

export enum ItemImages {
	SWORD = "oldKnife",
	POTION = "loli",
	SHOTGUN = "shotgun",
	ARMOR = "armor",
	HELMET = "helmet",
	SHIELD = "shield",
	MANA = "star",
	GOLD = "golditem1",
}

// Interfaz para definir la estructura del objeto plano (JSON)
export interface ItemData {
	itemName: string;
	weight: number;
	quantity: number;
	description: string;
	image: string;
}

export class Item {
	// Agregamos 'type' al constructor
	constructor(
		public itemName: string,
		public weight: number,
		public quantity: number,
		public description: string,
		public image: string,
		public type: ItemType = ItemType.GENERIC // Nuevo campo
	) { }

	public getTotalWeight(): number {
		return this.weight * this.quantity;
	}

	// Método para serializar (lo usa JSON.stringify automáticamente)
	public toJSON(): ItemData {
		return {
			itemName: this.itemName,
			weight: this.weight,
			quantity: this.quantity,
			description: this.description,
			image: this.image,
			type: this.type, // Guardamos el tipo
		} as any;
	}

	/**
	 * Reconstruye una instancia de la clase Item a partir de un objeto plano (ej: desde JSON).
	 */
	public static fromJSON(data: any): Item {
		return new Item(
			data.itemName,
			data.weight,
			data.quantity,
			data.description,
			data.image,
			data.type || ItemType.GENERIC // Recuperamos el tipo
		);
	}
}
