import type { FederatedPointerEvent } from "pixi.js";
import { Container, Sprite, Text, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Tween } from "tweedle.js";
import type { Achievement } from "../../../../engine/achievement/AchievementsManager";
import { AchievementsManager } from "../../../../engine/achievement/AchievementsManager";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Manager } from "../../../..";
import { MenuScene } from "./MenuScene";
import { FadeColorTransition } from "../../../../engine/scenemanager/transitions/FadeColorTransition";
import { CharacterSelectorScene } from "./CharacterSelectorScene";
import { initRunFallAchievements, type RunFallGameState } from "../Objects/RunFallAchievements";
/**
 * Clase que representa una "card" individual para un logro.
 */
class AchievementCard extends Container {
	public achievement: Achievement<any>; // Usamos any o el genérico si queremos ser estrictos
	private background: Sprite;
	private iconSprite: Sprite; // Nuevo sprite para el icono
	private titleText: Text;
	private overlayText?: Text;
	private cardWidth: number;
	private cardHeight: number;

	constructor(achievement: Achievement<any>, cardWidth: number, cardHeight: number) {
		super();
		this.achievement = achievement;
		this.cardWidth = cardWidth;
		this.cardHeight = cardHeight;
		this.createCard();
		this.interactive = true;
		this.on("pointertap", this.onPointerTap.bind(this));
	}

	private createCard(): void {
		// 1. Fondo de la card (Marco)
		// Usamos la textura según si está desbloqueado o no
		const bgTextureName = this.achievement.unlocked ? "achievement1" : "achievement2";
		this.background = Sprite.from(bgTextureName);
		this.background.scale.set(0.5); // Ajusta según el tamaño de tu asset original
		this.addChild(this.background);

		// 2. Icono del logro (Nuevo)
		// Si tienes una textura por defecto para errores, úsala, si no, usa el nombre del config
		try {
			this.iconSprite = Sprite.from(this.achievement.icon);
		} catch (e) {
			this.iconSprite = Sprite.from("default_icon"); // Fallback
		}

		// Centramos el icono en la carta
		this.iconSprite.anchor.set(0.5);
		this.iconSprite.position.set(this.cardWidth * 0.5, this.cardHeight * 0.4);

		// Escalar icono para que quepa bien
		const maxIconSize = 100;
		const scale = Math.min(maxIconSize / this.iconSprite.width, maxIconSize / this.iconSprite.height);
		this.iconSprite.scale.set(scale);

		// Si está bloqueado, oscurecemos el icono (tinte negro) o lo ocultamos
		if (!this.achievement.unlocked) {
			this.iconSprite.tint = 0x000000;
			this.iconSprite.alpha = 0.5;
		}

		// Nota: Agregamos el icono AL FONDO o al contenedor, dependiendo de cómo sea tu asset de fondo.
		// Si el fondo es un marco transparente, añádelo antes. Si es solido, añádelo después.
		this.background.addChild(this.iconSprite);
		// Corrección de posición relativa al background (ya que agregué iconSprite a background)
		this.iconSprite.position.set(this.background.width, this.background.height * 0.8); // Ajuste manual según tu asset

		// 3. Título centrado
		this.titleText = new Text(this.achievement.title, {
			fontSize: 73,
			align: "center",
			lineHeight: 60,
			wordWrap: true,
			wordWrapWidth: this.cardWidth * 0.9,
			fill: 0xffffff,
			fontFamily: "Pixelate-Regular",
		});
		this.titleText.anchor.set(0.5);
		// Ajustamos posición relativa al background
		this.titleText.position.set(this.background.width, this.background.height * 1.6);
		this.background.addChild(this.titleText);

		// 4. Estado Bloqueado (Overlay)
		if (!this.achievement.unlocked) {
			this.overlayText = new Text("Locked", {
				fontSize: 20,
				fill: 0xff0000,
				fontFamily: "Daydream",
				stroke: 0x000000,
				strokeThickness: 3,
			});
			this.overlayText.anchor.set(0.5);
			this.overlayText.position.set(this.background.width, this.background.height); // Centro visual
			this.background.addChild(this.overlayText);
		}
	}

