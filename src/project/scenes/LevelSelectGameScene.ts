/* eslint-disable @typescript-eslint/naming-convention */
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
import { TopDownMovementController } from "../../engine/topdownmovement/TopDownMovementController";
import { OverlayMode } from "../../engine/dialog/DialogOverlay";
import { Item } from "../../engine/storagemanager/Item";
import { DataManager } from "../../engine/datamanager/DataManager"; // IMPORTANTE
import type { LevelSaveData } from "../../engine/levelselection/LevelModels"; // IMPORTANTE

export class LevelSelectGameScene extends PixiScene {
	// ... (Propiedades visuales iguales) ...
	public static readonly BUNDLES = ["myfriend", "storagescene", "basquet", "package-2", "fallrungame"];
	private C_PLAYER = 0x3498db;
	private C_NPC = 0xf1c40f;
	private C_WALL = 0xe74c3c;
	private C_FLOOR = 0x2ecc71;

	private player: Graphics;
	private world: Container;
	private walls: Graphics[] = [];
	private interactManager: InteractableManager;
	private movementController: TopDownMovementController;
	private inventoryManager: StorageManager;
	private inventoryView: InventoryView;
	private isInventoryOpen: boolean = false;
	private currentLevelId: string;
	private zoneType: string;

	// Flag para init diferido del overlay
	private overlayInitialized = false;

	constructor(levelId: string, zoneId: string) {
		super();
		this.currentLevelId = levelId;
		this.zoneType = zoneId;

		this.world = new Container();
		this.addChildAt(this.world, 0);

		// 3. Inicializar Managers
		this.interactManager = new InteractableManager(this.world);

		this.inventoryManager = new StorageManager(10, 50, "player_inventory");
		this.inventoryManager.loadInventoryFromJSON();
		this.inventoryView = new InventoryView(this.inventoryManager);
		this.inventoryView.visible = false;
		this.inventoryView.x = 200;
		this.inventoryView.y = 100;
		this.addChild(this.inventoryView);

		console.log(`Construyendo Nivel: ${this.currentLevelId} (${this.zoneType})`);
		this.createLevelEnvironment();
		this.createPlayer();

		this.movementController = new TopDownMovementController(this.player, this.walls);
		this.movementController.onDashStart = () => {
			this.spawnParticles(this.player.x, this.player.y, 0xffffff);
		};

		this.setupInteractions();
	}

	private initOverlaySafe(): void {
		DialogueOverlayManager.init(this);
		DialogueOverlayManager.changeTalkerImage("playerface");
		DialogueOverlayManager.talk(`¡Entrando al Nivel ${this.currentLevelId}!`, { speed: 60 });
		DialogueOverlayManager.talk("Usa 'I' para inventario, 'Espacio' para dash.");
	}

	private createLevelEnvironment(): void {
		this.walls = []; // Reiniciar paredes

		if (this.currentLevelId === "lvl_2" || this.currentLevelId === "lvl_2a") {
			// --- ESTILO DUNGEON ---
			this.C_FLOOR = 0x2c3e50;
			this.C_WALL = 0xc0392b;

			this.drawFloor(1500, 1000);

			// Paredes estilo laberinto
			this.createWall(0, 0, 1500, 50); // Norte
			this.createWall(0, 950, 1500, 50); // Sur
			this.createWall(0, 0, 50, 1000); // Oeste
			this.createWall(1450, 0, 50, 1000); // Este

			this.createWall(300, 0, 50, 600); // Obstáculo 1
			this.createWall(800, 400, 50, 600); // Obstáculo 2
		} else {
			// --- ESTILO BOSQUE (Default) ---
			this.C_FLOOR = 0x2ecc71;
			this.C_WALL = 0x27ae60;

			this.drawFloor(1200, 800);

			// Paredes originales
			this.createWall(200, 200, 100, 300);
			this.createWall(600, 100, 400, 50);
			this.createWall(800, 400, 100, 100);

			// Límites del mundo
			this.createWall(0, -50, 1200, 50);
			this.createWall(0, 800, 1200, 50);
			this.createWall(-50, 0, 50, 800);
			this.createWall(1200, 0, 50, 800);
		}
	}

	private drawFloor(w: number, h: number): void {
		const floor = new Graphics();
		floor.beginFill(this.C_FLOOR);
		floor.drawRect(0, 0, w, h);
		floor.endFill();
		this.world.addChild(floor);
	}

	private createWall(x: number, y: number, w: number, h: number): void {
		const wall = new Graphics();
		wall.beginFill(this.C_WALL);
		wall.lineStyle(2, 0x000000, 0.3);
		wall.drawRect(0, 0, w, h);
		wall.endFill();
		wall.x = x;
		wall.y = y;

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

		// Spawn dinámico
		if (this.currentLevelId === "lvl_2" || this.currentLevelId === "lvl_2a") {
			this.player.x = 100;
			this.player.y = 800;
		} else {
			this.player.x = 100;
			this.player.y = 100;
		}

		this.world.addChild(this.player);
	}

