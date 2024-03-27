/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Graphics, Sprite } from "pixi.js";
import Random from "../../../engine/random/Random";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Terrain } from "./Terrain";
import { GRASS_TEXTURE, HILL_TEXTURE, RIVER_TEXTURE } from "../../../utils/constants";
import { Character } from "./Character";
import { Keyboard } from "../../../engine/input/Keyboard";
import { InputHandler } from "../../../utils/InputHandler";
import { Text } from "pixi.js";

export class RandomWorldMap extends PixiScene {
	private WIDTH: number = 9;
	private HEIGHT: number = 6;
	private tiles_: Terrain[][] = []; // Define the tiles array.

	private grassTerrain_: Terrain = new Terrain("grass", 1, false, GRASS_TEXTURE);
	private hillTerrain_: Terrain = new Terrain("hill", 2, false, HILL_TEXTURE);
	private riverTerrain_: Terrain = new Terrain("river", 6, true, RIVER_TEXTURE);

	private inputHandler: InputHandler;
	private player: Character;
	public previousTile: any;
	private movementPointsText: Text; // Variable para mantener el texto actualizado

	// Agrega una propiedad para rastrear la zona visible
	private visibleZone: Graphics;
	public static previousTileCost: number;
	constructor() {
		super();

		// Initialize the tiles array.
		for (let x = 0; x < this.WIDTH; x++) {
			this.tiles_[x] = [];
			for (let y = 0; y < this.HEIGHT; y++) {
				// Sprinkle some hills.
				if (Random.shared.randomInt(0, 6) === 3) {
					this.tiles_[x][y] = this.hillTerrain_;
				} else {
					this.tiles_[x][y] = this.grassTerrain_;
				}
			}
		}

		// Lay a river.
		const x = Random.shared.randomInt(0, this.WIDTH);
		for (let y = 0; y < this.HEIGHT; y++) {
			this.tiles_[x][y] = this.riverTerrain_;
		}

		const terrainContainer = new Container();
		this.addChild(terrainContainer);

		// Create terrain sprites and add them to the container.
		for (let x = 0; x < this.WIDTH; x++) {
			for (let y = 0; y < this.HEIGHT; y++) {
				const terrain = this.tiles_[x][y];
				const terrainSprite = new Sprite(terrain.getTexture());
				terrainSprite.width = terrain.getTexture().width;
				terrainSprite.height = terrain.getTexture().height;
				terrainSprite.x = x * terrainSprite.width; // Adjust position based on tile size.
				terrainSprite.y = y * terrainSprite.height;
				terrainContainer.addChild(terrainSprite);
			}
		}
		this.player = new Character(0, 0);
		this.addChild(this.player);

		this.inputHandler = new InputHandler(this.player);
		// Antes de mover al personaje, establece el terreno actual bajo él
		const initialTerrain = this.getTile(this.player.x, this.player.y);
		this.previousTile = initialTerrain;
		console.log("initialTerrain", initialTerrain.getMovementCost());
		this.player.setTerrainUnderCharacter(initialTerrain);
		console.log(initialTerrain.getName());

		// Crear y agregar la zona visible al inicio
		this.visibleZone = new Graphics();
		this.addChild(this.visibleZone);

		// Crear un objeto Text para mostrar los puntos disponibles
		this.movementPointsText = new Text(`Movement Points: ${this.player.movementPoints}`);
		this.movementPointsText.position.set(10, 10); // Ajusta la posición según tus necesidades
		this.addChild(this.movementPointsText); // Agrega el texto a la escena

	}

