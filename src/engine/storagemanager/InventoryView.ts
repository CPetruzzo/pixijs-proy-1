import type { FederatedPointerEvent } from "pixi.js";
import { Container, Graphics, Sprite, Texture, Text, TextStyle } from "pixi.js";
import type { StorageManager } from "./StorageManager";
import type { EquipmentManager } from "./EquipmentManager"; // <--- IMPORTANTE

export class InventoryView extends Container {
	private manager: StorageManager;
	private equipmentManager?: EquipmentManager; // <--- NUEVA PROPIEDAD OPCIONAL

	private background: Graphics;
	private itemContainer: Container;
	private draggedItem: { sprite: Sprite; originalIndex: number; startPos: { x: number; y: number } } | null = null;
	private slotSize: number = 70;
	private gap: number = 10;
	private cols: number = 5;
	public selectedIndex: number = -1;

	// Actualizamos el constructor para aceptar equipmentManager
	constructor(manager: StorageManager, equipmentManager?: EquipmentManager) {
		super();
		this.manager = manager;
		this.equipmentManager = equipmentManager; // Guardamos la referencia

		this.background = new Graphics();
		this.addChild(this.background);

		this.itemContainer = new Container();
		this.addChild(this.itemContainer);

		this.createDebugButton();

		this.manager.subscribe(() => this.draw());
		this.draw();
	}

	private createDebugButton(): void {
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const createBtn = (label: string, color: number, x: number, onClick: () => void) => {
			const container = new Container();
			const bg = new Graphics();
			bg.beginFill(color);
			bg.drawRoundedRect(0, 0, 90, 30, 5);
			bg.endFill();

			const txt = new Text(label, new TextStyle({ fontSize: 12, fill: "white", fontWeight: "bold" })); // Fuente un poco más chica para que quepan
			txt.anchor.set(0.5);
			txt.position.set(45, 15);

			container.addChild(bg, txt);
			container.eventMode = "static";
			container.cursor = "pointer";
			container.on("pointerdown", onClick);
			container.position.set(x, buttonsY);
			this.addChild(container);
		};

		// Calculamos posición Y
		const rows = Math.ceil(this.manager.getSlots().length / this.cols);
		const gridHeight = rows * (this.slotSize + this.gap);
		const buttonsY = gridHeight + 10;

		// 1. Limpiar (Rojo) - X: 0
		createBtn("LIMPIAR", 0xff0000, 0, () => {
			console.log("Limpiando...");
			this.manager.clear();
		});

		// 2. Ordenar (Azul) - X: 100
		createBtn("ORDENAR", 0x3498db, 100, () => {
			console.log("Ordenando...");
			this.manager.organize();
		});

		// 3. Desequipar (Naranja/Violeta) - X: 200
		// Solo mostramos este botón si pasamos el equipmentManager al constructor
		if (this.equipmentManager) {
			createBtn("DESEQUIPAR", 0x9b59b6, 200, () => {
				console.log("Desequipando todo...");
				if (this.equipmentManager) {
					// Llamamos al método nuevo pasando 'this.manager' como destino
					const success = this.equipmentManager.unequipAll(this.manager);

					if (!success) {
						console.warn("Inventario lleno: No se pudo remover todo el equipamiento.");
						// Opcional: Feedback visual rápido (ej: cambiar texto temporalmente)
						alert("No se pudo remover todo el equipamiento (Inventario lleno)");
					} else {
						console.log("Todo desequipado con éxito.");
					}
				}
			});
		}
	}

	private draw(): void {
		// ... (Mismo código de draw que ya tenías, sin cambios)
		this.background.clear();
		const rows = Math.ceil(this.manager.getSlots().length / this.cols);
		const width = this.cols * (this.slotSize + this.gap) - this.gap;
		// Aumentamos un poco el height del fondo para cubrir los botones nuevos
		const height = rows * (this.slotSize + this.gap) + 40;

		this.background.beginFill(0x000000, 0.8);
		this.background.lineStyle(2, 0xffffff);
		this.background.drawRoundedRect(-10, -10, width + 20, height, 10);
		this.background.endFill();

		this.itemContainer.removeChildren();

		const slots = this.manager.getSlots();
		slots.forEach((slot, index) => {
			const col = index % this.cols;
			const row = Math.floor(index / this.cols);
			const x = col * (this.slotSize + this.gap);
			const y = row * (this.slotSize + this.gap);

			const slotBg = new Graphics();
			if (index === this.selectedIndex) {
				slotBg.beginFill(0xffff00, 0.3);
				slotBg.lineStyle(2, 0xffff00);
			} else {
				slotBg.beginFill(0xffffff, 0.1);
			}
			slotBg.drawRect(0, 0, this.slotSize, this.slotSize);
			slotBg.endFill();
			slotBg.position.set(x, y);

			slotBg.eventMode = "static";
			slotBg.on("pointerdown", () => this.selectSlot(index));
			this.itemContainer.addChild(slotBg);

			if (slot.item) {
				const texture = Texture.from(slot.item.image);
				const sprite = new Sprite(texture);

				sprite.width = this.slotSize - 10;
				sprite.height = this.slotSize - 10;
				sprite.anchor.set(0.5);
				sprite.position.set(x + this.slotSize / 2, y + this.slotSize / 2);

				sprite.eventMode = "static";
				sprite.cursor = "pointer";

				sprite.on("pointerdown", (e) => {
					this.selectSlot(index);
					this.onDragStart(e, sprite, index);
				});

				this.itemContainer.addChild(sprite);

				if (slot.item.quantity > 1) {
					const txt = new Text(slot.item.quantity.toString(), { fontSize: 12, fill: "white" });
					txt.position.set(x + 2, y + 2);
					this.itemContainer.addChild(txt);
				}
			}
		});
	}

	// ... (Resto de tus métodos selectSlot, onDragStart, etc. se mantienen igual)
	private selectSlot(index: number): void {
		if (this.selectedIndex !== index) {
			this.selectedIndex = index;
			this.draw();
		}
	}

	private onDragStart(_e: FederatedPointerEvent, sprite: Sprite, index: number): void {
		this.draggedItem = {
			sprite,
			originalIndex: index,
			startPos: { x: sprite.x, y: sprite.y },
		};
		sprite.alpha = 0.8;
		this.itemContainer.addChild(sprite);
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

		const bgBounds = this.background.getBounds();
		if (!bgBounds.contains(e.global.x, e.global.y)) {
			console.log("Item tirado");
			this.manager.removeItemFromSlot(originalIndex);
			this.draggedItem = null;
			return;
		}

		const localPos = this.toLocal(e.global);
		const col = Math.floor(localPos.x / (this.slotSize + this.gap));
		const row = Math.floor(localPos.y / (this.slotSize + this.gap));
		const targetIndex = row * this.cols + col;
		const totalSlots = this.manager.getSlots().length;

		let success = false;
		if (targetIndex >= 0 && targetIndex < totalSlots && col < this.cols && col >= 0 && row >= 0) {
			success = this.manager.moveItemBetweenSlots(originalIndex, targetIndex);
		}

		if (!success) {
			sprite.position.set(this.draggedItem.startPos.x, this.draggedItem.startPos.y);
		}
		this.draggedItem = null;
	};
}
