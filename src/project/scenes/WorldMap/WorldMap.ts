/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Graphics, Point, Sprite, Text, TextStyle } from "pixi.js";
import Random from "../../../engine/random/Random";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Terrain } from "./Terrain";
import { GRASS_TEXTURE, HILL_TEXTURE, RIVER_TEXTURE, FOREST_TEXTURE, ROAD_TEXTURE } from "../../../utils/constants";
import { Character } from "./Character";
import { Keyboard } from "../../../engine/input/Keyboard";
import { InputHandler } from "../../../utils/InputHandler";
import { Entity, EntityType } from "./Entity";
import type { IMapProvider } from "../../../engine/pathfinding/IMapProvider";
import { WeightedPathfindingManager } from "../../../engine/pathfinding/WeightedPathfindingManager";

export class RandomWorldMap extends PixiScene {
	private WIDTH: number = 9;
	private HEIGHT: number = 6;
	private TILE_SIZE: number = 177;
	private tiles_: Terrain[][] = [];

	// Terrenos
	private grassTerrain_: Terrain = new Terrain("grass", 1, false, GRASS_TEXTURE);
	private hillTerrain_: Terrain = new Terrain("hill", 2, false, HILL_TEXTURE);
	private riverTerrain_: Terrain = new Terrain("river", 6, true, RIVER_TEXTURE);
	private forestTerrain_: Terrain = new Terrain("forest", 2, false, FOREST_TEXTURE);
	private roadTerrain_: Terrain = new Terrain("road", 0.5, false, ROAD_TEXTURE);

	private inputHandler: InputHandler;
	private player: Character;
	public previousTile: any;

	// UI Elements
	private movementPointsText: Text;
	private scoreText: Text;
	private hpText: Text;
	private levelText: Text;
	private messageText: Text;

	// Zona visible
	private visibleZone: Graphics;

	// Entidades del juego
	private entities: Entity[] = [];

	// Estado del juego
	private score: number = 0;
	private level: number = 1;
	private gameOver: boolean = false;
	private victory: boolean = false;

	public static previousTileCost: number;

	constructor() {
		super();

		this.initializeLevel();

		this.testPathfinding();
	}

	private initializeLevel(): void {
		// Limpiar todo
		this.removeChildren();
		this.entities = [];
		this.tiles_ = [];

		// Generar terreno
		this.generateTerrain();

		// Crear sprites de terreno
		const terrainContainer = new Container();
		this.addChild(terrainContainer);
		this.createTerrainSprites(terrainContainer);

		// Crear jugador
		this.player = new Character(0, 0);
		this.addChild(this.player);

		this.inputHandler = new InputHandler(this.player);

		const initialTerrain = this.getTile(0, 0);
		this.previousTile = initialTerrain;
		this.player.setTerrainUnderCharacter(initialTerrain);

		// Crear zona visible
		this.visibleZone = new Graphics();
		this.addChild(this.visibleZone);

		// Generar entidades
		this.generateEntities();

		// Crear UI
		this.createUI();

		// Reset estado
		this.gameOver = false;
		this.victory = false;
	}

	private generateTerrain(): void {
		for (let x = 0; x < this.WIDTH; x++) {
			this.tiles_[x] = [];
			for (let y = 0; y < this.HEIGHT; y++) {
				const rand = Random.shared.randomInt(0, 100);
				if (rand < 15) {
					this.tiles_[x][y] = this.hillTerrain_;
				} else if (rand < 30) {
					this.tiles_[x][y] = this.forestTerrain_;
				} else {
					this.tiles_[x][y] = this.grassTerrain_;
				}
			}
		}

		// Agregar río
		const riverX = Random.shared.randomInt(0, this.WIDTH);
		for (let y = 0; y < this.HEIGHT; y++) {
			this.tiles_[riverX][y] = this.riverTerrain_;
		}

		// Agregar caminos
		const roadY = Random.shared.randomInt(0, this.HEIGHT);
		for (let x = 0; x < this.WIDTH; x++) {
			if (Random.shared.randomInt(0, 100) < 60) {
				this.tiles_[x][roadY] = this.roadTerrain_;
			}
		}
	}

	private createTerrainSprites(container: Container): void {
		for (let x = 0; x < this.WIDTH; x++) {
			for (let y = 0; y < this.HEIGHT; y++) {
				const terrain = this.tiles_[x][y];
				const terrainSprite = new Sprite(terrain.getTexture());
				terrainSprite.width = this.TILE_SIZE;
				terrainSprite.height = this.TILE_SIZE;
				terrainSprite.x = x * this.TILE_SIZE;
				terrainSprite.y = y * this.TILE_SIZE;
				container.addChild(terrainSprite);
			}
		}
	}

