import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Keyboard } from "../../engine/input/Keyboard";
import { Tween, Easing } from "tweedle.js";

export interface InteractableItem {
	x: number;
	y: number;
	radius: number;
	prompt: Container;
	action: () => void;
	condition?: () => boolean;
}

export class InteractableManager {
	private items: InteractableItem[] = [];
	private cooldown: number = 0;
	private sceneContainer: Container;

	constructor(sceneContainer: Container) {
		this.sceneContainer = sceneContainer;
		// IMPORTANTE: Esto permite que zIndex funcione.
		// Si no está en true, zIndex = 999 no hace nada y la 'E' puede quedar oculta.
		this.sceneContainer.sortableChildren = true;
	}

	public add(x: number, y: number, action: () => void, options: { radius?: number; condition?: () => boolean } = {}): InteractableItem {
		const promptContainer = new Container();
		promptContainer.x = x;
		promptContainer.y = y - 50;
		promptContainer.visible = false;
		promptContainer.zIndex = 999; // Aseguramos que esté al frente

		const bg = new Graphics();
		bg.beginFill(0x000000, 0.8);
		bg.lineStyle(2, 0xffffff);
		bg.drawRoundedRect(-15, -15, 30, 30, 5);
		bg.endFill();

		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 20,
			fontWeight: "bold",
			fill: "#ffffff",
		});
		const letter = new Text("E", style);
		letter.anchor.set(0.5);

		promptContainer.addChild(bg, letter);
		this.sceneContainer.addChild(promptContainer);

		new Tween(promptContainer)
			.to({ y: promptContainer.y - 10 }, 800)
			.yoyo(true)
			.repeat(Infinity)
			.easing(Easing.Quadratic.InOut)
			.start();

		const newItem: InteractableItem = {
			x,
			y,
			radius: options.radius || 60,
			prompt: promptContainer,
			action,
			condition: options.condition,
		};

		this.items.push(newItem);
		return newItem;
	}

	public remove(itemToRemove: InteractableItem): void {
		if (itemToRemove.prompt) {
			itemToRemove.prompt.destroy();
		}
		this.items = this.items.filter((i) => i !== itemToRemove);
	}

	public update(dt: number, playerX: number, playerY: number): void {
		if (this.cooldown > 0) {
			this.cooldown -= dt;
		}

		// Iteramos sobre una COPIA del array ([...this.items]) para evitar errores
		// si removemos un item mientras recorremos el loop.
		[...this.items].forEach((item) => {
			// 1. Validar condición externa (si existe)
			if (item.condition && !item.condition()) {
				if (item.prompt && !item.prompt.destroyed) {
					item.prompt.visible = false;
				}
				return;
			}

			// 2. Calcular distancia
			const dx = item.x - playerX;
			const dy = item.y - playerY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// 3. Lógica de visibilidad y acción
			if (dist < item.radius) {
				// Mostrar si estaba oculto
				if (item.prompt && !item.prompt.destroyed && !item.prompt.visible) {
					item.prompt.visible = true;
					item.prompt.alpha = 0;
					new Tween(item.prompt).to({ alpha: 1 }, 200).start();
				}

				// DETECTAR INPUT (Solo una vez)
				// Usamos justPressed para que sea más reactivo, o justReleased si prefieres.
				if (Keyboard.shared.justPressed("KeyE") && this.cooldown <= 0) {
					// B) Verificar si el item sobrevivió a la acción
					// (Si item.action() llamó a remove(), item ya no está en this.items)

					// A) Ejecutar la acción del juego (Recoger, Hablar, etc)
					item.action();
					const stillExists = this.items.includes(item);
					console.log("stillExists", stillExists);
					if (!stillExists) {
						// Si se eliminó, paramos aquí para evitar tocar gráficos muertos.
						return;
					}

					// C) Si sigue vivo, hacemos el feedback visual (cambio de color)
					if (item.prompt && !item.prompt.destroyed) {
						try {
							const bg = item.prompt.getChildAt(0) as Graphics;
							bg.tint = 0x00ff00; // Verde

							setTimeout(() => {
								// Doble chequeo por seguridad (si se destruyó durante el timeout)
								if (item.prompt && !item.prompt.destroyed) {
									bg.tint = 0xffffff; // Blanco
								}
							}, 200);
						} catch (e) {
							// Ignorar errores de render si ocurre algo raro
						}
					}

					this.cooldown = 500; // Reset cooldown
				}
			} else {
				// Ocultar si está lejos
				if (item.prompt && !item.prompt.destroyed && item.prompt.visible) {
					item.prompt.visible = false;
				}
			}
		});
	}

	public destroy(): void {
		this.items.forEach((i) => {
			if (i.prompt && !i.prompt.destroyed) {
				i.prompt.destroy();
			}
		});
		this.items = [];
	}
}
