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
import { Text, Texture } from "pixi.js";
import { FadeColorTransition } from "../../../../../engine/scenemanager/transitions/FadeColorTransition";
import { ToggleSwitch } from "../../Utils/toggle/ToggleSwitch";

export class SettingsPopUp extends PixiScene {
	// Assets
	private fadeAndBlocker: Graphics;
	public background: Sprite;
	public buttons: Button[];
	private menuButton: Graphics;
	// Level data
	public readonly level: any;
	public levelNumber: number;
	public levelTime: number;
	// Booleans
	public closing: boolean = false;
	public restart: boolean = false;
	public pauseScene: boolean = false;
	private closePopUpButton: Graphics;
	private goToMenu: boolean = false;
	private toggleSwitch: ToggleSwitch;
	private closePopUpBoolean: boolean = false;

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

		this.toggleSwitch = new ToggleSwitch({
			knobTexture: "soundKnob",
			backgroundTexture: "soundBG",
			travelDistance: Texture.from("soundBG").width,
			tweenDuration: 500,
			onToggleOn: () => {
				// Lógica para activar la música
				if (!SoundManager.isMusicOn()) {
					SoundManager.resumeMusic(Sounds.BG_MUSIC);
					SoundManager.musicPlaying = true;
				}
				SoundManager.playSound(Sounds.START, {}); // Reproduce el sonido de feedback
			},
			onToggleOff: () => {
				// Lógica para desactivar la música
				if (SoundManager.isMusicOn()) {
					SoundManager.pauseMusic(Sounds.BG_MUSIC);
					SoundManager.musicPlaying = false;
				}
				SoundManager.playSound(Sounds.CLOSEPOPUP, {}); // Reproduce el sonido de feedback
			},
			startingValue: SoundManager.isMusicOn(), // Sincroniza el estado inicial del interruptor con la música
		});
		this.toggleSwitch.anchor.set(0.5, 1.25);
		// this.toggleSwitch.scale.set(0.8);
	}

	// Método para manejar el clic en el botón de cerrar
	private handleResetClick(): void {
		this.closePopUpBoolean = true;
		SoundManager.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopup();
	}
	// Método para manejar el clic en el botón de cerrar
	private handleResetClickAndLeave(): void {
		this.goToMenu = true;
		SoundManager.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
		this.closePopupAndLeave();
	}
	public showButtons(): void {
		this.background.addChild(this.toggleSwitch);

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

		const closepopup = new Text("Continue", { fontSize: 70, fill: 0xffffff, dropShadow: true, fontFamily: "Darling Coffee" });
		closepopup.y = this.closePopUpButton.height * 0.5;
		closepopup.x = this.closePopUpButton.width * 0.5;
		closepopup.anchor.set(0.5);
		// tryagain.anchor.set(0.5);
		this.closePopUpButton.addChild(closepopup);

		this.menuButton = new Graphics();
		this.menuButton.beginFill(0x808080);
		this.menuButton.drawRoundedRect(0, -275, 350, 150, 50);
		this.menuButton.endFill();
		this.menuButton.pivot.set(this.menuButton.width * 0.5, this.menuButton.height * 0.5);
		this.menuButton.eventMode = "static";
		this.menuButton.position.set(this.background.width * 0.5, this.background.height + 350); // Posiciona el botón según sea necesario
		this.menuButton.on("pointertap", () => {
			this.handleResetClickAndLeave();
		});
		this.background.addChild(this.menuButton); // Agrega el botón al background

		const returnButton = new Text("To Menu", { fontSize: 70, fill: 0xffffff, dropShadow: true, fontFamily: "Darling Coffee" });
		returnButton.y = this.closePopUpButton.height * 0.5 - 275;
		returnButton.x = this.closePopUpButton.width * 0.5;
		returnButton.anchor.set(0.5);
		// returnButton.anchor.set(0.5);
		this.menuButton.addChild(returnButton);
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
			elasticAnimation.onComplete(() => {
				if (this.goToMenu) {
					this.emit("RESUME_PAUSE");
					Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
				}

				if (this.closePopUpBoolean) {
					this.emit("RESUME_PAUSE");
				}
			});
			elasticAnimation.start();
		});
	}

	public closePopup(): void {
		if (this.closing) {
			return;
		}
		this.requestClose();
	}

	public closePopupAndLeave(): void {
		if (this.closing) {
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
	}
}
