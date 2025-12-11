// ============================================
// Terrain.ts - Mejorado con nuevos tipos
// ============================================
import type { Texture } from "pixi.js";

export class Terrain {
	public movementCost: number;
	public isWater: boolean;
	private terrainTexture: Texture;
	private name: string;

	constructor(name: string, movementCost: number, isWater: boolean, terrainTexture: Texture) {
		this.movementCost = movementCost;
		this.isWater = isWater;
		this.terrainTexture = terrainTexture;
		this.name = name;
	}

	public getMovementCost(): number {
		return this.movementCost;
	}

	public getIsWater(): boolean {
		return this.isWater;
	}

	public getTexture(): Texture {
		return this.terrainTexture;
	}

	public getName(): string {
		return this.name;
	}
}
