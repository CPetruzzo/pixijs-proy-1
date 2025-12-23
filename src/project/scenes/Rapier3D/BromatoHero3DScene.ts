import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Light, LightType, LightingEnvironment, Color, StandardMaterial } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl } from "../../../index";
import { Graphics, Text, Container } from "pixi.js";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { OverlayMode } from "../../../engine/dialog/DialogOverlay";
import { Tween } from "tweedle.js";

// --- CONFIGURACIÓN ---
const PLAYER_SPEED = 8;
const PLAYER_SIZE = { h: 1.5, r: 0.4 };
const INTERACTION_DIST = 2.5; // Distancia para interactuar
const SAFE_SPAWN_Y = 2.0; // Altura segura para NPCs y jugador (encima del suelo y de la cápsula)

export class BromatoHero3DScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx"];

	// --- COLORES ---
	private readonly C_WALL = 0x2c3e50;
	private readonly C_FLOOR = 0x955a6; // Gris claro (visiblemente diferente al rojo)
	private readonly C_COOK = 0xc0392b;
	private readonly C_SINK = 0x3498db;
	private readonly C_TRASH = 0x7f8c8d;
	private readonly C_DIRT = 0x2ecc71;

	// --- FÍSICA Y MUNDO 3D ---
	private world: World;
	private playerBody: RigidBody;
	private playerMesh: Mesh3D;

	// --- LÓGICA DE JUEGO ---
	private healthRiskScore: number = 0;
	private maxRisk: number = 100;
	private riskBarFill: Graphics;
	private dirtList: { mesh: Mesh3D; id: string }[] = [];
	private dirtSpawnTimer: number = 0;
	private customerSpawnTimer: number = 0;

	private interactables: { x: number; z: number; label: string; action: () => void }[] = [];

	// Clientes 3D
	private customers: { body: RigidBody; mesh: Mesh3D; state: "walking" | "waiting" | "leaving"; targetIndex: number; timer: number }[] = [];
	private counterSpots = [
		{ x: 300 * 0.05, z: 600 * 0.05, occupied: false },
		{ x: 400 * 0.05, z: 600 * 0.05, occupied: false },
		{ x: 500 * 0.05, z: 600 * 0.05, occupied: false },
	];

	constructor() {
		super();

		// 1. Configurar Luces
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 0.3;
		dirLight.rotationQuaternion.setEulerAngles(45, -45, 0);
		LightingEnvironment.main.lights.push(dirLight);

		// 2. Configuración Cámara FIJA
		cameraControl.distance = 40;
		cameraControl.angles.x = 45;
		cameraControl.angles.y = 0;
		cameraControl.target = { x: 20, y: 0, z: 15 }; // Fijo en el centro del mapa

		// Deshabilitar control con el mouse para dejarla fija
		// (Esto depende de la implementación de 'cameraControl', pero es la forma estándar)
		cameraControl.allowControl = false;

		// 3. Física
		this.world = new World({ x: 0, y: -9.81, z: 0 });

		// 4. Construir Nivel
		this.createLevel();
		this.createPlayer();
		this.createStations();
		this.createUI();
		DialogueOverlayManager.init(this);

		DialogueOverlayManager.talk("Bienvenido a la Cocina 3D. Usa WASD para moverte.");
		DialogueOverlayManager.talk("Acércate a las estaciones y presiona 'E' para interactuar.");
	}

	private createLevel(): void {
		// Suelo (40x30 metros)
		const floor = Mesh3D.createPlane();
		floor.scale.set(40, 1, 30);
		floor.position.set(20, -0.1, 15);
		// IMPORTANTE: Crear un material único para que no se mezclen los colores
		const mat = new StandardMaterial();
		mat.baseColor = new Color(this.C_FLOOR);
		mat.exposure = 1.1; // Un poco más de brillo si se ve oscuro
		this.addChild(floor);

		// Collider Suelo
		const groundDesc = RigidBodyDesc.fixed().setTranslation(20, -0.6, 15);
		const groundCol = ColliderDesc.cuboid(20, 0.5, 15);
		this.world.createCollider(groundCol, this.world.createRigidBody(groundDesc));

		// Paredes (El código es reutilizado y debería funcionar)
		this.createWall(20, 0, 40, 1, this.C_WALL); // Norte
		this.createWall(20, 30, 40, 1, this.C_WALL); // Sur
		this.createWall(40, 15, 1, 30, this.C_WALL); // Este

		// Pared Oeste con puerta (Hueco entre Z=10 y Z=20)
		this.createWall(0, 5, 1, 10, this.C_WALL); // Arriba Oeste
		this.createWall(0, 25, 1, 10, this.C_WALL); // Abajo Oeste
	}

	private createWall(x: number, z: number, w: number, d: number, color: number): void {
		const height = 3;
		const mesh = Mesh3D.createCube();

		// --- CLAVE: Crear un material nuevo para esta pared ---
		const material = new StandardMaterial();
		material.baseColor = new Color(color);
		mesh.material = material;
		// ------------------------------------------------------

		mesh.scale.set(w, height, d);
		mesh.position.set(x, height / 2, z);
		this.addChild(mesh);

		// Física (esto se mantiene igual)
		const rbDesc = RigidBodyDesc.fixed().setTranslation(x, height / 2, z);
		const colDesc = ColliderDesc.cuboid(w / 2, height / 2, d / 2);
		this.world.createCollider(colDesc, this.world.createRigidBody(rbDesc));
	}

	private createStations(): void {
		// Cocina (Roja)
		this.createStationBox(10, 3, 5, 2, this.C_COOK, "Cocina", () => {
			DialogueOverlayManager.talk("Cocinando... Riesgo +5", { mode: OverlayMode.BUBBLE });
			this.increaseRisk(5);
		});

		// Bacha (Azul)
		this.createStationBox(30, 3, 4, 2, this.C_SINK, "Bacha", () => {
			DialogueOverlayManager.talk("Lavando manos... Riesgo -25", { mode: OverlayMode.BUBBLE });
			this.decreaseRisk(25);
		});

		// Basura (Gris)
		this.createStationBox(35, 22, 2, 2, this.C_TRASH, "Basura", () => {
			DialogueOverlayManager.talk("Tirando basura... Riesgo -15", { mode: OverlayMode.BUBBLE });
			this.decreaseRisk(15);
		});

		// Mostrador
		this.createStationBox(20, 28, 30, 1, 0xffffff, "Mostrador", () => {
			DialogueOverlayManager.talk("Mostrador de atención.");
		});
	}

	private createStationBox(x: number, z: number, w: number, d: number, color: number, name: string, callback: () => void): void {
		this.createWall(x, z, w, d, color);
		this.interactables.push({ x, z, label: name, action: callback });
	}

	private createPlayer(): void {
		// Cuerpo
		const rbDesc = RigidBodyDesc.dynamic()
			.setTranslation(20, SAFE_SPAWN_Y, 15) // Spawn seguro en el centro
			.lockRotations()
			.setLinearDamping(2.0);

		this.playerBody = this.world.createRigidBody(rbDesc);
		this.playerBody.setEnabledRotations(false, true, false, true);

		const colDesc = ColliderDesc.capsule(PLAYER_SIZE.h / 2, PLAYER_SIZE.r);
		this.world.createCollider(colDesc, this.playerBody);

		// Visual
		this.playerMesh = Mesh3D.createCube();
		const playerMat = new StandardMaterial();
		playerMat.baseColor = new Color(0xffffff); // El jugador será blanco
		this.playerMesh.material = playerMat;

		this.playerMesh.scale.set(1, 2, 1);
		this.addChild(this.playerMesh);
	}

	private createUI(): void {
		const ui = new Container();
		this.addChild(ui);

		const label = new Text("RIESGO SANITARIO", { fill: "white", fontSize: 24, fontWeight: "bold" });
		label.position.set(20, 20);
		ui.addChild(label);

		const barBg = new Graphics();
		barBg.beginFill(0x000000).drawRect(0, 0, 300, 30).endFill();
		barBg.position.set(20, 50);
		ui.addChild(barBg);

		this.riskBarFill = new Graphics();
		// Este es el rojo que mencionabas, es intencional para la barra de riesgo.
		this.riskBarFill.beginFill(0xe74c3c).drawRect(0, 0, 300, 30).endFill();
		this.riskBarFill.scale.x = 0;
		this.riskBarFill.position.set(20, 50);
		ui.addChild(this.riskBarFill);
	}

	// --- GAME LOOP ---

	public override update(dt: number): void {
		const dtSec = dt / 1000;

		// 1. Movimiento Jugador
		this.handlePlayerInput();

		// 2. Física
		this.world.step();

		// 3. Sync Player
		const t = this.playerBody.translation();
		this.playerMesh.position.set(t.x, t.y, t.z);

		// 4. Lógica de Juego
		this.updateGameplay(dt);
		this.updateCustomers(dtSec);
	}

	private handlePlayerInput(): void {
		let dx = 0;
		let dz = 0;

		// Controles de movimiento
		if (Keyboard.shared.isDown("KeyW")) {
			dz += 1;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			dz -= 1;
		}
		if (Keyboard.shared.isDown("KeyA")) {
			dx += 1;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			dx -= 1;
		}

		// Aplicar velocidad
		const len = Math.sqrt(dx * dx + dz * dz);
		if (len > 0) {
			dx = (dx / len) * PLAYER_SPEED;
			dz = (dz / len) * PLAYER_SPEED;
		}

		const vel = this.playerBody.linvel();
		this.playerBody.setLinvel({ x: dx, y: vel.y, z: dz }, true);

		// Interacción
		if (Keyboard.shared.justPressed("KeyE")) {
			this.tryInteract();
		}
	}

	// ... (tryInteract, updateGameplay, increaseRisk, decreaseRisk, updateRiskUI, spawnDirt son iguales)

	private tryInteract(): void {
		const pPos = this.playerBody.translation();
		let interacted = false;

		// 1. Chequear Estaciones
		for (const st of this.interactables) {
			const dist = Math.sqrt(Math.pow(pPos.x - st.x, 2) + Math.pow(pPos.z - st.z, 2));
			if (dist < INTERACTION_DIST) {
				st.action();
				interacted = true;
				break;
			}
		}

		// 2. Chequear Suciedad
		if (!interacted) {
			for (let i = this.dirtList.length - 1; i >= 0; i--) {
				const dirt = this.dirtList[i];
				const dPos = dirt.mesh.position;
				const dist = Math.sqrt(Math.pow(pPos.x - dPos.x, 2) + Math.pow(pPos.z - dPos.z, 2));

				if (dist < INTERACTION_DIST) {
					DialogueOverlayManager.talk("Limpiando derrame...");
					this.decreaseRisk(10);
					dirt.mesh.destroy();
					this.dirtList.splice(i, 1);
					interacted = true;
					break;
				}
			}
		}

		// 3. Chequear Clientes
		if (!interacted) {
			for (const cust of this.customers) {
				if (cust.state === "waiting") {
					const cPos = cust.body.translation();
					const dist = Math.sqrt(Math.pow(pPos.x - cPos.x, 2) + Math.pow(pPos.z - cPos.z, 2));
					if (dist < INTERACTION_DIST + 1) {
						this.serveCustomer(cust);
						interacted = true;
						break;
					}
				}
			}
		}
	}

	private updateGameplay(dt: number): void {
		if (Math.random() < 0.005) {
			this.increaseRisk(0.5);
		}

		this.dirtSpawnTimer += dt;
		if (this.dirtSpawnTimer > 5000 && this.dirtList.length < 5) {
			this.dirtSpawnTimer = 0;
			this.spawnDirt();
		}

		this.customerSpawnTimer += dt;
		if (this.customerSpawnTimer > 4000 && this.customers.length < 5) {
			this.customerSpawnTimer = 0;
			this.spawnCustomer();
		}
	}

	private spawnDirt(): void {
		const x = Math.random() * 30 + 5;
		const z = Math.random() * 20 + 5;

		const mesh = Mesh3D.createPlane();
		mesh.scale.set(1.5, 1, 1.5);
		mesh.position.set(x, 0.05, z);

		const mat = new StandardMaterial();
		mat.baseColor = new Color(this.C_DIRT);
		mat.exposure = 1.1; // Un poco más de brillo si se ve oscuro

		mesh.material = mat;
		this.addChild(mesh);

		this.dirtList.push({ mesh, id: Math.random().toString() });
		this.increaseRisk(5);
	}

	private increaseRisk(amount: number): void {
		this.healthRiskScore = Math.min(this.maxRisk, this.healthRiskScore + amount);
		this.updateRiskUI();
	}

	private decreaseRisk(amount: number): void {
		this.healthRiskScore = Math.max(0, this.healthRiskScore - amount);
		this.updateRiskUI();
	}

	private updateRiskUI(): void {
		const pct = this.healthRiskScore / this.maxRisk;
		new Tween(this.riskBarFill.scale).to({ x: pct }, 200).start();
	}

	// --- CLIENTES ---

	private spawnCustomer(): void {
		const spotIdx = this.counterSpots.findIndex((s) => !s.occupied);
		if (spotIdx === -1) {
			return;
		}

		this.counterSpots[spotIdx].occupied = true;

		// CORRECCIÓN: Spawn seguro y dentro del mundo (X=1)
		const rbDesc = RigidBodyDesc.dynamic()
			.setTranslation(1, SAFE_SPAWN_Y, 15) // X=1 (puerta) Y=2 (encima del suelo) Z=15 (centro puerta)
			.lockRotations();
		const body = this.world.createRigidBody(rbDesc);
		this.world.createCollider(ColliderDesc.capsule(0.75, 0.4), body);

		const mesh = Mesh3D.createCylinder();
		mesh.scale.set(0.8, 1.5, 0.8);

		const mat = new StandardMaterial();
		mat.baseColor = new Color(this.C_DIRT);
		mat.exposure = 1.1; // Un poco más de brillo si se ve oscuro

		mesh.material = mat;
		this.addChild(mesh);

		this.customers.push({
			body,
			mesh,
			state: "walking",
			targetIndex: spotIdx,
			timer: 0,
		});
	}

	private updateCustomers(dtSec: number): void {
		for (let i = this.customers.length - 1; i >= 0; i--) {
			const cust = this.customers[i];
			const pos = cust.body.translation();

			cust.mesh.position.set(pos.x, pos.y, pos.z);

			if (cust.state === "walking") {
				const target = this.counterSpots[cust.targetIndex];
				const dx = target.x - pos.x;
				const dz = target.z - pos.z;
				const dist = Math.sqrt(dx * dx + dz * dz);

				if (dist < 0.5) {
					cust.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
					cust.state = "waiting";
				} else {
					const speed = 4;
					cust.body.setLinvel({ x: (dx / dist) * speed, y: -9.8, z: (dz / dist) * speed }, true);
				}
			} else if (cust.state === "waiting") {
				cust.timer += dtSec;
				if (cust.timer > 10) {
					DialogueOverlayManager.talk("¡Cliente enojado! (Demasiado tiempo)", { mode: OverlayMode.BUBBLE });
					this.increaseRisk(10);
					this.leaveCustomer(cust);
				}
			} else if (cust.state === "leaving") {
				const dx = -5 - pos.x;
				const dz = 15 - pos.z;
				const dist = Math.sqrt(dx * dx + dz * dz);

				const speed = 4;
				cust.body.setLinvel({ x: (dx / dist) * speed, y: -9.8, z: (dz / dist) * speed }, true);

				if (dist < 1) {
					this.world.removeRigidBody(cust.body);
					cust.mesh.destroy();
					this.customers.splice(i, 1);
				}
			}
		}
	}

	private serveCustomer(cust: any): void {
		DialogueOverlayManager.talk("¡Pedido entregado!", { mode: OverlayMode.BUBBLE });
		this.decreaseRisk(5);
		this.leaveCustomer(cust);
	}

	private leaveCustomer(cust: any): void {
		if (cust.targetIndex !== -1) {
			this.counterSpots[cust.targetIndex].occupied = false;
			cust.targetIndex = -1;
		}
		cust.state = "leaving";
	}
}