	private generateEntities(): void {
		const numTreasures = 2 + this.level;
		const numCoins = 3 + this.level * 2;
		const numEnemies = 2 + this.level;
		const numHealth = 2;

		// Generar tesoros
		for (let i = 0; i < numTreasures; i++) {
			this.spawnRandomEntity(EntityType.TREASURE);
		}

		// Generar monedas
		for (let i = 0; i < numCoins; i++) {
			this.spawnRandomEntity(EntityType.COIN);
		}

		// Generar enemigos
		for (let i = 0; i < numEnemies; i++) {
			this.spawnRandomEntity(EntityType.ENEMY);
		}

		// Generar pociones
		for (let i = 0; i < numHealth; i++) {
			this.spawnRandomEntity(EntityType.HEALTH);
		}

		// Generar meta (siempre en la esquina opuesta)
		this.spawnEntity(this.WIDTH - 1, this.HEIGHT - 1, EntityType.GOAL);
	}

	private spawnRandomEntity(type: EntityType): void {
		for (let attempts = 0; attempts < 50; attempts++) {
			const x = Random.shared.randomInt(0, this.WIDTH);
			const y = Random.shared.randomInt(0, this.HEIGHT);

			// No spawear en posición inicial del jugador
			if (x === 0 && y === 0) {
				continue;
			}

			// No spawear donde ya hay otra entidad
			if (this.entities.find((e) => e.gridX === x && e.gridY === y)) {
				continue;
			}

			this.spawnEntity(x, y, type);
			break;
		}
	}

	private spawnEntity(x: number, y: number, type: EntityType): void {
		// Usar textura apropiada basada en el tipo
		const texture = this.getEntityTexture(type);
		const entity = new Entity(x, y, type, texture, this.TILE_SIZE);
		this.entities.push(entity);
		this.addChild(entity);
	}

	private getEntityTexture(type: EntityType): any {
		// Aquí deberías usar tus texturas reales
		// Por ahora usamos GRASS_TEXTURE como placeholder
		switch (type) {
			case EntityType.TREASURE:
				return GRASS_TEXTURE; // Reemplazar con TREASURE_TEXTURE
			case EntityType.COIN:
				return GRASS_TEXTURE; // Reemplazar con COIN_TEXTURE
			case EntityType.ENEMY:
				return HILL_TEXTURE; // Reemplazar con ENEMY_TEXTURE
			case EntityType.HEALTH:
				return GRASS_TEXTURE; // Reemplazar con HEALTH_TEXTURE
			case EntityType.GOAL:
				return ROAD_TEXTURE; // Reemplazar con GOAL_TEXTURE
			default:
				return GRASS_TEXTURE;
		}
	}

	private createUI(): void {
		const textStyle = new TextStyle({
			fontSize: 24,
			fill: 0xffffff,
			stroke: 0x000000,
			strokeThickness: 4,
			fontWeight: "bold",
		});

		// Puntos de movimiento
		this.movementPointsText = new Text(`MP: ${this.player.movementPoints}/${this.player.maxMovementPoints}`, textStyle);
		this.movementPointsText.position.set(10, 10);
		this.addChild(this.movementPointsText);

		// HP
		this.hpText = new Text(`HP: ${this.player.hp}/${this.player.maxHp}`, textStyle);
		this.hpText.position.set(10, 40);
		this.addChild(this.hpText);

		// Score
		this.scoreText = new Text(`Score: ${this.score}`, textStyle);
		this.scoreText.position.set(10, 70);
		this.addChild(this.scoreText);

		// Level
		this.levelText = new Text(`Level: ${this.level}`, textStyle);
		this.levelText.position.set(10, 100);
		this.addChild(this.levelText);

		// Mensaje
		const messageStyle = new TextStyle({
			fontSize: 20,
			fill: 0xffff00,
			stroke: 0x000000,
			strokeThickness: 3,
			fontWeight: "bold",
			wordWrap: true,
			wordWrapWidth: this.WIDTH * this.TILE_SIZE - 20,
		});
		this.messageText = new Text("¡Alcanza la meta y recolecta tesoros!", messageStyle);
		this.messageText.position.set(10, 130);
		this.addChild(this.messageText);
	}

	private updateUI(): void {
		this.movementPointsText.text = `MP: ${this.player.movementPoints.toFixed(1)}/${this.player.maxMovementPoints}`;
		this.hpText.text = `HP: ${this.player.hp}/${this.player.maxHp}`;
		this.scoreText.text = `Score: ${this.score}`;
		this.levelText.text = `Level: ${this.level}`;
	}

