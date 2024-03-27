/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Container } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { LevelCreator } from "../../../utils/LevelCreator";
import { levelData } from "../../../utils/LevelData";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { CURRENT_LEVEL } from "../../../utils/constants";
import { encontrarIndice } from "../../../utils/EntityType";
import type { Player } from "./Player";
import { Item } from "./Item";
import { Tween } from "tweedle.js";
import { navigateToNeighborLevel } from "./NeighbourManager";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class LDTKMapScene extends PixiScene {
	public static readonly BUNDLES = ["package-1", "sfx"];

	private world: Container = new Container();
	private levels: LevelCreator[] = [];

	constructor() {
		super();

		this.addChild(this.world);
		this.world.sortableChildren = true;

		for (let i = 0; i < 4; i++) {
			const level = new LevelCreator(levelData[0], CURRENT_LEVEL + i);
			level.cullable = false;
			level.zIndex = i === 0 ? 0 : -1;
			this.levels.push(level);
			this.world.addChild(level);
			console.log(level.mapData.levels[0].__neighbours);
			// Ejemplo de uso
			navigateToNeighborLevel("d53f9950-c640-11ed-8430-4942c04951ff", "n");
		}
	}

	public override update(dt: number): void {
		this.levels.forEach((level) => {
			if (level.levelEntities) {
				const playerIndex = encontrarIndice(level.levelEntities.dataName, "Player");

				if (playerIndex !== -1) {
					const player: Player = level.levelEntities.entities[playerIndex];
					player.playerUpdate(dt);

					const collisions = level.mapa.collisions;

					for (const item of level.levelEntities.entities) {
						if (item instanceof Item) {
							switch (item.data.fieldInstances[0].__value) {
								case "Health":
									player.detectCollision([item], true);
									if (player.detectCollision([item])) {
										SoundLib.playMusic("potion", { loop: false });
										level.levelEntities.removeChild(item);
										console.log(`Agarré el ${item.data.fieldInstances[0].__value}`);
									}
									break;
								case "KeyA":
								case "KeyB":
									item.alpha = 0;
									player.detectCollision([item], true);
									if (player.detectCollision([item])) {
										level.levelEntities.removeChild(item);
										const newX = item.data.fieldInstances[0].__value === "KeyA" ? -level.width : this.world.width;
										new Tween(this).to({ x: newX }, 1000).start();
									}
									break;
								default:
									// Lógica por defecto para otros tipos de objetos
									break;
							}
						}
					}

					if (player.detectCollision(collisions, false)) {
						player.stopMovement();
					}
				}
			}
		});
	}

	public override onResize(_newW: number, _newH: number): void {
		this.levels.forEach((level, index) => {
			ScaleHelper.setScaleRelativeToIdeal(level, _newW * 4.5, _newH * 4.5, 1920, 1280, ScaleHelper.FIT);
			level.x = index === 2 ? this.world.x + this.world.width : index === 1 ? this.world.x - level.width / 2 : this.world.x;
			level.y = index === 3 ? this.world.y + this.levels[3].height : 0;
		});
	}
}
