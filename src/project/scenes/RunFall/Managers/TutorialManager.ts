import { Container, Graphics, Text } from "pixi.js";
import { Tween } from "tweedle.js";
import type { GameObject } from "../Objects/GameObject";
import { CoinObject, EnemyObject, PotionObject, ObstacleObject, PowerUpObject } from "../Objects/Objects";
import Random from "../../../../engine/random/Random";

// Cambia a false para producción
const DEBUG_TUTORIAL = false;

interface TutorialStep {
	objectName: string;
	message: string;
	spawnClass: new () => GameObject;
}

export class TutorialManager extends Container {
	private steps: TutorialStep[] = [
		{ objectName: "COIN", message: "¡Recoge MONEDAS para sumar puntos!", spawnClass: CoinObject },
		{ objectName: "ENEMY", message: "¡Evita a los ENEMIGOS! Te quitan vida y puntos.", spawnClass: EnemyObject },
		{ objectName: "POTION", message: "Las POCIONES restauran tu salud.", spawnClass: PotionObject },
		{ objectName: "POWER_UP", message: "¡Los POWERUP te hacen más veloz momentáneamente!", spawnClass: PowerUpObject },
		{ objectName: "OBSTACLE", message: "¡Pero cuidado! Podés chocar con OBSTÁCULOS que te frenan y dañan.", spawnClass: ObstacleObject },
	];

	private currentStepIndex: number = 0;
	private overlay: Graphics;
	private messageText: Text;
	private helperText: Text;

	public isActive: boolean = true;
	public isWaitingForClick: boolean = false;
	public currentTutorialObject: GameObject | null = null;
	private hasPausedCurrentStep: boolean = false; // Nueva bandera
	constructor() {
		super();
		this.visible = false;

		// Si DEBUG_TUTORIAL es true, isActive siempre será true al iniciar
		if (!DEBUG_TUTORIAL && localStorage.getItem("tutorialCompleted") === "true") {
			this.isActive = false;
		}

		this.setupUI();
	}

	private setupUI(): void {
		this.overlay = new Graphics();
		this.overlay.beginFill(0x000000, 0.6);
		this.overlay.drawRect(-2000, -2000, 4000, 4000);
		this.overlay.endFill();
		this.overlay.eventMode = "static";
		this.overlay.on("pointerdown", () => this.handleProgress());
		this.addChild(this.overlay);

		const style = {
			fontFamily: "Pixelate-Regular",
			fontSize: 110,
			fill: "#ffffff",
			align: "center" as const,
			wordWrap: true,
			wordWrapWidth: 600,
		};

		this.messageText = new Text("", style);
		this.messageText.anchor.set(0.5);
		this.addChild(this.messageText);

		this.helperText = new Text("Toca para continuar", { ...style, fontSize: 70, fill: "#ffff00" });
		this.helperText.anchor.set(0.5);
		this.helperText.position.set(0, 720);
		this.addChild(this.helperText);
	}

	public spawnNextStep(objectsArray: GameObject[], container: Container): void {
		if (this.currentStepIndex >= this.steps.length) {
			this.completeTutorial();
			return;
		}

		this.hasPausedCurrentStep = false; // Resetear para el nuevo objeto
		const step = this.steps[this.currentStepIndex];
		const obj = new step.spawnClass();
		obj.name = step.objectName;

		obj.x = Random.shared.randomInt(obj.width * 0.5, container.width - obj.width * 0.5);
		obj.y = -800;

		this.currentTutorialObject = obj;
		objectsArray.push(obj);
		container.addChild(obj);
	}

	public checkPauseTrigger(): boolean {
		// Solo pausar si NO hemos pausado ya para este objeto específico
		if (this.isActive && this.currentTutorialObject && this.currentTutorialObject.y > -200 && !this.hasPausedCurrentStep) {
			this.hasPausedCurrentStep = true; // Marcar como pausado
			this.showStep();
			return true;
		}
		return false;
	}

	private handleProgress(): void {
		if (this.isWaitingForClick) {
			this.isWaitingForClick = false;
			this.visible = false;
			this.currentStepIndex++;

			// Importante: No reseteamos hasPausedCurrentStep aquí,
			// se resetea solo cuando spawnea el SIGUIENTE objeto.

			if (this.currentStepIndex >= this.steps.length) {
				this.completeTutorial();
			}
		}
	}

	private showStep(): void {
		if (!this.steps[this.currentStepIndex]) {
			this.completeTutorial();
			return;
		}

		this.isWaitingForClick = true;
		this.visible = true;
		this.messageText.text = this.steps[this.currentStepIndex].message;

		this.alpha = 0;
		new Tween(this).to({ alpha: 1 }, 300).start();
	}

	private completeTutorial(): void {
		this.isActive = false;
		this.visible = false;
		this.currentTutorialObject = null;

		// Solo guardamos en localStorage si no estamos en modo debug
		// o si queremos que se guarde de todos modos
		localStorage.setItem("tutorialCompleted", "true");

		if (DEBUG_TUTORIAL) {
			console.log("Tutorial finalizado (Modo Debug activo)");
		}
	}
}
