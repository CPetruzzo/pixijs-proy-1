import type { Graphics, Sprite } from "pixi.js";

export interface PlayerUnit {
	id: string;
	gridX: number;
	gridY: number;
	puntosDeMovimiento: number;
	attackRange: number;
	sprite: Sprite;
	hasActed: boolean;
	isEnemy: boolean;
	// Stats:
	strength: number;
	defense: number;
	avoid: number; // porcentaje, ej. 0.03 para 3%
	maxHealthPoints: number;
	healthPoints: number;
	// Health bar:
	healthBar: Graphics;
}

export interface UnitConfig {
	id: string;
	textureKey: string; // nombre o key de la textura para Sprite.from(...)
	gridX: number;
	gridY: number;
	puntosDeMovimiento: number;
	attackRange: number;
	isEnemy: boolean;

	// Stats:
	strength: number;
	defense: number;
	avoid: number;
	maxHealthPoints: number;
	// initial healthPoints: típicamente igual a maxHealthPoints
}
