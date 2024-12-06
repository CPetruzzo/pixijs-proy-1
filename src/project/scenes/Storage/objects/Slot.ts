import type { Item } from "./Item";

export class Slot {
	public item: Item | null = null;

	// eslint-disable-next-line prettier/prettier
	constructor(public maxWeight: number) { }

	public canHold(item: Item): boolean {
		return item.weight * item.quantity <= this.maxWeight;
	}

	public addItem(item: Item): boolean {
		if (this.canHold(item)) {
			this.item = item;
			return true;
		}
		return false;
	}

	public removeItem(): Item | null {
		const removedItem = this.item;
		this.item = null;
		return removedItem;
	}

	public clear(): void {
		this.item = null;
	}
}
