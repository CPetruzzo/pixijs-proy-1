import { Graphics, Text, TextStyle } from "pixi.js";
import type { AllContainers } from "../Utils/AllContainers";

export enum DialoguePhase {
	DIALOG0,
	DIALOG1,
	DIALOG2,
	DIALOG3,
}

export enum GamePhase {
	SELECT,
	CHOICE,
	MOVE,
	MOVING,
	ATTACK,
	END,
}

export class PhaseManager {
	public phaseText!: Text;
	public gamePhase: GamePhase = GamePhase.SELECT;

	public initPhaseText(allContainers: AllContainers): void {
		// 1) Añadimos el text de fase en la UI
		const style = new TextStyle({
			fill: "#ffffff",
			fontSize: 18,
			fontWeight: "bold",
		});
		this.phaseText = new Text("", style);
		// Posición fija en la esquina superior izquierda de la ventana:
		this.phaseText.x = 10;
		this.phaseText.y = 10;
		allContainers.uiContainer.addChild(this.phaseText);

		const bg = new Graphics();
		bg.beginFill(0x000000, 0.5).drawRect(0, 0, 150, 24).endFill();
		allContainers.uiContainer.addChild(bg);
		allContainers.uiContainer.addChild(this.phaseText);
		this.phaseText.x = 5;
		this.phaseText.y = 4;
		this.updatePhaseText();
	}

	/** Actualiza el contenido de phaseText según this.gamePhase */
	public updatePhaseText(): void {
		// Opción 1: usar directamente el nombre del enum:
		const phaseName = GamePhase[this.gamePhase];
		// Opción 2: mapping más amigable, por ejemplo:
		// const phaseLabels: Record<GamePhase, string> = {
		//     [GamePhase.SELECT]: "Fase: Selección",
		//     [GamePhase.MOVE]:   "Fase: Movimiento",
		//     [GamePhase.ATTACK]: "Fase: Ataque",
		//     [GamePhase.END]:    "Fase: Fin de turno",
		// };
		// const phaseName = phaseLabels[this.gamePhase];
		this.phaseText.text = `Fase: ${phaseName}`;
	}
}
