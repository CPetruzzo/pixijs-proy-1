import { PixiScene } from "../../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../../engine/utils/ScaleHelper";
import { Sprite } from "@pixi/sprite";
import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import { Keyboard } from "../../../../../engine/input/Keyboard";
import { Manager } from "../../../../..";
import type { Button } from "@pixi/ui";
import { SoundManager, Sounds } from "../../Managers/SoundManager";
import { DodgeScene } from "../DodgeScene";
import { MenuScene } from "../MenuScene";
import { SoundToggleButton } from "../../Utils/SoundToggleButton";
import { Text } from "pixi.js";

export class SettingsPopUp extends PixiScene {
	// Assets
	private fadeAndBlocker: Graphics;
	public background: Sprite;
	public buttons: Button[];
	private soundToggleButton: SoundToggleButton;
	private menuButton: Sprite;
	// Level data
	public readonly level: any;
	public levelNumber: number;
	public levelTime: number;
	// Booleans
	public closing: boolean = false;
	public restart: boolean = false;
	public pauseScene: boolean = false;
	private closePopUpButton: Graphics;

	constructor(_score?: number) {
		super();

		// Create fade background
		this.fadeAndBlocker = new Graphics();
		this.fadeAndBlocker.beginFill(0x000000, 0.5);
		this.fadeAndBlocker.drawRect(0, 0, 1500, 1500);
		this.fadeAndBlocker.endFill();
		this.fadeAndBlocker.interactive = true;
		this.fadeAndBlocker.pivot.set(this.fadeAndBlocker.width * 0.5, this.fadeAndBlocker.height * 0.5);
		this.addChild(this.fadeAndBlocker);
		this.fadeAndBlocker.scale.set(10);

		// Create background sprite
		this.background = Sprite.from("highscore");
		this.background.anchor.set(0.5);
		this.addChild(this.background);

		this.soundToggleButton = new SoundToggleButton(-100, 0);

		// Create menu button to go back to main menu
		this.menuButton = Sprite.from("asteroidFragment");
		this.menuButton.anchor.set(0.5);
		this.menuButton.scale.set(0.5);
		this.menuButton.interactive = true;
		this.menuButton.on("pointerdown", this.goToMenu.bind(this));
	}

	// Método para manejar el clic en el botón de cerrar
	private handleResetClick(): void {
		SoundManager.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopup();
	}

	public showButtons(): void {
		// Create sound toggle button
		this.background.addChild(this.soundToggleButton);
		this.background.addChild(this.menuButton);
		this.positionButtons();

		// Mostrar el botón de reinicio
		this.closePopUpButton = new Graphics();
		this.closePopUpButton.beginFill(0x808080);
		this.closePopUpButton.drawRoundedRect(0, 0, 350, 150, 50);
		this.closePopUpButton.endFill();
		this.closePopUpButton.pivot.set(this.closePopUpButton.width * 0.5, this.closePopUpButton.height * 0.5);
		this.closePopUpButton.eventMode = "static";
		this.closePopUpButton.position.set(this.background.width * 0.5, this.background.height + 350); // Posiciona el botón según sea necesario
		this.closePopUpButton.on("pointertap", this.handleResetClick, this); // Agrega un manejador de eventos al hacer clic en el botón
		this.background.addChild(this.closePopUpButton); // Agrega el botón al background

		const tryagain = new Text("Close", { fontSize: 70, fill: 0xffffff, dropShadow: true, fontFamily: "Darling Coffee" });
		tryagain.y = this.closePopUpButton.height * 0.5;
		tryagain.x = this.closePopUpButton.width * 0.5;
		tryagain.anchor.set(0.5);
		// tryagain.anchor.set(0.5);
		this.closePopUpButton.addChild(tryagain);
	}

	public override onStart(): void {
		// Disable interaction until animations complete
		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		// Fade and scale animations
		const fadeScale = new Tween(this.fadeAndBlocker).to({ scale: { x: 35, y: 15 } });
		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);
		const elasticAnimation = new Tween(this.background).to({ scale: { x: 7, y: 7 } }, 1000).easing(Easing.Elastic.Out);

		// Play sound when animation starts
		elasticAnimation.onStart(() => {
			SoundManager.playSound(Sounds.OPENPOUP, {});
		});

		// Allow interaction after animations
		elasticAnimation.onComplete(() => {
			this.background.interactiveChildren = true;
			Keyboard.shared.pressed.once("Escape", this.closePopup.bind(this));
		});

		// Chain and start animations
		fadeAnimation.chain(elasticAnimation);
		fadeAnimation.start();
		fadeScale.chain(fadeAnimation);
		fadeScale.start();

		// Position buttons
		// this.positionButtons();
	}

	private positionButtons(): void {
		// Position the menu button
		this.menuButton.x = 0; // Adjust as needed
		this.menuButton.y = this.background.height * 0.5; // Adjust as needed
	}

	// Navigate to main menu
	private goToMenu(): void {
		Manager.changeScene(MenuScene);
	}

	public override requestClose(_doSomething?: () => void): Promise<boolean> {
		this.closing = true;
		return new Promise((resolve) => {
			this.background.interactiveChildren = false;

			// Fade out and scale down animations
			const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 0 }, 500);
			const elasticAnimation = new Tween(this.background).to({ scale: { x: 0, y: 0 } }, 1000).easing(Easing.Elastic.In);

			// On animation complete, handle the closure
			fadeAnimation.onComplete(() => {
				Keyboard.shared.pressed.off("Escape", this.closePopup.bind(this));
				this.closeHandler(_doSomething);
				resolve(true);

				// Restart scene if needed
				if (this.restart) {
					Manager.changeScene(DodgeScene);
				}
			});

			// Chain and start closing animations
			elasticAnimation.chain(fadeAnimation);
			elasticAnimation.start();
		});
	}

	public closePopup(): void {
		if (this.closing) {
			this.emit("RESUME_PAUSE");
			return;
		}
		this.requestClose();
	}

	public override onResize(_newW: number, _newH: number): void {
		// Adjust blocker size to fit new dimensions
		this.fadeAndBlocker.width = _newW;
		this.fadeAndBlocker.height = _newH;

		// Adjust scale and position of the popup
		ScaleHelper.setScaleRelativeToIdeal(this, _newW * 0.1, _newH * 0.1, 720, 1600, ScaleHelper.FIT);
		this.x = _newW * 0.5;
		this.y = _newH * 0.5;

		// Reposition buttons after resizing
		this.positionButtons();
	}
}
