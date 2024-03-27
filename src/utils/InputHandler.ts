import { WalkDown } from "../project/scenes/WorldMap/Actions/WalkDown";
import { WalkLeft } from "../project/scenes/WorldMap/Actions/WalkLeft";
import { WalkRight } from "../project/scenes/WorldMap/Actions/WalkRight";
import { WalkUp } from "../project/scenes/WorldMap/Actions/WalkUp";
import type { Character } from "../project/scenes/WorldMap/Character";

/** I set up which buttons I'm gonna need, I don't assign a Keyboard Key, I just know which buttons are gonna be needed
 * @abstract note that all of them ARE COMMANDS
 */
export class InputHandler {
	public buttonUp: WalkUp;
	public buttonDown: WalkDown;
	public buttonLeft: WalkLeft;
	public buttonRight: WalkRight;
	constructor(character: Character) {
		this.buttonUp = new WalkUp(character);
		this.buttonDown = new WalkDown(character);
		this.buttonLeft = new WalkLeft(character);
		this.buttonRight = new WalkRight(character);
	}
}
