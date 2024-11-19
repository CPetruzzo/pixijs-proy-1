export class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }

	public equals(other: Node): boolean {
		return this.x === other.x && this.y === other.y;
	}
}
