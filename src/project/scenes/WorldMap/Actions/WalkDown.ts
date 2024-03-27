import { Command } from "../../../../utils/Command";
import type { Character } from "../Character";

export class WalkDown extends Command {
	private character: Character;
	constructor(character: Character) {
		super();
		this.character = character;
	}
	// En la clase WalkUp
	public override execute(): void {
		this.character.moveDown();
	}
}
