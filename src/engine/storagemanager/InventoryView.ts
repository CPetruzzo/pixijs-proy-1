import type { FederatedPointerEvent } from "pixi.js";
import { Container, Graphics, Sprite, Texture, Text, TextStyle } from "pixi.js"; // Asegúrate de importar Text y TextStyle
import type { StorageManager } from "./StorageManager";

export class InventoryView extends Container {
	// ... (tus propiedades existentes: manager, background, itemContainer, draggedItem, slotSize, gap, cols...)
	private manager: StorageManager;
	private background: Graphics;
	private itemContainer: Container;
	private draggedItem: { sprite: Sprite; originalIndex: number; startPos: { x: number; y: number } } | null = null;
	private slotSize: number = 70;
	private gap: number = 10;
	private cols: number = 5;

	constructor(manager: StorageManager) {
		super();
		this.manager = manager;

		this.background = new Graphics();
		this.addChild(this.background);

		this.itemContainer = new Container();
		this.addChild(this.itemContainer);

		// --- NUEVO: Botón de Debug para Limpiar ---
		this.createDebugButton();

		// Nos suscribimos a cambios en los datos
		this.manager.subscribe(() => this.draw());

		this.draw();
	}

	// --- NUEVO MÉTODO: Crear botón de Debug ---
	private createDebugButton(): void {
		// --- Botón LIMPIAR (Rojo) ---
		const btnClear = new Container();
		const bgClear = new Graphics();
		bgClear.beginFill(0xff0000);
		bgClear.drawRoundedRect(0, 0, 90, 30, 5);
		bgClear.endFill();

		const txtClear = new Text("LIMPIAR", new TextStyle({ fontSize: 14, fill: "white", fontWeight: "bold" }));
		txtClear.anchor.set(0.5);
		txtClear.position.set(45, 15);

		btnClear.addChild(bgClear, txtClear);

		// Evento Limpiar
		btnClear.eventMode = "static";
		btnClear.cursor = "pointer";
		btnClear.on("pointerdown", () => {
			console.log("Limpiando...");
			this.manager.clear();
		});

		// --- Botón ORDENAR (Azul) ---
		const btnSort = new Container();
		const bgSort = new Graphics();
		bgSort.beginFill(0x3498db); // Azul
		bgSort.drawRoundedRect(0, 0, 90, 30, 5);
		bgSort.endFill();

		const txtSort = new Text("ORDENAR", new TextStyle({ fontSize: 14, fill: "white", fontWeight: "bold" }));
		txtSort.anchor.set(0.5);
		txtSort.position.set(45, 15);

		btnSort.addChild(bgSort, txtSort);

		// Evento Ordenar
		btnSort.eventMode = "static";
		btnSort.cursor = "pointer";
		btnSort.on("pointerdown", () => {
			console.log("Ordenando...");
			this.manager.organize();
		});

		// --- POSICIONAMIENTO ---
		const rows = Math.ceil(this.manager.getSlots().length / this.cols);
		const gridHeight = rows * (this.slotSize + this.gap);

		const buttonsY = gridHeight + 10;

		btnClear.position.set(0, buttonsY);
		// Lo ponemos a la derecha del botón limpiar (90 ancho + 10 margen)
		btnSort.position.set(100, buttonsY);

		this.addChild(btnClear);
		this.addChild(btnSort);
	}

