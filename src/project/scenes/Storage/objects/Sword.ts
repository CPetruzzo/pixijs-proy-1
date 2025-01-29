import { Item, ItemImages, ItemNames } from "./Item";

export class SwordItem extends Item {
	private static SWORD_WEIGHT: number = 5;
	private static SWORD_QUANTITY: number = 5;
	private static DESCRIPTION: string = "Sharped blade made of steel, ideal to kill enemies";

	constructor() {
		super(ItemNames.SWORD, SwordItem.SWORD_WEIGHT, SwordItem.SWORD_QUANTITY, SwordItem.DESCRIPTION, ItemImages.SWORD);
	}
}
