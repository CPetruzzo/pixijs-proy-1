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

/**
 * Clase que representa una "card" individual para un logro.
 */
class AchievementCard extends Container {
	public achievement: Achievement;
	private background: Sprite;
	private titleText: Text;
	private overlayText?: Text;
	private cardWidth: number;
	private cardHeight: number;

	constructor(achievement: Achievement, cardWidth: number, cardHeight: number) {
		super();
		this.achievement = achievement;
		this.cardWidth = cardWidth;
		this.cardHeight = cardHeight;
		this.createCard();
		this.interactive = true;
		this.on("pointertap", this.onPointerTap.bind(this));
	}

	private createCard(): void {
		// Fondo de la card
		this.background = Sprite.from("achievement1");
		this.background.scale.set(0.5);
		this.addChild(this.background);

		// Título centrado (nombre del logro)
		this.titleText = new Text(this.achievement.title, {
			fontSize: 23,
			align: "center",
			lineHeight: 50,
			wordWrap: true,
			wordWrapWidth: this.cardWidth * 0.9,
			fill: 0xffffff,
			fontFamily: "Daydream",
		});
		this.titleText.anchor.set(0.5);
		this.titleText.position.set(this.cardWidth * 1.5, this.cardHeight);
		this.background.addChild(this.titleText);

		// Si el logro está bloqueado, la card se muestra en alpha 0.5 con un texto superpuesto
		if (!this.achievement.unlocked) {
			this.background.texture = Texture.from("achievement2");
			this.overlayText = new Text("Locked", { fontSize: 20, wordWrap: true, wordWrapWidth: this.cardWidth * 0.5, fill: 0xff0000, fontFamily: "Daydream" });
			this.overlayText.anchor.set(0.5);
			this.overlayText.position.set(this.cardWidth * 1.5, this.cardHeight + 280);
			this.background.addChild(this.overlayText);
		} else {
			this.background.texture = Texture.from("achievement1");
		}
	}

	/**
	 * Al hacer pointertap se muestra la descripción del logro en una etiqueta temporal.
	 */
	private onPointerTap(): void {
		const descText = new Text(this.achievement.description, {
			fontSize: 9,
			fill: 0xffffff,
			fontFamily: "Daydream",
			wordWrap: true,
			align: "center",
			wordWrapWidth: this.cardWidth * 0.5,
		});
		descText.anchor.set(0.5);
		descText.position.set(this.cardWidth - descText.width * 0.5, this.cardHeight - 65);
		this.addChild(descText);
		new Tween(descText)
			.to({ alpha: 0 }, 4000)
			.start()
			.onComplete(() => {
				this.removeChild(descText);
			});
	}

	/**
	 * Actualiza la card a su estado "desbloqueado": anima a alpha: 1 y remueve el texto superpuesto.
	 */
	public unlock(): void {
		if (!this.achievement.unlocked) {
			this.achievement.unlocked = true;
			new Tween(this).to({ alpha: 1 }, 500).start();
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
	private bleedingBackgroundContainer: Container = new Container();
	private backButton: Sprite;
	public static readonly BUNDLES = ["fallrungame", "sfx"];

	// Variables para scroll (drag vertical)
	private isDragging: boolean = false;
	private dragStartY: number = 0;
	private contentStartY: number = 0;
	// Altura del viewport para clamping
	private viewportHeight: number = 0;
	// Sprite que sirve de máscara con degradé
	private scrollMask: Sprite;

	constructor() {
		super();

		this.cardsContainer.name = "CARDS_CONTAINER";
		// Agregamos fondos, scrollContainer y luego el overlay (si se necesitara en el futuro)
		this.addChild(this.bleedingBackgroundContainer, this.backgroundContainer, this.scrollContainer);
		// Creamos el sprite de máscara (inicialmente con una textura vacía)
		this.scrollMask = new Sprite(Texture.EMPTY);
		this.scrollMask.name = "SCROLL_MASK";
		this.scrollContainer.mask = this.scrollMask;
		this.addChild(this.scrollMask);

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
		this.backButton.y = background.height * 0.5 - this.backButton.height;
		this.backButton.eventMode = "static";
		this.backButton.interactive = true;
		this.backButton.on("pointertap", () => {
			Manager.changeScene(MenuScene, { transitionClass: FadeColorTransition, transitionParams: [] });
		});
		this.backgroundContainer.addChild(this.backButton);
	}

	/**
	 * Crea y organiza las cards en una grid.
	 */
	private createCards(): void {
		const achievements = this.achievementsManager.getAchievements();
		const gap = 120;
		const columns = 2;

		achievements.forEach((achievement, index) => {
			const cardWidth = 150;
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
		this.dragStartY = e.data.global.y;
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
		const deltaY = currentY - this.dragStartY;
		this.cardsContainer.y = this.contentStartY + deltaY;

		// Clampeo: si el contenido es mayor que el viewport, evito moverlo de más
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

	/**
	 * Finaliza el drag.
	 */
	private onDragEnd(_e: FederatedPointerEvent): void {
		this.isDragging = false;
	}

	/**
	 * Ajusta la posición o escala de la grid y actualiza la máscara degradada del scroll según el tamaño de la pantalla.
	 */
	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW * 0.7, newH * 0.7, 720, 1600, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.bleedingBackgroundContainer, newW * 3, newH * 2, 720, 1600, ScaleHelper.FILL);
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

		// Actualizamos el scaling de las cards según el nuevo tamaño
		ScaleHelper.setScaleRelativeToIdeal(this.cardsContainer, newW * 1.2, newH * 1.2, 720, 1600, ScaleHelper.FIT);
		const containerBounds = this.cardsContainer.getLocalBounds();
		this.cardsContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.23);
	}

	public override update(_dt: number): void {
		// Actualiza animaciones o lógica propia de la escena, si fuera necesario.
	}
}
