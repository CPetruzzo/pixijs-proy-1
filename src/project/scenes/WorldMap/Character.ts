// ============================================
// Character.ts - Mejorado con HP y combate
// ============================================
import { Container, Graphics, Point } from "pixi.js";
import type { Terrain } from "./Terrain";

export class Character extends Container {
	public static MOVESPEED: number = 177;
	private playerPositionX: number;
	private playerPositionY: number;
	private player: Graphics;
	public terrainUnderCharacter: Terrain;
	public tileX: number;
	public tileY: number;
	public movementPoints: number = 15;
	public maxMovementPoints: number = 15;

	// Nuevas propiedades
	public hp: number = 5;
	public maxHp: number = 5;

	constructor(initialPosX: number, initialPosY: number) {
		super();
		this.player = new Graphics();
		this.player.beginFill(0x4169e1);
		this.player.drawRect(0, 0, 177, 177);
		this.player.endFill();

		this.playerPositionX = initialPosX;
		this.playerPositionY = initialPosY;
		this.terrainUnderCharacter = null;

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
		this.tileX += directionX;
		this.tileY += directionY;
		this.updatePlayerPosition();
	}

	public moveUp(): void {
		this.move(0, -1);
	}

	public moveDown(): void {
		this.move(0, 1);
	}

	public moveLeft(): void {
		this.move(-1, 0);
	}

	public moveRight(): void {
		this.move(1, 0);
	}

	public updatePlayerPosition(): void {
		this.player.x = this.playerPositionX;
		this.player.y = this.playerPositionY;
		this.position.set(this.playerPositionX, this.playerPositionY);
	}

	public moveTowards(targetTile: Terrain): void {
		const movementCost = targetTile.getMovementCost();

		if (this.movementPoints >= movementCost) {
			this.movementPoints -= movementCost;
			this.updatePlayerPosition();
		}
	}

	public canReachTile(tile: Terrain): boolean {
		return this.movementPoints >= tile.getMovementCost();
	}

	public resetMovementPoints(): void {
		this.movementPoints = this.maxMovementPoints;
	}

	public takeDamage(damage: number): void {
		this.hp = Math.max(0, this.hp - damage);
	}

	public heal(amount: number): void {
		this.hp = Math.min(this.maxHp, this.hp + amount);
	}

	public isDead(): boolean {
		return this.hp <= 0;
	}
}
