import type { Sprite } from "pixi.js";
import { Easing, Tween } from "tweedle.js";
import type { PlayerUnit } from "./IUnit";
import type { AllContainers } from "./AllContainers";

export class Animations {
	/**
	 * Aplica shake a un sprite: desplaza repetidamente la posición local en rangos [-magnitude, +magnitude],
	 * varias veces, y finalmente restaura la posición original.
	 * @param sprite El Sprite a sacudir.
	 * @param magnitude Máximo desplazamiento en px en cada eje.
	 * @param times Número de oscilaciones (ida y vuelta cuentan dentro de este número).
	 * @param durationPer Duración en ms de cada pequeño movimiento.
	 * @param onComplete Callback al finalizar todo el shake.
	 */
	public shakeSprite(sprite: Sprite, magnitude: number, times: number, durationPer: number, onComplete: () => void): void {
		const origX = sprite.x;
		const origY = sprite.y;
		let count = 0;

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const doShakeStep = () => {
			if (count >= times) {
				// Restaurar posición original con un tween rápido para evitar glitch
				const restoreTween = new Tween(sprite).to({ x: origX, y: origY }, durationPer).easing(Easing.Quadratic.Out);
				restoreTween.onComplete(() => {
					onComplete();
				});
				restoreTween.start();
				return;
			}
			// Generar un desplazamiento aleatorio en [-magnitude, +magnitude]
			const offsetX = (Math.random() * 2 - 1) * magnitude;
			const offsetY = (Math.random() * 2 - 1) * magnitude;
			// Tween desde la posición actual (que debería estar restaurada o en orig) a la nueva posición desplazada
			const shakeTween = new Tween(sprite).to({ x: origX + offsetX, y: origY + offsetY }, durationPer).easing(Easing.Quadratic.InOut);
			shakeTween.onComplete(() => {
				// Después de moverse, incrementamos contador y volvemos a iniciar otra oscilación
				count++;
				doShakeStep();
			});
			shakeTween.start();
		};

		// Iniciar primera oscilación
		doShakeStep();
	}

	/**
	 * Efecto visual cuando el ataque falla:
	 * - Texto flotante "Miss" en color amarillo.
	 * - Flash rápido del sprite del objetivo (tint).
	 * - Pequeña sacudida leve del atacante (opcional).
	 * @param attacker Unidad atacante.
	 * @param target Unidad objetivo que esquiva.
	 * @param onComplete Callback opcional cuando termina la animación de miss.
	 */
	public animateMissEffect(attacker: PlayerUnit, target: PlayerUnit, allContainers: AllContainers, tileSize: number, onComplete?: () => void): void {
		// 1) Mostrar texto flotante "Miss" sobre el objetivo
		allContainers.showFloatingText("Miss", target.sprite.x, target.sprite.y - tileSize * 0.3, 0xffff00);

		// 2) Flash / tint breve del objetivo:
		const sprite = target.sprite;
		const originalTint = sprite.tint;
		const flashTint = 0x999999; // color de flash (gris claro). Ajusta según tu estilo.
		const flashDuration = 200; // ms totales para tintar y restaurar

		// Tween para tint: primero a flashTint, luego de regreso a originalTint
		// Como Tween no trabaja directamente con tint en Pixi (tween de número funciona, pero interpolar tint puede verse raro),
		// haremos un setTimeout simple: tint inmediato, y restaurar tras delay.
		sprite.tint = flashTint;
		setTimeout(() => {
			sprite.tint = originalTint;
		}, flashDuration);

		// 3) Pequeña sacudida del atacante para indicar swing sin impacto
		// Podríamos usar shakeSprite con valores muy leves, o simplemente un avance y retroceso muy pequeño.
		const atkSprite = attacker.sprite;
		// Guardar posición original
		const atkOrigX = atkSprite.x;
		const atkOrigY = atkSprite.y;
		// Dirección hacia el target
		const dx = target.sprite.x - atkOrigX;
		const dy = target.sprite.y - atkOrigY;
		const dist = Math.hypot(dx, dy);
		const dirX = dist > 0 ? dx / dist : 0;
		const dirY = dist > 0 ? dy / dist : 0;
		const advanceDistance = 5; // px leve, menor que en golpe real
		const advanceDuration = 100; // ms para avanzar
		const retreatDuration = 100; // ms para retroceder

		// Tween avance:
		const advanceTween = new Tween(atkSprite)
			.to(
				{
					x: atkOrigX + dirX * advanceDistance,
					y: atkOrigY + dirY * advanceDistance,
				},
				advanceDuration
			)
			.easing(Easing.Quadratic.Out);

		advanceTween.onComplete(() => {
			// Al completar avance, retroceder:
			const retreatTween = new Tween(atkSprite).to({ x: atkOrigX, y: atkOrigY }, retreatDuration).easing(Easing.Quadratic.In);
			retreatTween.onComplete(() => {
				// Al terminar retroceso, invocamos onComplete si existe
				if (onComplete) {
					onComplete();
				}
			});
			retreatTween.start();
		});

		advanceTween.start();

		// Si no quieres sacudida del atacante, puedes omitir la parte de advanceTween y simplemente llamar onComplete tras flash:
		// setTimeout(() => { if (onComplete) onComplete(); }, flashDuration);
	}

