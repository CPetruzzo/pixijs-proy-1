import type { FederatedPointerEvent, Resource } from "pixi.js";
import { Container, Sprite, Texture, Text, NineSlicePlane, Graphics } from "pixi.js";
import type { StorageManager } from "./StorageManager";
import type { EquipmentManager } from "./EquipmentManager";

export class InventoryView extends Container {
	private manager: StorageManager;
	private equipmentManager?: EquipmentManager;

	// El fondo puede ser cualquiera de los dos tipos
	private background: NineSlicePlane | Graphics;
	private itemContainer: Container;
	private buttonContainer: Container;

	private draggedItem: { sprite: Sprite; originalIndex: number; startPos: { x: number; y: number } } | null = null;

	private slotSize: number = 70;
	private gap: number = 20;
	private cols: number = 4;
	private padding: number = 35;

	public selectedIndex: number = -1;

	/**
	 * @param manager El manager de storage
	 * @param equipmentManager El manager de equipo (opcional)
	 * @param texture Si se pasa, usará NineSlicePlane. Si no, usará Graphics.
	 */
	constructor(
		manager: StorageManager,
		equipmentManager?: EquipmentManager,
		texture?: Texture<Resource>,
		left: number = 0,
		top: number = 0,
		right: number = 0,
		bottom: number = 0
	) {
		super();
		this.manager = manager;
		this.equipmentManager = equipmentManager;

		// LÓGICA DE DETECCIÓN:
		if (texture) {
			// Si pasas textura, creamos el NineSlicePlane (Estilo Nuevo)
			this.background = new NineSlicePlane(texture, left, top, right, bottom);
		} else {
			// Si no pasas nada, creamos el Graphics (Estilo Clásico)
			this.background = new Graphics();
		}

		this.addChild(this.background);

		this.itemContainer = new Container();
		this.addChild(this.itemContainer);

		this.buttonContainer = new Container();
		this.addChild(this.buttonContainer);

		this.manager.subscribe(() => this.draw());
		this.draw();
	}

	// --- MÉTODOS DE CONFIGURACIÓN DINÁMICA ---

	/** Modifica el número de columnas y redibuja */
	public setGridColumns(count: number): void {
		this.cols = count;
		this.draw();
	}

	/** Modifica el tamaño de los slots (útil para zoom o pantallas chicas) */
	public setSlotSize(size: number, gap: number = 10): void {
		this.slotSize = size;
		this.gap = gap;
		this.draw();
	}

	/** * El número de filas se calcula automáticamente basado en
	 * el total de slots del StorageManager y las columnas seteadas.
	 */
	public get rows(): number {
		return Math.ceil(this.manager.getSlots().length / this.cols);
	}

	private draw(): void {
		const slots = this.manager.getSlots();
		const rows = this.rows;

		this.itemContainer.removeChildren();
		this.buttonContainer.removeChildren();

		// Calculamos dimensiones base
		const gridWidth = this.cols * (this.slotSize + this.gap) - this.gap;
		const gridHeight = rows * (this.slotSize + this.gap) - this.gap;
		const totalWidth = gridWidth + this.padding * 2;
		const totalHeight = gridHeight + this.padding * 2 + 50;

		// 1. ACTUALIZAR FONDO SEGÚN EL TIPO
		if (this.background instanceof Graphics) {
			// Lógica de Graphics como antes
			this.background.clear();
			this.background.beginFill(0x000000, 0.8);
			this.background.lineStyle(2, 0xffffff);
			this.background.drawRoundedRect(0, 0, totalWidth, totalHeight, 10);
			this.background.endFill();
		} else {
			// Lógica de NineSlicePlane
			this.background.width = totalWidth;
			this.background.height = totalHeight;
		}

		// 2. RENDERIZAR SLOTS (con el offset del padding)
		slots.forEach((slot, index) => {
			const col = index % this.cols;
			const row = Math.floor(index / this.cols);
			const x = col * (this.slotSize + this.gap) + this.padding;
			const y = row * (this.slotSize + this.gap) + this.padding;
			this.renderSlot(x, y, index, slot);
		});

		this.createButtons();
		this.renderCloseHint();
	}

	private renderSlot(x: number, y: number, index: number, slot: any): void {
		// Podrías usar un Sprite aquí también si tienes una textura de "slot_bg.png"
		const slotBg = new Sprite(Texture.WHITE); // Temporalmente blanco, cámbialo por tu textura
		slotBg.width = this.slotSize;
		slotBg.height = this.slotSize;
		slotBg.tint = index === this.selectedIndex ? 0xffff00 : 0x333333;
		slotBg.alpha = 0.5;
		slotBg.position.set(x, y);
		slotBg.eventMode = "static";
		slotBg.on("pointerdown", () => this.selectSlot(index));
		this.itemContainer.addChild(slotBg);

		if (slot.item) {
			const sprite = new Sprite(Texture.from(slot.item.image));
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
				txt.position.set(x + 5, y + 5);
				this.itemContainer.addChild(txt);
			}
		}
	}

	private createButtons(): void {
		const gridHeight = this.rows * (this.slotSize + this.gap);
		const buttonsY = gridHeight + this.padding;

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const createBtn = (label: string, color: number, x: number, onClick: () => void) => {
			const btn = new Container();
			// Aquí podrías usar otro NineSlice para los botones si quisieras
			// Pero por brevedad mantenemos una lógica similar
			const txt = new Text(label, { fontSize: 12, fill: color, fontWeight: "bold" });
			btn.addChild(txt);
			btn.eventMode = "static";
			btn.cursor = "pointer";
			btn.on("pointerdown", onClick);
			btn.position.set(x + this.padding, buttonsY);
			this.buttonContainer.addChild(btn);
		};

		createBtn("LIMPIAR", 0xff4444, 0, () => this.manager.clear());
		createBtn("ORDENAR", 0x44aaff, 80, () => this.manager.organize());

		if (this.equipmentManager) {
			createBtn("DESEQUIPAR", 0xaa44ff, 170, () => {
				this.equipmentManager?.unequipAll(this.manager);
			});
		}
	}

	private renderCloseHint(_gridWidth?: number): void {
		const closeHint = new Text("[I] CERRAR", { fontSize: 10, fill: 0xffffff });
		closeHint.anchor.set(1, 0);
		closeHint.position.set(this.background.width - 10, 5);
		this.itemContainer.addChild(closeHint);
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
