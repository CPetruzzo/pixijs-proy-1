import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle, Graphics } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager } from "../../..";
import { BasquetballGameScene } from "./BasquetballGameScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { Easing, Tween } from "tweedle.js";

export class NameInputScene extends PixiScene {
	private backgroundContainer: Container = new Container();
	private nameInputContainer: Container = new Container();
	private playerName: string = "";

	constructor() {
		super();

		// Fondo
		const background = Sprite.from("backgroundTexture");
		background.anchor.set(0.5);
		background.x = 960; // Ajusta según resolución
		background.y = 540;
		this.backgroundContainer.addChild(background);
		this.addChild(this.backgroundContainer);

		// Título
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
		titleText.position.set(960, 300);
		this.addChild(titleText);

		// Campo de texto (usando un gráfico básico como fondo)
		const inputBox = new Graphics();
		inputBox.beginFill(0xffffff, 0.2); // Color de fondo del campo
		inputBox.drawRoundedRect(0, 0, 600, 80, 10);
		inputBox.endFill();
		inputBox.position.set(660, 500);

		// Texto para mostrar el nombre ingresado
		const nameText = new Text(
			this.playerName,
			new TextStyle({
				fontSize: 50,
				fill: 0xffffff,
				fontFamily: "Arial",
			})
		);
		nameText.position.set(675, 510); // Dentro del campo de texto
		this.nameInputContainer.addChild(inputBox);
		this.nameInputContainer.addChild(nameText);
		this.addChild(this.nameInputContainer);

		// Evento para actualizar el texto del nombre en tiempo real
		window.addEventListener("keydown", (e) => this.onKeyDown(e, nameText));

		// Botón de confirmación
		const confirmButton = Sprite.from("confirmButtonTexture");
		confirmButton.anchor.set(0.5);
		confirmButton.position.set(960, 700);
		confirmButton.interactive = true;
		this.addChild(confirmButton);

		// Animación del botón en pointerover
		confirmButton.on("pointerover", () => {
			new Tween(confirmButton)
				.to({ scale: { x: 1.1, y: 1.1 } }, 200)
				.easing(Easing.Quadratic.Out)
				.start();
		});
		confirmButton.on("pointerout", () => {
			new Tween(confirmButton)
				.to({ scale: { x: 1.0, y: 1.0 } }, 200)
				.easing(Easing.Quadratic.Out)
				.start();
		});
		confirmButton.on("pointertap", () => this.onConfirm());

		this.backgroundContainer.pivot.set(this.backgroundContainer.width * 0.5, this.backgroundContainer.height * 0.5);
	}

	// Función para manejar la entrada del teclado
	private onKeyDown(e: KeyboardEvent, nameText: Text): void {
		if (e.key === "Backspace") {
			this.playerName = this.playerName.slice(0, -1);
		} else if (e.key.length === 1) {
			this.playerName += e.key;
		}
		nameText.text = this.playerName;
	}

	// Función para confirmar y pasar a la siguiente escena
	private onConfirm(): void {
		if (this.playerName.length > 0) {
			Manager.changeScene(BasquetballGameScene, {
				transitionClass: FadeColorTransition,
			});
		} else {
			console.log("Please enter a name.");
		}
	}

	// Ajuste de escala y posición en caso de cambio de tamaño de pantalla
	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.backgroundContainer.x = _newW / 2;
		this.backgroundContainer.y = _newH / 2;
	}
}