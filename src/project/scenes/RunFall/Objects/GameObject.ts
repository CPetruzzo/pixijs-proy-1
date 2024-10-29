import { Graphics } from "pixi.js";

export abstract class GameObject extends Graphics {
	public isOnGround: boolean = false;
	public shipDead: boolean = false;

	protected constructor() {
		super();
		this.eventMode = "static";
	}

	public abstract update(dt: number): void;

	public abstract handleEvent(_something?: any): void;
}
