import { Container, Graphics, Point } from "pixi.js";
import type { Terrain } from "./Terrain";

export class Character extends Container {
	public static MOVESPEED: number = 177 / 2;
	private playerPositionX: number;
	private playerPositionY: number;
	private player: Graphics;
	public terrainUnderCharacter: Terrain; // Guarda el terreno actual bajo el personaje
	public tileX: number;
	public tileY: number;
	public movementPoints: number = 15;

	constructor(initialPosX: number, initialPosY: number) {
		super();
		this.player = new Graphics();
		this.player.beginFill();
		this.player.drawRect(0, 0, 177, 177);
		this.player.endFill();

		this.playerPositionX = initialPosX;
		this.playerPositionY = initialPosY;
		this.terrainUnderCharacter = null; // Inicialmente no hay terreno bajo el personaje

		this.tileX = 0;
		this.tileY = 0;

		this.addChild(this.player);
	}
	public setTerrainUnderCharacter(terrain: Terrain): void {
		this.terrainUnderCharacter = terrain;
	}

	public getPlayerPosition(): Point {
		return new Point(this.playerPositionX, this.playerPositionY);
	}

	// Método genérico para mover al personaje en una dirección dada
	private move(directionX: number, directionY: number): void {
		if (this.terrainUnderCharacter) {
			const movementCost = this.terrainUnderCharacter.getMovementCost();
			if (this.movementPoints >= movementCost) {
				this.playerPositionX += directionX * Character.MOVESPEED;
				this.playerPositionY += directionY * Character.MOVESPEED;
			}
		} else {
			if (this.movementPoints >= 1) {
				this.playerPositionX += directionX * Character.MOVESPEED;
				this.playerPositionY += directionY * Character.MOVESPEED;
			}
		}
		// Actualiza la posición visual del personaje
		this.tileX += directionX;
		this.tileY += directionY;
		this.updatePlayerPosition();
	}

	public moveUp(): void {
		this.move(0, -1); // Mover hacia arriba (Y negativo)
	}

	public moveDown(): void {
		this.move(0, 1); // Mover hacia abajo (Y positivo)
	}

	public moveLeft(): void {
		this.move(-1, 0); // Mover hacia la izquierda (X negativo)
	}

	public moveRight(): void {
		this.move(1, 0); // Mover hacia la derecha (X positivo)
	}

	public updatePlayerPosition(): void {
		// Actualiza la posición del sprite del jugador
		this.player.x = this.playerPositionX;
		this.player.y = this.playerPositionY;
		this.position.set(this.playerPositionX, this.playerPositionY);
		console.log(this.tileX, this.tileY);
	}

	public moveTowards(targetTile: Terrain): void {
		// Calcula el costo de movimiento hacia el objetivo
		const movementCost = targetTile.getMovementCost();
		console.log('movementCost', movementCost)

		// Verifica si el personaje tiene suficiente movimiento restante
		if (this.movementPoints >= movementCost) {
			// Actualiza la posición del personaje y resta los puntos de movimiento
			// this.playerPositionX = targetTile.x;
			// this.playerPositionY = targetTile.y;
			this.movementPoints -= movementCost;

			// Actualiza la posición visual del personaje
			this.updatePlayerPosition();
		}
	}

	public canReachTile(tile: Terrain): boolean {
		// Verifica si el personaje puede alcanzar el terreno basado en los puntos de movimiento restantes
		return this.movementPoints >= tile.getMovementCost();
	}

	// Agrega un método para reiniciar los puntos de movimiento
	public resetMovementPoints(): void {
		this.movementPoints = 5; // Cambia esto al valor inicial deseado
	}
}
