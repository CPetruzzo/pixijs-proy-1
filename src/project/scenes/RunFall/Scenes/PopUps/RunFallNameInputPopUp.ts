import { Easing, Tween } from "tweedle.js";
import { Graphics } from "@pixi/graphics";
import type { Button } from "@pixi/ui";
import { Container, NineSlicePlane, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { PixiScene } from "../../../../../engine/scenemanager/scenes/PixiScene";
import { Keyboard } from "../../../../../engine/input/Keyboard";
import { ScaleHelper } from "../../../../../engine/utils/ScaleHelper";

export class RunFallNameInputPopUp extends PixiScene {
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

	// Nombre del jugador
	private playerName: string = "";
	private static _playerName: string = "";

	// Contenedores y elementos de UI
	private nameInputContainer: Container = new Container();
	private nameText: Text; // Mostrará el nombre a medida que el usuario hace clic
	private confirmButton: Sprite;

	constructor(_score?: number) {
		super();

		// Fondo semi-transparente que bloquea interacción
		this.fadeAndBlocker = new Graphics();
		this.fadeAndBlocker.beginFill(0x000000, 0.5);
		this.fadeAndBlocker.drawRect(0, 0, 1500, 1500);
		this.fadeAndBlocker.endFill();
		this.fadeAndBlocker.interactive = true;
		this.fadeAndBlocker.pivot.set(this.fadeAndBlocker.width * 0.5, this.fadeAndBlocker.height * 0.5);
		this.addChild(this.fadeAndBlocker);
		this.fadeAndBlocker.scale.set(10);

		// Panel de fondo
		this.background = new NineSlicePlane(Texture.from("emptyBanner"), 10, 10, 10, 10);
		this.background.pivot.set(this.background.width * 0.5, this.background.height * 0.5);
		this.addChild(this.background);
	}

	/**
	 * Cuando se hace clic en el botón "Continuar".
	 * Se verifica que haya al menos un caracter en el nombre,
	 * se guarda en la propiedad estática y se cierra el popup.
	 */
	public nameAddedAndClick(): void {
		if (this.playerName.length > 0) {
			RunFallNameInputPopUp._playerName = this.playerName;
			console.log("Name saved:", this.playerName);
			this.closePopup();
		} else {
			console.log("Please enter a name before continuing.");
		}
	}

	// Getter para acceder al nombre del jugador desde otras escenas
	public static get playerName(): string {
		return RunFallNameInputPopUp._playerName;
	}

	/**
	 * Crea el recuadro donde se mostrará el nombre ingresado.
	 * Ya no se crea un <input> HTML, solo un contenedor con un Text.
	 */
	private createNameDisplay(): void {
		const inputBox = new Graphics();
		inputBox.beginFill(0xffffff, 0.2);
		inputBox.drawRoundedRect(0, -25, 500, 80, 10);
		inputBox.endFill();
		inputBox.position.set(200, 210);

		this.nameText = new Text(
			this.playerName,
			new TextStyle({
				fontSize: 50,
				fill: 0xffffff,
				fontFamily: "Daydream",
			})
		);
		// Ajusta la posición dentro del box
		this.nameText.position.set(220, 190);

		this.nameInputContainer.addChild(inputBox);
		this.nameInputContainer.addChild(this.nameText);
		this.background.addChild(this.nameInputContainer);
	}

	/**
	 * Crea el teclado virtual con letras A-Z, un botón de espacio
	 * y un botón de borrar. Cada “tecla” es un Text interactivo.
	 */
	private createVirtualKeyboard(): void {
		const keyboardContainer = new Container();
		keyboardContainer.position.set(200, 300); // Ajusta según tu diseño

		// Estilo para las "teclas"
		const keyStyle = new TextStyle({
			fontSize: 40,
			fill: 0xffffff,
			fontFamily: "Daydream",
		});

		// Letras A-Z
		const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
		const keysPerRow = 7; // cuántas "teclas" por fila
		let row = 0;
		let col = 0;

		for (let i = 0; i < letters.length; i++) {
			const letter = letters[i];
			const letterKey = new Text(letter, keyStyle);

			letterKey.interactive = true;
			letterKey.cursor = "pointer";
			letterKey.position.set(col * 75, row * 75);

			letterKey.on("pointertap", () => {
				this.addCharacter(letter);
			});

			keyboardContainer.addChild(letterKey);

			col++;
			if (col >= keysPerRow) {
				col = 0;
				row++;
			}
		}

		// Botón de espacio
		const spaceKey = new Text("[SPACE]", keyStyle);
		spaceKey.interactive = true;
		spaceKey.cursor = "pointer";
		spaceKey.position.set(0, (row + 1) * 80);
		spaceKey.on("pointertap", () => {
			this.addCharacter(" ");
		});
		keyboardContainer.addChild(spaceKey);

		// Botón de borrar (backspace)
		const backKey = new Text("[DEL]", keyStyle);
		backKey.interactive = true;
		backKey.cursor = "pointer";
		backKey.position.set(350, (row + 1) * 80);
		backKey.on("pointertap", () => {
			this.removeCharacter();
		});
		keyboardContainer.addChild(backKey);

		this.background.addChild(keyboardContainer);
	}

	/**
	 * Agrega un caracter al nombre, hasta un máximo de 20.
	 */
	private addCharacter(char: string): void {
		if (this.playerName.length < 20) {
			this.playerName += char;
			this.nameText.text = this.playerName;
		}
	}

	/**
	 * Elimina el último caracter del nombre.
	 */
	private removeCharacter(): void {
		this.playerName = this.playerName.slice(0, -1);
		this.nameText.text = this.playerName;
	}

	/**
	 * Crea el botón de "Continuar" (confirm).
	 */
	private createConfirmButton(): void {
		this.confirmButton = Sprite.from("buttonContinue");
		this.confirmButton.anchor.set(0.5);
		this.confirmButton.scale.set(0.65);
		this.confirmButton.position.set(460, 800);
		this.confirmButton.eventMode = "static";
		this.background.addChild(this.confirmButton);

		// Eventos hover
		this.addButtonHoverEffect(this.confirmButton);
		this.confirmButton.on("pointertap", this.nameAddedAndClick.bind(this));
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

	/**
	 * Método principal para mostrar los elementos del popup:
	 * Título, caja donde se muestra el nombre y el teclado virtual.
	 */
	public showButtons(): void {
		this.createTitle();
		this.createNameDisplay();
		this.createVirtualKeyboard();
		this.createConfirmButton();
	}

	private createTitle(): void {
		const titleText = new Text(
			"Enter Your Name",
			new TextStyle({
				fontSize: 50,
				fill: 0xffffff,
				dropShadow: true,
				dropShadowColor: 0x000000,
				fontFamily: "Daydream",
			})
		);
		titleText.anchor.set(0.5);
		titleText.position.set(titleText.width * 0.59, -titleText.height * 1.2);
		this.background.addChild(titleText);
	}

	// Animaciones de entrada
	public override onStart(): void {
		// Deshabilita la interacción hasta que terminen las animaciones
		this.background.interactiveChildren = false;

		this.fadeAndBlocker.alpha = 0;
		this.background.scale.set(0);

		// Animaciones de fade y scale
		const fadeScale = new Tween(this.fadeAndBlocker).to({ scale: { x: 35, y: 15 } });
		const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 1 }, 500);
		const elasticAnimation = new Tween(this.background)
			.from({
				scale: { x: 7, y: 7 },
				y: 8000,
				alpha: 0,
			})
			.to(
				{
					scale: { x: 7, y: 7 },
					y: 0,
					alpha: 1,
				},
				1000
			)
			.easing(Easing.Elastic.Out);

		elasticAnimation.onComplete(() => {
			this.background.interactiveChildren = true;
			Keyboard.shared.pressed.once("Escape", this.closePopup.bind(this));
		});

		fadeAnimation.chain(elasticAnimation);
		fadeAnimation.start();
		fadeScale.chain(fadeAnimation);
		fadeScale.start();
	}

	// Animación y lógica de cierre
	public override requestClose(_doSomething?: () => void): Promise<boolean> {
		this.closing = true;

		return new Promise((resolve) => {
			this.background.interactiveChildren = false;

			const fadeAnimation = new Tween(this.fadeAndBlocker).to({ alpha: 0 }, 500);
			const elasticAnimation = new Tween(this.background)
				.to(
					{
						y: 8000,
						alpha: 0,
					},
					1000
				)
				.easing(Easing.Elastic.In);

			fadeAnimation.onComplete(() => {
				Keyboard.shared.pressed.off("Escape", this.closePopup.bind(this));
				this.closeHandler(_doSomething);
				resolve(true);
			});

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
		// Ajusta el bloqueador de fondo al nuevo tamaño
		this.fadeAndBlocker.width = _newW;
		this.fadeAndBlocker.height = _newH;

		// Ajusta la escala y posición del popup
		ScaleHelper.setScaleRelativeToIdeal(this, _newW * 0.1, _newH * 0.1, 720, 1600, ScaleHelper.FIT);
		this.x = _newW * 0.5;
		this.y = _newH * 0.5;
	}
}
