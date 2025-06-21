// IUnit.ts (o donde defines interfaces)
import type { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";
import type { Sprite, Graphics } from "pixi.js";

export interface PlayerUnit {
	id: string;
	gridX: number;
	gridY: number;
	puntosDeMovimiento: number;
	attackRange: number;
	sprite: Sprite;
	faceSprite?: Sprite;

	hasActed: boolean;
	isEnemy: boolean;
	isBoss?: boolean;

	// Stats:
	strength: number;
	defense: number;
	avoid: number;
	maxHealthPoints: number;
	healthPoints: number;
	criticalChance: number;
	healthBar: Graphics;
	hasHealedFortress?: boolean;

	// Para combate:
	battleTextureKey: string; // clave base para texturas de combate
	battleAnimator?: StateMachineAnimator; // animador de combate (se inicializa en PlayerFactory)
}

export interface UnitConfig {
	id: string;
	textureKey: string;
	faceKey?: string;

	gridX: number;
	gridY: number;
	puntosDeMovimiento: number;
	attackRange: number;
	isEnemy: boolean;
	isBoss?: boolean;

	// Stats:
	strength: number;
	defense: number;
	avoid: number;
	maxHealthPoints: number;
	criticalChance: number;

	// Opcional: clave(s) para animaciones de combate
	battleTextureKey?: string;
	// También podrías añadir: battleStates?: Record<string, string[]> // mapeo estado->[keys de frame]
}
