/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import type { BaseTexture } from "@pixi/core";
import { Rectangle, Texture } from "@pixi/core";
import { GetTileTexture } from "./Tileset";
import { encontrarIndice } from "./EntityType";

export class Map extends Container {
	public identifier: string;
	public iid: string;
	public worldX: number;
	public worldY: number;
	public bgColor: string;
	public layerInstances: any;
	public jsonData: any;
	private tiles: Array<Sprite> = [];
	public levels: any;
	public entitiesNames: string[] = [];
	public collisions: any[] = [];
	constructor(jsonData: any, lvlNmbr: number) {
		super();

		this.identifier = jsonData.levels[lvlNmbr].identifier;
		this.iid = jsonData.levels[lvlNmbr].iid;
		this.worldX = jsonData.levels[lvlNmbr].worldX;
		this.worldY = jsonData.levels[lvlNmbr].worldY;
		this.bgColor = jsonData.levels[lvlNmbr].__bgColor;
		this.levels = jsonData.levels;
		this.layerInstances = jsonData.levels[lvlNmbr].layerInstances;
		this.jsonData = jsonData;
	}

	public cutTileset(baseTexture: BaseTexture): void {
		const numTilesX = Math.floor(baseTexture.width / 16);
		const numTilesY = Math.floor(baseTexture.height / 16);

		for (let y = 0; y < numTilesY; y++) {
			for (let x = 0; x < numTilesX; x++) {
				const tile = Sprite.from(new Texture(baseTexture, new Rectangle(x * 16, y * 16, 16, 16)));
				tile.x = x * 16;
				tile.y = y * 16;
				this.addChild(tile);
				this.tiles.push(tile);
			}
		}
	}