	private onPointerTap(): void {
		// Muestra descripción temporal
		const descText = new Text(this.achievement.description, {
			fontSize: 18, // Un poco más grande para leerse bien
			fill: 0xffffff,
			fontFamily: "Daydream",
			wordWrap: true,
			align: "center",
			wordWrapWidth: this.cardWidth * 1.2,
			dropShadow: true,
			dropShadowColor: 0x000000,
			dropShadowDistance: 2,
		});
		descText.anchor.set(0.5);
		// Posición global relativa a la carta (ajustar según necesidad)
		descText.position.set(this.cardWidth / 2, this.cardHeight / 2);

		this.addChild(descText);
		new Tween(descText)
			.to({ alpha: 0 }, 4000) // 4 segundos fade out
			.start()
			.onComplete(() => {
				this.removeChild(descText);
			});
	}

	public unlock(): void {
		if (!this.achievement.unlocked) {
			this.achievement.unlocked = true;

			// Animación de desbloqueo visual
			new Tween(this).to({ alpha: 1 }, 500).start();

			// Cambiar marco
			this.background.texture = Texture.from("achievement1");

			// Restaurar icono
			this.iconSprite.tint = 0xffffff;
			this.iconSprite.alpha = 1;

			if (this.overlayText) {
				new Tween(this.overlayText)
					.to({ alpha: 0 }, 500)
					.start()
					.onComplete(() => {
						if (this.overlayText) {
							this.background.removeChild(this.overlayText);
							this.overlayText = undefined;
						}
					});
			}
		}
	}
}

/**
 * Escena principal de Logros
 */
export class AchievementsScene extends PixiScene {
	// Tipado fuerte con el estado de tu juego
	private achievementsManager: AchievementsManager<RunFallGameState>;

	private cardsContainer: Container = new Container();
	private scrollContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	private bleedingBackgroundContainer: Container = new Container();
	private backButton: Sprite;

	public static readonly BUNDLES = ["fallrungame", "sfx"];

	// Scroll vars
	private isDragging: boolean = false;
	private dragStartY: number = 0;
	private contentStartY: number = 0;
	private viewportHeight: number = 0;
	private scrollMask: Sprite;

