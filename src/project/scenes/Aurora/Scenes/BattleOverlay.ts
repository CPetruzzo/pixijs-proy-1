// BattleOverlay.ts
import { Graphics, Sprite, Text, TextStyle, Ticker } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import type { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import type { PlayerUnit } from "../Data/IUnit";

export interface BattleOverlayOptions {
	attackerAnimator?: StateMachineAnimator;
	defenderAnimator?: StateMachineAnimator;
	attackerUnit?: PlayerUnit; // agregamos
	defenderUnit?: PlayerUnit; // agregamos
	isCrit?: boolean;
	didMiss?: boolean;
	attackerOnLeft?: boolean;
	introDuration?: number;
	attackDuration?: number;
	resultDuration?: number;
	onComplete?: () => void;
	onHit?: () => void;
	// SFX opcionales:
	soundIntroKey?: string;
	soundAttackKey?: string;
	soundHitKey?: string;
	soundCritKey?: string;
	soundMissKey?: string;
	soundResultKey?: string;
}

export class BattleOverlay extends PixiScene {
	private attackerAnim?: StateMachineAnimator;
	private defenderAnim?: StateMachineAnimator;
	private onComplete?: () => void;
	private onHit?: () => void;
	private isCrit: boolean;
	private didMiss: boolean;
	private attackerOnLeft: boolean;

	private elapsed = 0;
	private phase: "intro" | "attack" | "result" = "intro";
	private introDuration: number;
	private attackDuration: number;
	private resultDuration: number;

	private introPlayed = false;
	private hitPlayed = false;

	private critText?: Text;

	// Posiciones para tween
	private attackerStartX = 0;
	private attackerEndX = 0;
	private attackMoveDistance = 250; // píxeles a avanzar durante ataque

	// SFX keys
	private soundIntroKey?: string;
	private soundAttackKey?: string;
	private soundHitKey?: string;
	private soundCritKey?: string;
	private soundMissKey?: string;
	private soundResultKey?: string;

	// Nuevas para hitstop y shake
	private hitStopDuration = 0.1; // segundos de pausa breve
	private hitStopElapsed = 0;
	private inHitStop = false;

	private shakeDuration = 0.2; // segundos de shake
	private shakeElapsed = 0;
	private defenderOriginalX = 0;
	private defenderOriginalY = 0;

	// Textos:
	private attackerNameText?: Text;
	private defenderNameText?: Text;
	private attackerStatsText?: Text;
	private defenderStatsText?: Text;

	constructor(options: BattleOverlayOptions) {
		super();

		const {
			attackerAnimator,
			defenderAnimator,
			attackerUnit,
			defenderUnit,
			isCrit = false,
			didMiss = false,
			attackerOnLeft = true,
			introDuration = 1,
			attackDuration = 1.5,
			resultDuration = 1.5,
			onComplete,
			onHit,
			soundIntroKey,
			soundAttackKey,
			soundHitKey,
			soundCritKey,
			soundMissKey,
			soundResultKey,
		} = options;

		this.onComplete = onComplete;
		this.onHit = onHit;
		this.isCrit = isCrit;
		this.didMiss = didMiss;
		this.attackerOnLeft = attackerOnLeft;
		this.introDuration = introDuration;
		this.attackDuration = attackDuration;
		this.resultDuration = resultDuration;

		this.soundIntroKey = soundIntroKey;
		this.soundAttackKey = soundAttackKey;
		this.soundHitKey = soundHitKey;
		this.soundCritKey = soundCritKey;
		this.soundMissKey = soundMissKey;
		this.soundResultKey = soundResultKey;

		// Fondo semitransparente y decorativo...
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.5).drawRect(-800, -600, 1600, 1200).endFill();
		this.addChild(bg);

		const sprBg = Sprite.from("battle2");
		sprBg.alpha = 0.7;
		sprBg.anchor.set(0.5);
		this.addChild(sprBg);

		// Offset base para posicionar animators
		const offsetX = 150;
		const offsetY = 30;

		// --- Configurar attackerAnimator ---
		if (attackerAnimator) {
			this.attackerAnim = attackerAnimator;
			this.attackerAnim.scale.set(0.5);
			this.attackerAnim.playState("idle");

			if (this.attackerOnLeft) {
				this.attackerStartX = -offsetX;
				this.attackerEndX = this.attackerStartX + this.attackMoveDistance;
				this.attackerAnim.scale.x = Math.abs(this.attackerAnim.scale.x);
			} else {
				this.attackerStartX = offsetX;
				this.attackerEndX = this.attackerStartX - this.attackMoveDistance;
				this.attackerAnim.scale.x = -Math.abs(this.attackerAnim.scale.x);
			}
			this.attackerAnim.x = this.attackerStartX;
			this.attackerAnim.y = offsetY;
			this.attackerAnim.alpha = 0;
			this.addChild(this.attackerAnim);
		}

		// --- Configurar defenderAnimator ---
		if (defenderAnimator) {
			this.defenderAnim = defenderAnimator;
			this.defenderAnim.scale.set(0.5);
			this.defenderAnim.playState("idle");
			if (this.attackerOnLeft) {
				this.defenderAnim.x = offsetX;
				this.defenderAnim.scale.x = -Math.abs(this.defenderAnim.scale.x);
			} else {
				this.defenderAnim.x = -offsetX;
				this.defenderAnim.scale.x = Math.abs(this.defenderAnim.scale.x);
			}
			this.defenderAnim.y = offsetY;
			this.defenderAnim.alpha = 0;
			this.addChild(this.defenderAnim);
			// Guardar posición original para shake
			this.defenderOriginalX = this.defenderAnim.x;
			this.defenderOriginalY = this.defenderAnim.y;
		}

		// --- Crear textos de nombre y stats si hay unidades ---
		const textStyleName = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fill: "#ffffff",
			fontSize: 50,
			stroke: "#000000",
			strokeThickness: 3,
		});
		const textStyleStats = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fill: "#ffff88",
			fontSize: 40,
			stroke: "#000000",
			strokeThickness: 2,
			lineHeight: 50,
		});

		// Definir posiciones fijas en UI para textos de atacante y defensor, según attackerOnLeft.
		// Ajusta estos valores (x, y) según tu layout de UI.
		// Ejemplo: si tu UI es de 1600px ancho centrada en 0, puedes usar:
		const fixedYName = -450; // altura en UI para mostrar nombres
		const fixedYStats = 230; // altura en UI para mostrar stats (debajo o encima del nombre)
		// Para X, elegimos una posición a la izquierda o derecha:
		// Por ejemplo, si attackerOnLeft, ponemos atacante en -400 y defensor en +400; si no, viceversa.
		const attackerNameX = this.attackerOnLeft ? -650 : 650;
		const attackerStatsX = attackerNameX;
		const defenderNameX = this.attackerOnLeft ? 650 : -650;
		const defenderStatsX = defenderNameX;

		if (attackerUnit) {
			const name = attackerUnit.id;
			const strength = attackerUnit.strength;
			const critPct = Math.round(attackerUnit.criticalChance * 100);
			const avoidPct = Math.round(attackerUnit.avoid * 100);

			this.attackerNameText = new Text(name, textStyleName);
			this.attackerStatsText = new Text(`STR: ${strength}\nCRIT: ${critPct}%\nAVO: ${avoidPct}%`, textStyleStats);
			// Anchor centrado horizontal, verticalmente podemos anclar arriba (0) o centro (0.5). Aquí anclamos (0.5, 0) para que la posición sea su punto medio superior.
			this.attackerNameText.anchor.set(0.5, 0);
			this.attackerStatsText.anchor.set(0.5, 0);

			// Asignar posición fija según attackerOnLeft:
			this.attackerNameText.x = attackerNameX;
			this.attackerNameText.y = fixedYName;
			this.attackerStatsText.x = attackerStatsX;
			this.attackerStatsText.y = fixedYStats;

			// Inicialmente alpha 0 (para fade-in)
			this.attackerNameText.alpha = 0;
			this.attackerStatsText.alpha = 0;
			this.addChild(this.attackerNameText);
			this.addChild(this.attackerStatsText);
		}

		if (defenderUnit) {
			const name = defenderUnit.id;
			const strength = defenderUnit.strength;
			const critPct = Math.round(defenderUnit.criticalChance * 100);
			const avoidPct = Math.round(defenderUnit.avoid * 100);

			this.defenderNameText = new Text(name, textStyleName);
			this.defenderStatsText = new Text(`STR: ${strength}\nCRIT: ${critPct}%\nAVO: ${avoidPct}%`, textStyleStats);
			this.defenderNameText.anchor.set(0.5, 0);
			this.defenderStatsText.anchor.set(0.5, 0);

			// Posición fija según attackerOnLeft (inversa a la del atacante)
			this.defenderNameText.x = defenderNameX;
			this.defenderNameText.y = fixedYName;
			this.defenderStatsText.x = defenderStatsX;
			this.defenderStatsText.y = fixedYStats;

			this.defenderNameText.alpha = 0;
			this.defenderStatsText.alpha = 0;
			this.addChild(this.defenderNameText);
			this.addChild(this.defenderStatsText);
		}

		// Texto crítico si aplica...
		if (this.isCrit) {
			const critText = new Text(
				"CRÍTICO!",
				new TextStyle({
					fontFamily: "Pixelate-Regular",
					fill: "#ff0000",
					fontSize: 36,
					stroke: "#000000",
					strokeThickness: 4,
				})
			);
			critText.anchor.set(0.5);
			// Ubicar el texto crítico en un lugar fijo de UI (por ejemplo arriba-centro):
			critText.x = 0;
			critText.y = -250;
			critText.alpha = 0;
			this.critText = critText;
			this.addChild(this.critText);
		}

		// Registrar update en ticker
		Ticker.shared.add(this.update, this);
	}

	public override update(_deltaFrame: number): void {
		const dt = Ticker.shared.deltaMS / 1000;
		this.elapsed += dt;

		switch (this.phase) {
			case "intro":
				if (!this.introPlayed) {
					this.introPlayed = true;
					if (this.soundIntroKey) {
						SoundLib.playSound(this.soundIntroKey, {});
					}
				}
				if (this.elapsed < this.introDuration) {
					const t = this.elapsed / this.introDuration;
					if (this.attackerAnim) {
						this.attackerAnim.alpha = t;
					}
					if (this.defenderAnim) {
						this.defenderAnim.alpha = t;
					}
					if (this.attackerNameText) {
						this.attackerNameText.alpha = t;
					}
					if (this.attackerStatsText) {
						this.attackerStatsText.alpha = t;
					}
					if (this.defenderNameText) {
						this.defenderNameText.alpha = t;
					}
					if (this.defenderStatsText) {
						this.defenderStatsText.alpha = t;
					}
					if (this.critText) {
						this.critText.alpha = t;
					}
				} else {
					// Al completar intro, fijar alpha=1 y pasar a attack
					if (this.attackerAnim) {
						this.attackerAnim.alpha = 1;
					}
					if (this.defenderAnim) {
						this.defenderAnim.alpha = 1;
					}
					if (this.attackerNameText) {
						this.attackerNameText.alpha = 1;
					}
					if (this.attackerStatsText) {
						this.attackerStatsText.alpha = 1;
					}
					if (this.defenderNameText) {
						this.defenderNameText.alpha = 1;
					}
					if (this.defenderStatsText) {
						this.defenderStatsText.alpha = 1;
					}
					if (this.critText) {
						this.critText.alpha = 1;
					}
					this.phase = "attack";
					this.elapsed = 0;
					this.hitPlayed = false;
					this.hitStopElapsed = 0;
					this.inHitStop = false;
					this.shakeElapsed = 0;

					// SFX inicio de ataque
					if (this.soundAttackKey) {
						SoundLib.playSound(this.soundAttackKey, {});
					}
					// SFX crítico
					if (this.isCrit && this.soundCritKey) {
						SoundLib.playSound(this.soundCritKey, {});
					}
					// Mostrar “CRÍTICO!” brevemente
					if (this.isCrit && this.critText) {
						this.critText.alpha = 1;
						setTimeout(() => {
							if (this.critText) {
								this.critText.alpha = 0;
							}
						}, 500);
					}
					// Empezar anim de ataque
					if (this.attackerAnim && this.attackerAnim.hasState("attack")) {
						this.attackerAnim.playState("attack");
					}
				}
				break;

			case "attack":
				// Hitstop
				if (this.inHitStop) {
					this.hitStopElapsed += dt;
					if (this.hitStopElapsed >= this.hitStopDuration) {
						this.inHitStop = false;
					}
				} else {
					// Tween de movimiento atacante
					if (this.attackerAnim) {
						const t = this.elapsed / this.attackDuration;
						const easedT = Math.min(1, (1 - Math.cos(Math.PI * t)) / 2);
						this.attackerAnim.x = this.attackerStartX + easedT * (this.attackerEndX - this.attackerStartX);
					}
				}

				// Momento medio: onHit, shake y anim defensor
				const half = this.attackDuration / 2;
				if (this.elapsed >= half && !this.hitPlayed) {
					this.hitPlayed = true;
					// Llamar onHit para aplicar daño
					if (this.onHit) {
						this.onHit();
					}
					// Iniciar hitstop
					this.inHitStop = true;
					this.hitStopElapsed = 0;
					// Iniciar shake defensor
					this.shakeElapsed = 0;
					// Anim defensor: hit o miss
					if (this.defenderAnim) {
						if (this.didMiss) {
							if (this.defenderAnim.hasState("miss")) {
								this.defenderAnim.playState("miss");
							} else {
								this.defenderAnim.tint = 0xaaaaaa;
							}
						} else {
							if (this.defenderAnim.hasState("hit")) {
								this.defenderAnim.playState("hit");
							} else {
								this.defenderAnim.tint = 0xff0000;
							}
						}
					}
					// SFX impacto o miss
					if (this.didMiss) {
						if (this.soundMissKey) {
							SoundLib.playSound(this.soundMissKey, {});
						}
					} else {
						if (!this.isCrit && this.soundHitKey) {
							SoundLib.playSound(this.soundHitKey, {});
						}
					}
				}

				// Shake defensor
				if (this.shakeElapsed < this.shakeDuration) {
					this.shakeElapsed += dt;
					if (this.defenderAnim) {
						const magnitude = 5;
						const dx = (Math.random() * 2 - 1) * magnitude * (1 - this.shakeElapsed / this.shakeDuration);
						const dy = (Math.random() * 2 - 1) * magnitude * (1 - this.shakeElapsed / this.shakeDuration);
						this.defenderAnim.x = this.defenderOriginalX + dx;
						this.defenderAnim.y = this.defenderOriginalY + dy;
					}
				} else {
					if (this.defenderAnim) {
						this.defenderAnim.x = this.defenderOriginalX;
						this.defenderAnim.y = this.defenderOriginalY;
						this.defenderAnim.tint = 0xffffff;
					}
				}

				// Fin de fase ataque
				if (this.elapsed >= this.attackDuration) {
					if (this.attackerAnim) {
						this.attackerAnim.x = this.attackerStartX;
						if (this.attackerAnim.hasState("idle")) {
							this.attackerAnim.playState("idle");
						}
					}
					if (this.defenderAnim) {
						this.defenderAnim.tint = 0xffffff;
						if (this.defenderAnim.hasState("idle")) {
							this.defenderAnim.playState("idle");
						}
						this.defenderAnim.x = this.defenderOriginalX;
						this.defenderAnim.y = this.defenderOriginalY;
					}
					this.phase = "result";
					this.elapsed = 0;
					if (this.soundResultKey) {
						SoundLib.playSound(this.soundResultKey, {});
					}
				}
				break;

			case "result":
				if (this.elapsed < this.resultDuration) {
					const t = this.elapsed / this.resultDuration;
					this.alpha = 1 - t;
				} else {
					this.cleanup();
					if (this.onComplete) {
						this.onComplete();
					}
				}
				break;
		}
	}

	private cleanup(): void {
		Ticker.shared.remove(this.update, this);
		// Restaurar tint/posiciones si es necesario
		if (this.defenderAnim) {
			this.defenderAnim.tint = 0xffffff;
			this.defenderAnim.x = this.defenderOriginalX;
			this.defenderAnim.y = this.defenderOriginalY;
		}
		if (this.attackerAnim) {
			this.attackerAnim.x = this.attackerStartX;
			if (this.attackerAnim.hasState("idle")) {
				this.attackerAnim.playState("idle");
			}
		}
	}
}
