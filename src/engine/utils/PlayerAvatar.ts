import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { EquipmentManager } from "../storagemanager/EquipmentManager";
import { EquipmentSlots } from "../storagemanager/EquipmentManager";

export class PlayerAvatar extends Container {
	public bodyShape: Graphics;

	// Contenedores visuales
	private weaponSprite: Sprite; // Mano derecha
	private shieldSprite: Sprite; // Mano izquierda (Representará el slot BODY/ARMOR)
	private helmetSprite: Sprite; // Cabeza

	private equipmentManager: EquipmentManager;

	constructor(equipmentManager: EquipmentManager, color: number) {
		super();
		this.equipmentManager = equipmentManager;

		// 2. Capa BASE (El cuerpo)
		this.bodyShape = new Graphics();
		this.bodyShape.beginFill(color);
		this.bodyShape.drawCircle(0, 0, 20);
		this.bodyShape.endFill();
		this.addChild(this.bodyShape);

		// 1. Capa ESCUDO/ARMADURA (Mano Izquierda, dibujada PRIMERO para que quede "debajo" del cuerpo si rota)
		this.shieldSprite = Sprite.from(Texture.EMPTY);
		this.shieldSprite.anchor.set(0.5); // Pivote al centro
		this.shieldSprite.position.set(-18, 18); // A la IZQUIERDA del cuerpo
		this.addChild(this.shieldSprite);

		// 3. Capa ARMA (Mano Derecha)
		this.weaponSprite = Sprite.from(Texture.EMPTY);
		this.weaponSprite.anchor.set(0, 0.5); // Pivote en el mango
		this.weaponSprite.position.set(15, 10); // A la DERECHA
		this.weaponSprite.rotation = Math.PI / 4;
		this.addChild(this.weaponSprite);

		// 4. Capa CASCO
		this.helmetSprite = Sprite.from(Texture.EMPTY);
		this.helmetSprite.anchor.set(0.5);
		this.helmetSprite.position.set(0, -13);
		this.addChild(this.helmetSprite);

		this.equipmentManager.storage.subscribe(() => this.updateVisuals());
	}

	private updateVisuals(): void {
		const slots = this.equipmentManager.storage.getSlots();

		// --- Actualizar Arma (MAIN_HAND) ---
		const weaponItem = slots[EquipmentSlots.MAIN_HAND].item;
		if (weaponItem) {
			// Aseguramos que cargue la textura si existe, si no usa una por defecto o maneja error
			try {
				this.weaponSprite.texture = Texture.from(weaponItem.image);
				this.weaponSprite.visible = true;
				this.weaponSprite.width = 20;
				this.weaponSprite.height = 30;
			} catch (e) {
				console.warn("Textura no encontrada:", weaponItem.image);
				this.weaponSprite.visible = false;
			}
		} else {
			this.weaponSprite.visible = false;
		}

		// --- Actualizar Escudo/Armadura (BODY) ---
		// En tu EquipmentManager, ItemType.ARMOR va al slot BODY
		const bodyItem = slots[EquipmentSlots.BODY].item;
		if (bodyItem) {
			try {
				this.shieldSprite.texture = Texture.from(bodyItem.image);
				this.shieldSprite.visible = true;
				this.shieldSprite.width = 25; // Un poco más pequeño o grande según prefieras
				this.shieldSprite.height = 25;
			} catch (e) {
				this.shieldSprite.visible = false;
			}
		} else {
			this.shieldSprite.visible = false;
		}

		// --- Actualizar Casco (HEAD) ---
		const helmetItem = slots[EquipmentSlots.HEAD].item;
		if (helmetItem) {
			try {
				this.helmetSprite.texture = Texture.from(helmetItem.image);
				this.helmetSprite.visible = true;
				this.helmetSprite.width = 40;
				this.helmetSprite.height = 20;
			} catch (e) {
				this.helmetSprite.visible = false;
			}
		} else {
			this.helmetSprite.visible = false;
		}
	}
}
