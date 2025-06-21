// BattleOverlay.ts
import { Graphics, Sprite, Text, TextStyle, Ticker } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import type { StateMachineAnimator } from "../../../../engine/animation/StateMachineAnimation";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export interface BattleOverlayOptions {
	attackerAnimator?: StateMachineAnimator;
	defenderAnimator?: StateMachineAnimator;
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

	constructor(options: BattleOverlayOptions) {
		super();

		const {
			attackerAnimator,
			defenderAnimator,
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

		// Fondo semitransparente
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.5).drawRect(-800, -600, 1600, 1200).endFill();
		this.addChild(bg);

		// Fondo decorativo
		const sprBg = Sprite.from("battle2");
		sprBg.alpha = 0.7;
		sprBg.anchor.set(0.5);
		this.addChild(sprBg);

		// Offset para posicionar animators
		const offsetX = 150;
		const offsetY = 30;

		// Configurar attackerAnimator
		if (attackerAnimator) {
			this.attackerAnim = attackerAnimator;
			this.attackerAnim.scale.set(0.5);
			this.attackerAnim.playState("idle");

			// Decidir posición inicial y final para el tween
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

		// Configurar defenderAnimator
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

		// Texto crítico si aplica
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
			critText.x = 0;
			critText.y = -100;
			critText.alpha = 0;
			this.critText = critText;
			this.addChild(critText);
		}

		// Registrar update en ticker
		Ticker.shared.add(this.update, this);
	}

	public override update(_deltaFrame: number): void {
		const dt = Ticker.shared.deltaMS / 1000;
		this.elapsed += dt;

		switch (this.phase) {
			case "intro":
				// Reproducir SFX intro solo una vez al inicio
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
					if (this.critText) {
						this.critText.alpha = t;
					}
				} else {
					// Pasar a fase ataque
					if (this.attackerAnim) {
						this.attackerAnim.alpha = 1;
					}
					if (this.defenderAnim) {
						this.defenderAnim.alpha = 1;
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

					// Reproducir SFX de inicio de ataque
					if (this.soundAttackKey) {
						SoundLib.playSound(this.soundAttackKey, {});
					}
					// Si crítico, reproducir SFX de crítico
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
				// Si estamos en hitstop, contamos su tiempo y no avanzamos tween
				if (this.inHitStop) {
					this.hitStopElapsed += dt;
					if (this.hitStopElapsed >= this.hitStopDuration) {
						this.inHitStop = false;
						// reanudar movimiento: no reseteamos elapsed, pero en siguientes frames permitimos tween
					}
				} else {
					// Tween de movimiento del atacante
					if (this.attackerAnim) {
						// Solo si no en hitstop
						const t = this.elapsed / this.attackDuration;
						// Easing in-out: 0 → 1
						const easedT = Math.min(1, (1 - Math.cos(Math.PI * t)) / 2);
						this.attackerAnim.x = this.attackerStartX + easedT * (this.attackerEndX - this.attackerStartX);
					}
				}

				// En el momento medio, disparar hit/miss anim, sonido, onHit, hitstop y shake, solo una vez
				const half = this.attackDuration / 2;
				if (this.elapsed >= half && !this.hitPlayed) {
					this.hitPlayed = true;
					// 1) Llamar callback onHit para aplicar daño o miss text
					if (this.onHit) {
						this.onHit();
					}

					// 2) Iniciar hitstop
					this.inHitStop = true;
					this.hitStopElapsed = 0;

					// 3) Iniciar shake en defensor
					this.shakeElapsed = 0;

					// 4) Anim defensor: hit o miss
					if (this.defenderAnim) {
						if (this.didMiss) {
							if (this.defenderAnim.hasState("miss")) {
								this.defenderAnim.playState("miss");
							} else {
								// tint o gris momentáneo
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
					// 5) Reproducir sonido de impacto o miss
					if (this.didMiss) {
						if (this.soundMissKey) {
							SoundLib.playSound(this.soundMissKey, {});
						}
					} else {
						if (this.isCrit) {
							// opcional reproducir extra en impacto
						} else {
							if (this.soundHitKey) {
								SoundLib.playSound(this.soundHitKey, {});
							}
						}
					}
				}

				// Mientras dure shake, aplicamos offsets aleatorios pequeños
				if (this.shakeElapsed < this.shakeDuration) {
					this.shakeElapsed += dt;
					if (this.defenderAnim) {
						const magnitude = 5; // píxeles de desplazamiento máximo
						const dx = (Math.random() * 2 - 1) * magnitude * (1 - this.shakeElapsed / this.shakeDuration);
						const dy = (Math.random() * 2 - 1) * magnitude * (1 - this.shakeElapsed / this.shakeDuration);
						this.defenderAnim.x = this.defenderOriginalX + dx;
						this.defenderAnim.y = this.defenderOriginalY + dy;
					}
				} else {
					// Al terminar shake, restauramos posición original
					if (this.defenderAnim) {
						this.defenderAnim.x = this.defenderOriginalX;
						this.defenderAnim.y = this.defenderOriginalY;
						// Si usamos tint momentáneo, restaurar:
						this.defenderAnim.tint = 0xffffff;
					}
				}

				// Finalmente, si la fase ataque completa:
				if (this.elapsed >= this.attackDuration) {
					// Reset y transición a fase final
					if (this.attackerAnim) {
						this.attackerAnim.x = this.attackerStartX;
						if (this.attackerAnim.hasState("idle")) {
							this.attackerAnim.playState("idle");
						}
					}
					if (this.defenderAnim) {
						// Asegurar restaurar tint en caso que no lo haya hecho:
						this.defenderAnim.tint = 0xffffff;
						if (this.defenderAnim.hasState("idle")) {
							this.defenderAnim.playState("idle");
						}
						// Restaurar posición final tras shake
						this.defenderAnim.x = this.defenderOriginalX;
						this.defenderAnim.y = this.defenderOriginalY;
					}
					this.phase = "result";
					this.elapsed = 0;
					// Sonido de resultado
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