	constructor() {
		super();

		this.cardsContainer.name = "CARDS_CONTAINER";
		this.addChild(this.bleedingBackgroundContainer, this.backgroundContainer, this.scrollContainer);

		// Máscara
		this.scrollMask = new Sprite(Texture.EMPTY);
		this.scrollContainer.mask = this.scrollMask;
		this.addChild(this.scrollMask);

		// Fondos
		const bleedBG = Sprite.from("playerSelectBG");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		const background = Sprite.from("playerSelectBG");
		background.position.set(-background.width * 0.5, -background.height * 0.5);
		this.backgroundContainer.addChild(background);

		// Eventos Scroll
		this.scrollContainer.interactive = true;
		this.scrollContainer.on("pointerdown", this.onDragStart, this);
		this.scrollContainer.on("pointermove", this.onDragMove, this);
		this.scrollContainer.on("pointerup", this.onDragEnd, this);
		this.scrollContainer.on("pointerupoutside", this.onDragEnd, this);
		this.scrollContainer.addChild(this.cardsContainer);

		// --- INTEGRACIÓN DEL MANAGER ---
		// Obtenemos la instancia tipada
		this.achievementsManager = AchievementsManager.getInstance<RunFallGameState>();
		this.achievementsManager = initRunFallAchievements();

		// Verificación de seguridad en consola
		console.log("Achievements cargados:", this.achievementsManager.getAll().length);
		this.createCards();

		// Escucha eventos
		this.achievementsManager.on("achievementUnlocked", (achievement: Achievement<RunFallGameState>) => {
			// 1. Actualizar visualmente la carta
			for (const child of this.cardsContainer.children) {
				if (child instanceof AchievementCard && child.achievement.id === achievement.id) {
					child.unlock();
					break;
				}
			}

			// 2. Lógica específica de RunFall (Personaje oculto)
			this.checkHiddenCharacterUnlock();
		});

		// Botón volver
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
	 * Verifica si se cumple la condición especial de los 3 meteoritos
	 */
	private checkHiddenCharacterUnlock(): void {
		const meteorIds = ["meteor_crasher_1", "meteor_crasher_2", "meteor_crasher_3"];
		// IMPORTANTE: Ahora usamos .getAll() en lugar de .getAchievements()
		const allMeteor = this.achievementsManager
			.getAll()
			.filter((a) => meteorIds.includes(a.id))
			.every((a) => a.unlocked);

		if (allMeteor) {
			console.log("¡Trío de meteoritos completado! Desbloqueando personaje...");
			CharacterSelectorScene.unlock(1);
		}
	}

	private createCards(): void {
		// IMPORTANTE: Cambio de método a .getAll()
		const achievements = this.achievementsManager.getAll();
		const gap = 120;
		const columns = 2;

		achievements.forEach((achievement, index) => {
			const cardWidth = 150;
			const cardHeight = 300;
			// Pasamos el logro completo (que ahora incluye .icon)
			const card = new AchievementCard(achievement, cardWidth, cardHeight);

			const col = index % columns;
			const row = Math.floor(index / columns);

			card.x = col * (cardWidth + gap);
			card.y = row * (cardHeight + gap);
			this.cardsContainer.addChild(card);
		});
	}

	private createGradientTexture(width: number, height: number): Texture {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			const gradient = ctx.createLinearGradient(0, 0, 0, height);
			gradient.addColorStop(0, "rgba(255,255,255,1)");
			gradient.addColorStop(0.8, "rgba(255,255,255,1)");
			gradient.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, width, height);
		}
		return Texture.from(canvas);
	}

	// --- Lógica de Scroll (Sin cambios mayores) ---
	private onDragStart(e: FederatedPointerEvent): void {
		this.isDragging = true;
		this.dragStartY = e.data.global.y;
		this.contentStartY = this.cardsContainer.y;
	}

	private onDragMove(e: FederatedPointerEvent): void {
		if (!this.isDragging) {
			return;
		}
		const currentY = e.data.global.y;
		const deltaY = currentY - this.dragStartY;
		this.cardsContainer.y = this.contentStartY + deltaY;

		const contentBounds = this.cardsContainer.getBounds();
		if (contentBounds.height > this.viewportHeight) {
			if (this.cardsContainer.y > 0) {
				this.cardsContainer.y = 0;
			}
			if (this.cardsContainer.y < this.viewportHeight - contentBounds.height) {
				this.cardsContainer.y = this.viewportHeight - contentBounds.height;
			}
		} else {
			this.cardsContainer.y = 0;
		}
	}

	private onDragEnd(_e: FederatedPointerEvent): void {
		this.isDragging = false;
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		this.x = newW * 0.5;
		this.y = newH * 0.5;

		this.viewportHeight = newH * 0.7;

		const maskWidth = newW * 0.9;
		const maskHeight = newH * 0.9;
		const gradientTexture = this.createGradientTexture(maskWidth, maskHeight);
		this.scrollMask.texture = gradientTexture;
		this.scrollMask.width = maskWidth;
		this.scrollMask.height = maskHeight;
		this.scrollMask.position.set(-newW * 0.5, -newH * 0.5);

		ScaleHelper.setScaleRelativeToIdeal(this.cardsContainer, newW * 1.2, newH * 1.2, 720, 1600, ScaleHelper.FIT);
		const containerBounds = this.cardsContainer.getLocalBounds();
		this.cardsContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.23);
	}

	// eslint-disable-next-line prettier/prettier
	public override update(_dt: number): void { }
}
