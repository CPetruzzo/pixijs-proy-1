import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Text, Point } from "pixi.js";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../../engine/utils/InteractableManager";
import { Manager } from "../../..";
import { Tween } from "tweedle.js";
import { TopDownMovementController } from "../../../engine/topdownmovement/TopDownMovementController";
import { PlayerAvatar } from "../../../engine/utils/PlayerAvatar";
import { EquipmentManager } from "../../../engine/storagemanager/EquipmentManager";
import { OverlayMode } from "../../../engine/dialog/DialogOverlay";
import { NPCManager } from "../../../engine/npc/NPCManager";

interface Table {
	id: number;
	graphics: Graphics;
	status: "CLEAN" | "OCCUPIED" | "DIRTY";
	capacity: number;
	position: Point;
	orderReady: boolean;
	waitingTime: number;
	dishCount: number; // Cantidad de platos según el grupo
	maxWaitTime: number;
}

export class NewBromatologyScene extends PixiScene {
	public static readonly BUNDLES = ["myfriend", "storagescene", "basquet"];

	private readonly C_WALL = 0x2c3e50;
	private readonly C_STATION_COOK = 0xc0392b;

	private world: Container;
	private player: PlayerAvatar;
	private walls: Graphics[] = [];
	private movementController: TopDownMovementController;
	private interactManager: InteractableManager;
	private npcManager: NPCManager;

	private sanitaryRiskScore: number = 0;
	private readonly MAX_RISK: number = 100;
	private riskBarFill: Graphics;
	private orderBoardContainer: Container;
	private cookingMenu: Container; // Nuevo Menú de Cocina

	private tables: Table[] = [];
	private fridgeTemperature: number = -18;
	private currentCarriedOrder: { tableId: number; dishCount: number } | null = null;
	private gameOver: boolean = false;

	constructor() {
		super();
		DialogueOverlayManager.init(this);
		this.world = new Container();
		this.addChildAt(this.world, 0);

		this.interactManager = new InteractableManager(this.world);
		this.npcManager = new NPCManager(this.world, this.interactManager, this.walls);

		this.createEnvironmentLayout();
		this.createBromatologyStations();
		this.createTables();
		this.createPlayer();

		this.movementController = new TopDownMovementController(this.player as any, this.walls);
		this.createUI();

		DialogueOverlayManager.talk("Inspector: 'El servicio debe ser ordenado. Cocina lo que las mesas piden.'", { mode: OverlayMode.CINEMATIC });
	}

	private createEnvironmentLayout(): void {
		// Pisos (Storage, Kitchen, Dining)
		// Depósito (0 a 300)
		this.world.addChild(new Graphics().beginFill(0x7f8c8d).drawRect(0, 0, 300, 600).endFill());

		// COCINA: Cambiamos el ancho de 600 a 900 para que llegue a 1200 (300 + 900 = 1200)
		this.world.addChild(new Graphics().beginFill(0x95a5a6).drawRect(300, 0, 900, 600).endFill());

		// Comedor (Ya está bien, cubre los 1200)
		this.world.addChild(new Graphics().beginFill(0xd35400).drawRect(0, 600, 1200, 200).endFill());
		this.createWall(0, 0, 1200, 40);
		this.createWall(0, 760, 1200, 40);
		this.createWall(280, 0, 40, 250);
		this.createWall(300, 580, 250, 40);
	}

	private createBromatologyStations(): void {
		// Bacha
		this.createInteractiveStation(800, 50, 80, 60, 0x3498db, "Lavado de Manos", () => {
			this.modifyRisk(-15);
			DialogueOverlayManager.talk("Manos desinfectadas.", { mode: OverlayMode.CINEMATIC });
		});

		// Heladera
		this.createInteractiveStation(50, 50, 100, 150, 0xadd8e6, "Cámara Frío", () => {
			this.fridgeTemperature = -18;
			DialogueOverlayManager.talk("Temperatura reseteada.", { mode: OverlayMode.CINEMATIC });
		});

		// Cocina (Ahora abre menú)
		this.createInteractiveStation(400, 50, 150, 60, this.C_STATION_COOK, "COCINA: Ver Pedidos", () => {
			this.toggleCookingMenu(true);
		});
	}

