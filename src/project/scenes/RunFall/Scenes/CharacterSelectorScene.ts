import { Container, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../../..";
import { FadeColorTransition } from "../../../../engine/scenemanager/transitions/FadeColorTransition";
import { Tween, Easing } from "tweedle.js";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { MenuScene } from "./MenuScene";
import { AdMobManager } from "../../../../engine/utils/AdMobManager";

export class CharacterSelectorScene extends PixiScene {
	private backgroundContainer: Container;
	private sliderContainer: Container;
	// Usamos contenedores para cada personaje, que contendrán el sprite y el texto de bloqueo (si corresponde)
	private characters: Container[] = [];
	private selectedIndex: number = 0;
	private backButton: Sprite;
	// Banner donde se muestran las descripciones
	private bannerText: Text;
	public static readonly BUNDLES = ["fallrungame", "runfallsfx"];
	private bleedingBackgroundContainer: Container = new Container();

	// Espaciado horizontal (en píxeles) para el slider
	private readonly spacing: number = 250;

	private static _instance: CharacterSelectorScene | null = null;
	private static pendingUnlocks: number[] = [];

	// Antes: private actionButton!: Text;
	private actionButton!: Sprite;
	private actionButtonText!: Text; // Mantendremos un objeto de texto para el "Unlock Free"
	constructor() {
		super();

		// ─────────────────────────────────────────────────────
		// ▶️ 1) Load persisted unlocks
		// ─────────────────────────────────────────────────────
		let unlockedChars: number[] = [];
		console.log("unlockedChars", unlockedChars);
		try {
			const raw = localStorage.getItem("unlockedCharacters");
			if (raw) {
				unlockedChars = JSON.parse(raw);
			}
		} catch {
			unlockedChars = [];
		}

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
		frame.position.set(-frame.width * 0.5, -frame.height * 0.2);
		this.backgroundContainer.addChild(frame);

		// Creamos el objeto de texto que irá dentro del banner
		this.bannerText = new Text(
			"",
			new TextStyle({
				fontFamily: "Pixelate-Regular",
				fill: "#ffffff",
				fontSize: 100,
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
		this.sliderContainer.y = -500;
		this.backgroundContainer.addChild(this.sliderContainer);

		// Carga de sprites de personajes (placeholders)
		// Solo el primero se mostrará desbloqueado; los demás aparecerán bloqueados
		const characterTextures = ["idle1", "newidle1", "alienidle1"];
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
		unlockedChars.forEach((i) => this.unlockCharacter(i));

		// Botón de navegación izquierda
		const leftButton = Sprite.from("leftArrow");
		leftButton.anchor.set(0.5);
		leftButton.scale.set(0.5);
		leftButton.x = -background.width * 0.5 + 80;
		leftButton.y = -400;
		leftButton.eventMode = "static";
		leftButton.interactive = true;
		leftButton.on("pointertap", () => this.selectPrevious());
		this.backgroundContainer.addChild(leftButton);

		// Botón de navegación derecha
		const rightButton = Sprite.from("rightArrow");
		rightButton.anchor.set(0.5);
		rightButton.scale.set(0.5);
		rightButton.x = background.width * 0.5 - 80;
		rightButton.y = -400;
		rightButton.eventMode = "static";
		rightButton.interactive = true;
		rightButton.on("pointertap", () => this.selectNext());
		this.backgroundContainer.addChild(rightButton);

		// Botón para volver al menú
		this.backButton = Sprite.from("return");
		this.backButton.anchor.set(0.5);
		this.backButton.y = background.height * 0.5 - this.backButton.height - 100;
		this.backButton.eventMode = "static";
		this.backButton.interactive = true;
		this.backButton.on("pointertap", () => {
			Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
		this.backgroundContainer.addChild(this.backButton);

		// 👉 register yourself as the one true instance:
		CharacterSelectorScene._instance = this;
		// flush any pending
		CharacterSelectorScene.pendingUnlocks.forEach((i) => this.unlockCharacter(i));
		CharacterSelectorScene.pendingUnlocks = [];

		AdMobManager.showBanner();

		// ─────────────────────────────────────────────────────────────────
		// 🛠️  DEBUG BUTTONS
		// ─────────────────────────────────────────────────────────────────
		const debugStyle = new TextStyle({ fontFamily: "Daydream", fontSize: 18, fill: "#00ff00" });

		// Unlock button
		const btnUnlock = new Text("🔓 Unlock", debugStyle);
		btnUnlock.position.set(-this.width * 0.41, -this.height * 0.45 + 50);
		btnUnlock.interactive = true;
		btnUnlock.alpha = 0.2;

		btnUnlock.eventMode = "static";
		btnUnlock.on("pointertap", () => {
			CharacterSelectorScene.unlock(this.selectedIndex);
		});
		// this.backgroundContainer.addChild(btnUnlock);

		// Lock button
		const btnLock = new Text("🔒 Lock", debugStyle);
		btnLock.position.set(-this.width * 0.41, -this.height * 0.45 + 80);
		btnLock.interactive = true;
		btnLock.eventMode = "static";
		btnLock.alpha = 0.2;

		btnLock.on("pointertap", () => {
			CharacterSelectorScene.lock(this.selectedIndex);
		});
		// this.backgroundContainer.addChild(btnLock);

		// ─────────────────────────────────────────────────────────────────

		// ───────────────────────────────────────────────────────────
		//  Add the Select/Equipped button
		// ───────────────────────────────────────────────────────────
		this.actionButton = new Sprite();
		this.actionButton.anchor.set(0.5);
		this.actionButton.position.set(0, background.height * 0.5 - 560);
		this.actionButton.eventMode = "static";
		this.backgroundContainer.addChild(this.actionButton);

		// Texto auxiliar solo para cuando el personaje está bloqueado
		const btnStyle = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fontSize: 90,
			fill: "#ffffff",
			stroke: "#000000",
			strokeThickness: 4,
		});
		this.actionButtonText = new Text("", btnStyle);
		this.actionButtonText.anchor.set(0.5);
		this.actionButtonText.position.y = -800;
		this.actionButton.addChild(this.actionButtonText);

		// initial update
		this.updateActionButton();

		// whenever you change selection:
		// wrap your selectNext/selectPrevious to also update button:
		const origNext = this.selectNext.bind(this);
		this.selectNext = () => {
			origNext();
			this.updateActionButton();
		};
		const origPrev = this.selectPrevious.bind(this);
		this.selectPrevious = () => {
			origPrev();
			this.updateActionButton();
		};

		// also after unlockCharacter:
		const origUnlock = this.unlockCharacter.bind(this);
		this.unlockCharacter = (idx: number) => {
			origUnlock(idx);
			this.updateActionButton();
		};
	}

	/** Shows/hides & configures the action button */
	private updateActionButton(): void {
		const idx = this.selectedIndex;
		const container = this.characters[idx] as any;

		// Limpiamos eventos previos
		this.actionButton.off("pointertap");

		if (!container.unlocked) {
			// --- PERSONAJE BLOQUEADO ---
			this.actionButton.visible = true;
			// Usamos la textura de "select" como base para el botón de unlock o una genérica
			this.actionButton.texture = Texture.from("select");
			this.actionButtonText.text = "🎥 Unlock Free";
			this.actionButtonText.visible = true;

			this.actionButton.interactive = true;
			this.actionButton.alpha = 1.0;

			this.actionButton.once("pointertap", async () => {
				await AdMobManager.showRewardedAd((_reward) => {
					this.unlockCharacter(idx);
					this.updateActionButton();
				});
			});
		} else {
			// --- PERSONAJE DESBLOQUEADO ---
			this.actionButtonText.visible = false; // Ocultamos el texto ya que usaremos el sprite
			this.actionButton.visible = true;

			if (idx === this.getEquippedIndex()) {
				// ESTADO: EQUIPPED
				this.actionButton.texture = Texture.from("equipped");
				this.actionButton.interactive = false;
				this.actionButton.alpha = 1; // Un poco transparente para indicar que ya está puesto
			} else {
				// ESTADO: SELECT
				this.actionButton.texture = Texture.from("select");
				this.actionButton.interactive = true;
				this.actionButton.alpha = 1.0;

				this.actionButton.once("pointertap", () => {
					this.selectCharacter(idx);
					localStorage.setItem("equippedCharacter", idx.toString());
					this.updateActionButton();
				});
			}
		}
	}

	/** Read the currently equipped from storage (default 0) */
	private getEquippedIndex(): number {
		const raw = localStorage.getItem("equippedCharacter");
		const i = raw !== null ? parseInt(raw, 10) : NaN;
		return isNaN(i) || i < 0 || i >= this.characters.length ? 0 : i;
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
			switch (this.selectedIndex) {
				case 0:
					this.bannerText.text = "Speed: 200\n\nHealth: 3\n";
					break;
				case 1:
					this.bannerText.text = "Speed: 200\n\nHealth: 5\n";

					break;
				case 2:
					this.bannerText.text = "Speed: 500\n\nHealth: 3\n\nRevive: 1\n";

					break;

				default:
					this.bannerText.text = "No description available yet";

					break;
			}
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

	/** Smoothly moves the slider so `selectedIndex = index` */
	private selectCharacter(index: number): void {
		const n = this.characters.length;
		// Si no hay personajes cargados, no hacemos nada
		if (n === 0) {
			return;
		}

		this.selectedIndex = index;

		this.characters.forEach((char, i) => {
			// SEGURIDAD: Si el objeto fue destruido o es null, saltar
			if (!char || char.destroyed) {
				return;
			}

			const offset = (i - index + n) % n;
			let targetX: number,
				targetScale = 1.0,
				targetAlpha = 1;

			if (offset === 0) {
				targetX = 0;
				targetScale = (char as any).unlocked ? 1.5 : 1.0;
			} else if (offset === 1) {
				targetX = this.spacing;
			} else if (offset === n - 1) {
				targetX = -this.spacing;
			} else {
				targetX = this.spacing * 2;
				targetAlpha = 0;
			}

			new Tween(char)
				.to({ x: targetX, alpha: targetAlpha, scale: { x: targetScale, y: targetScale } }, 300)
				.easing(Easing.Cubic.Out)
				.start();
		});

		this.updateZIndices();
		this.updateBanner();
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}

	/** Persist current unlocks array */
	private saveUnlocks(): void {
		const unlocked = this.characters.map((c, i) => ((c as any).unlocked ? i : -1)).filter((i) => i >= 0);
		localStorage.setItem("unlockedCharacters", JSON.stringify(unlocked));
	}

	/** Unlock one slot, animate, update banner, and persist */
	public unlockCharacter(index: number): void {
		const charContainer = this.characters[index];
		if (!charContainer) {
			return;
		}

		(charContainer as any).unlocked = true;
		// clear tint
		charContainer.children.filter((c) => c instanceof Sprite).forEach((s: Sprite) => (s.tint = 0xffffff));
		// remove “Blocked” texts
		charContainer.children.filter((c) => c instanceof Text && c.text.trim().toLowerCase() === "blocked").forEach((l) => charContainer.removeChild(l));

		// animate & banner if centered
		if (this.selectedIndex === index) {
			new Tween(charContainer)
				.to({ scale: { x: 1.5, y: 1.5 } }, 300)
				.easing(Easing.Cubic.Out)
				.start();
			this.updateBanner();
		}

		this.selectCharacter(index);
		this.saveUnlocks();
	}

	/** Mirror: lock one slot and persist */
	public lockCharacter(index: number): void {
		const charContainer = this.characters[index];
		if (!charContainer) {
			return;
		}

		(charContainer as any).unlocked = false;

		// re‑apply tint
		charContainer.children.filter((c) => c instanceof Sprite).forEach((s: Sprite) => (s.tint = 0x000000));

		// re‑add “Blocked”
		const hasLock = charContainer.children.some((c) => c instanceof Text && c.text.trim().toLowerCase() === "blocked");
		if (!hasLock) {
			const lockText = new Text(
				"Blocked",
				new TextStyle({
					fontFamily: "Daydream",
					fill: "#ffffff",
					fontSize: 24,
				})
			);
			lockText.anchor.set(0.5);
			lockText.position.set(0, 0);
			charContainer.addChild(lockText);
		}

		if (this.selectedIndex === index) {
			new Tween(charContainer)
				.to({ scale: { x: 1.0, y: 1.0 } }, 300)
				.easing(Easing.Cubic.Out)
				.start();
			this.updateBanner();
		}

		this.saveUnlocks();
	}

	/** Static helpers */
	public static unlock(index: number): void {
		if (CharacterSelectorScene._instance) {
			CharacterSelectorScene._instance.unlockCharacter(index);
		} else {
			CharacterSelectorScene.pendingUnlocks.push(index);
		}
	}
	public static lock(index: number): void {
		if (CharacterSelectorScene._instance) {
			CharacterSelectorScene._instance.lockCharacter(index);
		} else {
			CharacterSelectorScene.pendingUnlocks.push(index);
		}
	}

	public override destroy(_options?: any): void {
		AdMobManager.hideBanner();
		CharacterSelectorScene._instance = null;
		super.destroy();
	}
}
