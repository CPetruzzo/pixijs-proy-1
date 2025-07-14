// TurnManager.ts
import type { PlayerUnit } from "../Data/IUnit";

export interface TurnCallbacks {
	onAllySelectNext: (unit: PlayerUnit | null) => void;
	onStartEnemyTurn: () => void;
	onStartAllyTurn: () => void;
	onTurnChange?: (side: TurnSide) => void;
}

export enum TurnSide {
	ALLY = "CONQUISTADOR",
	ENEMY = "QUILMES",
}

export class TurnManager {
	private allyUnits: PlayerUnit[];
	private enemyUnits: PlayerUnit[];
	private currentSide: TurnSide = TurnSide.ALLY;
	// callbacks para la escena:
	private callbacks: TurnCallbacks;

	constructor(allyUnits: PlayerUnit[], enemyUnits: PlayerUnit[], callbacks: TurnCallbacks) {
		this.allyUnits = allyUnits;
		this.enemyUnits = enemyUnits;
		this.callbacks = callbacks;
	}

	public startAllyTurn(): void {
		this.currentSide = TurnSide.ALLY;
		// reset flags:
		this.allyUnits.forEach((u) => {
			u.hasActed = false;
			u.hasHealedFortress = false;
		});
		// notificar cambio de turno
		if (this.callbacks.onTurnChange) {
			this.callbacks.onTurnChange(this.currentSide);
		}
		// notificar inicio de turno aliado
		if (this.callbacks.onStartAllyTurn) {
			this.callbacks.onStartAllyTurn();
		}
		// seleccionar siguiente aliado
		const next = this.allyUnits.find((u) => !u.hasActed) || null;
		this.callbacks.onAllySelectNext(next);
	}

	public endCurrentAction(): void {
		if (this.currentSide === TurnSide.ALLY) {
			const next = this.allyUnits.find((u) => !u.hasActed) || null;
			if (next) {
				this.callbacks.onAllySelectNext(next);
			} else {
				this.startEnemyTurn();
			}
		} else {
			const nextE = this.enemyUnits.find((u) => !u.hasActed) || null;
			if (nextE) {
				// la IA se encarga de procesar siguiente enemigo
				// la escena/AIController lo llama:
				// this.callbacks.onStartEnemyAction(nextE)
			} else {
				this.startAllyTurn();
			}
		}
	}

	public startEnemyTurn(): void {
		this.currentSide = TurnSide.ENEMY;
		this.enemyUnits.forEach((u) => (u.hasActed = false));
		if (this.callbacks.onTurnChange) {
			this.callbacks.onTurnChange(this.currentSide);
		}
		this.callbacks.onStartEnemyTurn();
		// IAController arrancará la secuencia
	}

	public getCurrentSide(): TurnSide {
		return this.currentSide;
	}
}
