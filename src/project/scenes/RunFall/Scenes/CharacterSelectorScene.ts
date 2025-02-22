import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../../..";
import { FadeColorTransition } from "../../../../engine/scenemanager/transitions/FadeColorTransition";
import { Tween, Easing } from "tweedle.js";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { MenuScene } from "./MenuScene";

export class CharacterSelectorScene extends PixiScene {
	private backgroundContainer: Container;
	private sliderContainer: Container;
	// Usamos contenedores para cada personaje, que contendrán el sprite y el texto de bloqueo (si corresponde)
	private characters: Container[] = [];
	private selectedIndex: number = 0;
	private backButton: Sprite;
	// Banner donde se muestran las descripciones
	private bannerText: Text;
	public static readonly BUNDLES = ["fallrungame", "sfx"];
	private bleedingBackgroundContainer: Container = new Container();

	// Espaciado horizontal (en píxeles) para el slider
	private readonly spacing: number = 250;

	constructor() {
		super();

		// Fondo para la ambientación
		const bleedBG = Sprite.from("playerSelectBG");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		// Contenedor principal de la escena
		this.backgroundContainer = new Container();
		this.addChild(this.bleedingBackgroundContainer, this.backgroundContainer);

		// Fondo principal
		const background = Sprite.from("playerSelectBG");
		background.position.set(-background.width * 0.5, -background.height * 0.5);
		this.backgroundContainer.addChild(background);

		// Banner de marco (opcional) que además contendrá los textos descriptivos
		const frame = Sprite.from("emptyBanner");
		frame.alpha = 0.8;
		frame.position.set(-frame.width * 0.5, -frame.height * 0.1);
		this.backgroundContainer.addChild(frame);

		// Creamos el objeto de texto que irá dentro del banner
		this.bannerText = new Text(
			"",
			new TextStyle({
				fontFamily: "Daydream",
				fill: "#ffffff",
				fontSize: 40,
				align: "center",
				wordWrap: true,
				wordWrapWidth: frame.width - 20,
			})
		);
		this.bannerText.zIndex = 1000;
		this.bannerText.anchor.set(0.5);
		// Posicionamos el texto dentro del banner (con un margen)
		this.bannerText.position.set(frame.width * 0.5, frame.height * 0.5);
		frame.addChild(this.bannerText);

		// Contenedor para el slider de personajes
		this.sliderContainer = new Container();
		this.sliderContainer.sortableChildren = true;
		this.sliderContainer.y = -400;
		this.backgroundContainer.addChild(this.sliderContainer);

		// Carga de sprites de personajes (placeholders)
		// Solo el primero se mostrará desbloqueado; los demás aparecerán bloqueados
		const characterTextures = ["astro1", "astro2", "astro3"];
		characterTextures.forEach((texture, index) => {
			// Creamos un contenedor para el personaje
			const charContainer = new Container();
			// Creamos el sprite del personaje
			const characterSprite = Sprite.from(texture);
			characterSprite.anchor.set(0.5);
			charContainer.addChild(characterSprite);

			// Indicamos si el personaje está desbloqueado (solo el índice 0 lo está)
			(charContainer as any).unlocked = index === 0;
			if (!(charContainer as any).unlocked) {
				// Aplicamos tint negro al sprite y agregamos un texto de bloqueo
				characterSprite.tint = 0x000000;
				const lockText = new Text("Blocked", new TextStyle({ fontFamily: "Daydream", fill: "#ffffff", fontSize: 24 }));
				lockText.anchor.set(0.5);
				lockText.position.set(0, 0);
				charContainer.addChild(lockText);
			}
			this.sliderContainer.addChild(charContainer);
			this.characters.push(charContainer);
		});

		// Configuración inicial de posiciones, visibilidad y escalas:
		const n = this.characters.length;
		// Centro (activo)
		this.characters[0].x = 0;
		this.characters[0].scale.set((this.characters[0] as any).unlocked ? 1.5 : 1.0);
		this.characters[0].alpha = 1;
		// Izquierda
		const leftIndex = (0 - 1 + n) % n;
		this.characters[leftIndex].x = -this.spacing;
		this.characters[leftIndex].alpha = 1;
		this.characters[leftIndex].scale.set(1.0);
		// Derecha
		const rightIndex = (0 + 1) % n;
		this.characters[rightIndex].x = this.spacing;
		this.characters[rightIndex].alpha = 1;
		this.characters[rightIndex].scale.set(1.0);
		// El resto (si existiera) se posicionan fuera de pantalla a la derecha
		for (let i = 0; i < n; i++) {
			if (i !== 0 && i !== leftIndex && i !== rightIndex) {
				this.characters[i].x = this.spacing * 2;
				this.characters[i].alpha = 0;
				this.characters[i].scale.set(1.0);
			}
		}
		this.selectedIndex = 0;
		this.updateZIndices();
		// Ahora que los personajes están creados, actualizamos el banner
		this.updateBanner();

		// Botón de navegación izquierda
		const leftButton = Sprite.from("leftArrow");
		leftButton.anchor.set(0.5);
		leftButton.scale.set(0.5);
		leftButton.x = -background.width * 0.5 + 50;
		leftButton.y = -400;
		leftButton.eventMode = "static";
		leftButton.interactive = true;
		leftButton.on("pointertap", () => this.selectPrevious());
		this.backgroundContainer.addChild(leftButton);

		// Botón de navegación derecha
		const rightButton = Sprite.from("rightArrow");
		rightButton.anchor.set(0.5);
		rightButton.scale.set(0.5);
		rightButton.x = background.width * 0.5 - 50;
		rightButton.y = -400;
		rightButton.eventMode = "static";
		rightButton.interactive = true;
		rightButton.on("pointertap", () => this.selectNext());
		this.backgroundContainer.addChild(rightButton);

		// Botón para volver al menú
		this.backButton = Sprite.from("return");
		this.backButton.anchor.set(0.5);
		this.backButton.y = background.height * 0.5 - this.backButton.height;
		this.backButton.eventMode = "static";
		this.backButton.interactive = true;
		this.backButton.on("pointertap", () => {
			Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
		this.backgroundContainer.addChild(this.backButton);
	}

	/**
	 * Actualiza el contenido del banner según el personaje activo.
	 * Si el personaje está desbloqueado, se muestran valores (velocidad, vida, otro);
	 * en caso contrario, se muestra un mensaje de "No description available yet".
	 */
	private updateBanner(): void {
		const current = this.characters[this.selectedIndex];
		if ((current as any).unlocked) {
			// Valores de ejemplo; actualizá con los datos reales
			this.bannerText.text = "Speed: 200\n\n\nHealth: 3\n";
		} else {
			this.bannerText.text = "No description available yet";
		}
	}

	/**
	 * Actualiza el zIndex de los personajes para que el activo (centro) aparezca por delante.
	 */
	private updateZIndices(): void {
		const n = this.characters.length;
		this.characters.forEach((char) => (char.zIndex = 0));
		this.characters[this.selectedIndex].zIndex = 10;
		const leftIndex = (this.selectedIndex - 1 + n) % n;
		const rightIndex = (this.selectedIndex + 1) % n;
		this.characters[leftIndex].zIndex = 5;
		this.characters[rightIndex].zIndex = 5;
	}

	/**
	 * Al presionar la flecha derecha, se mueve el slider hacia la derecha,
	 * animando posición, alpha, escala y actualizando el zIndex y el banner.
	 */
	private selectNext(): void {
		const n = this.characters.length;
		const s = this.selectedIndex;
		const oldLeft = (s - 1 + n) % n;
		const oldCenter = s;
		const oldRight = (s + 1) % n;
		const newRight = (s + 2) % n;
		this.selectedIndex = oldRight;

		new Tween(this.characters[oldLeft])
			.to({ x: -this.spacing * 2, alpha: 0 }, 300)
			.easing(Easing.Cubic.Out)
			.start();

		new Tween(this.characters[oldCenter])
			.to({ x: -this.spacing, scale: { x: 1.0, y: 1.0 } }, 300)
			.easing(Easing.Cubic.Out)
			.start();

		const targetScale = (this.characters[oldRight] as any).unlocked ? 1.5 : 1.0;
		new Tween(this.characters[oldRight])
			.to({ x: 0, scale: { x: targetScale, y: targetScale } }, 300)
			.easing(Easing.Cubic.Out)
			.start();

		const nr = this.characters[newRight];
		nr.x = this.spacing * 2;
		nr.alpha = 0;
		nr.scale.set(1.0);
		new Tween(nr).to({ x: this.spacing, alpha: 1 }, 300).easing(Easing.Cubic.Out).start();

		this.updateZIndices();
		this.updateBanner();
	}

	/**
	 * Al presionar la flecha izquierda, se mueve el slider hacia la izquierda,
	 * animando posición, alpha, escala y actualizando el zIndex y el banner.
	 */
	private selectPrevious(): void {
		const n = this.characters.length;
		const s = this.selectedIndex;
		const oldRight = (s + 1) % n;
		const oldCenter = s;
		const oldLeft = (s - 1 + n) % n;
		const newLeft = (s - 2 + n) % n;
		this.selectedIndex = oldLeft;

		new Tween(this.characters[oldRight])
			.to({ x: this.spacing * 2, alpha: 0 }, 300)
			.easing(Easing.Cubic.Out)
			.start();

		new Tween(this.characters[oldCenter])
			.to({ x: this.spacing, scale: { x: 1.0, y: 1.0 } }, 300)
			.easing(Easing.Cubic.Out)
			.start();

		const targetScale = (this.characters[oldLeft] as any).unlocked ? 1.5 : 1.0;
		new Tween(this.characters[oldLeft])
			.to({ x: 0, scale: { x: targetScale, y: targetScale } }, 300)
			.easing(Easing.Cubic.Out)
			.start();

		const nl = this.characters[newLeft];
		nl.x = -this.spacing * 2;
		nl.alpha = 0;
		nl.scale.set(1.0);
		new Tween(nl).to({ x: -this.spacing, alpha: 1 }, 300).easing(Easing.Cubic.Out).start();

		this.updateZIndices();
		this.updateBanner();
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
