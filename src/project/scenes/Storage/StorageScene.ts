/* eslint-disable prettier/prettier */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { StorageManager } from "./utils/StorageManager";
import { Item } from "./objects/Item";
import type { FederatedPointerEvent } from "pixi.js";
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

export class StorageScene extends PixiScene {
	private storageManager: StorageManager;
	private draggedItem: { sprite: Sprite; index: number } | null = null;
	public static readonly BUNDLES = ["storagescene", "basquet", "package-2", "fallrungame"];
	private slotContainer: Container = new Container();
	private uiContainer: Container = new Container();
	private worldContainer: Container = new Container();

	constructor() {
		super();
		this.addChild(this.worldContainer, this.slotContainer, this.uiContainer);
		this.storageManager = new StorageManager(10, 50); // 10 slots, 50 max weight per slot
		// Verificamos si ya hay datos en localStorage
		const savedInventory = localStorage.getItem("inventory");

		if (savedInventory) {
			this.storageManager.loadInventoryFromJSON(); // Asegúrate de tener este método en tu StorageManager
		} else {
			// Si no hay datos, agregamos ítems de prueba
			const item1 = new Item("Sword", 10, 1, "A sharp blade.", "coin");
			const item2 = new Item("Shield", 15, 1, "A sturdy shield.", "golditem1");
			this.storageManager.addItemToSlot(item1, 0); // Slot 0
			this.storageManager.addItemToSlot(item2, 1); // Slot 1

			const newItem = new Item("Health Potion", 5, 1, "Restores 50 HP.", "cachoknob");
			const added = this.storageManager.addItemToFirstAvailableSlot(newItem);

			if (added) {
				console.log("Item added to the inventory.");
			} else {
				console.log("Inventory is full!");
			}

			const newItem2 = new Item("Health Potion", 5, 1, "Restores 50 HP.", "loli");
			const added2 = this.storageManager.addItemToFirstAvailableSlot(newItem2);

			if (added2) {
				console.log("Item added to the inventory.");
			} else {
				console.log("Inventory is full!");
			}

			// Guardamos el inventario recién creado
			this.saveInventory();
		}
		this.create();

		// Simula recoger un ítem al hacer clic en un sprite
		const worldItemSprite = new Sprite(Texture.from("star"));
		worldItemSprite.name = "item suelto";
		worldItemSprite.position.set(150, 150);
		worldItemSprite.eventMode = "static";
		worldItemSprite.on("pointerdown", () => {
			const item = new Item("Health Potion", 5, 1, "Restores 50 HP.", "star");
			const added = this.storageManager.addItemToFirstAvailableSlot(item);
			this.worldContainer.removeChild(worldItemSprite);

			if (added) {
				console.log("Picked up: Health Potion");
			} else {
				console.log("Inventory full. Cannot pick up item.");
			}

			this.renderSlots(); // Actualiza los slots
		});
		this.worldContainer.addChild(worldItemSprite);
	}

	public create(): void {
		const bg = new Graphics();
		bg.beginFill(0x333333);
		bg.drawRect(0, 0, 800, 600);
		bg.endFill();
		this.slotContainer.addChild(bg);

		this.renderSlots();

		// Crear botón de "Spawn Object"
		const spawnButton = new Graphics();
		spawnButton.beginFill(0x00ff00);
		spawnButton.drawRect(350, 200, 100, 40);
		spawnButton.endFill();
		spawnButton.interactive = true;
		spawnButton.eventMode = "static";
		spawnButton.on("pointerdown", this.spawnObject.bind(this));

		const buttonText = new Text("Spawn Item", {
			fill: 0xffffff,
			fontSize: 14,
		});
		buttonText.anchor.set(0.5);
		buttonText.position.set(400, 220);
		this.uiContainer.addChild(spawnButton);
		this.uiContainer.addChild(buttonText);
	}

	private renderSlots(): void {
		const slots = this.storageManager.getSlots();

		// Eliminar los ítems anteriores de los slots
		this.slotContainer.removeChildren();

		slots.forEach((slot, index) => {
			const slotBox = new Graphics();
			slotBox.lineStyle(2, 0xffffff);
			slotBox.drawRect(index * 80 + 10, 50, 70, 70);
			this.slotContainer.addChild(slotBox);

			if (slot.item) {
				const itemTexture = Texture.from(slot.item.image); // Cargar la textura del ítem
				const itemSprite = Sprite.from(itemTexture);
				itemSprite.width = 50;
				itemSprite.height = 50;
				itemSprite.position.set(index * 80 + 20, 60);
				itemSprite.interactive = true;
				itemSprite.on("pointerdown", (event) => this.startDrag(event, index));
				this.slotContainer.addChild(itemSprite);
			}
		});
	}

