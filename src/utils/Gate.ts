import { Container } from "@pixi/display";
import { Tween } from "tweedle.js";
import { Sprite } from "@pixi/sprite";
import { Point } from "@pixi/core";
import { HitPoly } from "../engine/collision/HitPoly";
import { DataManager } from "../engine/datamanager/DataManager";

export class Gate extends Container {
	private gate: Sprite;
	public hitbox: HitPoly;
	private gateState: boolean = false;
	public orientation: string = "vertical";
	constructor(gateName: string) {
		super();
		this.gate = Sprite.from("armanda/gate.png");
		this.gate.name = gateName;
		this.hitbox = HitPoly.makeBox(0, 0, this.gate.width, this.gate.height);
		DataManager.setValue("GATEPARAMS", new Point(this.gate.width, this.gate.height));
		this.addChild(this.gate, this.hitbox);
	}

	/** to know how a gate it's called */
	public getGateName(): string {
		return this.gate.name;
	}

	/** in case you wan't to change gate's name */
	public setGateName(gateName: string): void {
		this.gate.name = gateName;
	}

	/** to know a gate's orientation */
	public getGateOrientation(): string {
		return this.orientation;
	}

	/** in case you wan't to change gate's orientation */
	public setGateOrientation(orientation: string): void {
		this.orientation = orientation;
		switch (this.orientation) {
			case "vertical":
				this.gate.angle = 0;
				this.hitbox.angle = 0;
				break;
			case "horizontal":
				this.gate.angle = 90;
				this.hitbox.angle = 90;
				break;
			default:
				this.gate.angle = 90;
				this.hitbox.angle = 90;
				break;
		}
	}

	/** to know the current "opened or closed" state of the gate */
	public getGateState(): boolean {
		return this.gateState;
	}

	/** to set a state by hand */
	public setGateState(state: boolean): void {
		this.gateState = state;
		// console.log("this.gateState", this.gateState);
		console.log(`GATE ${this.getGateName()} IS NOW:`, this.getGateState());
	}

	/** toggle gate between opened or closed */
	public toggleState(): void {
		this.setGateState(!this.getGateState());
		switch (this.getGateState()) {
			case true:
				console.log(`GATE ${this.getGateName()} IS NOW:`, this.getGateState());
				this.closeDoor();
				break;
			case false:
				console.log(`GATE ${this.getGateName()} IS NOW:`, this.getGateState());
				this.openDoor();
				break;
			default:
				break;
		}
	}

	public openDoor(): void {
		new Tween(this.gate).to({ height: 0 }, 500).start();
		new Tween(this.hitbox).to({ height: 0 }, 500).start();
	}

	public closeDoor(): void {
		const gateParams: Point = DataManager.getValue("GATEPARAMS");
		new Tween(this.gate).to({ height: gateParams.y }, 500).start();
		new Tween(this.hitbox).to({ height: gateParams.y }, 500).start();
	}
}
