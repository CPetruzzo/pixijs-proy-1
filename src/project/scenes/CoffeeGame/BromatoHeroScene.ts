import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Text } from "pixi.js";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../../engine/utils/InteractableManager";
import { Manager } from "../../..";
import { Tween, Easing } from "tweedle.js";
import { TopDownMovementController } from "../../../engine/topdownmovement/TopDownMovementController";
import { PlayerAvatar } from "../../../engine/utils/PlayerAvatar";
import { EquipmentManager } from "../../../engine/storagemanager/EquipmentManager";
import { StorageManager } from "../../../engine/storagemanager/StorageManager";
import { InventoryView } from "../../../engine/storagemanager/InventoryView";
// 1. MODIFICADO: Quitamos "type" para poder instanciar la clase
import { NPCManager } from "../../../engine/npc/NPCManager";
import { OverlayMode } from "../../../engine/dialog/DialogOverlay";

export class BromatoHeroScene extends PixiScene {
	public static readonly BUNDLES = ["myfriend", "storagescene", "basquet", "package-2", "fallrungame"];

	// Colores Placeholder
	private readonly C_FLOOR_KITCHEN = 0x95a5a6;
	private readonly C_FLOOR_CUSTOMER = 0xd35400;
	private readonly C_WALL = 0x2c3e50;
	private readonly C_STATION_COOK = 0xc0392b;
	private readonly C_STATION_SINK = 0x3498db;
	private readonly C_STATION_TRASH = 0x7f8c8d;
	private readonly C_DIRT_SPILL = 0x2ecc71;

	private world: Container;
	private player: PlayerAvatar;
	private walls: Graphics[] = [];
	private movementController: TopDownMovementController;
	private interactManager: InteractableManager;
	private npcManager: NPCManager;

	// --- Lógica de Bromatología ---
	private healthRiskScore: number = 0;
	private maxRisk: number = 100;
	private riskBarFill: Graphics;
	private activeDirtSpills: Container[] = [];
	private dirtSpawnTimer: number = 0;

	// 2. AGREGADO: Timer para spawnear clientes
	private customerSpawnTimer: number = 0;

	private inventoryManager: StorageManager;
	private equipmentManager: EquipmentManager;
	private inventoryView: InventoryView;
	private counterSpots = [
		{ x: 300, y: 600, occupied: false },
		{ x: 400, y: 600, occupied: false },
		{ x: 500, y: 600, occupied: false },
	];

	constructor() {
		super();
		DialogueOverlayManager.init(this);
		this.world = new Container();
		this.addChildAt(this.world, 0);
		this.interactManager = new InteractableManager(this.world);
		this.inventoryManager = new StorageManager(10, 50, "player_inventory");
		this.equipmentManager = new EquipmentManager();

		this.inventoryManager.loadInventoryFromJSON();
		this.equipmentManager.storage.loadInventoryFromJSON();

		this.inventoryView = new InventoryView(this.inventoryManager, this.equipmentManager);
		this.inventoryView.visible = false;
		this.inventoryView.x = 200;
		this.inventoryView.y = 100;
		this.addChild(this.inventoryView);

		this.createKitchenLayout();
		this.createStations();
		this.createPlayer();
		this.createUI();

		// Inicializamos controladores
		this.movementController = new TopDownMovementController(this.player as any, this.walls);

		// 3. AGREGADO: Inicializamos el NPCManager pasándole las paredes para que los clientes las eviten
		this.npcManager = new NPCManager(this.world, this.interactManager, this.walls);

		DialogueOverlayManager.changeTalkerImage("playerface");
		DialogueOverlayManager.talk("Bienvenido a la cocina. Soy el Director de Bromatología.");
		DialogueOverlayManager.talk("Tu objetivo es mantener la inocuidad. Vigila la barra de 'Riesgo Sanitario' arriba.");
		DialogueOverlayManager.talk("Lávate las manos (Bacha Azul) y limpia los derrames (Verde) frecuentemente con 'E'.");
	}

	// Modificamos el spawn para respetar el límite
	private spawnRandomCustomer(): void {
		// LIMITADOR DE POOL: Si ya hay 10 clientes activos, no traemos más.
		if (this.npcManager.activeCount >= 10) {
			return;
		}

		const freeSpotIndex = this.counterSpots.findIndex((s) => !s.occupied);
		if (freeSpotIndex === -1) {
			return;
		}

		const spot = this.counterSpots[freeSpotIndex];
		spot.occupied = true;

		this.npcManager.spawnCustomer(
			-50,
			800, // Spawn (afuera, invisible al inicio)
			spot.x,
			spot.y,
			850,
			300,
			10000,
			() => {
				DialogueOverlayManager.talk("¡Cliente atendido!", { mode: OverlayMode.BUBBLE });
				this.decreaseRisk(5);
				spot.occupied = false;
			},
			() => {
				DialogueOverlayManager.talk("¡Cliente furioso!", { mode: OverlayMode.BUBBLE });
				this.increaseRisk(10);
				spot.occupied = false;
			}
		);
	}

