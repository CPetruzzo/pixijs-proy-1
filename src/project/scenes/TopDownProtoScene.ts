/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { Keyboard } from "../../engine/input/Keyboard";
import { DialogueOverlayManager } from "../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../engine/utils/InteractableManager";
import { Manager } from "../..";
import { Tween, Easing } from "tweedle.js";
import { InventoryView } from "../../engine/storagemanager/InventoryView";
import { StorageManager } from "../../engine/storagemanager/StorageManager";
import { Item, ItemImages, ItemType } from "../../engine/storagemanager/Item";

// IMPORTAMOS EL NUEVO CONTROLADOR
import { TopDownMovementController } from "../../engine/topdownmovement/TopDownMovementController";
import { OverlayMode } from "../../engine/dialog/DialogOverlay";
import { PlayerAvatar } from "../../engine/utils/PlayerAvatar";
import { EquipmentManager } from "../../engine/storagemanager/EquipmentManager";
import { NPCManager } from "../../engine/npc/NPCManager";
export class TopDownProtoScene extends PixiScene {
	private readonly C_PLAYER = 0x3498db;
	private readonly C_NPC = 0xf1c40f;
	private readonly C_WALL = 0xe74c3c;
	private readonly C_FLOOR = 0x2ecc71;
	public static readonly BUNDLES = ["myfriend", "storagescene", "basquet", "package-2", "fallrungame"];

	private player: PlayerAvatar;
	private equipmentManager: EquipmentManager;
	private world: Container;
	private walls: Graphics[] = [];

	private interactManager: InteractableManager;

	// --- NUEVO: Controlador de movimiento ---
	private movementController: TopDownMovementController;

	private inventoryManager: StorageManager;
	private inventoryView: InventoryView;
	private isInventoryOpen: boolean = false;
	private npcManager: NPCManager; // <--- NUEVO
	constructor() {
		super();
		DialogueOverlayManager.init(this);

		this.world = new Container();
		this.addChildAt(this.world, 0);

		this.interactManager = new InteractableManager(this.world);

		this.inventoryManager = new StorageManager(10, 50, "player_inventory");
		this.equipmentManager = new EquipmentManager(); // Nuevo manager

		this.inventoryManager.loadInventoryFromJSON();
		this.equipmentManager.storage.loadInventoryFromJSON();
		// Pasamos ambos managers
		this.inventoryView = new InventoryView(this.inventoryManager, this.equipmentManager);
		this.inventoryView.visible = false;
		this.inventoryView.x = 200;
		this.inventoryView.y = 100;
		this.addChild(this.inventoryView);

		this.createLevel();
		this.createPlayer();

		// --- INICIALIZAR EL CONTROLADOR ---
		this.movementController = new TopDownMovementController(this.player as any, this.walls);
		// Opcional: Agregar efecto visual al dashear
		this.movementController.onDashStart = () => {
			this.spawnParticles(this.player.x, this.player.y, 0xffffff); // Partículas blancas al dashear
		};

		// --- INICIALIZAR NPC MANAGER ---
		// Le pasamos las paredes (walls) para que cree el grid de navegación A*
		this.npcManager = new NPCManager(this.world, this.interactManager, this.walls);

		this.setupNPCs(); // Reemplazamos setupInteractions parcial o totalmente

		this.setupInteractions();

		DialogueOverlayManager.changeTalkerImage("playerface");
		DialogueOverlayManager.talk("¡Hola! Presiona 'Enter' para avanzar este diálogo.");
		DialogueOverlayManager.talk("Ahora puedes usar el teclado o el mouse para leer.");
		DialogueOverlayManager.talk("Presiona Space to make a dash.");
	}

	private setupNPCs(): void {
		// 1. NPC Estático (Friendly Static)
		this.npcManager.spawnStaticFriendly(500, 300, ["Soy un NPC estático.", "Me gusta ver pasar las nubes."]);

		// 2. NPC Seguidor (Friendly Follower)
		// Se ubica lejos, al interactuar vendrá hacia ti sorteando obstáculos
		this.npcManager.spawnFollowerFriendly(150, 500, ["Hola viajero.", "Es peligroso ir solo."]);

		// 3. NPC Agresivo (Aggressive Follower)
		// Ponlo detrás de una pared para probar el A*
		this.npcManager.spawnAggressive(900, 250, 250); // 250 de rango detección
	}

