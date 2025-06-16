// EnemyAI.ts
import { Point } from "pixi.js";
import type { PlayerUnit } from "../Data/IUnit";
import type { PathFinder } from "./PathFinder";
import type { AttackRangeCalculator } from "./AttackRangeCalculator";

export class EnemyAI {
	private pathFinder: PathFinder;
	private attackCalc: AttackRangeCalculator;
	private animateMove: (unit: PlayerUnit, pathPts: Point[], destX: number, destY: number) => Promise<void>;
	private animateAttackAndDamage: (attacker: PlayerUnit, target: PlayerUnit) => Promise<void>;

	constructor(
		pathFinder: PathFinder,
		attackCalc: AttackRangeCalculator,
		animateMove: (unit: PlayerUnit, pathPts: Point[], destX: number, destY: number) => Promise<void>,
		animateAttackAndDamage: (att: PlayerUnit, tgt: PlayerUnit) => Promise<void>
	) {
		this.pathFinder = pathFinder;
		this.attackCalc = attackCalc;
		this.animateMove = animateMove;
		this.animateAttackAndDamage = animateAttackAndDamage;
	}

	/**
	 * Ejecuta la acción de un enemigo: movimiento + ataque.
	 * Retorna Promise que se resuelve al terminar animaciones.
	 */
	public async processEnemyAction(enemy: PlayerUnit, allyUnits: PlayerUnit[]): Promise<void> {
		// elegir objetivo
		const aliveAllies = allyUnits.filter((a) => a.healthPoints > 0);
		if (aliveAllies.length === 0) {
			return;
		}

		// 2) Si es jefe, solo chequeamos ataque en posición fija
		if (enemy.isBoss) {
			// Encontrar el objetivo más cercano (opcional, o podrías priorizar otro criterio)
			let bestAlly = aliveAllies[0];
			let bestDist = Math.abs(bestAlly.gridX - enemy.gridX) + Math.abs(bestAlly.gridY - enemy.gridY);
			for (const ally of aliveAllies) {
				const d = Math.abs(ally.gridX - enemy.gridX) + Math.abs(ally.gridY - enemy.gridY);
				if (d < bestDist) {
					bestDist = d;
					bestAlly = ally;
				}
			}
			// Calcular rango de ataque desde la posición actual
			const rangeSet = this.attackCalc.computeAttackRange(enemy);
			const keyAlly = `${bestAlly.gridX},${bestAlly.gridY}`;
			if (rangeSet.has(keyAlly)) {
				// Ataca directamente
				await this.animateAttackAndDamage(enemy, bestAlly);
			} else {
				// No puede atacar: se queda quieto, termina su turno sin moverse
				console.log(`${enemy.id} (boss) no tiene objetivos en rango, permanece en su celda.`);
			}
			return;
		}
		// buscar closest
		let bestAlly = aliveAllies[0];
		let bestDist = Math.abs(bestAlly.gridX - enemy.gridX) + Math.abs(bestAlly.gridY - enemy.gridY);
		for (const ally of aliveAllies) {
			const d = Math.abs(ally.gridX - enemy.gridX) + Math.abs(ally.gridY - enemy.gridY);
			if (d < bestDist) {
				bestDist = d;
				bestAlly = ally;
			}
		}
		// calcular rango desde posición actual
		const rangeSet = this.attackCalc.computeAttackRange(enemy);
		const keyAlly = `${bestAlly.gridX},${bestAlly.gridY}`;
		if (rangeSet.has(keyAlly)) {
			// ataca directamente
			await this.animateAttackAndDamage(enemy, bestAlly);
			return;
		}
		// no en rango: calcular movementRange
		const moveRange = this.pathFinder.computeMovementRange(enemy);
		// buscar casilla desde la que pueda atacar
		let chosenPath: Point[] | null = null;
		let destGrid: { x: number; y: number } | null = null;
		// Dentro de processEnemyAction:
		for (const k of moveRange) {
			const [cx, cy] = k.split(",").map((s) => parseInt(s, 10));
			// Crear un clon temporal que herede propiedades de enemy, pero posición simulada:
			const tempUnit = Object.assign(Object.create(Object.getPrototypeOf(enemy)), enemy);
			tempUnit.gridX = cx;
			tempUnit.gridY = cy;
			const r2 = this.attackCalc.computeAttackRange(tempUnit);
			if (r2.has(keyAlly)) {
				// Para hallar ruta necesitas la posición original: hacer otro clon o simplemente usar enemy original,
				// pero pasar un objeto “fakeOrigin” para no confundir pathFinder si lee enemy.gridX modificado:
				const fakeOrigin = Object.assign(Object.create(Object.getPrototypeOf(enemy)), enemy);
				fakeOrigin.gridX = enemy.gridX;
				fakeOrigin.gridY = enemy.gridY;
				const path = this.pathFinder.findPath(fakeOrigin, cx, cy);
				if (path) {
					chosenPath = path.map((n) => new Point(n.x, n.y));
					destGrid = { x: cx, y: cy };
					break;
				}
			}
			// No mutas enemy real aquí.
		}

		if (chosenPath && destGrid) {
			// Mover al enemigo a destGrid
			await this.animateMove(enemy, chosenPath, destGrid.x, destGrid.y);

			// Recalcular rango tras moverse:
			const rangeAfter = this.attackCalc.computeAttackRange(enemy);
			const keyAlly = `${bestAlly.gridX},${bestAlly.gridY}`;
			console.log("rangeAfter.has(keyAlly)", rangeAfter.has(keyAlly));
			if (rangeAfter.has(keyAlly)) {
				// Sólo ataca si quedó efectivamente en rango
				await this.animateAttackAndDamage(enemy, bestAlly);
			}
			return;
		}

		// si no puede atacar en un turno, moverse lo más cerca posible
		// buscar en moveRange la celda con menor distancia a bestAlly
		let bestCell: { x: number; y: number; dist: number } | null = null;
		for (const k of moveRange) {
			const [cx, cy] = k.split(",").map((s) => parseInt(s, 10));
			const d = Math.abs(cx - bestAlly.gridX) + Math.abs(cy - bestAlly.gridY);
			if (!bestCell || d < bestCell.dist) {
				bestCell = { x: cx, y: cy, dist: d };
			}
		}
		if (bestCell) {
			const path = this.pathFinder.findPath(enemy, bestCell.x, bestCell.y);
			if (path) {
				await this.animateMove(
					enemy,
					path.map((n) => new Point(n.x, n.y)),
					bestCell.x,
					bestCell.y
				);
			}
		}
		// no ataca
	}
}
