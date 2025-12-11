// ============================================
// Entity.ts - Nueva clase para items/enemigos
// ============================================
import type { Texture } from "pixi.js";
import { Container, Sprite } from "pixi.js";

export enum EntityType {
	TREASURE,
	COIN,
	ENEMY,
	HEALTH,
	GOAL,
}

export interface EntityData {
	emoji: string;
	points?: number;
	damage?: number;
	healing?: number;
	texture?: Texture;
}

export class Entity extends Container {
	public gridX: number;
	public gridY: number;
	public entityType: EntityType;
	private sprite: Sprite;

	constructor(x: number, y: number, type: EntityType, texture: Texture, tileSize: number = 177) {
		super();
		this.gridX = x;
		this.gridY = y;
		this.entityType = type;

		this.sprite = new Sprite(texture);
		this.sprite.width = tileSize;
		this.sprite.height = tileSize;
		this.addChild(this.sprite);

		this.position.set(x * tileSize, y * tileSize);
	}

	public getEntityData(): EntityData {
		switch (this.entityType) {
			case EntityType.TREASURE:
				return { emoji: "💎", points: 50 };
			case EntityType.COIN:
				return { emoji: "🪙", points: 10 };
			case EntityType.ENEMY:
				return { emoji: "👹", damage: 2 };
			case EntityType.HEALTH:
				return { emoji: "❤️", healing: 2 };
			case EntityType.GOAL:
				return { emoji: "🏁" };
			default:
				return { emoji: "?" };
		}
	}
}