	private handleEquipWeaponInput(): void {
		// 1. Verificar si el inventario está abierto y hay algo seleccionado
		if (!this.isInventoryOpen) {
			DialogueOverlayManager.talk("Abre el inventario (I) y selecciona un item para equipar.");
			return;
		}

		const selectedIndex = this.inventoryView.selectedIndex;

		if (selectedIndex === -1) {
			DialogueOverlayManager.talk("Selecciona un objeto primero.");
			return;
		}

		// 2. Obtener el item del slot seleccionado
		const slot = this.inventoryManager.getSlots()[selectedIndex];
		const itemToEquip = slot.item;

		if (!itemToEquip) {
			// El usuario seleccionó un slot vacío
			return;
		}

		console.log(`Intentando equipar: ${itemToEquip.itemName} desde slot ${selectedIndex}`);

		// 3. Intentar equipar usando el EquipmentManager
		// Esto devuelve el item que estaba puesto antes (si había) o null
		const oldItem = this.equipmentManager.equipItem(itemToEquip);

		// equipItem devuelve el mismo item si falló (ej: tipo incorrecto)
		if (oldItem === itemToEquip) {
			DialogueOverlayManager.talk("No puedes equipar esto aquí.");
			return;
		}

		// 4. ÉXITO: Actualizar inventario
		// Quitamos el item que acabamos de equipar del inventario
		this.inventoryManager.removeItemFromSlot(selectedIndex);

		// Si había un item puesto anteriormente, lo devolvemos al inventario
		// Idealmente al mismo slot que quedó libre, o al primero disponible
		if (oldItem) {
			// Intentamos ponerlo donde estaba el otro
			const success = this.inventoryManager.addItemToSlot(oldItem, selectedIndex);
			if (!success) {
				// Si falla (por peso o algo raro), busca cualquier hueco
				this.inventoryManager.addItemToFirstAvailableSlot(oldItem);
			}
			DialogueOverlayManager.talk(`Equipado ${itemToEquip.itemName}, desequipado ${oldItem.itemName}.`);
		} else {
			DialogueOverlayManager.talk(`¡Has equipado ${itemToEquip.itemName}!`);
		}

		// Reseteamos selección visual
		this.inventoryView.selectedIndex = -1;
		// Forzamos redibujado (aunque los notifyChange de los managers deberían encargarse)
	}

	private createLevel(): void {
		const floor = new Graphics();
		floor.beginFill(this.C_FLOOR);
		floor.drawRect(0, 0, 1200, 800);
		floor.endFill();
		this.world.addChild(floor);

		this.createWall(200, 200, 100, 300);
		this.createWall(600, 100, 400, 50);
		this.createWall(800, 400, 100, 100);
	}

	private createWall(x: number, y: number, w: number, h: number): void {
		const wall = new Graphics();
		wall.beginFill(this.C_WALL);
		wall.drawRect(0, 0, w, h);
		wall.endFill();
		wall.x = x;
		wall.y = y;

		wall.name = "wall";
		(wall as any).widthRect = w;
		(wall as any).heightRect = h;

		this.world.addChild(wall);
		this.walls.push(wall);
	}

	private createPlayer(): void {
		// En lugar de Graphics, creamos el Avatar pasándole el manager
		this.player = new PlayerAvatar(this.equipmentManager, this.C_PLAYER);
		this.player.x = 100;
		this.player.y = 100;
		this.world.addChild(this.player);
	}

