/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics } from "pixi.js";
import { Keyboard } from "../../engine/input/Keyboard";
import { DialogueOverlayManager } from "../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../engine/utils/InteractableManager";
import { Manager } from "../..";
import { Tween, Easing } from "tweedle.js";
import { InventoryView } from "../../engine/storagemanager/InventoryView";
import { StorageManager } from "../../engine/storagemanager/StorageManager";
import { Item } from "../../engine/storagemanager/Item";

// IMPORTAMOS EL NUEVO CONTROLADOR
import { TopDownMovementController } from "../../engine/topdownmovement/TopDownMovementController";
export class TopDownProtoScene extends PixiScene {
	private readonly C_PLAYER = 0x3498db;
	private readonly C_NPC = 0xf1c40f;
	private readonly C_WALL = 0xe74c3c;
	private readonly C_FLOOR = 0x2ecc71;
	public static readonly BUNDLES = ["myfriend", "storagescene", "basquet", "package-2", "fallrungame"];

	private player: Graphics;
	private world: Container;
	private walls: Graphics[] = [];

	private interactManager: InteractableManager;

	// --- NUEVO: Controlador de movimiento ---
	private movementController: TopDownMovementController;

	private inventoryManager: StorageManager;
	private inventoryView: InventoryView;
	private isInventoryOpen: boolean = false;

	constructor() {
		super();
		DialogueOverlayManager.init(this);

		this.world = new Container();
		this.addChildAt(this.world, 0);

		this.interactManager = new InteractableManager(this.world);

		this.inventoryManager = new StorageManager(10, 50, "player_inventory");
		this.inventoryManager.loadInventoryFromJSON();
		this.inventoryView = new InventoryView(this.inventoryManager);
		this.inventoryView.visible = false;
		this.inventoryView.x = 200;
		this.inventoryView.y = 100;
		this.addChild(this.inventoryView);

		this.createLevel();
		this.createPlayer();

		// --- INICIALIZAR EL CONTROLADOR ---
		this.movementController = new TopDownMovementController(this.player, this.walls);

		// Opcional: Agregar efecto visual al dashear
		this.movementController.onDashStart = () => {
			this.spawnParticles(this.player.x, this.player.y, 0xffffff); // Partículas blancas al dashear
		};

		this.setupInteractions();

		DialogueOverlayManager.changeTalkerImage("playerface");
		DialogueOverlayManager.talk("¡Hola! Presiona 'Enter' para avanzar este diálogo.");
		DialogueOverlayManager.talk("Ahora puedes usar el teclado o el mouse para leer.");
		DialogueOverlayManager.talk("Presiona Space to make a dash.");
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
		this.player = new Graphics();
		this.player.beginFill(this.C_PLAYER);
		this.player.drawCircle(0, 0, 20);
		this.player.endFill();
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
			DialogueOverlayManager.changeTalkerImage("npc_face");
			// 1. Calculamos la posición en pantalla del NPC.
			// Como 'npc' es hijo de 'this.world', su posición absoluta en pantalla es:
			// su posición local + la posición del contenedor mundo.
			// Además, queremos que la burbuja salga arriba del NPC (npc.y - 40 de altura)
			const screenX = npc.x + this.world.x;
			const screenY = npc.y - 40 + this.world.y;

			// 2. Usamos el nuevo modo "bubble" y pasamos el target
			DialogueOverlayManager.talk("¡Hola! Soy un cubo amarillo en una burbuja.", {
				mode: "bubble",
				target: { x: screenX, y: screenY },
				speed: 40,
			});

			DialogueOverlayManager.talk("Puedo cambiar el color del jugador si quieres.", {
				mode: "bubble", // Seguimos en modo burbuja
				target: { x: screenX, y: screenY },
			});

			DialogueOverlayManager.chainEvent(() => {
				this.player.tint = Math.random() * 0xffffff;
			});

			// Volvemos a modo cinemático para el final (opcional, si no se especifica usa el default)
			DialogueOverlayManager.talk("¡Listo! Ahora te ves diferente.", { mode: "cinematic" });
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
		const loot = new Graphics();
		loot.beginFill(0xffd700);
		loot.drawCircle(0, 0, 10);
		loot.endFill();
		loot.x = 300;
		loot.y = 300;
		this.world.addChild(loot);

		const interaction = this.interactManager.add(loot.x, loot.y, () => {
			// Intenta usar un nombre de imagen que SEGURO tengas, ej: "oldKnife" o "star"
			const sword = new Item("Espada Mágica", 5, 1, "Brilla mucho", "sword");
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

		// --- BLOQUE 3: Lógica de Juego (Input del jugador) ---

		// Toggle Inventario
		if (Keyboard.shared.justPressed("KeyI")) {
			this.isInventoryOpen = !this.isInventoryOpen;
			this.inventoryView.visible = this.isInventoryOpen;
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
