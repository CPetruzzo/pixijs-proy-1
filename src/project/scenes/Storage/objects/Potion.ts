import { Item, ItemImages, ItemNames } from "./Item";

export class PotionItem extends Item {
	private static POTION_WEIGHT: number = 2;
	private static POTION_QUANTITY: number = 5;
	private static DESCRIPTION: string = "Recovers player's health by half";

	constructor() {
		super(ItemNames.POTION, PotionItem.POTION_WEIGHT, PotionItem.POTION_QUANTITY, PotionItem.DESCRIPTION, ItemImages.POTION);
	}
}