	// Modificamos el layout para abrir la puerta
	private createKitchenLayout(): void {
		const floorKitchen = new Graphics();
		floorKitchen.beginFill(this.C_FLOOR_KITCHEN);
		floorKitchen.drawRect(0, 0, 800, 600);
		floorKitchen.endFill();
		this.world.addChild(floorKitchen);

		const floorCustomer = new Graphics();
		floorCustomer.beginFill(this.C_FLOOR_CUSTOMER);
		floorCustomer.drawRect(0, 600, 800, 200);
		floorCustomer.endFill();
		this.world.addChild(floorCustomer);

		// --- PAREDES ---
		this.createWall(0, 0, 800, 50); // Norte
		this.createWall(0, 0, 50, 600); // <-- ESTA ERA LA PARED OESTE QUE BLOQUEABA
		this.createWall(750, 0, 50, 800); // Este
		this.createWall(0, 750, 800, 50); // Sur
		this.createWall(50, 600, 700, 20); // Mesada Central

		// --- NUEVA PARED OESTE CON HUECO ---
		// Dejamos un hueco entre Y=200 y Y=400 para que entren los NPCs (Spawn en 300)
		this.createWall(0, 750, 50, 50); // Parte superior Oeste
		// this.createWall(0, 400, 50, 400); // Parte inferior Oeste (hasta abajo)
	}

	private createWall(x: number, y: number, w: number, h: number): Graphics {
		const wall = new Graphics();
		wall.beginFill(this.C_WALL);
		wall.drawRect(0, 0, w, h);
		wall.endFill();
		wall.x = x;
		wall.y = y;
		(wall as any).widthRect = w;
		(wall as any).heightRect = h;
		this.world.addChild(wall);
		this.walls.push(wall);
		return wall;
	}

	private createStations(): void {
		this.createInteractiveStation(200, 60, 100, 40, this.C_STATION_COOK, () => {
			DialogueOverlayManager.talk("Cocinando hamburguesa... (Cuidado con la contaminación cruzada)");
			this.increaseRisk(5);
		});

		this.createInteractiveStation(600, 60, 80, 40, this.C_STATION_SINK, () => {
			DialogueOverlayManager.talk("Lavando manos correctamente con agua tibia y jabón...");
			this.decreaseRisk(25);
			this.spawnParticles(this.player.x, this.player.y, this.C_STATION_SINK);
		});

		this.createInteractiveStation(700, 450, 40, 40, this.C_STATION_TRASH, () => {
			DialogueOverlayManager.talk("Vaciando el tacho de residuos...");
			this.decreaseRisk(15);
		});

		// La interacción de mostrador "manual" la dejamos, pero ahora los clientes
		// tendrán sus propias interacciones al llegar a la barra.
		const counterInteraction = new Graphics();
		counterInteraction.beginFill(0xffffff, 0.3);
		counterInteraction.drawCircle(0, 0, 20);
		counterInteraction.x = 400;
		counterInteraction.y = 575;
		this.world.addChild(counterInteraction);

		this.interactManager.add(counterInteraction.x, counterInteraction.y, () => {
			if (this.healthRiskScore > 50) {
				DialogueOverlayManager.talk("Cliente genérico: '¡Esa comida se ve dudosa!'");
			} else {
				DialogueOverlayManager.talk("Cliente genérico: 'Gracias.'");
				this.decreaseRisk(5);
			}
		});
	}

	private createInteractiveStation(x: number, y: number, w: number, h: number, color: number, callback: () => void): void {
		const stationGraphic = this.createWall(x, y, w, h);
		stationGraphic.tint = color;
		const interactX = x + w / 2;
		const interactY = y + h + 20;
		this.interactManager.add(interactX, interactY, callback);
	}

	private createPlayer(): void {
		this.player = new PlayerAvatar(this.equipmentManager, 0xffffff);
		this.player.x = 400;
		this.player.y = 300;
		this.world.addChild(this.player);
	}

