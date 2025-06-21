/* eslint-disable @typescript-eslint/naming-convention */
// PlayerFactory.ts
import type { Container } from "pixi.js";
import { Sprite, Graphics, Texture } from "pixi.js";
import type { PlayerUnit, UnitConfig } from "../Data/IUnit";
import { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";

export class PlayerFactory {
	private worldContainer: Container;
	private tileSize: number;

	/**
	 * @param worldContainer Contenedor PIXI donde se añadirán los sprites y healthBars.
	 * @param tileSize Tamaño de tile en píxeles para posicionar correctamente.
	 */
	constructor(worldContainer: Container, tileSize: number) {
		this.worldContainer = worldContainer;
		this.tileSize = tileSize;
	}

	/**
	 * Crea una unidad (aliada o enemiga) según la configuración,
	 * añade el sprite y healthBar al contenedor, y retorna el PlayerUnit.
	 * No dibuja la health bar por completo (la escena puede llamar a drawHealthBar).
	 */
	public createUnit(config: UnitConfig): PlayerUnit {
		// --- Sprite en el mapa ---
		const sprite = Sprite.from(config.textureKey);
		sprite.anchor.set(0.5);
		sprite.scale.set(0.4);
		sprite.x = config.gridX * this.tileSize + this.tileSize / 2;
		sprite.y = config.gridY * this.tileSize + this.tileSize / 2;

		const healthBar = new Graphics();
		this.worldContainer.addChild(sprite);
		this.worldContainer.addChild(healthBar);

		// faceSprite (UI preview)
		let faceSprite: Sprite | undefined;
		if (config.faceKey) {
			faceSprite = Sprite.from(config.faceKey);
			faceSprite.anchor.set(0.5);
			faceSprite.scale.set(0.5);
		} else {
			faceSprite = Sprite.from(config.textureKey);
			faceSprite.anchor.set(0.5);
			faceSprite.scale.set(0.5);
		}

		// battleTextureKey base (clave para texturas de combate)
		let battleTextureKey: string;
		if (config.battleTextureKey) {
			battleTextureKey = config.battleTextureKey;
		} else {
			battleTextureKey = config.isEnemy ? "battle_quilmes" : "battle_colonial";
		}

		// --- Crear StateMachineAnimator para combate ---
		const battleAnimator = new StateMachineAnimator();
		battleAnimator.anchor.set(0.5);
		battleAnimator.scale.set(1.0);

		// 1) Estado "idle"
		const idleKey = `${battleTextureKey}_idle`;
		battleAnimator.addState("idle", [Texture.from(idleKey)], 4, true);

		// 2) Estado "attack": generar lista de textures de frames 1..N
		//    y determinar fps dinámicamente según si es aliado/enemigo o según la clave.
		// Primero, cuántos frames tiene cada tipo (ya teníamos frameCountMap):
		const frameCountMap: Record<string, number> = {
			battle_quilmes: 8,
			battle_colonial: 28,
			// si hay más, agregarlos...
		};
		const maxFrames = frameCountMap[battleTextureKey] ?? 0;
		const attackTextures: Texture[] = [];
		for (let i = 1; i <= maxFrames; i++) {
			const key = `${battleTextureKey}_attack_${i}`;
			// Texture.from(...) devuelve un Texture aunque no exista en cache;
			// idealmente el loader ya cargó "battleTextureKey_attack_i".
			attackTextures.push(Texture.from(key));
		}

		if (attackTextures.length > 0) {
			// Definir un mapeo de fps según clave o según config.isEnemy.
			// Por ejemplo, los aliados (colonial) más rápidos: fps mayor;
			// enemigos (quilmes) más lentos: fps menor:
			const attackFpsMap: Record<string, number> = {
				battle_quilmes: 8, // animación de ataque de enemigo más lenta
				battle_colonial: 35, // animación de ataque de aliado más rápida
				// agregar otros si se requieren...
			};
			// Tomar fps según battleTextureKey; si no hay mapping, un default:
			const fps = attackFpsMap[battleTextureKey] ?? 20;

			battleAnimator.addState("attack", attackTextures, fps, false);
		}
		// Opcional: otros estados, p.ej. "hit", "die", etc., con lógica similar (frameCountMap y fpsMap).

		// Empezar en "idle"
		battleAnimator.playState("idle");
		// No lo añadimos al worldContainer aquí; se usará en BattleOverlay.

		const unit: PlayerUnit = {
			id: config.id,
			gridX: config.gridX,
			gridY: config.gridY,
			puntosDeMovimiento: config.puntosDeMovimiento,
			attackRange: config.attackRange,
			sprite,
			faceSprite,
			hasActed: false,
			isEnemy: config.isEnemy,
			isBoss: config.isBoss ?? false,
			strength: config.strength,
			defense: config.defense,
			avoid: config.avoid,
			maxHealthPoints: config.maxHealthPoints,
			healthPoints: config.maxHealthPoints,
			criticalChance: config.criticalChance,
			healthBar,
			hasHealedFortress: false,
			battleTextureKey,
			battleAnimator,
		};
		return unit;
	}
	/** Apply gray-out effect to show unit already acted */
	public grayOutUnit(unit: PlayerUnit): void {
		// Option A: simple tint + alpha
		unit.sprite.alpha = 0.6; // slightly faded

		// Option B: for stronger desaturation, you can use ColorMatrixFilter:
		// const cmf = new PIXI.filters.ColorMatrixFilter();
		// cmf.desaturate(); // or cmf.saturate(-1) depending on PIXI version
		// unit.sprite.filters = [cmf];
	}

	/** Remove gray-out effect so unit looks normal again */
	public restoreUnitAppearance(unit: PlayerUnit): void {
		unit.sprite.alpha = 1; // fully opaque
		// If you used filters:
		// unit.sprite.filters = [];
	}

	/**
	 * Conveniencia para crear un aliado.
	 * Llama a createUnit con isEnemy=false.
	 */
	public createAlly(config: Omit<UnitConfig, "isEnemy">): PlayerUnit {
		return this.createUnit({ ...config, isEnemy: false });
	}

	/**
	 * Conveniencia para crear un enemigo.
	 * Llama a createUnit con isEnemy=true.
	 */
	public createEnemy(config: Omit<UnitConfig, "isEnemy">): PlayerUnit {
		return this.createUnit({ ...config, isEnemy: true });
	}

	/**
	 * Dibuja o actualiza la health bar de una unidad:
	 * - Mide el ancho en base a un porcentaje (p.ej. 80% de tileSize).
	 * - Posiciona el Graphics centrado horizontalmente sobre el sprite, un poco arriba.
	 */
	public drawHealthBar(unit: PlayerUnit): void {
		const g = unit.healthBar;
		g.clear();

		const sprite = unit.sprite;
		// Configuración de la barra:
		const barWidth = this.tileSize * 0.8; // 80% del tile
		const barHeight = 6; // altura fija
		const borderThickness = 1; // grosor del contorno
		const percent = unit.healthPoints / unit.maxHealthPoints;
		const filledWidth = Math.max(0, percent) * barWidth;

		// Coordenadas: queremos que la barra quede centrada horizontalmente sobre el sprite,
		// y verticalmente un poco encima: por ejemplo sprite.y - sprite.height/2 - offset.
		// Como el sprite.anchor está en (0.5,0.5), sprite.y es el centro en Y.
		const offsetY = this.tileSize * 0.5; // ajusta este valor a tu sprite; p.ej. 0.5 tile arriba.
		const x = sprite.x - barWidth / 2;
		const y = sprite.y - offsetY;

		// 1) Dibuja fondo de la barra (por ejemplo gris oscuro):
		g.beginFill(0x333333);
		g.drawRect(x, y, barWidth, barHeight);
		g.endFill();

		// 2) Dibuja la parte llena (verde->amarillo->rojo según percent, opcional):
		let color = 0x00ff00;
		if (percent < 0.3) {
			color = 0xff0000;
		} else if (percent < 0.6) {
			color = 0xffff00;
		}
		g.beginFill(color);
		g.drawRect(x + borderThickness, y + borderThickness, Math.max(0, filledWidth - 2 * borderThickness), barHeight - 2 * borderThickness);
		g.endFill();

		// 3) (Opcional) Dibuja contorno:
		g.lineStyle(1, 0x000000);
		g.drawRect(x, y, barWidth, barHeight);
		g.lineStyle(0);
	}

	// Función para actualizar barra:
	public updateHpBar(unit: PlayerUnit): void {
		const bar = (unit as any).hpBar as Graphics;
		if (!bar) {
			return;
		}
		const x = unit.gridX * this.tileSize;
		const y = unit.gridY * this.tileSize - 8; // justo encima del tile
		const w = this.tileSize * 0.8;
		const h = 4;
		const pct = unit.healthPoints / unit.maxHealthPoints;
		bar.clear();
		// Fondo
		bar.beginFill(0x000000)
			.drawRect(x + (this.tileSize - w) / 2, y, w, h)
			.endFill();
		// Vida
		bar.beginFill(0x00ff00)
			.drawRect(x + (this.tileSize - w) / 2, y, w * pct, h)
			.endFill();
	}
}

export function criticalDamage(attacker: PlayerUnit, defender: PlayerUnit): number {
	function isCriticalHit(attacker: PlayerUnit): boolean {
		return Math.random() < attacker.criticalChance;
	}
	const baseDamage = Math.max(0, attacker.strength - defender.defense);
	if (isCriticalHit(attacker)) {
		console.log("¡Golpe crítico!");
		return baseDamage * 2; // O 1.5, según quieras
	}
	return baseDamage;
}