	private draw(): void {
		// Redibujamos el fondo adaptado al tamaño real de la grilla
		// Esto es importante para saber qué es "dentro" y qué es "fuera"
		this.background.clear();
		const rows = Math.ceil(this.manager.getSlots().length / this.cols);
		const width = this.cols * (this.slotSize + this.gap) - this.gap;
		const height = rows * (this.slotSize + this.gap) - this.gap;

		// Fondo semitransparente que abarca toda el área de slots
		this.background.beginFill(0x000000, 0.8);
		this.background.lineStyle(2, 0xffffff);
		this.background.drawRoundedRect(-10, -10, width + 20, height + 20, 10); // Padding visual
		this.background.endFill();

		this.itemContainer.removeChildren();

		const slots = this.manager.getSlots();
		slots.forEach((slot, index) => {
			const col = index % this.cols;
			const row = Math.floor(index / this.cols);
			const x = col * (this.slotSize + this.gap);
			const y = row * (this.slotSize + this.gap);

			// Dibujar hueco del slot visualmente
			const slotBg = new Graphics();
			slotBg.beginFill(0xffffff, 0.1);
			slotBg.drawRect(0, 0, this.slotSize, this.slotSize);
			slotBg.endFill();
			slotBg.position.set(x, y);
			this.itemContainer.addChild(slotBg);

			if (slot.item) {
				// Cargar textura (Asegúrate de que 'image' sea un key válido o URL)
				const texture = Texture.from(slot.item.image);
				const sprite = new Sprite(texture);

				sprite.width = this.slotSize - 10;
				sprite.height = this.slotSize - 10;
				sprite.anchor.set(0.5);
				sprite.position.set(x + this.slotSize / 2, y + this.slotSize / 2);

				// Habilitar arrastre
				sprite.eventMode = "static";
				sprite.cursor = "pointer";
				sprite.on("pointerdown", (e) => this.onDragStart(e, sprite, index));

				this.itemContainer.addChild(sprite);

				// Texto cantidad
				if (slot.item.quantity > 1) {
					const txt = new Text(slot.item.quantity.toString(), { fontSize: 12, fill: "white" });
					txt.position.set(x + 2, y + 2);
					this.itemContainer.addChild(txt);
				}
			}
		});
	}

	private onDragStart(_e: FederatedPointerEvent, sprite: Sprite, index: number): void {
		this.draggedItem = {
			sprite,
			originalIndex: index,
			startPos: { x: sprite.x, y: sprite.y },
		};

		sprite.alpha = 0.8;
		this.itemContainer.addChild(sprite); // Traer al frente

		// Listeners globales al sprite
		sprite.on("pointermove", this.onDragMove);
		sprite.on("pointerup", this.onDragEnd);
		sprite.on("pointerupoutside", this.onDragEnd);
	}

	private onDragMove = (e: FederatedPointerEvent): void => {
		if (!this.draggedItem) {
			return;
		}
		const localPos = this.toLocal(e.global);
		this.draggedItem.sprite.position.set(localPos.x, localPos.y);
	};

	private onDragEnd = (e: FederatedPointerEvent): void => {
		if (!this.draggedItem) {
			return;
		}

		const { sprite, originalIndex } = this.draggedItem;
		sprite.off("pointermove", this.onDragMove);
		sprite.off("pointerup", this.onDragEnd);
		sprite.off("pointerupoutside", this.onDragEnd);
		sprite.alpha = 1;

		// --- LÓGICA DE TIRAR OBJETO (DROP) ---

		// 1. Obtenemos los límites del fondo negro del inventario
		// Usamos getBounds() que nos da coordenadas globales, igual que e.global
		const bgBounds = this.background.getBounds();

		// 2. Si el mouse está fuera de ese rectángulo... ¡TIRAR!
		if (!bgBounds.contains(e.global.x, e.global.y)) {
			console.log("Item tirado fuera del inventario (Basura)");

			// Quitamos el item del Manager.
			// Como nos suscribimos en el constructor, esto disparará this.draw() automáticamente.
			this.manager.removeItemFromSlot(originalIndex);

			this.draggedItem = null;
			return;
		}

		// --- LÓGICA DE MOVER ENTRE SLOTS (si estamos dentro) ---

		const localPos = this.toLocal(e.global);
		// Cálculo inverso de la grilla
		const col = Math.floor(localPos.x / (this.slotSize + this.gap));
		const row = Math.floor(localPos.y / (this.slotSize + this.gap));
		const targetIndex = row * this.cols + col;
		const totalSlots = this.manager.getSlots().length;

		let success = false;

		// Verificar límites válidos de array
		if (targetIndex >= 0 && targetIndex < totalSlots && col < this.cols && col >= 0 && row >= 0) {
			success = this.manager.moveItemBetweenSlots(originalIndex, targetIndex);
		}

		if (!success) {
			// Regresa a su lugar si el movimiento fue inválido dentro del inventario
			sprite.position.set(this.draggedItem.startPos.x, this.draggedItem.startPos.y);
		}

		this.draggedItem = null;
	};
}