	private createUI(): void {
		const uiContainer = new Container();
		uiContainer.position.set(Manager.width / 2 - 200, 20);
		this.addChild(uiContainer);

		const label = new Text("RIESGO SANITARIO", { fill: "white", fontSize: 16, fontWeight: "bold" });
		label.y = -20;
		uiContainer.addChild(label);

		const barBg = new Graphics();
		barBg.beginFill(0x000000);
		barBg.lineStyle(2, 0xffffff);
		barBg.drawRect(0, 0, 400, 30);
		barBg.endFill();
		uiContainer.addChild(barBg);

		this.riskBarFill = new Graphics();
		this.riskBarFill.beginFill(0xe74c3c);
		this.riskBarFill.drawRect(0, 0, 400, 30);
		this.riskBarFill.endFill();
		this.riskBarFill.scale.x = 0;
		uiContainer.addChild(this.riskBarFill);
	}

	private increaseRisk(amount: number): void {
		this.healthRiskScore = Math.min(this.maxRisk, this.healthRiskScore + amount);
		this.updateRiskUI();
		if (this.healthRiskScore >= this.maxRisk) {
			DialogueOverlayManager.talk("¡ALERTA CRÍTICA! Clausura inminente.", { highlight: "red" });
		}
	}

	private decreaseRisk(amount: number): void {
		this.healthRiskScore = Math.max(0, this.healthRiskScore - amount);
		this.updateRiskUI();
	}

	private updateRiskUI(): void {
		const percentage = this.healthRiskScore / this.maxRisk;
		new Tween(this.riskBarFill.scale).to({ x: percentage }, 200).start();
	}

	private spawnRandomDirt(): void {
		const x = Math.random() * 600 + 100;
		const y = Math.random() * 400 + 100;
		const dirt = new Graphics();
		dirt.beginFill(this.C_DIRT_SPILL);
		dirt.drawCircle(0, 0, 15 + Math.random() * 10);
		dirt.drawCircle(10, 5, 10);
		dirt.drawCircle(-5, -10, 12);
		dirt.endFill();
		dirt.x = x;
		dirt.y = y;
		this.world.addChildAt(dirt, 1);

		const interactionId = this.interactManager.add(x, y, () => {
			DialogueOverlayManager.talk("Limpiando derrame...");
			this.decreaseRisk(10);
			this.spawnParticles(x, y, 0xffffff);
			dirt.destroy();
			this.interactManager.remove(interactionId);
			this.activeDirtSpills = this.activeDirtSpills.filter((d) => d !== dirt);
		});
		this.activeDirtSpills.push(dirt);
		this.increaseRisk(5);
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
			this.world.addChild(part);
			const angle = Math.random() * Math.PI * 2;
			const speed = Math.random() * 50 + 20;
			const targetX = x + Math.cos(angle) * speed;
			const targetY = y + Math.sin(angle) * speed;
			new Tween(part)
				.to({ x: targetX, y: targetY, alpha: 0 }, 600)
				.easing(Easing.Quadratic.Out)
				.start()
				.onComplete(() => part.destroy());
			new Tween(part.scale).to({ x: 0.1, y: 0.1 }, 600).start();
		}
	}

	public override update(dt: number): void {
		this.cameraFollow();
		this.interactManager.update(dt, this.player.x, this.player.y);

		// 4. AGREGADO: Importante actualizar los NPCs para que se muevan
		if (this.npcManager) {
			this.npcManager.update(dt, this.player);
		}

		if (DialogueOverlayManager.isOpen) {
			return;
		}

		this.movementController.update(dt);

		// --- Lógica del Bucle de Juego ---

		if (Math.random() < 0.005) {
			this.increaseRisk(0.5);
		}

		// Suciedad
		this.dirtSpawnTimer += dt;
		if (this.dirtSpawnTimer > 5000) {
			this.dirtSpawnTimer = 0;
			if (this.activeDirtSpills.length < 5) {
				this.spawnRandomDirt();
			}
		}

		// 5. AGREGADO: Lógica de Spawn de Clientes
		// Cada 4 segundos intentamos traer un cliente nuevo si hay lugar
		this.customerSpawnTimer += dt;
		if (this.customerSpawnTimer > 4000) {
			this.customerSpawnTimer = 0;
			this.spawnRandomCustomer();
		}
	}

	private cameraFollow(): void {
		const targetX = Manager.width / 2 - this.player.x;
		const targetY = Manager.height / 2 - this.player.y;
		this.world.x += (targetX - this.world.x) * 0.1;
		this.world.y += (targetY - this.world.y) * 0.1;
	}
}
