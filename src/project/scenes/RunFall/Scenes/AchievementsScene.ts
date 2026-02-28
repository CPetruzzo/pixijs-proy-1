import type { FederatedPointerEvent } from "pixi.js";
// AchievementsScene.ts
import { Container, Sprite, Text, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Tween } from "tweedle.js";
import type { Achievement } from "../Managers/AchievementsManager";
import { AchievementsManager } from "../Managers/AchievementsManager";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { Manager } from "../../../..";
import { MenuScene } from "./MenuScene";
import { FadeColorTransition } from "../../../../engine/scenemanager/transitions/FadeColorTransition";
import { CharacterSelectorScene } from "./CharacterSelectorScene";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { Sounds } from "../Managers/SoundManager";

/**
 * Clase que representa una "card" individual para un logro.
 */
class AchievementCard extends Container {
	public achievement: Achievement;
	private background: Sprite;
	private titleText: Text;
	private descriptionText: Text; // Nueva propiedad para la descripción fija
	private overlayText?: Text;
	private cardWidth: number;
	private cardHeight: number;

	constructor(achievement: Achievement, cardWidth: number, cardHeight: number) {
		super();
		this.achievement = achievement;
		this.cardWidth = cardWidth;
		this.cardHeight = cardHeight;
		this.createCard();
		// Ya no necesitamos que sea interactiva para mostrar la descripción
	}

	private createCard(): void {
		const isUnlocked = this.achievement.unlocked;

		// 1. Determinar texturas y colores según el estado
		const bgTexture = isUnlocked ? "emptyBannerGold" : "emptyBanner";
		const titleColor = isUnlocked ? 0x000000 : 0xffffff; // Gris oscuro vs Blanco
		const descColor = isUnlocked ? 0x3a3a3a : 0xcccccc; // Gris medio vs Gris claro

		// Fondo de la card
		this.background = Sprite.from(bgTexture);
		this.background.scale.set(0.5);
		this.addChild(this.background);

		// Título
		this.titleText = new Text(this.achievement.title, {
			fontSize: 90,
			align: "center",
			lineHeight: 80,
			wordWrap: true,
			wordWrapWidth: this.cardWidth * 2.5,
			fill: titleColor, // Color dinámico
			fontFamily: "Pixelate-Regular",
		});
		this.titleText.anchor.set(0.5);
		this.titleText.position.set(this.cardWidth * 1.55, this.cardHeight - 150);
		this.background.addChild(this.titleText);

		// Descripción FIJA
		this.descriptionText = new Text(this.achievement.description, {
			fontSize: 65,
			fill: descColor, // Color dinámico
			fontFamily: "Pixelate-Regular",
			wordWrap: true,
			align: "center",
			wordWrapWidth: this.cardWidth * 2.2,
		});
		this.descriptionText.anchor.set(0.5, 0);
		this.descriptionText.position.set(this.cardWidth * 1.55, this.cardHeight);
		this.background.addChild(this.descriptionText);

		// Lógica para estado Bloqueado
		if (!isUnlocked) {
			this.overlayText = new Text("Bloqueado", {
				fontSize: 70,
				wordWrap: true,
				wordWrapWidth: this.cardWidth * 0.5,
				fill: 0xff0000,
				fontFamily: "Pixelate-Regular",
			});
			this.overlayText.anchor.set(0.5);
			this.overlayText.position.set(this.cardWidth * 1.5, this.cardHeight + 280);
			this.background.addChild(this.overlayText);

			this.descriptionText.alpha = 0.5;
		}
	}

	/**
	 * Actualiza la card y también los colores del texto al desbloquear
	 */
	public unlock(): void {
		if (!this.achievement.unlocked) {
			this.achievement.unlocked = true;

			// Cambiar textura a dorado
			this.background.texture = Texture.from("emptyBannerGold");

			// Cambiar colores de texto a gris oscuro
			this.titleText.style.fill = 0x3a3a3a;
			this.descriptionText.style.fill = 0x5a5a5a;
			this.descriptionText.alpha = 1;

			if (this.overlayText) {
				new Tween(this.overlayText)
					.to({ alpha: 0 }, 500)
					.start()
					.onComplete(() => {
						this.removeChild(this.overlayText);
						this.overlayText = undefined;
					});
			}
		}
	}
}

/**
 * Escena de logros que muestra una grid de AchievementCard.
 * Ahora el contenedor de las cards es scrolleable y se aplica una máscara degradada en la parte inferior.
 */
