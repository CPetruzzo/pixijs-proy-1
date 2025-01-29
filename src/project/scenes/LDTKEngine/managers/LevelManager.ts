import type { LDTkLevel, LDTkLayer } from "../types/LDTkTypes";
import { EntityManager } from "./EntityManager";
import { CollisionManager } from "./CollisionManager";
import { Container, Rectangle, Sprite, Texture } from "pixi.js";

export class LevelManager extends Container {
	private levelData: LDTkLevel;
	private tileLayers: Container[] = [];
	private entityManager: EntityManager;
	private collisionManager: CollisionManager;

	constructor(levelData: LDTkLevel) {
		super();
		this.levelData = levelData;
		this.entityManager = new EntityManager();
		this.collisionManager = new CollisionManager();
	}

	public loadLevel(): void {
		this.levelData.layers.forEach((layer: LDTkLayer) => {
			if (layer.type === "Tiles") {
				this.renderTileLayer(layer);
			} else if (layer.type === "Entities") {
				this.entityManager.loadEntities(layer);
			}
		});
	}

	private renderTileLayer(layer: LDTkLayer): void {
		const tilesetTexture = "tileset.png"; // Cambia según tu tileset
		const container = new Container();

		layer.gridTiles?.forEach((tile) => {
			const sprite = Sprite.from(Texture.from(tilesetTexture));
			new Rectangle(tile.src[0], tile.src[1], 32, 32);
			sprite.x = tile.px[0];
			sprite.y = tile.px[1];
			container.addChild(sprite);

			if (layer.identifier === "Collisions") {
				this.collisionManager.addCollider(sprite);
			}
		});

		this.tileLayers.push(container);
		this.addChild(container);
	}
}