	private setupInteractions(): void {
		// NPC (Solo aparece en niveles que no sean Dungeon)
		if (!this.currentLevelId.includes("lvl_2")) {
			const npc = new Graphics();
			npc.beginFill(this.C_NPC);
			npc.drawRect(-20, -40, 40, 40);
			npc.endFill();
			npc.x = 500;
			npc.y = 300;
			this.world.addChild(npc);

			this.interactManager.add(npc.x, npc.y, () => {
				const screenPos = { x: npc.x + this.world.x, y: npc.y - 40 + this.world.y };
				DialogueOverlayManager.talk(`Bienvenido al sector: ${this.zoneType}`, {
					mode: OverlayMode.BUBBLE,
					target: screenPos,
				});
			});
		}

		const loot = new Graphics();
		loot.beginFill(0xffd700);
		loot.drawCircle(0, 0, 10);
		loot.endFill();
		loot.x = 300 + Math.random() * 100;
		loot.y = 300 + Math.random() * 100;
		this.world.addChild(loot);

		const lootInteraction = this.interactManager.add(loot.x, loot.y, () => {
			const sword = new Item("Espada Antigua", 1, 1, `Reliquia del nivel ${this.currentLevelId}`, "sword");
			if (this.inventoryManager.addItemToFirstAvailableSlot(sword)) {
				DialogueOverlayManager.talk("¡Obtuviste un objeto raro!");
				loot.destroy();
				this.interactManager.remove(lootInteraction);

				this.isInventoryOpen = true;
				this.inventoryView.visible = true;
			} else {
				DialogueOverlayManager.talk("¡Inventario lleno!");
			}
		});

		// WARP DE SALIDA
		const warp = new Graphics();
		warp.beginFill(0x9b59b6);
		warp.drawCircle(0, 0, 20);
		warp.endFill();
		warp.x = this.currentLevelId.includes("lvl_2") ? 1300 : 900;
		warp.y = 600;
		this.world.addChild(warp);

		new Tween(warp.scale).to({ x: 1.2, y: 1.2 }, 800).yoyo(true).repeat(Infinity).start();

		this.interactManager.add(warp.x, warp.y, () => {
			DialogueOverlayManager.talk("Completando nivel...");
			DialogueOverlayManager.chainEvent(() => {
				this.performExitAnimation(warp.x, warp.y);
			});
		});
	}

	private performExitAnimation(targetX: number, targetY: number): void {
		const duration = 600;

		new Tween(this.player).to({ x: targetX, y: targetY }, 300).start();
		this.spawnParticles(targetX, targetY, 0x9b59b6);

		new Tween(this.player.scale)
			.to({ x: 0, y: 0 }, duration)
			.easing(Easing.Back.In)
			.start()
			.onComplete(() => {
				console.log("Nivel completado. Guardando...");

				// 1. Obtener datos actuales desde DataManager
				const PROGRESS_KEY = "LEVEL_PROGRESS_MAP";
				let allProgress = DataManager.getValue<Record<string, LevelSaveData>>(PROGRESS_KEY);

				if (!allProgress) {
					allProgress = {}; // Seguridad por si acaso
				}

				// 2. Actualizar el nivel actual
				if (!allProgress[this.currentLevelId]) {
					// Si no existía, lo creamos
					allProgress[this.currentLevelId] = { stars: 0, score: 0, completed: false, unlocked: true };
				}

				const currentData = allProgress[this.currentLevelId];
				currentData.completed = true;
				currentData.stars = 3; // Lógica de estrellas aquí
				currentData.score = 1000; // Lógica de puntaje aquí
				currentData.unlocked = true; // Asegurar que sigue desbloqueado

				// 3. Guardar en memoria y disco
				DataManager.setValue(PROGRESS_KEY, allProgress);
				DataManager.save().then(() => {
					console.log("Guardado exitoso.");
				});

				// 4. Volver al Menú
				import("./LevelSelectScene").then((module) => {
					Manager.changeScene(module.LevelSelectScene);
				});
			});

		new Tween(this.player).to({ rotation: Math.PI * 4 }, duration).start();
	}

	private spawnParticles(x: number, y: number, color: number): void {
		const particleCount = 15;
		for (let i = 0; i < particleCount; i++) {
			const part = new Graphics();
			part.beginFill(color);
			const size = Math.random() * 4 + 2;
			part.drawRect(-size / 2, -size / 2, size, size);
			part.endFill();
			part.x = x;
			part.y = y;
			part.rotation = Math.random() * Math.PI * 2;
			this.world.addChild(part);

			const angle = Math.random() * Math.PI * 2;
			const speed = Math.random() * 50 + 30;
			const targetX = x + Math.cos(angle) * speed;
			const targetY = y + Math.sin(angle) * speed;

			new Tween(part)
				.to({ x: targetX, y: targetY, rotation: part.rotation + 2, alpha: 0 }, 500)
				.easing(Easing.Quadratic.Out)
				.start()
				.onComplete(() => part.destroy());
		}
	}

	public override update(dt: number): void {
		if (!this.overlayInitialized) {
			this.overlayInitialized = true;
			this.initOverlaySafe();
		}
		this.cameraFollow();
		this.interactManager.update(dt, this.player.x, this.player.y);

		if (DialogueOverlayManager.isOpen) {
			return;
		}

		if (Keyboard.shared.justPressed("KeyI")) {
			this.isInventoryOpen = !this.isInventoryOpen;
			this.inventoryView.visible = this.isInventoryOpen;
		}

		if (!this.isInventoryOpen) {
			this.movementController.update(dt);
		}
	}

	private cameraFollow(): void {
		const targetX = Manager.width / 2 - this.player.x;
		const targetY = Manager.height / 2 - this.player.y;
		this.world.x += (targetX - this.world.x) * 0.1;
		this.world.y += (targetY - this.world.y) * 0.1;
	}
}
