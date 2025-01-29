import { Player } from "../entities/Player";
import { NPC } from "../entities/NPC";
import { Container, type Sprite } from "pixi.js";
import type { LDTkEntity, LDTkLayer } from "../types/LDTkTypes";

export class EntityManager extends Container {
	private entities: Sprite[] = [];

	public loadEntities(layer: LDTkLayer): void {
		layer.entityInstances?.forEach((entity: LDTkEntity) => {
			const { x, y, width, height, identifier } = entity;

			if (identifier === "Player") {
				const player = new Player(x, y, width, height);
				this.entities.push(player.sprite);
				this.addChild(player.sprite);
			}

			if (identifier === "NPC") {
				const npc = new NPC(x, y, width, height);
				this.entities.push(npc.sprite);
				this.addChild(npc.sprite);
			}
		});
	}
}