	private createTables(): void {
		const pos = [
			{ x: 200, y: 650, c: 2 },
			{ x: 600, y: 650, c: 4 },
			{ x: 1000, y: 650, c: 2 },
		];
		pos.forEach((p, i) => {
			const g = new Graphics().beginFill(0x27ae60).drawRect(-40, -40, 80, 80).endFill();
			g.position.set(p.x, p.y);
			this.world.addChild(g);

			const table: Table = {
				id: i + 1,
				graphics: g,
				status: "CLEAN",
				capacity: p.c,
				position: new Point(p.x, p.y),
				orderReady: false,
				waitingTime: 0,
				dishCount: 0,
				maxWaitTime: 60, // Más tiempo para ser lento
			};
			this.tables.push(table);
			this.interactManager.add(p.x, p.y, () => this.handleTableInteraction(table));
		});
	}

	private handleTableInteraction(table: Table): void {
		// CASO A: Entregar comida
		if (table.status === "OCCUPIED" && this.currentCarriedOrder?.tableId === table.id) {
			DialogueOverlayManager.talk(`¡Buen provecho! Mesa ${table.id} servida.`, { mode: OverlayMode.CINEMATIC });

			// Limpiamos los platos del jugador
			this.currentCarriedOrder = null;
			this.player.bodyShape.tint = 0xffffff;

			// --- ELIMINAR INTERACTABLES DE LOS PARTICIPANTES ---
			// Esto quita todos los iconos "E" de los NPCs sentados aquí
			this.npcManager.resolveNPCsAt(table.position.x, table.position.y, 120);

			table.orderReady = true; // Marca que ya tienen la comida
			this.startEatingCycle(table);
		}
		// CASO B: Limpiar mesa (Solo si está sucia)
		else if (table.status === "DIRTY") {
			DialogueOverlayManager.talk("Limpiando mesa y restos de comida...", { mode: OverlayMode.CINEMATIC });
			table.status = "CLEAN";
			table.graphics.tint = 0xffffff; // Vuelve a color original
			this.modifyRisk(-5);
		}
		// NOTA: Si table.status === "OCCUPIED" pero table.orderReady === true,
		// no entra en ningún if, lo que significa que no hay interacción mientras comen.
	}

	private startEatingCycle(table: Table): void {
		// Cambiamos el color para indicar que están comiendo
		table.graphics.tint = 0xf1c40f;

		// Los clientes se quedan 15 segundos (puedes ajustar este tiempo)
		setTimeout(() => {
			// Una vez terminan, se retiran (el NPCManager los maneja) y la mesa queda sucia
			table.status = "DIRTY";
			table.graphics.tint = 0x7f8c8d; // Gris suciedad
			table.orderReady = false;
			table.waitingTime = 0;
			table.dishCount = 0;

			DialogueOverlayManager.talk(`Mesa ${table.id} ha quedado libre. ¡Necesita limpieza!`, { mode: OverlayMode.CINEMATIC });
		}, 15000);
	}

	private createUI(): void {
		// UI Riesgo
		const ui = new Container();
		ui.position.set(Manager.width / 2 - 200, 20);
		this.addChild(ui);
		this.riskBarFill = new Graphics().beginFill(0xe74c3c).drawRect(0, 0, 400, 25).endFill();
		this.riskBarFill.scale.x = 0;
		ui.addChild(new Graphics().beginFill(0x000000, 0.5).drawRect(0, 0, 400, 25).endFill());
		ui.addChild(this.riskBarFill);

		// Order Board
		this.orderBoardContainer = new Container();
		this.orderBoardContainer.position.set(20, 100);
		this.addChild(this.orderBoardContainer);

		// Menú de Cocina (Inicialmente oculto)
		this.cookingMenu = new Container();
		this.cookingMenu.visible = false;
		this.addChild(this.cookingMenu);
	}

