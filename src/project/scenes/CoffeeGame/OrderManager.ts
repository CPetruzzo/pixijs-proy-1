import { EventEmitter } from "events";
import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { Tween, Easing } from "tweedle.js";

interface Order {
	type: string;
	ui: Container;
	text: Text;
	timer: number;
	pending: string[];
	ready: boolean; // <-- nuevo flag
	readyIcon?: Sprite; // <-- para guardar la referencia
}

export class OrderManager extends EventEmitter {
	private container: Container;
	private orders: Order[] = [];

	private elapsedSinceLast = 0;
	private spawnInterval = 5; // segundos
	/** Cuántos ítems extra (además de 1) puede pedir un cliente */
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
		café: "station-café",
		sandwich: "station-sandwich",
	};

	// Slots fijos (de derecha a izquierda)
	private slotX = [-350, -500, -650];
	private slotY = 300;

	constructor(uiContainer: Container) {
		super();
		this.container = new Container();
		uiContainer.addChild(this.container);
	}

	public update(dt: number): void {
		// 1) Spawn (máx 3 clientes)
		this.elapsedSinceLast += dt / 1000;
		if (this.elapsedSinceLast >= this.spawnInterval && this.orders.length < 3) {
			this.elapsedSinceLast = 0;
			this.spawnOrder();
		}

		// 2) Timer & expiry
		for (let i = this.orders.length - 1; i >= 0; i--) {
			const o = this.orders[i];
			o.timer -= dt / 1000;
			if (o.timer <= 0) {
				this.removeOrder(i);
			} else {
				// actualiza texto
				o.text.text = `${o.type.toUpperCase()} (${Math.ceil(o.timer)}s)`;
			}
		}
	}

	private spawnOrder(): void {
		// 1) tipo y cantidad de ítems
		const types = Object.keys(this.recipes);
		const type = types[Math.floor(Math.random() * types.length)];
		const count = 1 + Math.floor(Math.random() * (this.difficulty + 1));

		// 2) construimos el UI container
		const orderUI = new Container();
		orderUI.y = this.slotY;
		orderUI.x = -1500; // empieza fuera de pantalla
		this.container.addChild(orderUI);

		// 3) personaje aleatorio
		const charKey = Math.random() < 0.5 ? "char1" : "char2";
		const char = Sprite.from(charKey);
		char.scale.set(0.85);
		char.anchor.set(0.5, 1);
		char.y = 0;
		orderUI.addChild(char);

		// 4) pedimos `count` veces: cada burbuja + ícono
		const pendings: string[] = [];
		for (let i = 0; i < count; i++) {
			// 4a) burbuja
			const bubble = Sprite.from("blob");
			bubble.anchor.set(0.5, 1);
			bubble.scale.set(0.7);
			bubble.y = -char.height - i * bubble.height;
			orderUI.addChild(bubble);

			// 4b) icono
			const iconKey = this.icons[type] || "question-icon";
			const icon = Sprite.from(iconKey);
			icon.anchor.set(0.5);
			icon.scale.set(0.25);
			icon.position.set(0, bubble.y - bubble.height * 0.6);
			orderUI.addChild(icon);

			// registramos un pedido
			pendings.push(...this.recipes[type]);
		}
		console.log("pendings", pendings);

		// 5) texto de temporizador
		const text = new Text("", this.style);
		// this.container.addChild(text);

		// 6) guardamos y tweenamos al slot
		const order: Order = {
			type,
			ui: orderUI,
			text,
			timer: 15,
			pending: pendings,
			ready: false,
		};
		this.orders.push(order);
		this.tweenToSlot(this.orders.length - 1, order);
	}

	public tryServe(stationType: string, ingredientKey: string): boolean {
		if (!this.orders.length) {
			return false;
		}
		const head = this.orders[0];
		if (head.type !== stationType) {
			return false;
		}
		if (head.pending[0] !== ingredientKey) {
			return false;
		}

		head.pending.shift();
		console.log(`Ingrediente aceptado, quedan [${head.pending.join(",")}]`);

		// Si acabamos todos los ingredientes, marcamos como ready
		if (head.pending.length === 0 && !head.ready) {
			head.ready = true;
			// mostramos un check encima de la burbuja
			const check = Sprite.from("check"); // pon aquí tu asset de check
			check.anchor.set(0.5);
			check.scale.set(0.05);
			check.position.set(70, -head.ui.height);
			head.ui.addChild(check);
			head.readyIcon = check;

			this.emit("orderReady", head.type);
			console.log("✅ Pedido listo:", head.type);
		}
		return true;
	}

	/** Elimina una orden y reordena las demás con tween */
	private removeOrder(idx: number, _correct = false): void {
		const o = this.orders[idx];
		this.container.removeChild(o.ui);
		this.container.removeChild(o.text);
		this.orders.splice(idx, 1);
		this.orders.forEach((ord, i) => this.tweenToSlot(i, ord));
	}

	/** Mueve `o.ui` y `o.text` al slot `idx` */
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
		// 1) Si no hay pedidos, no hacer nada
		if (this.orders.length === 0) {
			return;
		}

		const head = this.orders[0];

		// 2) Sólo si ya no hay ingredientes pendientes
		if (head.pending.length > 0) {
			return;
		}

		// 3) Lo removemos visualmente y de la lista
		this.removeOrder(0, /* correcto= */ true);

		// 4) Emitimos orderComplete para que la escena, por ejemplo, sume puntos
		this.emit("orderComplete", head.type);
	}
}