export class AchievementsScene extends PixiScene {
	private achievementsManager: AchievementsManager;
	// Contenedor original de las cards
	private cardsContainer: Container = new Container();
	// Contenedor que actúa como viewport scrollable
	private scrollContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	private uiContainer: Container = new Container();

	private bleedingBackgroundContainer: Container = new Container();
	private backButton: Sprite;
	public static readonly BUNDLES = ["fallrungame", "runfallsfx"];

	// Variables para scroll (drag vertical)
	private isDragging: boolean = false;
	private dragStartY: number = 0;
	private contentStartY: number = 0;
	// Altura del viewport para clamping
	private viewportHeight: number = 0;
	// Sprite que sirve de máscara con degradé
	private scrollMask: Sprite;
	private scrollHitArea: Sprite; // Nueva propiedad

	// NUEVAS variables para inercia
	private velocity: number = 0;
	private friction: number = 0.98; // Qué tan rápido se detiene (0.9 a 0.99)
	private lastPointerY: number = 0;

	constructor() {
		super();

		this.cardsContainer.name = "CARDS_CONTAINER";
		// Agregamos fondos, scrollContainer y luego el overlay (si se necesitara en el futuro)
		this.addChild(this.bleedingBackgroundContainer, this.backgroundContainer, this.scrollContainer, this.uiContainer);
		// Creamos el sprite de máscara (inicialmente con una textura vacía)
		this.scrollMask = new Sprite(Texture.EMPTY);
		this.scrollMask.name = "SCROLL_MASK";
		this.scrollContainer.mask = this.scrollMask;
		this.addChild(this.scrollMask);

		// Creamos el hit area invisible
		this.scrollHitArea = new Sprite(Texture.WHITE);
		this.scrollHitArea.tint = 0x000000;
		this.scrollHitArea.alpha = 0; // Totalmente invisible
		this.scrollHitArea.name = "SCROLL_HIT_AREA";
		// Fondo para la ambientación
		const bleedBG = Sprite.from("playerSelectBG");
		bleedBG.anchor.set(0.5);
		this.bleedingBackgroundContainer.addChild(bleedBG);

		// Fondo principal
		const background = Sprite.from("playerSelectBG");
		background.position.set(-background.width * 0.5, -background.height * 0.5);
		this.backgroundContainer.addChild(background);

		// Configuramos el scrollContainer para detectar drag
		this.scrollContainer.interactive = true;
		this.scrollContainer.on("pointerdown", this.onDragStart, this);
		this.scrollContainer.on("pointermove", this.onDragMove, this);
		this.scrollContainer.on("pointerup", this.onDragEnd, this);
		this.scrollContainer.on("pointerupoutside", this.onDragEnd, this);

		// Agregamos las cards al scrollContainer
		this.scrollContainer.addChild(this.scrollHitArea);
		this.scrollContainer.addChild(this.cardsContainer);

		// Obtén la instancia global del AchievementsManager
		this.achievementsManager = AchievementsManager.getInstance();
		this.createCards();

		// Escucha el evento para actualizar las cards cuando se desbloquee un logro
		this.achievementsManager.on("achievementUnlocked", (achievement: Achievement) => {
			for (const child of this.cardsContainer.children) {
				if (child instanceof AchievementCard && child.achievement.id === achievement.id) {
					child.unlock();
					break;
				}
			}

			// 2) check the “meteor_crasher” trio
			const meteorIds = ["meteor_crasher_1", "meteor_crasher_2", "meteor_crasher_3"];
			const allMeteor = this.achievementsManager
				.getAchievements()
				.filter((a) => meteorIds.includes(a.id))
				.every((a) => a.unlocked);

			if (allMeteor) {
				console.log("allMeteor", allMeteor);
				// unlock character #1
				CharacterSelectorScene.unlock(1);
			}
		});

		// Botón para volver al menú
		this.backButton = Sprite.from("return");
		this.backButton.anchor.set(0.5);
		this.backButton.y = background.height * 0.5 - this.backButton.height - 100;
		this.backButton.eventMode = "static";
		this.backButton.interactive = true;
		this.backButton.on("pointertap", () => {
			SoundLib.playSound(Sounds.CLOSEPOPUP, { volume: 0.04 });

			Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
		this.uiContainer.addChild(this.backButton);
	}

	/**
	 * Crea y organiza las cards en una grid.
	 */
	private createCards(): void {
		const achievements = this.achievementsManager.getAchievements();
		const gap = 120;
		const columns = 1;

		achievements.forEach((achievement, index) => {
			const cardWidth = 260;
			const cardHeight = 300;
			const card = new AchievementCard(achievement, cardWidth, cardHeight);
			const col = index % columns;
			const row = Math.floor(index / columns);
			card.x = col * (cardWidth + gap);
			card.y = row * (cardHeight + gap);
			this.cardsContainer.addChild(card);
		});
	}

	/**
	 * Crea una textura degradada usando un canvas.
	 * La textura es completamente opaca en la mayor parte y se desvanece en la parte inferior.
	 */
	private createGradientTexture(width: number, height: number): Texture {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			// Creamos un degradé vertical que se mantiene opaco hasta el 80% y luego se desvanece
			const gradient = ctx.createLinearGradient(0, 0, 0, height);
			gradient.addColorStop(0, "rgba(255,255,255,1)");
			gradient.addColorStop(0.8, "rgba(255,255,255,1)");
			gradient.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, width, height);
		}
		return Texture.from(canvas);
	}

