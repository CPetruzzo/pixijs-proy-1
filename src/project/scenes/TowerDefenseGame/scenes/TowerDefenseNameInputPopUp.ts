import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import type { Button } from "@pixi/ui";
import { Container, NineSlicePlane, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { SoundManager, Sounds } from "../../RunFall/Managers/SoundManager";
import { Keyboard } from "../../../../engine/input/Keyboard";
// import { Manager } from "../../../..";
// import { FadeColorTransition } from "../../../../engine/scenemanager/transitions/FadeColorTransition";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { pixiSettings } from "../../../..";
// import { BasketballHighScorePopUp } from "../BasketballHighScorePopUp";

export class TowerDefenseNameInputPopUp extends PixiScene {
	// Assets
	private fadeAndBlocker: Graphics;
	public background: NineSlicePlane;
	public buttons: Button[];
	public menuButton: Sprite;
	// Level data
	public readonly level: any;
	public levelNumber: number;
	public levelTime: number;
	// Booleans
	public closing: boolean = false;
	public restart: boolean = false;
	public pauseScene: boolean = false;
	public closePopUpButton: Sprite;
	public goToMenu: boolean = false;
	private playerName: string = "";
	private nameInputContainer: Container = new Container();
	// Propiedad estática para almacenar el nombre del jugador
	private static _playerName: string = "";
	private confirmButton: Sprite;

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
		this.background = new NineSlicePlane(Texture.from("tdBG"), 10, 10, 10, 10);
		this.background.pivot.set(this.background.width * 0.5, this.background.height * 0.5);
		this.addChild(this.background);
	}

	// Método para manejar el clic en el botón de cerrar
	public nameAddedAndClick(): void {
		if (this.playerName.length > 0) {
			TowerDefenseNameInputPopUp._playerName = this.playerName;
			console.log("Name saved:", this.playerName);
			SoundManager.playSound(Sounds.CLOSEPOPUP, { allowOverlap: false, singleInstance: true, loop: false, volume: 0.2, speed: 0.5 });
			this.closePopup();
		} else {
			console.log("Please enter a name before continuing.");
		}
	}

	// Getter para acceder al nombre del jugador desde otras escenas
	public static get playerName(): string {
		return TowerDefenseNameInputPopUp._playerName;
	}

	private createInputField(): void {
		const inputBox = new Graphics();
		inputBox.beginFill(0xffffff, 0.2);
		inputBox.drawRoundedRect(0, -25, 500, 80, 10);
		inputBox.endFill();
		inputBox.position.set(200, 210);

		const nameText = new Text(
			this.playerName,
			new TextStyle({
				fontSize: 50,
				fill: 0xffffff,
				fontFamily: "DK Boarding House III",
			})
		);
		nameText.position.set(220, 190);

		this.nameInputContainer.addChild(inputBox);
		this.nameInputContainer.addChild(nameText);
		this.background.addChild(this.nameInputContainer);

		const inputElement = document.createElement("input");
		inputElement.type = "text";
		inputElement.maxLength = 20;
		inputElement.style.position = "absolute";
		inputElement.style.opacity = "0";
		inputElement.style.pointerEvents = "none";

		document.body.appendChild(inputElement);

		inputBox.interactive = true;
		inputBox.on("pointertap", () => {
			const canvasBounds = pixiSettings.view.getBoundingClientRect();
			inputElement.style.left = `${canvasBounds.left + inputBox.x}px`;
			inputElement.style.top = `${canvasBounds.top + inputBox.y}px`;
			inputElement.style.width = `${inputBox.width}px`;
			inputElement.style.height = `${inputBox.height}px`;
			inputElement.style.fontSize = "24px";
			inputElement.style.color = "white";
			inputElement.style.backgroundColor = "transparent";
			inputElement.style.border = "none";
			inputElement.style.opacity = "1";
			inputElement.style.pointerEvents = "auto";
			inputElement.focus();
		});

		inputElement.addEventListener("input", () => {
			this.playerName = inputElement.value;
			nameText.text = this.playerName;
		});

		inputElement.addEventListener("blur", () => {
			inputElement.style.opacity = "0";
			inputElement.style.pointerEvents = "none";
		});

		// Cerrar con Enter
		inputElement.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				inputElement.blur(); // Dispara el evento 'blur'
			}
		});

		// Cerrar al hacer clic fuera
		this.eventMode = "static";
		this.on("pointerdown", (event) => {
			const localPoint = inputBox.toLocal(event.data.global);
			if (localPoint.x < 0 || localPoint.x > inputBox.width || localPoint.y < 0 || localPoint.y > inputBox.height) {
				inputElement.blur(); // Cierra el input
			}
		});
	}

	public showButtons(): void {
		// Crear los elementos individuales y añadirlos al contenedor principal
		this.createTitle();
		this.createInputField();
		this.createConfirmButton();

		// Añadir eventos
		this.addInputEvent();
	}

	private createTitle(): void {
		const titleText = new Text(
			"Enter Your Name",
			new TextStyle({
				fontSize: 60,
				fill: 0xffffff,
				dropShadow: true,
				dropShadowColor: 0x000000,
				fontFamily: "DK Boarding House III",
			})
		);
		titleText.anchor.set(0.5);
		titleText.position.set(titleText.width, titleText.height * 1.55);
		this.background.addChild(titleText);
	}

	private createConfirmButton(): void {
		this.confirmButton = Sprite.from("resetButton");
		this.confirmButton.anchor.set(0.5);
		this.confirmButton.scale.set(0.6);
		this.confirmButton.position.set(460, 380);
		this.confirmButton.eventMode = "static";
		this.background.addChild(this.confirmButton);

		// Eventos del botón
		this.addButtonHoverEffect(this.confirmButton);
		this.confirmButton.on("pointertap", this.nameAddedAndClick.bind(this));
	}

	private addInputEvent(): void {
		// Evento para actualizar el texto del nombre en tiempo real
		const nameText = this.nameInputContainer.children.find((child) => child instanceof Text) as Text;

		window.addEventListener("keydown", (e) => this.onKeyDown(e, nameText));
	}

	private addButtonHoverEffect(button: Sprite): void {
		button.on("pointerover", () => {
			new Tween(button)
				.to({ scale: { x: 0.65, y: 0.65 } }, 200)
				.easing(Easing.Quadratic.Out)
				.start();
		});
		button.on("pointerout", () => {
			new Tween(button)
				.to({ scale: { x: 0.6, y: 0.6 } }, 200)
				.easing(Easing.Quadratic.Out)
				.start();
		});
	}

	private onKeyDown(event: KeyboardEvent, nameText: Text): void {
		// Lógica para capturar y mostrar el texto en tiempo real
		const char = event.key;
		if (char.length === 1 || char === "Backspace") {
			this.playerName = char === "Backspace" ? this.playerName.slice(0, -1) : this.playerName + char;
			nameText.text = this.playerName;
		}
	}

	public override onStart(): void {
		// Disable interaction until animations complete
		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		// Fade and scale animations
		const fadeScale = new Tween(this.fadeAndBlocker).to({ scale: { x: 35, y: 15 } });
		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);
		const elasticAnimation = new Tween(this.background)
			.from({
				scale: { x: 20, y: 20 },
				y: 8000,
				alpha: 0,
			})
			.to(
				{
					scale: { x: 20, y: 20 },
					y: 0,
					alpha: 1,
				},
				1000
			)
			.easing(Easing.Elastic.Out);

		// Play sound when animation starts
		elasticAnimation.onStart(() => {
			// SoundManager.playSound(Sounds.OPENPOUP, {});
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
			const elasticAnimation = new Tween(this.background)
				.to(
					{
						// scale: { x: 0, y: 0 },
						y: 8000,
						alpha: 0,
					},
					1000
				)
				.easing(Easing.Elastic.In);

			// On animation complete, handle the closure
			fadeAnimation.onComplete(() => {
				Keyboard.shared.pressed.off("Escape", this.closePopup.bind(this));
				this.closeHandler(_doSomething);
				resolve(true);
			});

			// Chain and start closing animations
			elasticAnimation.chain(fadeAnimation);
			elasticAnimation.onComplete(() => {
				this.emit("HIGHSCORE_NAME_READY");
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
