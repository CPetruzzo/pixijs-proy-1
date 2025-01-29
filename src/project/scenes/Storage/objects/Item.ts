/* eslint-disable prettier/prettier */

import { Container } from "pixi.js";


export enum ItemNames {
	SWORD = "Iron Sword",
	POTION = "Mana Potion",
	MANA = "Iron Sword",
	GOLD = "Mana Potion",
}

export enum ItemImages {
	SWORD = "oldKnife",
	POTION = "loli",
	MANA = "star",
	GOLD = "golditem1"
}

export class Item extends Container {
	constructor(
		public itemName: string,
		public weight: number,
		public quantity: number,
		public description: string,
		public image: string
	) {
		super();
	}

	public getTotalWeight(): number {
		return this.weight * this.quantity;
	}

	public toJSON(): any {
		return {
			itemName: this.itemName,
			weight: this.weight,
			quantity: this.quantity,
			description: this.description,
			image: this.image,
		};
	}
}