	/**
	 * Eventos para el scroll: inicia el drag.
	 */
	private onDragStart(e: FederatedPointerEvent): void {
		this.isDragging = true;
		this.velocity = 0; // Resetear velocidad al tocar
		this.dragStartY = e.data.global.y;
		this.lastPointerY = e.data.global.y;
		this.contentStartY = this.cardsContainer.y;
	}

	/**
	 * Durante el drag, mueve el contenido verticalmente y hace clamp para no salir del viewport.
	 */
	private onDragMove(e: FederatedPointerEvent): void {
		if (!this.isDragging) {
			return;
		}

		const currentY = e.data.global.y;

		// Calcular velocidad instantánea para la inercia
		this.velocity = currentY - this.lastPointerY;
		this.lastPointerY = currentY;

		// Movimiento directo del drag
		const deltaY = currentY - this.dragStartY;
		this.cardsContainer.y = this.contentStartY + deltaY;

		this.applyConstraints();
	}

	/**
	 * Finaliza el drag.
	 */
	private onDragEnd(_e: FederatedPointerEvent): void {
		this.isDragging = false;
	}

	/**
	 * Mantiene el contenedor dentro de los límites permitidos.
	 */
	private applyConstraints(): void {
		const contentBounds = this.cardsContainer.getBounds();
		// Solo aplicamos límites si el contenido es más alto que el área visible
		if (contentBounds.height > this.viewportHeight) {
			if (this.cardsContainer.y > 0) {
				this.cardsContainer.y = 0;
				this.velocity = 0; // Detener si choca arriba
			}
			const minHeight = this.viewportHeight - contentBounds.height;
			if (this.cardsContainer.y < minHeight) {
				this.cardsContainer.y = minHeight;
				this.velocity = 0; // Detener si choca abajo
			}
		} else {
			this.cardsContainer.y = 0;
		}
	}

	/**
	 * Ajusta la posición o escala de la grid y actualiza la máscara degradada del scroll según el tamaño de la pantalla.
	 */
	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);

		this.x = newW * 0.5;
		this.y = newH * 0.5;

		// Actualizamos el viewport del scroll (usamos un 70% de newH como altura visible)
		this.viewportHeight = newH * 0.7;

		// Creamos o actualizamos la textura degradada para la máscara
		const maskWidth = newW * 0.9;
		const maskHeight = newH * 0.9;
		const gradientTexture = this.createGradientTexture(maskWidth, maskHeight);
		this.scrollMask.texture = gradientTexture;
		this.scrollMask.width = maskWidth;
		this.scrollMask.height = maskHeight;
		// Posicionamos la máscara para que cubra el área deseada (ajusta el offset según necesites)
		this.scrollMask.position.set(-newW * 0.5, -newH * 0.5);

		// Ajustamos el Hit Area para que cubra toda la pantalla o el área de scroll
		// Usamos el tamaño de la máscara como referencia
		this.scrollHitArea.width = newW;
		this.scrollHitArea.height = newH;
		this.scrollHitArea.position.set(-newW * 0.5, -newH * 0.5);

		// Actualizamos el scaling de las cards según el nuevo tamaño
		ScaleHelper.setScaleRelativeToIdeal(this.cardsContainer, newW * 1.2, newH * 1.2, 720, 1600, ScaleHelper.FIT);
		const containerBounds = this.cardsContainer.getLocalBounds();
		this.cardsContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.1);
	}

	public override update(_dt: number): void {
		// Si no estamos arrastrando y hay velocidad, aplicamos inercia
		if (!this.isDragging && Math.abs(this.velocity) > 0.1) {
			this.cardsContainer.y += this.velocity;
			this.velocity *= this.friction; // Aplicar rozamiento

			this.applyConstraints();
		}
	}
}
