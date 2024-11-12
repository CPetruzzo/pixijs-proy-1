export class TutorialManager {
	private static isTutorialActive: boolean = true;

	public static enableTutorial(): void {
		this.isTutorialActive = true;
		console.log("Tutorial enabled.");
		// Lógica para activar el tutorial (mostrar elementos o activar guías)
	}

	public static disableTutorial(): void {
		this.isTutorialActive = false;
		console.log("Tutorial disabled.");
		// Lógica para desactivar el tutorial (ocultar elementos o desactivar guías)
	}

	public static toggleTutorial(): void {
		if (this.isTutorialActive) {
			this.disableTutorial();
		} else {
			this.enableTutorial();
		}
	}

	public static isActive(): boolean {
		return this.isTutorialActive;
	}
}
