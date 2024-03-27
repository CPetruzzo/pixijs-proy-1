import { Command } from "../../../../utils/Command";
import type { Character } from "../Character";

export class WalkLeft extends Command {
	private character: Character;
	constructor(character: Character) {
		super();
		this.character = character;
	}
	public override execute(): void {
		this.character.moveLeft();
	}
}