	private showMessage(message: string): void {
		this.messageText.text = message;
	}

	public override update(): void {
		if (this.gameOver || this.victory) {
			if (Keyboard.shared.justPressed("KeyR")) {
				if (this.victory) {
					this.level++;
				} else {
					this.score = 0;
					this.level = 1;
				}
				this.initializeLevel();
			}
			return;
		}

		// Movimiento
		if (Keyboard.shared.justPressed("KeyW")) {
			this.moveCharacterUp();
		}
		if (Keyboard.shared.justPressed("KeyS")) {
			this.moveCharacterDown();
		}
		if (Keyboard.shared.justPressed("KeyA")) {
			this.moveCharacterLeft();
		}
		if (Keyboard.shared.justPressed("KeyD")) {
			this.moveCharacterRight();
		}

		// Reset turno
		if (Keyboard.shared.justPressed("Space")) {
			this.player.resetMovementPoints();
			this.showMessage("¡Turno reseteado!");
			this.updateUI();
		}

		const tile = this.getTile(this.player.tileX, this.player.tileY);
		if (this.previousTile != tile) {
			this.previousTile = tile;
			RandomWorldMap.previousTileCost = tile.getMovementCost();
		}

		this.calculateVisibleZone();
		this.updateUI();
	}

	// Adaptador de Mapa Centralizado
	private getMapAdapter(includeEntities: boolean = true): IMapProvider {
		return {
			getWidth: () => this.WIDTH,
			getHeight: () => this.HEIGHT,
			getMovementCost: (x, y) => {
				// 1. Chequeo de límites (ya implícito en la iteración, pero por si acaso)
				if (x < 0 || x >= this.WIDTH || y < 0 || y >= this.HEIGHT) {
					return Infinity;
				}

				const tile = this.tiles_[x][y];

				// 2. Costo del terreno
				if (tile.isWater) {
					return Infinity;
				} // Si es agua y no tenemos barco

				let cost = tile.movementCost;

				// 3. Chequeo de entidades bloqueantes (ej: un enemigo o roca)
				if (includeEntities) {
					const entity = this.entities.find((e) => e.gridX === x && e.gridY === y);
					if (entity && entity.entityType === EntityType.ENEMY) {
						// Un enemigo bloquea el paso (cuesta infinito para el A*)
						cost = Infinity;
					}
				}

				return cost;
			},
		};
	}

