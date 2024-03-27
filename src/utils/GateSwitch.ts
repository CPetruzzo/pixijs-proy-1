import { Sprite } from "@pixi/sprite";
import type { Gate } from "./Gate";
import { Trigger } from "./Trigger";
import { HitPoly } from "../engine/collision/HitPoly";

export class GateSwitch extends Trigger {
	public static readonly BUNDLES = ["img"];
	private buttonSwitch: Sprite;
	public switchBox: HitPoly;
	constructor() {
		super();

		this.buttonSwitch = Sprite.from("armanda/switch.png");

		this.switchBox = HitPoly.makeBox(0, 0, this.buttonSwitch.width, this.buttonSwitch.width, true);

		this.addChild(this.buttonSwitch, this.switchBox);

		this.eventMode = "static";
	}

	/** switches gate state */
	public toggleGate(gate: Gate): void {
		// esto si querés hacer switch entre open y close
		// gate.toggleState();

		// esto es para hacerla open y punto
		gate.setGateState(true);
		gate.openDoor();
		this.alpha = 0;
	}
}
