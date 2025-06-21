/* eslint-disable prettier/prettier */
// AuroraBattleScene.ts
import type { Texture } from "pixi.js";
import { Container, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Tween, Easing } from "tweedle.js";

export class AuroraBattleScene extends PixiScene {
	public static readonly BUNDLES = ["aurora-latest", "abandonedhouse", "sfx"];
	private worldContainer = new Container();

	private attackerSprite: Sprite;
	private defenderSprite: Sprite;
	private onComplete: () => void;

	// Ajustes de layout/animación:
	private readonly xOffset = 155; // desplazamiento horizontal desde el centro
	private readonly spriteScale = 1; // escala de los sprites en batalla

	/**
	 * @param attackerTex Opcional Texture o clave de textura para atacante. Si no se provee, entra en modo debug y usa textura por defecto.
	 * @param defenderTex Opcional Texture o clave de textura para defensor. Si no se provee, entra en modo debug y usa textura por defecto.
	 * @param onComplete Opcional callback tras terminar animación. Si no se provee, en modo debug hace console.log y/o reinicia animación.
	 */
	constructor(attackerTex?: Texture | string, defenderTex?: Texture | string, onComplete?: () => void) {
		super();

		const spr = Sprite.from("battle2");
		spr.alpha = 0.7;
		spr.anchor.set(0.5)

		this.worldContainer.addChildAt(spr, 0);
		// ---------------------------------------
		// Detectar modo debug si no se pasaron texturas ni callback
		const debugMode = !attackerTex || !defenderTex;
		// Texturas de prueba en modo debug (asegurate de que existan en tus bundles)
		const DEBUG_ATTACKER_KEY = "battle_colonial"; // por ejemplo, textura de enemigo de prueba
		const DEBUG_DEFENDER_KEY = "battle_quilmes"; // por ejemplo, textura de aliado de prueba

		// Asignar textura atacante: si se pasó, usarla; si no, debug:
		const atkTex: Texture | string = attackerTex ? attackerTex : DEBUG_ATTACKER_KEY;
		// Asignar textura defensor:
		const defTex: Texture | string = defenderTex ? defenderTex : DEBUG_DEFENDER_KEY;

		// Asignar callback onComplete: si se pasó, usarlo; si no, en debug hacemos un log
		this.onComplete = onComplete
			? onComplete
			: () => {
				console.log("[Battle Debug] Animación de batalla terminada.");
				// En modo debug, podríamos reiniciar la animación automáticamente:
				if (debugMode) {
					// Esperar un momento y reiniciar:
					setTimeout(() => {
						this.playBattleAnimation();
					}, 500);
				}
			};

		// -------------------------------------------------
		// Configuración de la escena
		this.addChild(this.worldContainer);

		// Crear sprites
		this.attackerSprite = typeof atkTex === "string" ? Sprite.from(atkTex) : new Sprite(atkTex);
		this.defenderSprite = typeof defTex === "string" ? Sprite.from(defTex) : new Sprite(defTex);

		// Anchor al centro
		this.attackerSprite.anchor.set(0.5);
		this.defenderSprite.anchor.set(0.5);

		// Escala
		this.attackerSprite.scale.set(this.spriteScale);
		this.defenderSprite.scale.set(this.spriteScale);

		// Añadir al contenedor
		this.worldContainer.addChild(this.attackerSprite);
		this.worldContainer.addChild(this.defenderSprite);

		// Posicionar relativo al centro (worldContainer estará centrado en onResize)
		this.attackerSprite.x = -this.xOffset;
		this.attackerSprite.y = 50;
		this.defenderSprite.x = this.xOffset;
		this.defenderSprite.y = 50;

		// Iniciar animación de batalla
		this.playBattleAnimation();
	}

	// Centrar y escalar worldContainer cuando cambia tamaño
	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.worldContainer.x = w / 2;
		this.worldContainer.y = h / 2;
		// Si quisiéramos ajustar distancias según tamaño, podríamos recalcular xOffset aquí.
	}

	/** Orquesta la secuencia de animación de batalla */
	private playBattleAnimation(): void {
		// Guardar posiciones originales
		const origAttX = this.attackerSprite.x;
		// const origDefX = this.defenderSprite.x; // no se mueve, pero si quisieras animar defensa, lo usarías

		// Opcional: si quisieras un efecto especial en modo crítico, podrías pasar un flag isCrit y tintar aquí.

		// 1) Avance del atacante hacia el defensor
		const advanceDistance = 200; // px; ajustar según escala y tamaño de sprite

		new Tween(this.attackerSprite)
			.to({ x: origAttX + advanceDistance }, 300)
			.easing(Easing.Quadratic.Out)
			.onComplete(() => {
				// 2) Efecto golpe en defensor
				this.hitEffectOnDefender().then(() => {
					// 3) Regreso del atacante
					new Tween(this.attackerSprite)
						.to({ x: origAttX }, 300)
						.easing(Easing.Quadratic.In)
						.onComplete(() => {
							// 4) Llamar callback
							this.onComplete();
						})
						.start();
				});
			})
			.start();
	}

	/**
	 * Efecto de golpe en defensor: tint rojo momentáneo + shake.
	 * Devuelve Promise que se resuelve cuando termina.
	 */
	private hitEffectOnDefender(): Promise<void> {
		return new Promise((resolve) => {
			const sprite = this.defenderSprite;
			// Guardar tint original
			const originalTint = sprite.tint;
			// Tint rojo
			sprite.tint = 0xff4444;

			// Shake parameters
			const shakeMagnitude = 10;
			const shakeCount = 4;
			const singleShakeDuration = 50;

			let count = 0;
			// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
			const doShakeStep = () => {
				if (count >= shakeCount) {
					// Restaurar estado
					sprite.tint = originalTint;
					sprite.x = this.xOffset; // asegurarse en posición original
					resolve();
					return;
				}
				const dir = count % 2 === 0 ? -1 : 1;
				new Tween(sprite)
					.to({ x: this.xOffset + dir * shakeMagnitude }, singleShakeDuration)
					.easing(Easing.Linear.None)
					.onComplete(() => {
						// Volver a posición central
						new Tween(sprite)
							.to({ x: this.xOffset }, singleShakeDuration)
							.easing(Easing.Linear.None)
							.onComplete(() => {
								count++;
								doShakeStep();
							})
							.start();
					})
					.start();
			};

			doShakeStep();
		});
	}
}
