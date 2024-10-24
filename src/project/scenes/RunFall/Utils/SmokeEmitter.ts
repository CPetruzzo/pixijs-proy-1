import { Emitter, upgradeConfig } from "@pixi/particle-emitter";
import fireparticle from "../../../../../assets/img/emitter.json";
import type { Container } from "pixi.js";
import { Texture } from "pixi.js";

export class SmokeEmitter {
	private emitter: Emitter;

	constructor(particleContainer: Container) {
		const texture = Texture.from("smokeTexture");
		const config = upgradeConfig(fireparticle, [texture]);

		this.emitter = new Emitter(particleContainer, config);
	}

	public start(): void {
		this.emitter.emit = true;
	}

	public stop(): void {
		this.emitter.emit = false;
	}

	public update(dt: number): void {
		this.emitter.update(dt * 0.001);
	}
}