	private setupInteractions(): void {
		// ... (Tu código de interacciones se mantiene IGUAL) ...
		// Por brevedad no lo copio todo, pero aquí irían el NPC, el Orbe y el Loot
		// tal cual los tenías.

		// Solo como ejemplo rápido del loot para que compile:
		const npc = new Graphics();
		npc.beginFill(this.C_NPC);
		npc.drawRect(-20, -40, 40, 40);
		npc.endFill();
		npc.x = 500;
		npc.y = 300;
		this.world.addChild(npc);

		this.interactManager.add(npc.x, npc.y, () => {
			// DialogueOverlayManager.changeTalkerImage("playerface");
			// 1. Calculamos la posición en pantalla del NPC.
			// Como 'npc' es hijo de 'this.world', su posición absoluta en pantalla es:
			// su posición local + la posición del contenedor mundo.
			// Además, queremos que la burbuja salga arriba del NPC (npc.y - 40 de altura)
			const screenX = npc.x + this.world.x;
			const screenY = npc.y - 40 + this.world.y;

			// 2. Usamos el nuevo modo "bubble" y pasamos el target
			DialogueOverlayManager.talk("¡Hola! Soy un cubo amarillo en una burbuja.", {
				mode: OverlayMode.BUBBLE,
				target: { x: screenX, y: screenY },
				speed: 40,
			});

			DialogueOverlayManager.talk("Puedo cambiar el color del jugador si quieres.", {
				mode: OverlayMode.BUBBLE, // Seguimos en modo burbuja
				target: { x: screenX, y: screenY },
			});

			DialogueOverlayManager.chainEvent(() => {
				this.player.bodyShape.tint = Math.random() * 0xffffff;
			});

			// Volvemos a modo cinemático para el final (opcional, si no se especifica usa el default)
			DialogueOverlayManager.talk("¡Listo! Ahora te ves diferente.", { mode: OverlayMode.BUBBLE });
		});
		const orb = new Graphics();
		orb.beginFill(0x9b59b6);
		orb.drawCircle(0, 0, 15);
		orb.endFill();
		orb.x = 900;
		orb.y = 600;
		this.world.addChild(orb);

		this.interactManager.add(orb.x, orb.y, () => {
			DialogueOverlayManager.talk("Iniciando secuencia de warp...", { speed: 40 });

			DialogueOverlayManager.chainEvent(() => {
				this.performWarp(100, 100);
			});

			DialogueOverlayManager.talk("...secuencia completada.");
		});

		// En createLevel o setupInteractions dentro de TopDownProtoScene.ts

		// 1. Cuchillo (WEAPON -> Mano Derecha)
		this.createLootItem(300, 300, "knife", new Item("Daga", 2, 1, "Rápida", "knife", ItemType.WEAPON));

		// 2. Casco (HELMET -> Cabeza)
		// Asegúrate de tener una imagen "helmet_icon" o similar cargada, sino saldrá blanco/rojo
		this.createLootItem(400, 300, ItemImages.HELMET, new Item("Casco de Hierro", 3, 1, "Protege la cabeza", ItemImages.HELMET, ItemType.HELMET));

		// 3. Escudo (SHIELD -> Mano Izquierda / Slot BODY)
		this.createLootItem(
			500,
			350,
			ItemImages.SHIELD,
			new Item("Escudo de Madera", 5, 1, "Bloquea golpes", ItemImages.SHIELD, ItemType.SHIELD) // <--- Aquí usamos el nuevo tipo
		);

		const loot = new Graphics();
		loot.beginFill(0xffd700);
		loot.drawCircle(0, 0, 10);
		loot.endFill();
		loot.x = 300;
		loot.y = 300;
		this.world.addChild(loot);

		const interaction = this.interactManager.add(loot.x, loot.y, () => {
			// Intenta usar un nombre de imagen que SEGURO tengas, ej: "oldKnife" o "star"
			const sword = new Item("Espada Mágica", 5, 1, "Brilla mucho", "sword", ItemType.WEAPON);
			const added = this.inventoryManager.addItemToFirstAvailableSlot(sword);

			if (added) {
				DialogueOverlayManager.talk("¡Obtuviste una Espada!");

				loot.destroy(); // Borra el círculo amarillo
				this.interactManager.remove(interaction); // <--- NUEVO: Borra la lógica de la "E"

				// Opcional: Abrir inventario automáticamente para ver que lo tienes
				this.isInventoryOpen = true;
				this.inventoryView.visible = true;
			} else {
				DialogueOverlayManager.talk("¡Inventario lleno!");
			}
		});
	}

	// --- Helper para crear loot rápidamente ---
	private createLootItem(x: number, y: number, groundImage: string, itemData: Item): void {
		// Círculo amarillo de fondo para resaltar el loot
		const glow = new Graphics();
		glow.beginFill(0xffd700, 0.5);
		glow.drawCircle(0, 0, 15);
		glow.endFill();
		glow.x = x;
		glow.y = y;
		this.world.addChild(glow);

		// Icono del item en el piso
		// Usamos try/catch o un placeholder por si la imagen no existe en el asset loader aún
		let sprite: Sprite;
		try {
			sprite = Sprite.from(groundImage);
		} catch {
			sprite = Sprite.from(Texture.WHITE); // O un cuadrado blanco si falla
		}
		sprite.anchor.set(0.5);
		sprite.width = 20;
		sprite.height = 20;
		sprite.x = x;
		sprite.y = y;
		this.world.addChild(sprite);

		// Interacción
		const interaction = this.interactManager.add(x, y, () => {
			const added = this.inventoryManager.addItemToFirstAvailableSlot(itemData);

			if (added) {
				DialogueOverlayManager.talk(`¡Obtuviste: ${itemData.itemName}!`);

				// Limpieza visual y lógica
				glow.destroy();
				sprite.destroy();
				this.interactManager.remove(interaction);

				// Feedback visual inmediato
				this.isInventoryOpen = true;
				this.inventoryView.visible = true;
			} else {
				DialogueOverlayManager.talk("¡Inventario lleno!");
			}
		});
	}

