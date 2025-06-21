import { Container, Sprite, Text, TextStyle, Graphics } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import type { PlayerUnit } from "./Data/IUnit";

export class PreviewUnit extends Container {
	private bg: Sprite;
	private unitSprite: Sprite | null = null;
	private infoText: Text;
	private healthBar: Graphics;

	private tileSize: number;
	private previewSpriteSize: number;
	private uiInnerMargin: number;

	private currentUnit: PlayerUnit | null = null;
	private tweens: Tween<any>[] = [];

	/**
	 * @param tileSize Tamaño de tile usado para ciertas posiciones relativas (aunque aquí se usa más para healthbar/redibujo).
	 * @param frameKey Clave de textura para el fondo (p.ej. "frameBlue").
	 */
	constructor(tileSize: number, frameKey: string = "frameBlue") {
		super();
		this.tileSize = tileSize;
		// Tamaños internos (puedes ajustarlos o pasarlos como parámetro si prefieres)
		this.previewSpriteSize = 128; // solo para cálculo de offset de texto; ajústalo si tu sprite preview es distinto
		this.uiInnerMargin = 8;

		// Fondo:
		this.bg = Sprite.from(frameKey);
		this.bg.anchor.set(0);
		this.bg.scale.set(0.4, 0.3);
		this.bg.alpha = 0; // inicia invisible para fade-in
		this.addChild(this.bg);

		// Texto de ID:
		this.infoText = new Text(
			"",
			new TextStyle({
				fill: "#ffffff",
				dropShadow: true,
				dropShadowDistance: 2,
				fontFamily: "Pixelate-Regular",
				fontSize: 18, // otras propiedades si gustas: fontFamily, dropShadow, etc.
			})
		);
		this.infoText.alpha = 0;
		this.addChild(this.infoText);

		// Health bar:
		this.healthBar = new Graphics();
		this.healthBar.alpha = 0;
		this.addChild(this.healthBar);
	}

	/**
	 * Debe llamarse cada vez que cambie la unidad bajo el selector:
	 * - Si `unit` es distinto a la anterior (`currentUnit`), hará hide de la preview anterior y show de la nueva.
	 * - Si es la misma unidad, solo redibuja texto/healthbar.
	 * - Si `unit` es `null`, ocultará la preview actual (si existía).
	 */
	public update(unit: PlayerUnit | null, selector: Sprite): void {
		// Si cambió la unidad:
		if (unit !== this.currentUnit) {
			// hide de la anterior si existía
			if (this.currentUnit) {
				this.hidePreview();
			}
			// show de la nueva si no es null
			if (unit) {
				new Tween(selector)
					.from({ scale: { x: 0.1, y: 0.1 } })
					.to({ scale: { x: 0.08, y: 0.08 } }, 350)
					.yoyo(true)
					.easing(Easing.Bounce.Out)
					.start();
				this.showPreview(unit);
			}
			this.currentUnit = unit;
		}
		// Si es la misma unidad y no es null, actualizar texto y healthbar:
		if (unit && this.currentUnit === unit) {
			// Si cambió la textura:
			if (this.unitSprite && this.unitSprite.texture !== unit.faceSprite.texture) {
				this.unitSprite.texture = unit.faceSprite.texture;
			}
			// Actualizar texto:
			this.infoText.text = unit.id;
			// Actualizar healthbar:
			this.redrawHealthBar(unit);
			// Reposicionar elementos en caso de que hayan cambiado (grid pos no afecta aquí,
			// pero si deseas reposicionar dinámicamente puedes hacerlo):
			this.positionElements(unit);
		}
	}

	/** Crea/actualiza children y lanza tweens de entrada */
	private showPreview(unit: PlayerUnit): void {
		// Cancelar tweens anteriores si quieres:
		this.stopAllTweens();

		// Crear bg si no existe (aunque en constructor ya se creó, pero si se destruyó en hidePreview):
		if (!this.bg || this.bg.destroyed) {
			// Si en hidePreview destruimos bg, recreamos:
			this.bg = Sprite.from((this.bg as any)?.texture?.textureCacheIds?.[0] || "frameBlue");
			this.bg.anchor.set(0);
			this.bg.scale.set(0.4, 0.3);
			this.bg.alpha = 0;
			this.addChildAt(this.bg, 0);
		} else {
			this.bg.alpha = 0;
		}

		// Crear unitSprite si no existe:
		if (!this.unitSprite) {
			const spr = Sprite.from(unit.faceSprite.texture);
			spr.anchor.set(0.5);
			spr.x = 50;
			spr.y = 50;
			spr.scale.set(-0.05, 0.05); // inicia más pequeño para el pop tween
			spr.alpha = 0;
			this.unitSprite = spr;
			this.addChild(this.unitSprite);
		} else {
			// Si existía pero texture distinta, actualizamos; y reset alpha/scale para tween:
			this.unitSprite.texture = unit.faceSprite.texture;
			this.unitSprite.alpha = 0;
			this.unitSprite.scale.set(-0.05, 0.05);
			this.unitSprite.x = 50;
			this.unitSprite.y = 58;
		}

		// Texto y healthBar: aseguramos alpha=0 para fade-in
		this.infoText.alpha = 0;
		this.healthBar.alpha = 0;

		// Posicionar elementos para la unidad actual:
		this.positionElements(unit);

		// Lanzar tweens de entrada:
		// BG fade-in a alpha=0.6
		const tweenBg = new Tween(this.bg).to({ alpha: 0.6 }, 300).easing(Easing.Quadratic.Out).start();
		this.tweens.push(tweenBg);

		// Sprite pop + fade-in:
		if (this.unitSprite) {
			const tweenSprScale = new Tween(this.unitSprite.scale).to({ x: -0.09, y: 0.08 }, 300).easing(Easing.Back.Out).start();
			const tweenSprAlpha = new Tween(this.unitSprite).from({ y: 70 }).to({ alpha: 1, x: 50, y: 58 }, 300).easing(Easing.Quadratic.Out).start();
			this.tweens.push(tweenSprScale, tweenSprAlpha);
		}

		// Texto fade-in:
		const tweenText = new Tween(this.infoText).to({ alpha: 1 }, 300).easing(Easing.Quadratic.Out).start();
		this.tweens.push(tweenText);

		// Health bar fade-in:
		const tweenHp = new Tween(this.healthBar).to({ alpha: 1 }, 300).easing(Easing.Quadratic.Out).start();
		this.tweens.push(tweenHp);
	}