	/**
	 * Anima el avance y retroceso del atacante y el shake del objetivo.
	 * @param attacker Unidad atacante
	 * @param target Unidad objetivo
	 * @param onComplete Callback cuando toda la animación finaliza
	 */
	public animateAttackEffect(attacker: PlayerUnit, target: PlayerUnit, onComplete: () => void): void {
		const atkSprite = attacker.sprite;
		const tgtSprite = target.sprite;

		// Guardar posiciones originales en pixeles
		const atkOrigX = atkSprite.x;
		const atkOrigY = atkSprite.y;
		const tgtOrigX = tgtSprite.x;
		const tgtOrigY = tgtSprite.y;

		// Calcular dirección desde atacante hacia objetivo
		const dx = tgtOrigX - atkOrigX;
		const dy = tgtOrigY - atkOrigY;
		const dist = Math.hypot(dx, dy);
		// Evitar división por cero; si están en la misma posición (caso raro), no mover atacante
		const dirX = dist > 0 ? dx / dist : 0;
		const dirY = dist > 0 ? dy / dist : 0;

		// Parámetros de animación; ajusta a tu gusto
		const advanceDistance = 10; // px que avanza el atacante hacia el enemigo
		const advanceDuration = 100; // ms para avanzar
		const retreatDuration = 100; // ms para volver
		const shakeMagnitude = 5; // px máximo de shake en cada dirección
		const shakeTimes = 4; // número de oscilaciones de shake
		const shakeDurationPer = 50; // ms por cada pequeño movimiento de shake

		// 1) Animar avance del atacante
		//    Con Tween, podemos animar directamente atkSprite.x / atkSprite.y hacia la posición avanzada:
		const advanceTween = new Tween(atkSprite)
			.to(
				{
					x: atkOrigX + dirX * advanceDistance,
					y: atkOrigY + dirY * advanceDistance,
				},
				advanceDuration
			)
			.easing(Easing.Quadratic.Out);

		// 2) Al completar avance, lanzar shake del objetivo y luego retroceso del atacante
		advanceTween.onComplete(() => {
			// Iniciar shake en el objetivo
			this.shakeSprite(tgtSprite, shakeMagnitude, shakeTimes, shakeDurationPer, () => {
				// Al completar shake, nada más; la posición del objetivo ya se restauró dentro de shakeSprite.

				// Ahora retrocedemos al atacante a su posición original
				const retreatTween = new Tween(atkSprite).to({ x: atkOrigX, y: atkOrigY }, retreatDuration).easing(Easing.Quadratic.In);

				retreatTween.onComplete(() => {
					// Toda la animación de ataque/retroceso y shake completada
					onComplete();
				});
				retreatTween.start();
			});
		});

		// Start advance tween
		advanceTween.start();
	}
}