	private toggleCookingMenu(show: boolean): void {
		this.cookingMenu.visible = show;
		if (!show) {
			return;
		}

		this.cookingMenu.removeChildren();
		const bg = new Graphics()
			.beginFill(0x000000, 0.9)
			.drawRect(Manager.width / 4, Manager.height / 4, Manager.width / 2, Manager.height / 2)
			.endFill();
		this.cookingMenu.addChild(bg);

		const title = new Text("--- COMANDAS VIGENTES ---", { fill: "white", fontSize: 24 });
		title.position.set(Manager.width / 2 - 150, Manager.height / 4 + 20);
		this.cookingMenu.addChild(title);

		let offset = 80;
		this.tables.forEach((t) => {
			if (t.status === "OCCUPIED" && !t.orderReady) {
				const btn = new Container();
				btn.interactive = true;
				btn.cursor = "pointer";
				const btnBg = new Graphics()
					.beginFill(0x333333)
					.drawRect(Manager.width / 4 + 50, Manager.height / 4 + offset, 400, 40)
					.endFill();
				const btnTxt = new Text(`Mesa ${t.id} | Platos: ${t.dishCount} | Espera: ${Math.floor(t.waitingTime)}s`, { fill: "white", fontSize: 18 });
				btnTxt.position.set(Manager.width / 4 + 60, Manager.height / 4 + offset + 5);

				btn.addChild(btnBg, btnTxt);
				btn.on("pointerdown", () => {
					this.currentCarriedOrder = { tableId: t.id, dishCount: t.dishCount };
					this.player.bodyShape.tint = 0xffff00; // Visual de carga
					this.toggleCookingMenu(false);
					DialogueOverlayManager.talk(`Cocinando ${t.dishCount} platos para Mesa ${t.id}...`, { mode: OverlayMode.CINEMATIC });
				});
				this.cookingMenu.addChild(btn);
				offset += 50;
			}
		});

		// Botón Cerrar
		const close = new Text("[X] CERRAR", { fill: "red", fontSize: 20 });
		close.position.set(Manager.width / 2 + 150, Manager.height / 4 + 20);
		close.interactive = true;
		close.cursor = "pointer";
		close.on("pointerdown", () => this.toggleCookingMenu(false));
		this.cookingMenu.addChild(close);
	}

	private spawnCustomerGroup(): void {
		const groupSize = [1, 2, 4][Math.floor(Math.random() * 3)];
		const table = this.tables.find((t) => t.status === "CLEAN" && t.capacity >= groupSize);
		if (!table) {
			return;
		}

		table.status = "OCCUPIED";
		table.dishCount = groupSize; // Se asigna la cantidad de platos
		table.graphics.tint = 0xffaa00;
		for (let i = 0; i < groupSize; i++) {
			this.npcManager.spawnCustomer(
				-50,
				700,
				table.position.x + i * 20,
				table.position.y,
				-50,
				700,
				40000,
				// eslint-disable-next-line prettier/prettier
				() => { },
				() => this.modifyRisk(10)
			);
		}
	}

	private modifyRisk(amt: number): void {
		this.sanitaryRiskScore = Math.max(0, Math.min(this.MAX_RISK, this.sanitaryRiskScore + amt));
		new Tween(this.riskBarFill.scale).to({ x: this.sanitaryRiskScore / this.MAX_RISK }, 200).start();
		if (this.sanitaryRiskScore >= this.MAX_RISK) {
			this.gameOver = true;
		}
	}

	private createInteractiveStation(x: number, y: number, w: number, h: number, col: number, label: string, cb: () => void): void {
		const s = this.createWall(x, y, w, h);
		s.tint = col;
		const txt = new Text(label, { fill: "white", fontSize: 12 });
		txt.position.set(x, y - 20);
		this.world.addChild(txt);
		this.interactManager.add(x + w / 2, y + h + 20, cb);
	}

	private createWall(x: number, y: number, w: number, h: number): Graphics {
		const wall = new Graphics().beginFill(this.C_WALL).drawRect(0, 0, w, h).endFill();
		wall.position.set(x, y);
		(wall as any).widthRect = w;
		(wall as any).heightRect = h;
		this.world.addChild(wall);
		this.walls.push(wall);
		return wall;
	}

	private createPlayer(): void {
		this.player = new PlayerAvatar(new EquipmentManager(), 0xffffff);
		this.player.x = 600;
		this.player.y = 350;
		this.world.addChild(this.player);
	}

	public override update(dt: number): void {
		if (this.gameOver || DialogueOverlayManager.isOpen) {
			return;
		}

		this.movementController.update(dt);
		this.npcManager.update(dt, this.player);
		this.interactManager.update(dt, this.player.x, this.player.y);

		this.fridgeTemperature += 0.0005 * dt; // Mucho más lento
		if (this.fridgeTemperature > 5) {
			this.modifyRisk(0.005);
		}

		this.tables.forEach((t) => {
			if (t.status === "OCCUPIED" && !t.orderReady) {
				t.waitingTime += dt / 1000;
				if (t.waitingTime > t.maxWaitTime) {
					this.modifyRisk(0.02);
				}
			}
			if (t.status === "DIRTY") {
				this.modifyRisk(0.01);
			}
		});

		if (Math.random() < 0.0005) {
			this.spawnCustomerGroup();
		} // Mucho más lento

		// Cámara Follow
		const targetX = Manager.width / 2 - this.player.x;
		const targetY = Manager.height / 2 - this.player.y;
		this.world.x += (targetX - this.world.x) * 0.1;
		this.world.y += (targetY - this.world.y) * 0.1;
	}
}
