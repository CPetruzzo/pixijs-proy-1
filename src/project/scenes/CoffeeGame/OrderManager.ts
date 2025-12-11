import { EventEmitter } from "events";
import { Container, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { Tween, Easing } from "tweedle.js";

interface OrderItem {
	type: string;
	pending: string[];
	bubble: Sprite;
	icon: Sprite;
	checkIcon?: Sprite;
}

interface Order {
	ui: Container;
	text: Text;
	timer: number;
	maxTimer: number;
	items: OrderItem[]; // Múltiples items por pedido
	ready: boolean;
	timerBar?: Container;
}

export class OrderManager extends EventEmitter {
	private container: Container;
	private orders: Order[] = [];

	private elapsedSinceLast = 0;
	private spawnInterval = 8;
	private difficulty = 1;

	private style = new TextStyle({
		fill: "#f4e4c2",
		fontFamily: '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
		fontSize: 36,
		fontWeight: "bolder",
		stroke: "#3f2b1d",
		strokeThickness: 4,
	});

	private recipes: Record<string, string[]> = {
		café: ["granos", "agua"],
		sandwich: ["pan", "jamon"],
	};

	private icons: Record<string, string> = {
		café: "station-café2",
		sandwich: "station-sandwich2",
	};

	private slotX = [-350, -500, -650];
	private slotY = 300;

	constructor(uiContainer: Container) {
		super();
		this.container = new Container();
		uiContainer.addChild(this.container);
	}

	public update(dt: number): void {
		this.elapsedSinceLast += dt / 1000;
		if (this.elapsedSinceLast >= this.spawnInterval && this.orders.length < 3) {
			this.elapsedSinceLast = 0;
			this.spawnOrder();
		}

		for (let i = this.orders.length - 1; i >= 0; i--) {
			const o = this.orders[i];
			o.timer -= dt / 1000;
			this.updateTimerBar(o);

			if (o.timer <= 0) {
				this.emit("orderExpired");
				this.removeOrder(i);
			}
		}
	}

	private spawnOrder(): void {
		const orderUI = new Container();
		orderUI.y = this.slotY;
		orderUI.x = -1500;
		this.container.addChild(orderUI);

		// Personaje
		const charKey = Math.random() < 0.5 ? "char1" : "char2";
		const char = Sprite.from(charKey);
		char.scale.set(0.85);
		char.anchor.set(0.5, 1);
		char.y = 0;
		orderUI.addChild(char);

		// Determinar cuántos items diferentes pedir (1-3)
		const itemCount = 1 + Math.floor(Math.random() * Math.min(3, this.difficulty + 1));
		const items: OrderItem[] = [];
		const types = Object.keys(this.recipes);

		for (let i = 0; i < itemCount; i++) {
			// Elegir tipo aleatorio (puede repetir, pero es menos probable)
			const type = types[Math.floor(Math.random() * types.length)];

			// Crear burbuja
			const bubble = Sprite.from("blob");
			bubble.anchor.set(0.5, 1);
			bubble.scale.set(0.7);
			bubble.y = -char.height - i * bubble.height;
			orderUI.addChild(bubble);

			// Crear ícono
			const iconKey = this.icons[type] || "question-icon";
			const icon = Sprite.from(iconKey);
			icon.anchor.set(0.5);
			icon.scale.set(0.25);
			icon.position.set(0, bubble.y - bubble.height * 0.6);
			orderUI.addChild(icon);

			// Copiar ingredientes necesarios
			const pending = [...this.recipes[type]];

			items.push({
				type,
				pending,
				bubble,
				icon,
			});
		}

		// Crear barra de tiempo
		const timerBarContainer = new Container();
		timerBarContainer.y = -char.height - itemCount * 80 - 30;
		orderUI.addChild(timerBarContainer);

		const barBg = new Sprite(Texture.WHITE);
		barBg.width = 100;
		barBg.height = 8;
		barBg.anchor.set(0.5, 0.5);
		barBg.tint = 0x333333;
		timerBarContainer.addChild(barBg);

		const barFill = new Sprite(Texture.WHITE);
		barFill.width = 100;
		barFill.height = 8;
		barFill.anchor.set(0, 0.5);
		barFill.x = -50;
		barFill.tint = 0x00ff00;
		timerBarContainer.addChild(barFill);

		const text = new Text("", this.style);

		const maxTime = 20;
		const order: Order = {
			ui: orderUI,
			text,
			timer: maxTime,
			maxTimer: maxTime,
			items,
			ready: false,
			timerBar: timerBarContainer,
		};

		(order as any).barFill = barFill;

		this.orders.push(order);
		this.tweenToSlot(this.orders.length - 1, order);
	}

	private updateTimerBar(order: Order): void {
		const barFill = (order as any).barFill;
		if (!barFill) {
			return;
		}

		const progress = Math.max(0, order.timer / order.maxTimer);
		barFill.width = 100 * progress;

		if (progress > 0.5) {
			barFill.tint = 0x00ff00;
		} else if (progress > 0.25) {
			barFill.tint = 0xffaa00;
		} else {
			barFill.tint = 0xff0000;
			if (order.timer % 0.5 < 0.25) {
				barFill.alpha = 0.5;
			} else {
				barFill.alpha = 1;
			}
		}
	}

	public tryServe(stationType: string, ingredientKey: string): boolean {
		if (!this.orders.length) {
			return false;
		}

		const head = this.orders[0];

		// Buscar un item que coincida con el tipo de estación y necesite este ingrediente
		for (const item of head.items) {
			if (item.type !== stationType) {
				continue;
			}

			// Buscar el ingrediente en la lista de pendientes (sin importar el orden)
			const index = item.pending.indexOf(ingredientKey);
			if (index !== -1) {
				// Remover el ingrediente
				item.pending.splice(index, 1);
				console.log(`Ingrediente aceptado: ${ingredientKey} para ${item.type}, quedan [${item.pending.join(",")}]`);

				// Si este item está completo, mostrar check
				if (item.pending.length === 0 && !item.checkIcon) {
					const check = Sprite.from("check");
					check.anchor.set(0.5);
					check.scale.set(0.05);
					// Posicionar el check sobre la burbuja del item
					check.position.set(item.bubble.x + 40, item.bubble.y - item.bubble.height * 0.5);
					head.ui.addChild(check);
					item.checkIcon = check;

					// Animación del check
					check.scale.set(0);
					new Tween(check.scale).to({ x: 0.05, y: 0.05 }, 300).easing(Easing.Back.Out).start();

					console.log(`✅ Item completo: ${item.type}`);
				}

				// Verificar si todo el pedido está listo
				const allComplete = head.items.every((i) => i.pending.length === 0);
				if (allComplete && !head.ready) {
					head.ready = true;
					this.emit("orderReady", head.items.map((i) => i.type).join(", "));
					console.log("✅ Pedido completo y listo para entregar");
				}

				return true;
			}
		}

		return false;
	}

	private removeOrder(idx: number, _correct = false): void {
		const o = this.orders[idx];

		new Tween(o.ui)
			.to({ x: -1500, alpha: 0 }, 400)
			.easing(Easing.Cubic.In)
			.onComplete(() => {
				this.container.removeChild(o.ui);
			})
			.start();

		this.container.removeChild(o.text);
		this.orders.splice(idx, 1);
		this.orders.forEach((ord, i) => this.tweenToSlot(i, ord));
	}

	private tweenToSlot(idx: number, o: Order): void {
		const tx = this.slotX[idx];
		const ty = this.slotY;
		new Tween(o.ui).to({ x: tx, y: ty }, 500).easing(Easing.Cubic.Out).start();
		new Tween(o.text)
			.to({ x: tx + 40, y: ty - 120 }, 500)
			.easing(Easing.Cubic.Out)
			.start();
	}

	public deliverReady(): void {
		if (this.orders.length === 0) {
			return;
		}

		const head = this.orders[0];

		// Verificar que todos los items estén completos
		const allComplete = head.items.every((i) => i.pending.length === 0);
		if (!allComplete) {
			return;
		}

		// Bonus por entregar rápido
		const timeBonus = Math.floor((head.timer / head.maxTimer) * 5);
		console.log(`⏱️ Bonus por velocidad: +${timeBonus}`);

		this.removeOrder(0, true);
		this.emit("orderComplete", head.items.map((i) => i.type).join(", "));
	}

	public clearAllOrders(): void {
		// Eliminar todos los pedidos sin animación
		for (const order of this.orders) {
			this.container.removeChild(order.ui);
			this.container.removeChild(order.text);
		}
		this.orders = [];
	}
}
