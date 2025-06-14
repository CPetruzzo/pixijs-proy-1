// InputHandler.ts
import { Keyboard } from "../../../engine/input/Keyboard";
import { GamePhase } from "./PhaseManager";

export interface InputCallbacks {
	onSelect(): void;
	onConfirmMove(): void;
	onSkipAttack(): void;
	onAttack(): void;
	onProceedAfterAction(): void;
	onMoveSelector(dx: number, dy: number): void;
	onCancel(): void; // new callback for Escape
}

export class InputHandler {
	private callbacks: InputCallbacks;
	constructor(callbacks: InputCallbacks) {
		this.callbacks = callbacks;
	}

	public update(gamePhase: GamePhase): void {
		if (Keyboard.shared.justPressed("ArrowUp")) {
			this.callbacks.onMoveSelector(0, -1);
		}
		if (Keyboard.shared.justPressed("ArrowDown")) {
			this.callbacks.onMoveSelector(0, +1);
		}
		if (Keyboard.shared.justPressed("ArrowLeft")) {
			this.callbacks.onMoveSelector(-1, 0);
		}
		if (Keyboard.shared.justPressed("ArrowRight")) {
			this.callbacks.onMoveSelector(+1, 0);
		}
		if (Keyboard.shared.justPressed("Enter")) {
			switch (gamePhase) {
				case GamePhase.SELECT:
					this.callbacks.onSelect();
					break;
				case GamePhase.MOVE:
					this.callbacks.onConfirmMove();
					break;
				case GamePhase.ATTACK:
					this.callbacks.onSkipAttack();
					break;
				case GamePhase.END:
					this.callbacks.onProceedAfterAction();
					break;
			}
		}
		if (Keyboard.shared.justPressed("KeyQ") && gamePhase === GamePhase.ATTACK) {
			this.callbacks.onAttack();
		}

		if (Keyboard.shared.justPressed("Escape")) {
			this.callbacks.onCancel();
		}
	}
}
