// InputHandler.ts
import { Keyboard } from "../../../../engine/input/Keyboard";
import { GamePhase } from "../Managers/PhaseManager";

export interface InputCallbacks {
	onSelect(): void;
	onChoice(): void; // al presionar Enter en SELECT: abrir menú de acción
	onNavigateMenu(delta: number): void; // navegar opciones arriba/abajo en CHOICE
	onConfirmMenu(): void; // confirmar opción en CHOICE
	onConfirmMove(): void;
	onSkipAttack(): void;
	onAttack(): void;
	onProceedAfterAction(): void;
	onMoveSelector(dx: number, dy: number): void;
	onCancel(): void; // Escape
}

export class InputHandler {
	private callbacks: InputCallbacks;
	constructor(callbacks: InputCallbacks) {
		this.callbacks = callbacks;
	}

	public update(gamePhase: GamePhase): void {
		// Navegación de menú vs mover selector en mapa
		if (Keyboard.shared.justPressed("ArrowUp")) {
			if (gamePhase === GamePhase.CHOICE) {
				this.callbacks.onNavigateMenu(-1);
			} else {
				this.callbacks.onMoveSelector(0, -1);
			}
		}
		if (Keyboard.shared.justPressed("ArrowDown")) {
			if (gamePhase === GamePhase.CHOICE) {
				this.callbacks.onNavigateMenu(+1);
			} else {
				this.callbacks.onMoveSelector(0, +1);
			}
		}
		if (Keyboard.shared.justPressed("ArrowLeft")) {
			// En CHOICE no hacemos moveSelector a la izquierda; solo en mapa
			if (gamePhase !== GamePhase.CHOICE) {
				this.callbacks.onMoveSelector(-1, 0);
			}
		}
		if (Keyboard.shared.justPressed("ArrowRight")) {
			if (gamePhase !== GamePhase.CHOICE) {
				this.callbacks.onMoveSelector(+1, 0);
			}
		}

		if (Keyboard.shared.justPressed("Enter")) {
			switch (gamePhase) {
				case GamePhase.SELECT:
					// en SELECT, abrimos menú de acción
					this.callbacks.onChoice();
					break;
				case GamePhase.CHOICE:
					// confirmamos la opción elegida
					this.callbacks.onConfirmMenu();
					break;
				case GamePhase.MOVE:
					this.callbacks.onConfirmMove();
					break;

				case GamePhase.END:
					this.callbacks.onProceedAfterAction();
					break;
				default:
					break;
			}
		}
		if (Keyboard.shared.justPressed("Enter") && gamePhase === GamePhase.ATTACK) {
			this.callbacks.onAttack();
		}

		if (Keyboard.shared.justPressed("Escape")) {
			this.callbacks.onCancel();
		}
	}
}