	public override update(): void {
		if (Keyboard.shared.justPressed("KeyW")) {
			this.moveCharacterUp();
			this.updateMovementPointsText();

		}
		if (Keyboard.shared.justPressed("KeyS")) {
			this.moveCharacterDown();
			this.updateMovementPointsText();
		}
		if (Keyboard.shared.justPressed("KeyA")) {
			this.moveCharacterLeft();
			this.updateMovementPointsText();
		}
		if (Keyboard.shared.justPressed("KeyD")) {
			this.moveCharacterRight();
			this.updateMovementPointsText();
		}

		const tile = this.getTile(this.player.tileX, this.player.tileY);
		if (this.previousTile != tile) {
			this.previousTile = tile;
			RandomWorldMap.previousTileCost = tile.getMovementCost();
			console.log("tileCost", RandomWorldMap.previousTileCost, tile.getName());
		}

		// Calcula los límites de movimiento y muestra la zona visible
		this.calculateVisibleZone();
		// Cuando el jugador confirme su movimiento (por ejemplo, presionando "Enter")
		if (Keyboard.shared.justPressed("Enter")) {
			// Obtén la celda de destino actual del jugador
			const targetTile = this.getTile(this.player.tileX, this.player.tileY);

			if (targetTile && this.player.canReachTile(targetTile)) {
				// Realiza el movimiento
				this.moveCharacter(targetTile);
			}
		}
	}

	private calculateVisibleZone(): void {
		// Limpia la representación visual anterior de la zona visible
		this.visibleZone.clear();

		// Calcula y dibuja la zona visible basada en los puntos de movimiento restantes
		// y el costo de movimiento en cada celda dentro del rango permitido.
		// Puedes utilizar un bucle para recorrer las celdas y resaltarlas visualmente.
		// Por ejemplo:
		for (let x = 0; x < this.WIDTH; x++) {
			for (let y = 0; y < this.HEIGHT; y++) {
				const tile = this.tiles_[x][y];
				if (this.player.canReachTile(tile)) {
					// Dibuja un resaltado en esta celda para indicar que es alcanzable
					this.visibleZone.beginFill(0x00FF00, 0.2); // Color verde transparente
					this.visibleZone.drawRect(x * 177, y * 177, 177, 177);
					this.visibleZone.endFill();
				}
			}
		}
	}

	public getTile(x: number, y: number): any {
		// Verifica si las coordenadas están dentro de los límites
		if (x >= 0 && x < this.WIDTH && y >= 0 && y < this.HEIGHT) {
			return this.tiles_[x][y];
		} else {
			// Devuelve un valor predeterminado o maneja el error de alguna otra manera
			return null; // o lanza una excepción, según tu lógica
		}
	}

	public moveCharacterUp(): void {
		const targetTile = this.getTile(this.player.tileX, this.player.tileY - 1);
		this.moveCharacter(targetTile, this.inputHandler.buttonUp.execute());
	}

	public moveCharacterDown(): void {
		const targetTile = this.getTile(this.player.tileX, this.player.tileY + 1);
		this.moveCharacter(targetTile, this.inputHandler.buttonDown.execute());
	}

	public moveCharacterLeft(): void {
		const targetTile = this.getTile(this.player.tileX - 1, this.player.tileY);
		this.moveCharacter(targetTile, this.inputHandler.buttonLeft.execute());
	}

	public moveCharacterRight(): void {
		const targetTile = this.getTile(this.player.tileX + 1, this.player.tileY);
		this.moveCharacter(targetTile, this.inputHandler.buttonRight.execute());
		;
	}

	private moveCharacter(targetTile: Terrain, onComplete: void): void {
		if (targetTile) {
			if (this.player.canReachTile(targetTile)) {
				const movementCost = targetTile.getMovementCost();
				if (this.player.movementPoints >= movementCost) {
					this.player.setTerrainUnderCharacter(targetTile);
					// this.player.movementPoints -= movementCost;
					this.player.moveTowards(targetTile);
					onComplete;
				} else {
					// Aquí puedes agregar un mensaje de que no tienes suficientes puntos de movimiento.
					console.log("No tienes suficientes puntos de movimiento para llegar a esta celda.");
				}
			} else {
				// Aquí puedes agregar un mensaje de que no puedes llegar a esta celda.
				console.log("No puedes llegar a esta celda debido a su costo de movimiento.");
			}
		}
	}

	// Método para actualizar el contador de puntos
	public updateMovementPointsText(): void {
		this.movementPointsText.text = `Movement Points: ${this.player.movementPoints}`;
	}
}