	// Función de prueba para Pathfinding (ejecutar después de initializeLevel)
	private testPathfinding(): void {
		// Encontrar la meta (GOAL)
		const goalEntity = this.entities.find((e) => e.entityType === EntityType.GOAL);
		if (!goalEntity) {
			return;
		}

		const playerPos = new Point(this.player.tileX, this.player.tileY);
		const treasurePos = new Point(goalEntity.gridX, goalEntity.gridY);

		// Usar el Manager
		const mapAdapter = this.getMapAdapter(true); // Incluir entidades para no caminar sobre ellas

		const path = WeightedPathfindingManager.shared.findPath(mapAdapter, playerPos, treasurePos);

		if (path) {
			console.log("Ruta encontrada:", path);
			// Aquí llamarías a PathWalker para animar al jugador
		} else {
			console.log("No se encontró ruta a la meta.");
		}
	}
	// CAMBIO VITAL: Reimplementación de calculateVisibleZone usando Dijkstra
	private calculateVisibleZone(): void {
		this.visibleZone.clear();

		// 1. Definir el Punto de Inicio y el Límite de Movimiento
		const startPoint = new Point(this.player.tileX, this.player.tileY);
		const maxMovement = this.player.movementPoints;

		// 2. Usar el Manager para calcular el área alcanzable (Dijkstra)
		const mapAdapter = this.getMapAdapter(true); // Incluir entidades bloqueantes

		// Obtener un Set de coordenadas (e.g., "3,4", "3,5") que se pueden alcanzar
		const reachableTiles = WeightedPathfindingManager.shared.getReachableArea(mapAdapter, startPoint, maxMovement);

		// 3. Dibujar las celdas alcanzables
		reachableTiles.forEach((key) => {
			const [xStr, yStr] = key.split(",");
			const x = parseInt(xStr);
			const y = parseInt(yStr);

			// No dibujar la celda actual del jugador
			if (x === startPoint.x && y === startPoint.y) {
				return;
			}

			// Esta lógica ahora es puramente visual
			this.visibleZone.beginFill(0x00ff00, 0.2);
			this.visibleZone.drawRect(x * this.TILE_SIZE, y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
			this.visibleZone.endFill();
		});

		// El código original this.player.canReachTile(tile) ya no es necesario
	}

	public getTile(x: number, y: number): any {
		if (x >= 0 && x < this.WIDTH && y >= 0 && y < this.HEIGHT) {
			return this.tiles_[x][y];
		}
		return null;
	}

	public moveCharacterUp(): void {
		const targetTile = this.getTile(this.player.tileX, this.player.tileY - 1);
		this.moveCharacter(targetTile, 0, -1);
	}

	public moveCharacterDown(): void {
		const targetTile = this.getTile(this.player.tileX, this.player.tileY + 1);
		this.moveCharacter(targetTile, 0, 1);
	}

	public moveCharacterLeft(): void {
		const targetTile = this.getTile(this.player.tileX - 1, this.player.tileY);
		this.moveCharacter(targetTile, -1, 0);
	}

	public moveCharacterRight(): void {
		const targetTile = this.getTile(this.player.tileX + 1, this.player.tileY);
		this.moveCharacter(targetTile, 1, 0);
	}

	// CAMBIO en moveCharacter para usar la información de reachableTiles
	private moveCharacter(targetTile: Terrain, dx: number, dy: number): void {
		const targetX = this.player.tileX + dx;
		const targetY = this.player.tileY + dy;

		if (!targetTile || targetX < 0 || targetY < 0 || targetX >= this.WIDTH || targetY >= this.HEIGHT) {
			this.showMessage("¡No puedes salir del mapa!");
			return;
		}

		// --- Nueva Verificación de Movimiento Basada en Dijkstra ---
		const mapAdapter = this.getMapAdapter(true);
		const reachableTiles = WeightedPathfindingManager.shared.getReachableArea(mapAdapter, new Point(this.player.tileX, this.player.tileY), this.player.movementPoints);
		const targetKey = `${targetX},${targetY}`;

		if (!reachableTiles.has(targetKey)) {
			// Ya no chequeamos this.player.canReachTile(targetTile)
			this.showMessage("¡Esa casilla está fuera de tu rango de movimiento (MP)!");
			return;
		}
		// -----------------------------------------------------------

		// Aquí deberías recalcular el costo real para descontar si es un terreno pesado.
		// Opcional: Podrías usar A* para asegurar que el camino es viable si hubiese un obstáculo entre el start y end.
		const movementCost = mapAdapter.getMovementCost(targetX, targetY);
		if (this.player.movementPoints >= movementCost) {
			// Mover al jugador
			this.player.setTerrainUnderCharacter(targetTile);
			this.player.moveTowards(targetTile);

			// Ejecutar el comando de movimiento
			if (dx === 0 && dy === -1) {
				this.inputHandler.buttonUp.execute();
			} else if (dx === 0 && dy === 1) {
				this.inputHandler.buttonDown.execute();
			} else if (dx === -1 && dy === 0) {
				this.inputHandler.buttonLeft.execute();
			} else if (dx === 1 && dy === 0) {
				this.inputHandler.buttonRight.execute();
			}

			// Verificar colisión con entidades
			this.checkEntityCollision(this.player.tileX, this.player.tileY);
		}
	}

	private checkEntityCollision(x: number, y: number): void {
		const entityIndex = this.entities.findIndex((e) => e.gridX === x && e.gridY === y);
		if (entityIndex === -1) {
			return;
		}

		const entity = this.entities[entityIndex];
		const entityData = entity.getEntityData();

		switch (entity.entityType) {
			case EntityType.TREASURE:
				this.score += entityData.points;
				this.showMessage(`¡+${entityData.points} puntos! ${entityData.emoji}`);
				break;

			case EntityType.COIN:
				this.score += entityData.points;
				this.showMessage(`¡+${entityData.points} puntos! ${entityData.emoji}`);
				break;

			case EntityType.ENEMY:
				this.player.takeDamage(entityData.damage);
				this.showMessage(`¡Golpeado! -${entityData.damage} HP ${entityData.emoji}`);
				if (this.player.isDead()) {
					this.gameOver = true;
					this.showMessage("¡GAME OVER! Presiona R para reintentar");
				}
				break;

			case EntityType.HEALTH:
				this.player.heal(entityData.healing);
				this.showMessage(`¡+${entityData.healing} HP! ${entityData.emoji}`);
				break;

			case EntityType.GOAL:
				this.victory = true;
				this.showMessage(`¡NIVEL ${this.level} COMPLETADO! Score: ${this.score}. Presiona R para continuar`);
				break;
		}

		// Remover entidad
		this.removeChild(entity);
		this.entities.splice(entityIndex, 1);
	}
}
