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
	isBoss?: boolean; // ✅ NUEVO: opcional

	// Stats:
	strength: number;
	defense: number;
	avoid: number; // porcentaje, ej. 0.03 para 3%
	maxHealthPoints: number;
	healthPoints: number;
	criticalChance: number; // 0.1 = 10% de chance de crítico
	// Health bar:
	healthBar: Graphics;

	// NUEVO: para sanación en fortress:
	hasHealedFortress?: boolean;
}

export interface UnitConfig {
	id: string;
	textureKey: string; // nombre o key de la textura para Sprite.from(...)
	gridX: number;
	gridY: number;
	puntosDeMovimiento: number;
	attackRange: number;
	isEnemy: boolean;
	isBoss?: boolean; // ✅ NUEVO: opcional

	// Stats:
	strength: number;
	defense: number;
	avoid: number;
	maxHealthPoints: number;
	criticalChance: number; // 0.1 = 10% de chance de crítico
	// initial healthPoints: típicamente igual a maxHealthPoints
}
