import type { TextureSource } from "@pixi/core";
import { Texture } from "@pixi/core";
import type { Rectangle } from "@pixi/math";
import { AnimatedSprite } from "@pixi/sprite-animated";
import type { HitPoly } from "../../../engine/collision/HitPoly";
import { PhysicsContainer } from "./PhysichsContainer";

export class Nubes extends PhysicsContainer {
	private hitbox: HitPoly;
	public cloud: AnimatedSprite;

	constructor(shape: TextureSource) {
		super();

		this.cloud = new AnimatedSprite([Texture.from(shape)]);

		this.addChild(this.cloud);
	}

	public getHitBox(): Rectangle {
		return this.hitbox.getBounds();
	}

	public override update(dt: number): void {
		super.update(dt);
	}
}
