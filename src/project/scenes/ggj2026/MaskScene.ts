/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { Keyboard } from "../../../engine/input/Keyboard";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../../engine/utils/InteractableManager";
import { Manager } from "../../..";
import { InventoryView } from "../../../engine/storagemanager/InventoryView";
import { StorageManager } from "../../../engine/storagemanager/StorageManager";
import { Item, ItemType } from "../../../engine/storagemanager/Item";
import { TopDownMovementController } from "../../../engine/topdownmovement/TopDownMovementController";
import { PlayerAvatar } from "../../../engine/utils/PlayerAvatar";
import { EquipmentManager } from "../../../engine/storagemanager/EquipmentManager";
import { OverlayMode } from "../../../engine/dialog/DialogOverlay";
import { MaskMenuScene } from "./MaskMenuScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class MaskScene extends PixiScene {
	// Colores estéticos
	private readonly C_PUMPKIN = 0xd35400;
	private readonly C_WALL = 0x2c3e50;
	public static readonly BUNDLES = ["ggj2026", "donotdelete"];

	// Variables de juego
	public player: PlayerAvatar;
	public world: Container;
	private walls: Graphics[] = [];
	private movementController: TopDownMovementController;
	private interactManager: InteractableManager;

	// Sistema de Máscaras e Inventario
	private inventoryManager: StorageManager;
	public equipmentManager: EquipmentManager;
	private inventoryView: InventoryView;
	private isInventoryOpen: boolean = false;

	// Lógica de "Boo-Loop"
	public suspicion: number = 0;
	private maxSuspicion: number = 100;
	public candies: number = 0;
	private lastMaskId: string | null = null;

	// UI
	private suspicionBar: Graphics;
	private candyText: Text;
	private background: Sprite;

	private gameTimer: number = 60; // 60 segundos de juego
	public isGameOver: boolean = false;
	private timerText: Text;
	constructor() {
		super();

		SoundLib.playMusic("haunting", { volume: 0.2 });
		this.world = new Container();
		this.addChild(this.world);

		this.interactManager = new InteractableManager(this.world);
		this.createLevel();
		this.setupSystems();

		const frontLayer = Sprite.from("gameFrontLayer");
		frontLayer.anchor.set(0.5);
		// frontLayer.alpha = 0.8;
		this.world.addChild(frontLayer);
		this.createUI();
		DialogueOverlayManager.init(this);

		// Mensaje inicial
		DialogueOverlayManager.changeTalkerImage("kidface");
		DialogueOverlayManager.talk("¡Es noche de Halloween! Engaña al vecino cambiando de máscara.");
		DialogueOverlayManager.talk("Usa 'I' para ver tus máscaras y 'E' para ponértelas en el inventario.");
	}

	private setupSystems(): void {
		// Inventario con 4 slots para 4 máscaras
		this.inventoryManager = new StorageManager(4, 80, "player_masks");
		this.equipmentManager = new EquipmentManager();
		this.inventoryView = new InventoryView(
			this.inventoryManager,
			this.equipmentManager,
			Texture.from("ninesliceplane2"),
			20,
			20,
			20,
			20 // Bordes del NineSlice
		);
		this.inventoryView.visible = false;
		this.inventoryView.x = Manager.width * 0.5 - this.inventoryView.width / 2;
		this.inventoryView.y = Manager.height * 0.1;
		this.addChild(this.inventoryView);

		// Añadimos las máscaras iniciales al inventario
		// this.inventoryManager.addItemToFirstAvailableSlot(new Item("Calabaza", 0, 1, "Clásico", "pumpkin_mask", ItemType.HELMET));
		// this.inventoryManager.addItemToFirstAvailableSlot(new Item("Frankie", 0, 1, "Verde", "frank_mask", ItemType.HELMET));
		// this.inventoryManager.addItemToFirstAvailableSlot(new Item("Alien", 0, 1, "Galáctico", "alien_mask", ItemType.HELMET));
		// this.inventoryManager.addItemToFirstAvailableSlot(new Item("Pirata", 0, 1, "Arrr", "pirate_mask", ItemType.HELMET));

		this.player = new PlayerAvatar(this.equipmentManager, this.C_PUMPKIN, "kid");
		this.player.x = 1100;
		this.player.y = -50;
		this.world.addChild(this.player);

		this.movementController = new TopDownMovementController(this.player as any, this.walls);
	}

	private createLevel(): void {
		this.background = Sprite.from("gameBG"); // Guardamos la referencia
		this.background.anchor.set(0.5);
		this.world.addChildAt(this.background, 0);
		// La Casa del Vecino (Paredes)
		this.createWall(-200, -385, 400, 300); // Cuerpo casa

		// --- CORRECCIÓN 2: Metadata para el controlador ---
		// Ajusta estos rectángulos para que coincidan con las casas de tu imagen
		this.createWall(-1280, -385, 420, 300); // Casa izquierda

		this.createWall(150, -385, 330, 300); // Garage
		this.createWall(900, -385, 520, 300); // Casa derecha

		this.createWall(-1450, -255, 3520, 90); // Fences

		this.createWall(-1450, 655, 3520, 90); // Fences

		this.createWall(-1140, 465, 400, 600); // Casa izquierda abajo

		this.createWall(-465, 525, 615, 600); // Casa medio abajo

		this.createWall(405, 485, 450, 600); // Casa abajo derecha casi

		this.createWall(1105, 465, 450, 600); // Casa abajo derecha

		// La Puerta (Interactuable)
		const door = new Graphics().beginFill(0x7f8c8d).drawRect(-25, -50, 50, 50);
		door.x = 0;
		door.y = -90;
		door.alpha = 0.01;
		this.world.addChild(door);

		this.interactManager.add(door.x, door.y, () => this.tryTrickOrTreat());

		this.spawnMaskOnFloor(1100, 50, new Item("Calabaza", 0, 1, "Realmente aterrador", "pumpkin_mask", ItemType.HELMET));
		this.spawnMaskOnFloor(-800, 200, new Item("Frankie", 0, 1, "Muy verde", "frank_mask", ItemType.HELMET));
		this.spawnMaskOnFloor(-500, 600, new Item("Alien", 0, 1, "De otro mundo", "alien_mask", ItemType.HELMET));
		this.spawnMaskOnFloor(300, 600, new Item("Pirata", 0, 1, "Busca tesoros", "pirate_mask", ItemType.HELMET));

		const oldman = Sprite.from("oldman");
		oldman.anchor.set(0.5);
		oldman.scale.set(0.4);
		oldman.x = 10;
		oldman.y = -130;
		this.world.addChild(oldman);
	}

	private createUI(): void {
		// Barra de Sospecha (Fondo)
		const barBg = new Graphics().beginFill(0x000000, 0.5).drawRect(20, 20, 200, 20).endFill();
		this.addChild(barBg);

		this.suspicionBar = new Graphics();
		this.addChild(this.suspicionBar);

		// Contador de Caramelos
		this.candyText = new Text("Caramelos: 0", new TextStyle({ fill: "#ffffff", fontSize: 18, fontWeight: "bold" }));
		this.candyText.x = 20;
		this.candyText.y = 50;
		this.addChild(this.candyText);

		// Cronómetro (arriba a la derecha)
		const seconds = Math.max(0, Math.floor(this.gameTimer));
		const formatSeconds = seconds < 10 ? `0${seconds}` : seconds;

		this.timerText = new Text(
			`Tiempo hasta la medianoche: ${formatSeconds}`,
			new TextStyle({
				fill: "#ffffff",
				fontSize: 18,
				fontWeight: "bold",
				stroke: "#000000",
				strokeThickness: 4,
			})
		);
		this.timerText.x = Manager.width - 320;
		this.timerText.y = 20;
		this.addChild(this.timerText);
	}

	public tryTrickOrTreat(): void {
		const equippedMask = this.equipmentManager.getEquippedItem(ItemType.HELMET);

		if (!equippedMask) {
			DialogueOverlayManager.changeTalkerImage("oldmanface");
			DialogueOverlayManager.talk("Vecino: ¡Ni siquiera tienes un disfraz! Vete de aquí.", { mode: OverlayMode.CINEMATIC, target: { x: 700, y: 350 } });
			this.increaseSuspicion(20);
			return;
		}

		if (equippedMask.itemName === this.lastMaskId) {
			// MISMA MÁSCARA - El vecino sospecha
			this.increaseSuspicion(40);
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			DialogueOverlayManager.changeTalkerImage("oldmanface");
			DialogueOverlayManager.talk(`Vecino: Un momento... ¿tú no eres el mismo ${equippedMask.itemName} de hace un minuto?`, {
				mode: OverlayMode.CINEMATIC,
				target: { x: 700, y: 350 },
			});
		} else {
			// NUEVA MÁSCARA - ¡Éxito!
			this.candies += 25;
			this.lastMaskId = equippedMask.itemName;
			this.candyText.text = `Caramelos: ${this.candies}`;

			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			DialogueOverlayManager.changeTalkerImage("oldmanface");
			DialogueOverlayManager.talk(`Vecino: ¡Qué lindo disfraz de ${equippedMask.itemName}! Toma dulces.`, { mode: OverlayMode.CINEMATIC, target: { x: 700, y: 350 } });

			// La sospecha baja un poco si lo haces bien
			this.increaseSuspicion(-10);
		}

		if (this.suspicion >= this.maxSuspicion) {
			this.gameOver();
		}
	}

	private spawnMaskOnFloor(x: number, y: number, item: Item): void {
		// 1. Creamos el contenedor en la posición del mundo
		const container = new Container();
		container.x = x;
		container.y = y;

		// 2. El brillo (glow)
		const glow = new Graphics().beginFill(0xffff00, 0.3).drawCircle(0, 0, 15).endFill();

		// 3. El Sprite de la máscara
		// Usamos item.image que es el string de la textura (ej: "ghost_mask")
		const sprite = Sprite.from(item.image);

		sprite.anchor.set(0.5);
		sprite.width = 24; // Ajusta el tamaño para que se vea bien en el suelo
		sprite.height = 24;

		// IMPORTANTE: Como el padre (container) ya está en (x, y),
		// el sprite debe estar en (0, 0) para estar en el centro del contenedor.
		sprite.x = 0;
		sprite.y = 0;

		// 4. Armamos la jerarquía
		container.addChild(glow, sprite);
		this.world.addChild(container);

		// 5. Registrar la interacción (se mantiene igual)
		const interaction = this.interactManager.add(x, y, () => {
			const added = this.inventoryManager.addItemToFirstAvailableSlot(item);

			if (added) {
				DialogueOverlayManager.changeTalkerImage("kidface");
				DialogueOverlayManager.talk(`¡Encontré una máscara de ${item.itemName}!`);

				SoundLib.playSound("collect", { volume: 0.2 });

				container.destroy(); // Esto borra el contenedor, el brillo y el sprite de un golpe
				this.interactManager.remove(interaction);

				this.isInventoryOpen = true;
				this.inventoryView.visible = true;
			} else {
				SoundLib.playSound("collect", { volume: 0.2 });
				DialogueOverlayManager.changeTalkerImage("kidface");
				DialogueOverlayManager.talk("No tengo espacio en los bolsillos.");
			}
		});
	}

	private increaseSuspicion(amount: number): void {
		this.suspicion = Math.max(0, Math.min(this.maxSuspicion, this.suspicion + amount));
		this.updateSuspicionBar();
	}

	private updateSuspicionBar(): void {
		this.suspicionBar.clear();
		// Cambia de color a más rojo según la sospecha
		const color = this.suspicion > 70 ? 0xff4757 : 0xeccc68;
		this.suspicionBar
			.beginFill(color)
			.drawRect(20, 20, (this.suspicion / this.maxSuspicion) * 200, 20)
			.endFill();
	}

	private handleInventoryInput(): void {
		if (Keyboard.shared.justPressed("KeyI")) {
			this.isInventoryOpen = !this.isInventoryOpen;
			this.inventoryView.visible = this.isInventoryOpen;
		}

		if (this.isInventoryOpen && Keyboard.shared.justPressed("KeyE")) {
			this.handleEquipLogic();
		}
	}

	private handleEquipLogic(): void {
		const idx = this.inventoryView.selectedIndex;
		if (idx === -1) {
			return;
		}

		const slot = this.inventoryManager.getSlots()[idx];
		const itemToEquip = slot.item;
		if (!itemToEquip) {
			return;
		}

		// Si nos cambiamos de máscara muy cerca de la puerta, el vecino podría vernos
		const distToDoor = Math.hypot(this.player.x - 700, this.player.y - 400);
		if (distToDoor < 350) {
			this.increaseSuspicion(15);
			DialogueOverlayManager.changeTalkerImage("kidface");
			DialogueOverlayManager.talk("¡Cuidado! Estoy muy cerca de la casa, el vecino sospecha.");
		}

		const oldItem = this.equipmentManager.equipItem(itemToEquip);
		this.inventoryManager.removeItemFromSlot(idx);
		if (oldItem) {
			this.inventoryManager.addItemToSlot(oldItem, idx);
		}

		this.inventoryView.selectedIndex = -1;
	}

	private gameOver(): void {
		DialogueOverlayManager.talk("¡TE HAN DESCUBIERTO! El vecino llamó a tus padres. Fin del juego.");
		// Aquí podrías reiniciar la escena o volver al menú
		this.busted(); // Llamamos a la función de finalización
	}

	private createWall(x: number, y: number, w: number, h: number): void {
		const wall = new Graphics().beginFill(this.C_WALL, 0.5).drawRect(0, 0, w, h).endFill();
		wall.x = x;
		wall.y = y;

		// Agregamos propiedades manuales que el controlador suele usar para calcular hitboxes
		(wall as any).widthRect = w;
		(wall as any).heightRect = h;

		wall.alpha = 0; // Hazlo invisible para que se vea el fondo
		this.world.addChild(wall);
		this.walls.push(wall);
	}

	public override update(dt: number): void {
		if (this.isGameOver) {
			return;
		} // Si terminó el tiempo, no hacemos nada más
		this.cameraFollow();

		this.interactManager.update(dt, this.player.x, this.player.y);

		if (DialogueOverlayManager.isOpen) {
			return;
		}

		// --- LÓGICA DEL TIMER ---
		// dt suele ser el tiempo entre frames. Ajustamos para segundos:
		this.gameTimer -= dt / 1600;

		if (this.gameTimer <= 0) {
			this.gameTimer = 0;
			this.finishNight(); // Llamamos a la función de finalización
		}
		this.updateTimerUI();
		// ------------------------

		this.handleInventoryInput();

		if (!this.isInventoryOpen) {
			this.movementController.update(dt);

			this.clampPlayerPosition();
		}
	}

	private updateTimerUI(): void {
		const seconds = Math.max(0, Math.floor(this.gameTimer));
		const formatSeconds = seconds < 10 ? `0${seconds}` : seconds;
		this.timerText.text = `Tiempo hasta la medianoche: ${formatSeconds}`;
	}

	private finishNight(): void {
		this.isGameOver = true;

		// Detenemos el movimiento del controlador
		this.movementController.update(0);

		// Secuencia de diálogos de fin de juego
		DialogueOverlayManager.talk("¡Ding, ding, ding! ¡Son las 12 de la noche!");

		// Mostramos el recuento final
		DialogueOverlayManager.talk(`La noche ha terminado. \n\n🍬 Caramelos totales: ${this.candies} \n🕵️ Sospecha final: ${Math.floor(this.suspicion)}%`);

		if (this.candies >= 150) {
			DialogueOverlayManager.talk("¡Increíble! Eres el terror de las golosinas. Los vecinos no supieron qué les pasó.");
		} else {
			DialogueOverlayManager.talk("¡Buen intento! Pero el año que viene tendrás que ser más astuto con las máscaras.");
		}

		// Mensaje de instrucción para el jugador
		DialogueOverlayManager.talk("Presiona ENTER para volver a jugar...");

		// --- LÓGICA DE RESET ---
		// chainEvent se ejecuta justo después de que el último diálogo se cierra
		DialogueOverlayManager.chainEvent(() => {
			// Reiniciamos la escena creando una instancia nueva
			// Esto reseteará automáticamente el timer, los caramelos y la posición
			Manager.changeScene(MaskScene);
		});
	}

	private busted(): void {
		this.isGameOver = true;

		// Detenemos el movimiento del controlador
		this.movementController.update(0);

		// Secuencia de diálogos de fin de juego
		DialogueOverlayManager.talk("¡Fuiste descubierto!");

		// Mostramos el recuento final
		DialogueOverlayManager.talk(`La noche ha terminado. \n\n🍬 Caramelos totales: ${this.candies} \n🕵️ Sospecha final: ${Math.floor(this.suspicion)}%`);

		if (this.candies >= 150) {
			DialogueOverlayManager.talk("¡Increíble! Eres el terror de las golosinas. Los vecinos no supieron qué les pasó.");
		} else {
			DialogueOverlayManager.talk("¡Buen intento! Pero el año que viene tendrás que ser más astuto con las máscaras.");
		}

		// Mensaje de instrucción para el jugador
		DialogueOverlayManager.talk("Presiona ENTER para volver al menu principal y planificar un poco mejor...");

		// --- LÓGICA DE RESET ---
		// chainEvent se ejecuta justo después de que el último diálogo se cierra
		DialogueOverlayManager.chainEvent(() => {
			// Reiniciamos la escena creando una instancia nueva
			// Esto reseteará automáticamente el timer, los caramelos y la posición
			Manager.changeScene(MaskMenuScene, { transitionClass: FadeColorTransition });
		});
	}

	private clampPlayerPosition(): void {
		if (!this.background) {
			return;
		}

		// Calculamos los límites basados en el tamaño del fondo
		const halfW = this.background.width / 2;
		const halfH = this.background.height / 2;

		// Restringimos la posición del jugador
		// (Podemos restar un pequeño margen, ej. 20px, para que no toque el borde exacto)
		this.player.x = Math.max(-halfW + 20, Math.min(halfW - 20, this.player.x));
		this.player.y = Math.max(-halfH + 20, Math.min(halfH - 20, this.player.y));
	}

	private cameraFollow(): void {
		if (!this.background) {
			return;
		}

		// 1. Calculamos la posición ideal para centrar al jugador
		let targetX = Manager.width / 2 - this.player.x;
		let targetY = Manager.height / 2 - this.player.y;

		// 2. Calculamos los límites reales
		// El límite máximo es la mitad del fondo (detiene el borde izquierdo en x=0)
		const limitMaxX = this.background.width / 2;
		const limitMaxY = this.background.height / 2;

		// El límite mínimo es el ancho de la pantalla menos la mitad del fondo
		// (detiene el borde derecho en x = Manager.width)
		const limitMinX = Manager.width - this.background.width / 2;
		const limitMinY = Manager.height - this.background.height / 2;

		// 3. Aplicamos el Clamp
		// Math.min(limitMaxX, ...) asegura que no se pase de la izquierda
		// Math.max(limitMinX, ...) asegura que no se pase de la derecha
		targetX = Math.max(limitMinX, Math.min(limitMaxX, targetX));
		targetY = Math.max(limitMinY, Math.min(limitMaxY, targetY));

		// 4. Suavizado (Lerp)
		this.world.x += (targetX - this.world.x) * 0.1;
		this.world.y += (targetY - this.world.y) * 0.1;
	}
}