	public makeMap(baseTexture: BaseTexture, tilesize: number, levelNmbr: number): void {
		const tileSize = tilesize;
		const level = this.levels[levelNmbr];

		if (!level) {
			console.error(`No se encontró el nivel ${levelNmbr}`);
			return;
		}

		const capasEnOrden = [
			"Custom_floor",
			"Default_floor",
			"Collisions",
			"Wall_tops",
			// 'Entities' // they are added in LevelCreator with EntitiesCreator
		];

		const defaultFloorTiles: { x: number; y: number }[] = [];
		const d1Counts: { [key: number]: number } = {};

		for (const capaId of capasEnOrden) {
			const layer = level.layerInstances.find((layer: { __identifier: string }) => layer.__identifier === capaId);
			if (layer) {
				if (layer.__identifier === "Wall_tops") {
					layer
					console.log('layer', layer)
					const layerUID = layer.layerDefUid;
					const autoLayerRules = this.jsonData.defs.layers.find((layer: { uid: number }) => layer.uid === layerUID)?.autoRuleGroups[0].rules;
					if (autoLayerRules) {
						for (const autoLayerTile of layer.autoLayerTiles) {
							const tileTexture = GetTileTexture(baseTexture, autoLayerTile.src[0], autoLayerTile.src[1], tileSize, tileSize);

							const tile = Sprite.from(tileTexture);
							tile.name = "Wall_tops";
							// console.log('autoLayerTile.d[0]', autoLayerTile.d[0])

							for (const autoLayerTile of layer.autoLayerTiles) {
								const tileTexture = GetTileTexture(baseTexture, autoLayerTile.src[0], autoLayerTile.src[1], tileSize, tileSize);
								const tile = Sprite.from(tileTexture);
								tile.x = autoLayerTile.px[0];
								tile.y = autoLayerTile.px[1];

								// const d1Value = autoLayerTile.d[0];
								// if (d1Value === 132) {
								// 	const rule = this.jsonData.defs.layers[1].autoRuleGroups[0].rules.find((r: { uid: number }) => r.uid === 132);
								// 	if (rule.flipX) {
								// 		// tile.tint = 0x00fff;
								// 		// tile.scale.x = -1;
								// 		// tile.x = tile.x + 16;
								// 	}
								// } else if (d1Value === 131) {
								// 	// Apply specific behavior for rule 132
								// 	const rule = this.jsonData.defs.layers[1].autoRuleGroups[0].rules.find((r: { uid: number }) => r.uid === 131);
								// 	if (rule.flipX) {
								// 		// tile.tint = 0x00fff;
								// 		// tile.scale.x = -1;
								// 		// tile.x = tile.x + 16;
								// 	}
								// } else if (d1Value === 117) {
								// 	// Apply specific behavior for rule 117
								// 	const rule = this.jsonData.defs.layers[1].autoRuleGroups[0].rules.find((r: { uid: number }) => r.uid === 117);
								// 	if (rule.flipX) {
								// 		// tile.tint = 0x00fff;
								// 		// tile.scale.x = -1;
								// 		// tile.x = tile.x + 16;
								// 	}
								// } else if (d1Value === 122) {
								// 	// Apply specific behavior for rule 122
								// 	const rule = this.jsonData.defs.layers[1].autoRuleGroups[0].rules.find((r: { uid: number }) => r.uid === 122);
								// 	if (rule.flipX) {
								// 		// tile.tint = 0x00fff;
								// 		// tile.scale.x = -1;
								// 		// tile.x = tile.x + 16;
								// 	}
								// } else if (d1Value === 121) {

								// 	const rule = this.jsonData.defs.layers[1].autoRuleGroups[0].rules.find((r: { uid: number }) => r.uid === 121);
								// 	// Apply specific behavior for rule 121
								// 	if (rule.flipX) {
								// 		// tile.tint = 0x00fff;
								// 		// tile.scale.x = -1;
								// 		// tile.x = tile.x + 16;
								// 	}
								// } else if (d1Value === 127) {
								// 	const rule = this.jsonData.defs.layers[1].autoRuleGroups[0].rules.find((r: { uid: number }) => r.uid === 127);
								// 	// Apply specific behavior for rule 127
								// 	if (rule.flipX) {
								// 		// tile.tint = 0x00fff;
								// 		// tile.scale.x = -1;
								// 		// tile.x = tile.x + 16;
								// 	}
								// }

								// Establecer la posición del sprite y agregarlo al contenedor del mapa
								tile.x = autoLayerTile.px[0];
								tile.y = autoLayerTile.px[1] + layer.__pxTotalOffsetY;
								this.addChild(tile);
							}
						}
					}
				} else {
					for (const autoLayerTile of layer.autoLayerTiles) {
						const tileTexture = GetTileTexture(baseTexture, autoLayerTile.src[0], autoLayerTile.src[1], tileSize, tileSize);
						const tile = Sprite.from(tileTexture);
						tile.x = autoLayerTile.px[0];
						tile.y = autoLayerTile.px[1];
						if (autoLayerTile.flipX) {
							tile.scale.x = -1;
						}
						if (autoLayerTile.flipY) {
							tile.scale.y = -1;
						}
						this.addChild(tile);
						switch (layer.__identifier) {
							case "Collisions":
								tile.name = "Collisions";
								this.collisions.push(tile);
								break;
							case "Wall_tops":
								tile.name = "Wall_tops";
								break;
							case "Default_floor":
								tile.name = "Default_floor";
								defaultFloorTiles.push({ x: tile.x, y: tile.y });
								break;
							case "Custom_floor":
								tile.name = "Custom_floor";
								console.log("tile", tile);
								break;
							default:
								tile.name = `Other layer, ${layer.__identifier}`;
								break;
						}
					}
				}
			}
		}

		// Log de cuántas veces se repitió cada d[1] y su nombre
		console.log("Counts of d[1]:");
		for (const key in d1Counts) {
			if (d1Counts.hasOwnProperty(key)) {
				// console.log(`d[1]: ${key}, Count: ${d1Counts[key]}`);

			}
		}

		// Filtrar las colisiones que no estén superpuestas con los pisos predeterminados
		this.collisions = this.collisions.filter((collisionTile) => {
			for (const defaultFloorTile of defaultFloorTiles) {
				if (Math.abs(collisionTile.x - defaultFloorTile.x) <= 1 && collisionTile.y === defaultFloorTile.y) {
					return false;
				}
			}
			return true;
		});

		const entitiesLayer = level.layerInstances.find((layer: { __identifier: string }) => layer.__identifier === "Entities");
		entitiesLayer.entityInstances.forEach((element: any) => {
			this.entitiesNames.push(element.__identifier);
		});
		const player = entitiesLayer.entityInstances[encontrarIndice(this.entitiesNames, "Player")];
		console.log(player);
	}



	// private applyRulePropertiesToTile(rule: any, tile: any): void {
	// 	// Aquí puedes aplicar las propiedades de la regla a la baldosa
	// 	// Por ejemplo, ajustar la posición, volteo, etc.
	// 	if (rule.flipX) {
	// 		tile.scale.x = -1;
	// 	}
	// 	if (rule.flipY) {
	// 		tile.scale.y = -1;
	// 	}
	// 	// Otros ajustes de propiedades según las necesidades de tu aplicación
	// }

}