	private performWarp(targetX: number, targetY: number): void {
		const duration = 500;

		// EFECTO 1: Partículas al iniciar el teletransporte (color del jugador)
		this.spawnParticles(this.player.x, this.player.y, this.C_PLAYER);

		// Fase 1: Desaparecer
		new Tween(this.player.scale)
			.to({ x: 0, y: 0 }, duration)
			.easing(Easing.Back.In)
			.start()
			.onComplete(() => {
				// Fase 2: Mover invisible
				this.player.x = targetX;
				this.player.y = targetY;

				// EFECTO 2: Partículas al llegar (puedes usar otro color, ej: el del orbe 0x9b59b6)
				this.spawnParticles(targetX, targetY, 0x9b59b6);

				// Fase 3: Reaparecer
				new Tween(this.player.scale).to({ x: 1, y: 1 }, duration).easing(Easing.Back.Out).start();
			});

		// Rotación del jugador
		new Tween(this.player)
			.to({ rotation: Math.PI * 4 }, duration * 2)
			.start()
			.onComplete(() => {
				this.player.rotation = 0;
			});
	}

	private spawnParticles(x: number, y: number, color: number): void {
		const particleCount = 20; // Cantidad de partículas

		for (let i = 0; i < particleCount; i++) {
			const part = new Graphics();
			part.beginFill(color);
			// Dibujamos cuadraditos o círculos pequeños aleatorios
			const size = Math.random() * 4 + 2;
			part.drawRect(-size / 2, -size / 2, size, size);
			part.endFill();

			part.x = x;
			part.y = y;
			// Rotación inicial aleatoria
			part.rotation = Math.random() * Math.PI * 2;

			this.world.addChild(part);

			// Calculamos una dirección aleatoria hacia afuera
			const angle = Math.random() * Math.PI * 2;
			const speed = Math.random() * 60 + 40; // Distancia a recorrer

			const targetX = x + Math.cos(angle) * speed;
			const targetY = y + Math.sin(angle) * speed;

			// Animación de la partícula: Moverse, rotar, encogerse y desvanecerse
			new Tween(part)
				.to(
					{
						x: targetX,
						y: targetY,
						rotation: part.rotation + Math.random() * 5, // Girar un poco mientras se mueve
						alpha: 0,
					},
					500
				) // 500ms de vida
				.easing(Easing.Quadratic.Out)
				.start()
				.onComplete(() => {
					// Importante: Limpiar memoria al terminar
					part.destroy();
				});

			// Animación separada para la escala (opcional, para darle más "jugo")
			new Tween(part.scale).to({ x: 0, y: 0 }, 500).start();
		}
	}

	public override update(dt: number): void {
		// --- BLOQUE 1: Cosas que SIEMPRE deben actualizarse ---

		// 1. La cámara debe seguir al jugador aunque haya diálogo (para el efecto warp)
		this.cameraFollow();

		// 2. Las interacciones (para que se actualicen visualmente o los iconos 'E')
		this.interactManager.update(dt, this.player.x, this.player.y);

		// --- BLOQUE 2: Bloqueo por Diálogo ---
		if (DialogueOverlayManager.isOpen) {
			// Si hay diálogo, NO dejamos que el jugador se mueva ni abra inventario.
			// Pero como la cámara ya se actualizó arriba, el warp se verá bien.
			return;
		}

		this.npcManager.update(dt, this.player);

		// --- BLOQUE 3: Lógica de Juego (Input del jugador) ---

		// Toggle Inventario
		if (Keyboard.shared.justPressed("KeyI")) {
			this.isInventoryOpen = !this.isInventoryOpen;
			this.inventoryView.visible = this.isInventoryOpen;
		}

		if (this.isInventoryOpen && Keyboard.shared.justPressed("KeyE")) {
			this.handleEquipWeaponInput();
		}

		// Movimiento del personaje (solo si no hay inventario ni diálogo)
		if (!this.isInventoryOpen) {
			this.movementController.update(dt);
		}
	}

	// ELIMINAMOS checkCollision de aquí (ahora vive en el Controller)

	private cameraFollow(): void {
		const targetX = Manager.width / 2 - this.player.x;
		const targetY = Manager.height / 2 - this.player.y;

		// Lerp suave
		this.world.x += (targetX - this.world.x) * 0.1;
		this.world.y += (targetY - this.world.y) * 0.1;
	}
}