	/** Lanza tweens de salida y destruye/remueve children de bg y sprite al completarse */
	private hidePreview(): void {
		// Cancelar tweens anteriores si quieres:
		this.stopAllTweens();

		const duration = 200;
		// BG fade-out:
		if (this.bg) {
			const tweenBg = new Tween(this.bg)
				.to({ alpha: 0 }, duration)
				.easing(Easing.Quadratic.In)
				.onComplete(() => {
					if (this.bg && this.bg.parent) {
						this.removeChild(this.bg);
						this.bg.destroy();
						// Quedará recreado en next showPreview
					}
				})
				.start();
			this.tweens.push(tweenBg);
		}
		// Sprite fade-out:
		if (this.unitSprite) {
			const spr = this.unitSprite;
			const tweenSpr = new Tween(spr)
				.to({ alpha: 0 }, duration)
				.easing(Easing.Quadratic.In)
				.onComplete(() => {
					if (spr.parent) {
						this.removeChild(spr);
						spr.destroy();
						this.unitSprite = null;
					}
				})
				.start();
			this.tweens.push(tweenSpr);
		}
		// Texto fade-out:
		{
			const txt = this.infoText;
			const tweenText = new Tween(txt).to({ alpha: 0 }, duration).easing(Easing.Quadratic.In).start();
			this.tweens.push(tweenText);
		}
		// Health bar fade-out:
		{
			const hp = this.healthBar;
			const tweenHp = new Tween(hp).to({ alpha: 0 }, duration).easing(Easing.Quadratic.In).start();
			this.tweens.push(tweenHp);
		}
		// Reset currentUnit:
		this.currentUnit = null;
	}

	/** Posiciona bg, sprite, texto y healthBar según layout. Se puede ajustar a tus coordenadas deseadas. */
	private positionElements(_unit: PlayerUnit): void {
		// Aquí, el contenedor PreviewUnit debe haber sido posicionado por la escena:
		// Por ejemplo: this.prevUnit.position.set(x0, y0)
		// Dentro de este container (origen 0,0), posicionamos:
		// bg en (0,0):
		if (this.bg) {
			this.bg.x = 0;
			this.bg.y = 0;
			// Si deseas reposicionar dinámicamente en función de tamaño del bg, hazlo aquí
		}
		// Sprite:
		if (this.unitSprite && this.bg) {
			// Por ejemplo, colocamos sprite con un offset fijo dentro del bg:
			this.unitSprite.x = 50;
			this.unitSprite.y = 58;
		}
		// Texto:
		if (this.infoText && this.unitSprite) {
			this.infoText.x = this.unitSprite.x + this.previewSpriteSize + this.uiInnerMargin - 90;
			this.infoText.y = this.unitSprite.y - 20; // o algún offset respecto a bg
		}
		// Health bar:
		if (this.healthBar && this.infoText) {
			this.healthBar.x = this.infoText.x;
			this.healthBar.y = this.infoText.y + this.infoText.height + this.uiInnerMargin;
		}
	}

	/** Dibuja la health bar en este.healthBar según unit.healthPoints */
	private redrawHealthBar(unit: PlayerUnit): void {
		const g = this.healthBar;
		g.clear();
		const pct = unit.healthPoints / unit.maxHealthPoints;
		// Fondo:
		g.beginFill(0x333333);
		g.drawRect(0, 0, this.tileSize * 0.8, 6);
		g.endFill();
		// Relleno:
		let color = 0x00ff00;
		if (pct < 0.3) {
			color = 0xff0000;
		} else if (pct < 0.6) {
			color = 0xffff00;
		}
		g.beginFill(color);
		// leave 1px border:
		g.drawRect(1, 1, Math.max(0, (this.tileSize * 0.8 - 2) * pct), 6 - 2);
		g.endFill();
		// Contorno:
		g.lineStyle(1, 0x000000);
		g.drawRect(0, 0, this.tileSize * 0.8, 6);
		g.lineStyle(0);
	}

	/** Cancela tweens en curso (opcional), si deseas evitar solapamientos */
	private stopAllTweens(): void {
		for (const t of this.tweens) {
			try {
				t.stop();
				// eslint-disable-next-line prettier/prettier
			} catch { }
		}
		this.tweens = [];
	}
}
