/* eslint-disable prettier/prettier */
export class Item {
	constructor(
		public name: string,
		public weight: number,
		public quantity: number,
		public description: string,
		public image: string
	) { }

	public getTotalWeight(): number {
		return this.weight * this.quantity;
	}
}
