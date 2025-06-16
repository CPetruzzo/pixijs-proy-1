// BattleOverlay.ts
import type { Texture } from "pixi.js";
import { Container, Sprite, Text, TextStyle, Ticker } from "pixi.js";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export interface BattleOverlayOptions {
	attackerTex?: Texture | string;
	defenderTex?: Texture | string;
	isCrit?: boolean;
	onComplete?: () => void;
	// opcional: puedes añadir parámetros de animación (duraciones, offsets, etc.)
}

export class BattleOverlay extends Container {
	private attackerSprite: Sprite;
	private defenderSprite: Sprite;
	private onComplete?: () => void;
	private isCrit: boolean;
	private elapsed = 0;
	private phase: "intro" | "attack" | "result" = "intro";
	// duraciones en segundos (puedes ajustar):
	private introDuration = 0.5;
	private attackDuration = 0.7;
	private resultDuration = 0.5;

	constructor(options: BattleOverlayOptions) {
		super();

		const { attackerTex, defenderTex, isCrit = false, onComplete } = options;
		this.onComplete = onComplete;
		this.isCrit = isCrit;

		// Fondo semitransparente para oscurecer atrás (opcional):
		// const bg = new Graphics();
		// bg.beginFill(0x000000, 0.5).drawRect(0, 0, window.innerWidth, window.innerHeight).endFill();
		// this.addChild(bg);

		// Sprites de atacante y defensor:
		// Se colocan a izquierda y derecha. Ajusta posición según tu worldContainer o tamaño de vista.
		this.attackerSprite = Sprite.from(attackerTex || "defaultAttackerTextureKey");
		this.defenderSprite = Sprite.from(defenderTex || "defaultDefenderTextureKey");

		// Anchor centrado:
		this.attackerSprite.anchor.set(0.5);
		this.defenderSprite.anchor.set(0.5);

		// Escala (ajusta según tus sprites):
		this.attackerSprite.scale.set(0.5);
		this.defenderSprite.scale.set(0.5);

		// Como esto se añade a worldContainer centrado, podemos asumir (0,0) en el centro:
		// Mejor posicionar relativo al contenedor padre en la escena al añadir.
		// Aquí, inicialmente, ponemos en 0, luego cuando se añada, la escena ajustará posición.

		// Para facilitar, asumimos que esta clase se añade a un contenedor ya centrado, y:
		// atacante a x = -offsetX, defensor a x = +offsetX:
		const offsetX = 200; // ajusta según tu diseño
		const offsetY = 0;
		this.attackerSprite.x = -offsetX;
		this.attackerSprite.y = offsetY;
		this.defenderSprite.x = offsetX;
		this.defenderSprite.y = offsetY;

		// Inicialmente invisibles o con alpha 0 para animar fade-in:
		this.attackerSprite.alpha = 0;
		this.defenderSprite.alpha = 0;

		this.addChild(this.attackerSprite);
		this.addChild(this.defenderSprite);

		// Opcional: texto “CRÍTICO!” o algún indicador:
		if (this.isCrit) {
			const critText = new Text(
				"CRÍTICO!",
				new TextStyle({
					fill: "#ff0000",
					fontSize: 36,
					stroke: "#000000",
					strokeThickness: 4,
				})
			);
			critText.anchor.set(0.5);
			critText.x = 0;
			critText.y = -100; // arriba de los sprites
			critText.alpha = 0;
			this.addChild(critText);
			// Lo animaremos en fase apropiada
		}

		// Opcional: reproducir un sonido de inicio de batalla:

		// Registrar ticker para animar fases:
		Ticker.shared.add(this.update, this);
	}

	private update(_deltaFrame: number): void {
		// deltaFrame es velocidad relativa. Convertimos a segundos aproximados:
		const dt = Ticker.shared.deltaMS / 1000; // segundos desde último frame
		this.elapsed += dt;

		switch (this.phase) {
			case "intro":
				// Fade in ambos sprites:
				if (this.elapsed < this.introDuration) {
					const t = this.elapsed / this.introDuration;
					this.attackerSprite.alpha = t;
					this.defenderSprite.alpha = t;
				} else {
					// transitar a fase ataque
					this.attackerSprite.alpha = 1;
					this.defenderSprite.alpha = 1;
					this.phase = "attack";
					this.elapsed = 0;
					// Opcional: un tint momentáneo o shake en crítico:
					if (this.isCrit) {
						this.attackerSprite.tint = 0xffaaaa;
						this.defenderSprite.tint = 0xffaaaa;
						// quitar tint tras un breve delay:
						setTimeout(() => {
							this.attackerSprite.tint = 0xffffff;
							this.defenderSprite.tint = 0xffffff;
						}, 200);
						// Mostrar texto “CRÍTICO!”:
						// Si guardaste la referencia:
						// critText.alpha = 1; y luego fade out...
						// (En este ejemplo no nombramos, pero podrías guardarlo en una propiedad)
					}
					// Reproducir sonido de ataque:
				}
				break;

			case "attack":
				// Durante ataque, podrías hacer una pequeña animación: e.g. mover atacante hacia defensor y volver.
				// Simplificamos con un tiempo fijo:
				if (this.elapsed < this.attackDuration) {
					const t = this.elapsed / this.attackDuration;
					// Ejemplo: atacante avanza un poco y retrocede: un “punch”:
					const moveDist = 30;
					const phase = Math.sin(t * Math.PI); // avanza y retrocede suavemente
					this.attackerSprite.x = -200 + moveDist * phase;
					// Defender podría hacer un pequeño tint o shake si es golpeado:
					if (t > 0.4 && t < 0.6) {
						this.defenderSprite.tint = 0xff0000;
					} else {
						this.defenderSprite.tint = 0xffffff;
					}
				} else {
					// Termina animación de ataque
					this.attackerSprite.x = -200;
					this.defenderSprite.tint = 0xffffff;
					this.phase = "result";
					this.elapsed = 0;
					// Reproducir sonido de golpe recibido:
					SoundLib.playSound("performAtk_SFX", {});
				}
				break;

			case "result":
				// Mostrar algún efecto final (por ej. fade out del overlay o flash)
				if (this.elapsed < this.resultDuration) {
					const t = this.elapsed / this.resultDuration;
					// opcional: fade out gradual:
					this.alpha = 1 - t;
				} else {
					// Limpieza final
					this.cleanup();
					// Llamar callback para aplicar daño y continuar turno:
					if (this.onComplete) {
						this.onComplete();
					}
				}
				break;
		}
	}

	private cleanup(): void {
		// Detach ticker:
		Ticker.shared.remove(this.update, this);
		// Remover hijos, si es necesario:
		// this.removeChildren();
		// Opcional: destruir texturas o recursos?
	}
}
