import { Container, Graphics, Text, TextStyle } from "pixi.js";

export class AttackButton extends Container {
	private button: Graphics;
	private buttonText: Text;
	private isPressed: boolean = false;
	private onAttackCallback: (() => void) | null = null;

	constructor() {
		super();
		this.createButton();
		this.setupEvents();
	}

	private createButton(): void {
		// Create circular button
		this.button = new Graphics();
		this.button.beginFill(0xff0000, 0.7); // Red with transparency
		this.button.drawCircle(0, 0, 40); // Radius of 40 pixels
		this.button.endFill();

		// Add border
		this.button.lineStyle(3, 0xffffff, 1);
		this.button.drawCircle(0, 0, 40);

		// Make it interactive
		this.button.interactive = true;
		this.button.cursor = "pointer";

		// Create text
		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 28,
			fill: "white",
			fontWeight: "bold",
		});

		this.buttonText = new Text("⚔", textStyle); // Sword emoji
		this.buttonText.anchor.set(0.5);

		// Add to container
		this.addChild(this.button);
		this.addChild(this.buttonText);

		// Position at top-right corner (will be adjusted in scene)
		this.x = window.innerWidth - 80;
		this.y = 80;
	}

	private setupEvents(): void {
		this.button.on("pointerdown", this.onButtonDown);
		this.button.on("pointerup", this.onButtonUp);
		this.button.on("pointerupoutside", this.onButtonUp);
	}

	private onButtonDown = (): void => {
		this.isPressed = true;
		// Visual feedback - make button slightly bigger and more opaque
		this.button.scale.set(1.1);
		this.button.alpha = 1;

		// Trigger attack callback
		if (this.onAttackCallback) {
			this.onAttackCallback();
		}
	};

	private onButtonUp = (): void => {
		this.isPressed = false;
		// Reset visual feedback
		this.button.scale.set(1);
		this.button.alpha = 0.7;
	};

	public setOnAttackCallback(callback: () => void): void {
		this.onAttackCallback = callback;
	}

	public updatePosition(screenWidth: number, _screenHeight: number): void {
		// Position at top-right corner with some margin
		this.x = screenWidth - 80;
		this.y = 80;
	}

	public getIsPressed(): boolean {
		return this.isPressed;
	}

	public override destroy(_options?: any): void {
		// Remove event listeners
		this.button.off("pointerdown", this.onButtonDown);
		this.button.off("pointerup", this.onButtonUp);
		this.button.off("pointerupoutside", this.onButtonUp);

		super.destroy(_options);
	}
}