	private startDrag(event: FederatedPointerEvent, index: number): void {
		const slots = this.storageManager.getSlots();
		const slot = slots[index];

		if (slot.item) {
			const sprite = event.currentTarget as Sprite;
			this.draggedItem = { sprite, index };

			sprite.zIndex = 1000; // Llevar al frente
			sprite.on("pointermove", this.onDragMove.bind(this));
			sprite.on("pointerup", this.endDrag.bind(this));
			sprite.on("pointerupoutside", this.endDrag.bind(this));
		}
	}

	private onDragMove(event: FederatedPointerEvent): void {
		if (!this.draggedItem) {
			return;
		}

		const { sprite } = this.draggedItem;
		const newPosition = event.global;

		// Transformar las coordenadas globales a las coordenadas locales del contenedor
		const localPosition = this.slotContainer.toLocal(newPosition);
		sprite.x = localPosition.x - sprite.width / 2;
		sprite.y = localPosition.y - sprite.height / 2;
	}

	private endDrag(_event: FederatedPointerEvent): void {
		if (!this.draggedItem) {
			return;
		}

		const { sprite, index } = this.draggedItem;
		sprite.off("pointermove");
		sprite.off("pointerup");
		sprite.off("pointerupoutside");

		const newIndex = Math.floor(sprite.x / 80); // Suponiendo una sola fila de slots
		const slots = this.storageManager.getSlots();
		const item = slots[index].item; // Obtenemos el ítem de la ranura original

		const moved = this.storageManager.moveItemBetweenSlots(index, newIndex);

		if (moved) {
			console.log(`Moved item: ${item?.name} from slot ${index} to slot ${newIndex}`);
		} else {
			console.log(`Failed to move item. Returning ${item?.name} to original slot.`);
			sprite.position.set(index * 80 + 20, 60);
		}

		this.draggedItem = null;

		// Solo actualizar los slots relevantes para no interferir con otros ítems
		this.renderSlots();

		this.saveInventory(); // Guardar inventario después de mover el ítem
	}

	// Método para generar un nuevo ítem y agregarlo al inventario
	private spawnObject(): void {
		const randomItemNames = ["Health Potion", "Mana Potion", "Gold Coin", "Iron Sword"];
		const randomImages = ["star", "cachoknob", "loli", "golditem1"];
		const randomIndex = Math.floor(Math.random() * randomItemNames.length);

		const newItem = new Item(
			randomItemNames[randomIndex],
			Math.floor(Math.random() * 10) + 1, // Peso aleatorio entre 1 y 10
			1,
			"Generated item",
			randomImages[randomIndex]
		);

		const added = this.storageManager.addItemToFirstAvailableSlot(newItem);
		this.renderSlots();

		if (added) {
			console.log(`Spawned item: ${newItem.name}`);
		} else {
			console.log("No space available for new item.");
		}
	}


	private saveInventory(): void {
		const inventoryJSON = this.storageManager.saveInventoryToJSON();
		console.log("Inventory saved:", inventoryJSON);
		localStorage.setItem("inventory", inventoryJSON);
	}

	public override onResize(_newW: number, _newH: number): void {
		// Usar ScaleHelper para escalar solo los elementos internos, no el contenedor
		ScaleHelper.setScaleRelativeToIdeal(this.slotContainer, _newW, _newH, 950, 315, ScaleHelper.FIT);
		this.slotContainer.x = _newW * 0.5;
		this.slotContainer.y = _newH * 0.4;

		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, _newW, _newH, 950, 315, ScaleHelper.FIT);
		this.worldContainer.x = _newW * 0.5;
		this.worldContainer.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, _newW, _newH, 950, 315, ScaleHelper.FIT);
		this.uiContainer.x = _newW * 0.5;
		this.uiContainer.y = _newH * 0.5;

		// Asegúrate de actualizar el pivote de los contenedores para mantenerlos centrados
		const worldContainerBounds = this.slotContainer.getLocalBounds();
		this.worldContainer.pivot.set(worldContainerBounds.width * 0.5, worldContainerBounds.height * 0.5);

		const slotContainerBounds = this.slotContainer.getLocalBounds();
		this.slotContainer.pivot.set(slotContainerBounds.width * 0.5, slotContainerBounds.height * 0.5);

		const containerBounds = this.slotContainer.getLocalBounds();
		this.uiContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);
	}
}
