/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { SoundLib } from "./../../../engine/sound/SoundLib";
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Color, StandardMaterial, Light, LightType, LightingEnvironment, Container3D, StandardMaterialAlphaMode, Model } from "pixi3d/pixi7";
import { Container, Text, TextStyle, Graphics, Point, Rectangle, Texture, Assets } from "pixi.js";
import { cameraControl, mousePosition } from "../../..";
import { Easing, Group, Tween } from "tweedle.js";

enum TileType {
	EMPTY = -1,
	WALL = 0,
	FLOOR = 1,
	HEART = 2,
	GOLD_WALL = 3,
	LIBRARY = 4,
	TRAINING = 5,
	TORTURE = 6,
	REST = 7,
	PORTAL = 8, // Nuevo
	FOOD = 9, // Nueva sala: Criadero / Comedor
}

interface PortalData {
	x: number;
	z: number;
	isDiscovered: boolean;
}

const COLORS = {
	EARTH: new Color(0.17, 0.12, 0.08),
	GOLD_VEIN: new Color(1, 0.84, 0),
	FLOOR: new Color(0.1, 0.1, 0.1),
	HEART: new Color(0.66, 0, 0),
	LIBRARY: new Color(0.13, 0.26, 0.66),
	TRAINING: new Color(0.66, 0.26, 0.13),
	TORTURE: new Color(0.4, 0, 0.4),
	REST: new Color(0.9, 0.2, 0),
	PORTAL: new Color(0.1, 0.4, 1.0), // Azul brillante para el portal
	FOOD: new Color(0.8, 0.8, 0.2), // Amarillo para comida
	MARKED: new Color(1, 0.66, 0),
};

const MINING_SPEED = 0.1;
const GOLD_AWARD = 10000;
const WALL_AWARD = 10000;

// 1. Agrega este objeto de configuración fuera o dentro de la clase
const ROOM_CONFIG: Record<number, { cost: number; label: string; color: number }> = {
	[TileType.LIBRARY]: { cost: 250, label: "BIBLIO", color: 0x2244aa },
	[TileType.TRAINING]: { cost: 100, label: "ENTRENAR", color: 0xaa4422 },
	// Aquí puedes agregar más salas fácilmente:
	[TileType.TORTURE]: { cost: 350, label: "TORTURA", color: 0x660066 },
	[TileType.REST]: { cost: 50, label: "DESCANSO", color: 0x922044 },
	// [TileType.TORTURE]: { cost: 150, label: "TORTURA", color: 0x660066 },
	[TileType.FOOD]: { cost: 50, label: "COMIDA", color: 0xaaaa22 }, // Añadida FOOD
};

interface Minion {
	gx: number;
	gz: number;
	visual: Container3D;
	targetX: number;
	targetZ: number;
	targetWallX?: number;
	targetWallZ?: number;
	path: { x: number; z: number }[];
	// Añadimos el estado "IN_ROOM" para cuando están realizando la acción
	state: "IDLE" | "MOVING_TO_WORK" | "MINING" | "IN_ROOM";
	type: "WARRIOR" | "MAGE" | "WORKER";
	level: number;
	roomTimer?: number; // Para saber cuánto tiempo llevan en la sala
}

export class DungeonScene3D extends PixiScene {
	private readonly GRID_SIZE = 40;
	private readonly TILE_SIZE = 2;
	private readonly FOG_RADIUS = 3;
	private readonly FOG_DIM_FACTOR = 0.1;

	private grid: TileType[][] = [];
	private markedTiles: boolean[][] = [];
	private visibility: boolean[][] = [];
	private wallHealth: number[][] = [];
	private meshes: (Mesh3D | null)[][] = [];
	private floorMeshes: (Mesh3D | null)[][] = [];
	// Cerca de floorMeshes
	private propMeshes: (Mesh3D | null)[][] = [];

	private worldContainer: Container3D;
	private uiLayer: Container;
	private minions: Minion[] = [];
	private gold = 0;
	private uiText: Text;
	// ... dentro de la clase DungeonScene3D ...

	// Actualiza el tipo de selectedTool
	// En la parte superior, actualiza el tipo selectedTool
	private selectedTool: TileType | "MINE" | "SELL" | "GRAB" | "VIEW_INFO" | "POSSESS" = "MINE";

	// Nuevas propiedades privadas en la clase DungeonScene3D
	private possessedMinion: Minion | null = null;
	private keys: Record<string, boolean> = {};
	private savedCameraState = { distance: 0, angles: { x: 0, y: 0 }, target: { x: 0, y: 0, z: 0 } };
	private selectionVisual: Mesh3D;
	private grabbedMinion: Minion | null = null;
	private unitBarContainer: Container; // Nuevo contenedor para las caras de los monstruos	private selectionVisual: Mesh3D;
	private isDragging = false;
	private lastMousePos = new Point();
	private isSelecting = false;
	private selectionStart: { gx: number; gz: number } | null = null;
	private selectionAreaVisual: Mesh3D;
	private isDeselectingMode = false;
	public static readonly BUNDLES = ["dk"];

	private minimapContainer: Container;
	private minimapGraphics: Graphics;
	private minimapSize = 150;

	private dragVelocity = { x: 0, z: 0 };
	private readonly FRICTION = 0.97;
	private costPreviewText: Text;

	private appearingMeshes: { mesh: Mesh3D; targetY: number }[] = [];
	private constructionQueue: { x: number; z: number; type: TileType }[] = [];
	private constructionTimer = 0;
	private readonly CONSTRUCTION_DELAY = 8;

	// Lista para manejar las partículas de humo/desvanecimiento
	private smokeEffects: { mesh: Mesh3D; alpha: number }[] = [];
	private immigrationTimer = 0;
	private readonly IMMIGRATION_COOLDOWN = 3600;
	private portalPos: { x: number; z: number } | null = null;
	private debugText: Text;
	private portalLight: Light; // Luz para el efecto visual
	private portals: PortalData[] = [];
	// ... dentro de las propiedades de la clase ...
	private isDiscoverySequencePlaying = false;

	private heartLight: Light; // Luz para el efecto visual del corazón
	// En la sección de propiedades privadas
	private debrisParticles: { mesh: Mesh3D; velocity: { x: number; y: number; z: number }; life: number }[] = [];
	private frameThrottle = 0;
	private rotationTimer = 0;

	// --- FLAGS DE DEPUREACIÓN ---
	private readonly DEBUG_TILE_SETTINGS = true; // Cambia a false para ocultar todo el sistema
	private debugInfoPanel: Container;
	private debugInfoText: Text;
	private readonly MOUSE_SENSITIVITY = 0.15;
	private readonly LOOK_LIMIT = 0; // Límite para no poder mirar "atrás" por arriba o abajo
	constructor() {
		super();
		this.worldContainer = this.addChild(new Container3D());
		this.uiLayer = this.addChild(new Container());

		// En el constructor, después de worldContainer y antes de setupEvents:
		this.selectionVisual = Mesh3D.createCube();
		const selMat = new StandardMaterial();
		selMat.baseColor = new Color(0, 1, 0, 0.5); // Verde con 50% de transparencia
		this.selectionVisual.material = selMat;
		// Escalamos un poco menos (0.95) para que no choque visualmente con los bordes de los cubos
		this.selectionVisual.scale.set((this.TILE_SIZE / 2) * 1.05);
		this.selectionVisual.position.y = this.TILE_SIZE / 2; // Altura superior + pequeño margen
		this.selectionVisual.visible = false;
		this.worldContainer.addChild(this.selectionVisual);

		// En el constructor:
		this.selectionAreaVisual = Mesh3D.createPlane();
		const areaMat = new StandardMaterial();
		areaMat.baseColor = new Color(0, 0.5, 1, 0.3); // Azul muy tenue (alpha 0.3)
		this.selectionAreaVisual.material = areaMat;
		this.selectionAreaVisual.position.y = this.TILE_SIZE + 0.06; // Ligeramente arriba del cursor verde
		this.selectionAreaVisual.visible = false;
		this.worldContainer.addChild(this.selectionAreaVisual);

		this.setupLighting();
		this.initGrid();
		this.spawnMinions(4);
		this.createUI();
		this.createMinimap(); // Nueva llamada
		this.setupCamera();
		this.setupEvents();

		// En el constructor, al final:
		this.hitArea = new Rectangle(0, 0, 2000, 2000); // Usa un tamaño que cubra tu canvas
	}

	private setupLighting() {
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 2;
		dirLight.rotationQuaternion.setEulerAngles(45, 45, 0);
		LightingEnvironment.main.lights.push(dirLight);

		const ambLight = new Light();
		ambLight.type = LightType.directional; // Corregido de directional a ambient
		ambLight.intensity = 0.5;
		LightingEnvironment.main.lights.push(ambLight);
	}

	private spawnDebris(gx: number, gz: number) {
		return;
		const count = 5 + Math.floor(Math.random() * 5);
		const posX = gx * this.TILE_SIZE;
		const posZ = gz * this.TILE_SIZE;

		for (let i = 0; i < count; i++) {
			const p = Mesh3D.createCube();

			// Partículas muy pequeñas para que parezcan piedritas
			const s = 0.03 + Math.random() * 0.04;
			p.scale.set(s);

			// REDUCCIÓN DE ANCHO: Cambiamos 1.8 por 0.8 para que no se salgan de la pared
			p.position.set(
				posX + (Math.random() - 0.5) * 0.8,
				this.TILE_SIZE - 0.1, // Salen desde la parte alta de la pared
				posZ + (Math.random() - 0.5) * 0.8
			);

			const mat = new StandardMaterial();
			mat.baseColor = COLORS.EARTH;
			mat.alphaMode = StandardMaterialAlphaMode.blend;
			p.material = mat;

			this.worldContainer.addChild(p);

			this.debrisParticles.push({
				mesh: p as any,
				velocity: {
					// Velocidad horizontal muy baja para que caigan casi recto
					x: (Math.random() - 0.5) * 0.05,
					y: 0.02 + Math.random() * 0.03,
					z: (Math.random() - 0.5) * 0.05,
				},
				life: 1.5, // Duración moderada
			});
		}
	}

	private processDebris(dt: number) {
		// Gravedad más sutil para que no parezcan plomo
		const gravity = 0.004 * dt;

		for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
			const p = this.debrisParticles[i];

			// Aplicar movimiento
			p.velocity.y -= gravity;
			p.mesh.position.x += p.velocity.x * dt;
			p.mesh.position.y += p.velocity.y * dt;
			p.mesh.position.z += p.velocity.z * dt;

			// Rotación constante durante la caída
			p.mesh.rotationQuaternion.setEulerAngles(p.mesh.rotationQuaternion.x + 2, p.mesh.rotationQuaternion.y + 2, 0);

			// DESVANECIMIENTO MÁS LENTO: Bajamos de 0.02 a 0.005
			p.life -= 0.005 * dt;
			const mat = p.mesh.material as StandardMaterial;
			if (mat) {
				// Pixi3D Color usa r, g, b, a
				mat.baseColor = new Color(mat.baseColor.r, mat.baseColor.g, mat.baseColor.b, Math.max(0, p.life));
			}

			// Eliminación: Ahora duran hasta que el alpha es 0 o caen demasiado
			if (p.life <= 0 || p.mesh.position.y < -0.5) {
				p.mesh.removeFromParent();
				this.debrisParticles.splice(i, 1);
			}
		}
	}

	private setupCamera() {
		cameraControl.allowControl = false;
		cameraControl.angles.x = 60; // Inclinación vertical
		cameraControl.angles.y = 45; // ROTACIÓN: Volvemos a 45 grados
		cameraControl.distance = 50;

		const center = (this.GRID_SIZE * this.TILE_SIZE) / 2;
		cameraControl.target = { x: center, y: 0, z: center };
	}

	private initGrid() {
		// En el constructor o al inicio de initGrid(), inicializa la matriz
		for (let x = 0; x < this.GRID_SIZE; x++) {
			this.propMeshes[x] = new Array(this.GRID_SIZE).fill(null);
		}
		// 1. Generación inicial de paredes y oro
		for (let x = 0; x < this.GRID_SIZE; x++) {
			this.grid[x] = [];
			this.markedTiles[x] = [];
			this.visibility[x] = [];
			this.wallHealth[x] = [];
			this.meshes[x] = [];
			this.floorMeshes[x] = [];

			for (let z = 0; z < this.GRID_SIZE; z++) {
				this.markedTiles[x][z] = false;
				this.visibility[x][z] = false;

				if (Math.random() < 0.09) {
					this.grid[x][z] = TileType.GOLD_WALL;
					this.wallHealth[x][z] = 500;
				} else {
					this.grid[x][z] = TileType.WALL;
					this.wallHealth[x][z] = 100;
				}
			}
		}

		// 2. Crear el Corazón de la Mazmorra
		const c = Math.floor(this.GRID_SIZE / 2);
		this.grid[c][c] = TileType.HEART;
		for (let x = c - 2; x <= c + 2; x++) {
			for (let z = c - 2; z <= c + 2; z++) {
				if (this.grid[x][z] !== TileType.HEART) {
					this.grid[x][z] = TileType.FLOOR;
				}
			}
		}

		// 3. TERCERO: Ahora que todo el grid tiene datos, creamos los meshes visuales
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				this.updateTileMesh(x, z);
			}
		}
		this.revealArea(c, c);

		// 3. Limpiar el área inicial (5x5) alrededor del corazón
		for (let x = c - 2; x <= c + 2; x++) {
			for (let z = c - 2; z <= c + 2; z++) {
				if (this.grid[x][z] !== TileType.HEART) {
					this.grid[x][z] = TileType.FLOOR;
				}
				this.updateTileMesh(x, z);
			}
		}
		this.heartLight = new Light();
		this.heartLight.type = LightType.point;
		this.heartLight.intensity = 5;
		this.heartLight.range = 10;
		this.heartLight.color = COLORS.HEART; // Color rojo ladrillo definido en COLORS
		this.heartLight.position.set(c * this.TILE_SIZE, 3, c * this.TILE_SIZE);
		LightingEnvironment.main.lights.push(this.heartLight);

		// --- LÓGICA DEL PORTAL ÚNICO (FUERA DE LOS BUCLES ANTERIORES) ---
		let portalX: number = 0;
		let portalZ: number = 0;
		let attempts = 0;
		let foundPosition = false;

		while (!foundPosition && attempts < 100) {
			// Distancia entre 6 y 10 para asegurar que el área 3x3 del portal
			// no toque el área 5x5 del corazón (manteniéndolo desconectado)
			const angle = Math.random() * Math.PI * 2;
			const dist = 7 + Math.random() * 3;

			portalX = Math.floor(c + Math.cos(angle) * dist);
			portalZ = Math.floor(c + Math.sin(angle) * dist);

			// Validar que el portal y su área 3x3 estén dentro del mapa
			if (portalX >= 2 && portalX < this.GRID_SIZE - 2 && portalZ >= 2 && portalZ < this.GRID_SIZE - 2) {
				foundPosition = true;
			}
			attempts++;
		}

		// Crear el Portal y su anillo de seguridad (3x3 total)
		for (let x = portalX - 1; x <= portalX + 1; x++) {
			for (let z = portalZ - 1; z <= portalZ + 1; z++) {
				if (x === portalX && z === portalZ) {
					this.grid[x][z] = TileType.PORTAL; // El centro es el portal
				} else {
					this.grid[x][z] = TileType.FLOOR; // El anillo es suelo libre
				}
				this.updateTileMesh(x, z);
			}
		}

		this.portalPos = { x: portalX, z: portalZ };
		// Añadimos una luz puntual azul sobre el portal
		this.portals = []; // Limpiamos lista
		this.portals.push({ x: portalX, z: portalZ, isDiscovered: false });

		// Crear el Portal y su anillo de seguridad (3x3 total)
		for (let x = portalX - 1; x <= portalX + 1; x++) {
			for (let z = portalZ - 1; z <= portalZ + 1; z++) {
				if (x === portalX && z === portalZ) {
					this.grid[x][z] = TileType.PORTAL;
				} else {
					this.grid[x][z] = TileType.FLOOR;
				}
				this.updateTileMesh(x, z);
			}
		}

		// Luz del portal (la dejamos, pero podrías bajarle la intensidad si no está descubierto)
		this.portalLight = new Light();
		this.portalLight.type = LightType.point;
		this.portalLight.intensity = 5;
		this.portalLight.range = 10;
		this.portalLight.color = new Color(0.1, 0.5, 1.0);
		this.portalLight.position.set(portalX * this.TILE_SIZE, 3, portalZ * this.TILE_SIZE);
		LightingEnvironment.main.lights.push(this.portalLight);
	}

	private getDungeonStats() {
		const stats = { beds: 0, food: 0, library: 0, training: 0, warriors: 0, mages: 0, workers: 0 };
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				const t = this.grid[x][z];
				if (t === TileType.REST) {
					stats.beds++;
				}
				if (t === TileType.FOOD) {
					stats.food++;
				}
				if (t === TileType.LIBRARY) {
					stats.library++;
				}
				if (t === TileType.TRAINING) {
					stats.training++;
				}
			}
		}
		this.minions.forEach((m) => {
			if (m.type === "WARRIOR") {
				stats.warriors++;
			} else if (m.type === "MAGE") {
				stats.mages++;
			} else if (m.type === "WORKER") {
				stats.workers++;
			}
		});
		return stats;
	}

	private createPropMesh(x: number, z: number, type: TileType) {
		this.removePropMesh(x, z);

		let prop: any;

		switch (type) {
			case TileType.TRAINING:
				// Aumentado de 0.02 a 1.2 para que el totem sea visible
				prop = Model.from(Assets.get("boxdkfight"));
				prop.scale.set(2);
				break;
			case TileType.LIBRARY:
				// Aumentado de 0.8 a 2.5 para llenar el tile
				prop = Model.from(Assets.get("shelf"));
				prop.scale.set(2.5);
				break;
			case TileType.FOOD:
				// Aumentado de 1.2 a 3.0 para que el gallinero destaque
				prop = Model.from(Assets.get("gallinero"));
				prop.scale.set(4.0);
				break;
			default:
				return;
		}

		// Posicionamiento
		prop.position.set(x * this.TILE_SIZE, 0, z * this.TILE_SIZE);
		prop.rotationQuaternion.setEulerAngles(0, Math.random() * 360, 0);

		this.worldContainer.addChild(prop);
		this.propMeshes[x][z] = prop;
	}
	private removePropMesh(x: number, z: number) {
		if (this.propMeshes[x][z]) {
			this.propMeshes[x][z]?.removeFromParent();
			this.propMeshes[x][z] = null;
		}
	}

	private updateRoomProps(startX: number, startZ: number) {
		const type = this.grid[startX][startZ];
		const propsAllowed = [TileType.TRAINING, TileType.LIBRARY, TileType.FOOD, TileType.TORTURE];

		// 1. Limpieza inmediata si no es sala válida
		if (!propsAllowed.includes(type)) {
			if (this.propMeshes[startX][startZ]) {
				this.propMeshes[startX][startZ]?.removeFromParent();
				this.propMeshes[startX][startZ] = null;
			}
			return;
		}

		// 2. Buscamos los límites de la sala (BBox)
		let minX = startX,
			maxX = startX,
			minZ = startZ,
			maxZ = startZ;
		while (minX > 0 && this.grid[minX - 1][startZ] === type) {
			minX--;
		}
		while (maxX < this.GRID_SIZE - 1 && this.grid[maxX + 1][startZ] === type) {
			maxX++;
		}
		while (minZ > 0 && this.grid[startX][minZ - 1] === type) {
			minZ--;
		}
		while (maxZ < this.GRID_SIZE - 1 && this.grid[startX][maxZ + 1] === type) {
			maxZ++;
		}

		const width = maxX - minX + 1;
		const height = maxZ - minZ + 1;

		// 3. Iteramos sobre TODA la sala para re-calcular el patrón
		for (let x = minX; x <= maxX; x++) {
			for (let z = minZ; z <= maxZ; z++) {
				const lx = x - minX;
				const lz = z - minZ;

				// EL TWEAK: Patrón "hueco, totem, hueco"
				// Indices impares (1, 3, 5) y que no toquen el borde final (< length - 1)
				const shouldHaveProp = lx % 2 === 1 && lz % 2 === 1 && lx < width - 1 && lz < height - 1;

				if (shouldHaveProp) {
					if (!this.propMeshes[x][z]) {
						this.createPropMesh(x, z, type);
					}
				} else {
					if (this.propMeshes[x][z]) {
						this.propMeshes[x][z]?.removeFromParent();
						this.propMeshes[x][z] = null;
					}
				}
			}
		}
	}

	private tryImmigration() {
		const stats = this.getDungeonStats();

		// Filtrar portales que ya fueron descubiertos
		const discoveredPortals = this.portals.filter((p) => p.isDiscovered);

		// REQUISITOS:
		// 1. Tener portales descubiertos
		// 2. Tener al menos 6 de comida.
		// 3. Tener más camas que minions totales.
		if (discoveredPortals.length === 0 || stats.food < 6 || this.minions.length >= stats.beds) {
			return;
		}

		// Elegimos un portal descubierto al azar para el spawn
		const targetPortal = discoveredPortals[Math.floor(Math.random() * discoveredPortals.length)];

		let newType: "WARRIOR" | "MAGE" = stats.library > stats.training ? "MAGE" : "WARRIOR";

		this.spawnSingleMinionAt(newType, targetPortal.x, targetPortal.z);
	}

	private spawnSingleMinionAt(type: "WARRIOR" | "MAGE", px: number, pz: number) {
		if (!this.portalPos) {
			return;
		}

		const visual = new Container3D();
		const body = Mesh3D.createSphere();
		body.scale.set(0.6);
		body.position.y = 1.2;

		const mat = new StandardMaterial();
		// Color según clase: Azul para magos, Rojo para guerreros
		mat.baseColor = type === "MAGE" ? new Color(0.2, 0.5, 1) : new Color(1, 0.2, 0.2);
		body.material = mat;

		visual.addChild(body);
		this.worldContainer.addChild(visual);

		this.minions.push({
			gx: px,
			gz: pz,
			visual,
			targetX: px,
			targetZ: pz,
			state: "IDLE",
			path: [],
			type: type,
			level: 1,
		});
	}

	private updateTileMesh(x: number, z: number, _animate = false) {
		const type = this.grid[x][z];
		if (this.meshes[x][z]) {
			this.meshes[x][z]?.removeFromParent();
		}
		if (this.floorMeshes[x][z]) {
			this.floorMeshes[x][z]?.removeFromParent();
		}

		const posX = x * this.TILE_SIZE;
		const posZ = z * this.TILE_SIZE;

		// --- 1. LÓGICA DE SUELOS (Sin cambios) ---
		if (type !== TileType.WALL && type !== TileType.GOLD_WALL && type !== TileType.EMPTY) {
			const floor = Mesh3D.createPlane();
			floor.scale.set(this.TILE_SIZE / 2);
			const mat = new StandardMaterial();
			if (type === TileType.TRAINING) {
				mat.baseColorTexture = Texture.from("training");
			} else if (type === TileType.REST) {
				mat.baseColorTexture = Texture.from("room");
			} else if (type === TileType.FOOD) {
				mat.baseColorTexture = Texture.from("food");
			} else if (type === TileType.LIBRARY) {
				mat.baseColorTexture = Texture.from("library");
			} else {
				mat.baseColorTexture = Texture.from("heart");
			}
			floor.material = mat;
			this.worldContainer.addChild(floor);
			floor.position.set(posX, 0, posZ);
			this.floorMeshes[x][z] = floor as any;
		}

		// --- 2. LÓGICA DE PAREDES ---

		if (type === TileType.WALL || type === TileType.GOLD_WALL || type === TileType.HEART || type === TileType.PORTAL) {
			const wallGroup = new Container3D();
			this.worldContainer.addChild(wallGroup);
			this.meshes[x][z] = wallGroup as any;

			// --- CASO ESPECIAL: MODELOS 3D ÚNICOS ---
			// --- DENTRO DE LÓGICA DE PAREDES EN updateTileMesh ---
			if (type === TileType.HEART || type === TileType.PORTAL) {
				const wallGroup = new Container3D();
				this.worldContainer.addChild(wallGroup);
				this.meshes[x][z] = wallGroup as any;

				if (type === TileType.HEART) {
					// 1. LA BASE (Color neutral)
					const base = Model.from(Assets.get("heartbase"));
					base.scale.set((this.TILE_SIZE / 2) * 8.0);
					// Forzamos a que la base sea gris/blanca neutral
					base.meshes.forEach((m) => ((m.material as StandardMaterial).baseColor = new Color(0.8, 0.8, 0.8)));
					wallGroup.addChild(base);

					// 2. EL PORTAL ROJO (Encima de la base)
					const heartPortal = Model.from(Assets.get("portal"));
					heartPortal.scale.set((this.TILE_SIZE / 2) * 2.0); // Mismo tamaño que el portal azul
					heartPortal.position.y = 1.5; // Lo elevamos para que no se entierre en la base
					heartPortal.name = "rotating_part"; // Nombre clave para la animación de giro

					// Teñimos las mallas del portal de rojo intenso
					heartPortal.meshes.forEach((m) => {
						(m.material as StandardMaterial).baseColor = new Color(1, 0, 0);
					});
					wallGroup.addChild(heartPortal);
				} else {
					// PORTAL NORMAL (Azul)
					const portal = Model.from(Assets.get("portal"));
					portal.scale.set((this.TILE_SIZE / 2) * 2.0);
					portal.name = "rotating_part";
					wallGroup.addChild(portal);
				}

				wallGroup.position.set(posX, 1, posZ);
				this.updateRoomProps(x, z);
			}
			const isW = (dx: number, dz: number) => {
				const nx = x + dx,
					nz = z + dz;
				if (nx < 0 || nx >= this.GRID_SIZE || nz < 0 || nz >= this.GRID_SIZE) {
					return false;
				}
				return [TileType.WALL, TileType.GOLD_WALL, TileType.HEART, TileType.PORTAL].includes(this.grid[nx][nz]);
			};

			const n = isW(0, -1),
				s = isW(0, 1),
				e = isW(1, 0),
				w = isW(-1, 0);
			const ne = isW(1, -1),
				se = isW(1, 1),
				sw = isW(-1, 1),
				nw = isW(-1, -1);
			const diagCount = (!nw ? 1 : 0) + (!ne ? 1 : 0) + (!se ? 1 : 0) + (!sw ? 1 : 0);

			let hasExposure = false;
			for (let dx = -1; dx <= 1; dx++) {
				for (let dz = -1; dz <= 1; dz++) {
					if (dx === 0 && dz === 0) {
						continue;
					}
					if (!isW(dx, dz)) {
						hasExposure = true;
						break;
					}
				}
				if (hasExposure) {
					break;
				}
			}

			// --- PREPARACIÓN DE VARIABLES DEL TECHO ---
			let roofTex = "topwall_1x1";
			let roofRot = 0;
			let scaleX = this.TILE_SIZE / 2;
			let scaleZ = this.TILE_SIZE / 2;

			const count = (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0);

			if (count === 4) {
				if (diagCount === 1) {
					roofTex = "topwall_corner_inside";
					if (!nw) {
						roofRot = 0;
					} else if (!ne) {
						roofRot = 270;
					} else if (!se) {
						roofRot = 180;
					} else if (!sw) {
						roofRot = 90;
					}
				} else if (diagCount === 2) {
					roofTex = "topwall_T_corner";
					if (!nw && !ne) {
						roofRot = 0;
					} else if (!ne && !se) {
						roofRot = 270;
					} else if (!se && !sw) {
						roofRot = 180;
					} else if (!sw && !nw) {
						roofRot = 90;
					}
				} else {
					roofTex = "topwall_1x1_cross";
				}
			} else if (count === 3) {
				const nFloor = (!nw ? 1 : 0) + (!ne ? 1 : 0);
				const sFloor = (!sw ? 1 : 0) + (!se ? 1 : 0);
				const eFloor = (!ne ? 1 : 0) + (!se ? 1 : 0);
				const wFloor = (!nw ? 1 : 0) + (!sw ? 1 : 0);

				if (!n) {
					roofRot = 0;
					if (diagCount >= 3) {
						roofTex = "topwall_side1_n_T";
					}
					// Transición si hay 2+ huecos, o si el único hueco es trasero (Sur)
					else {
						roofTex = (diagCount >= 2 && eFloor !== wFloor) || (diagCount === 1 && sFloor > 0) ? "topwall_side1_n_side2_1" : "topwall_side_n";
					}
					if (roofTex === "topwall_side1_n_side2_1" && wFloor > eFloor) {
						scaleX = -scaleX;
					}
				} else if (!s) {
					roofRot = 180;
					if (diagCount >= 3) {
						roofTex = "topwall_side1_n_T";
					} else {
						roofTex = (diagCount >= 2 && eFloor !== wFloor) || (diagCount === 1 && nFloor > 0) ? "topwall_side1_n_side2_1" : "topwall_side_n";
					}
					if (roofTex === "topwall_side1_n_side2_1" && eFloor > wFloor) {
						scaleX = -scaleX;
					}
				} else if (!e) {
					roofRot = 270;
					if (diagCount >= 3) {
						roofTex = "topwall_side1_n_T";
					} else {
						roofTex = (diagCount >= 2 && nFloor !== sFloor) || (diagCount === 1 && wFloor > 0) ? "topwall_side1_n_side2_1" : "topwall_side_n";
					}
					if (roofTex === "topwall_side1_n_side2_1" && nFloor > sFloor) {
						scaleX = -scaleX;
					}
				} else if (!w) {
					roofRot = 90;
					if (diagCount >= 3) {
						roofTex = "topwall_side1_n_T";
					}
					// FIJO [26, 23]: Detecta el hueco trasero (Este) y pone la transición
					// FIJO [28, 21]: Detecta que el hueco es delantero (Oeste) y mantiene side_n
					else {
						roofTex = (diagCount >= 2 && nFloor !== sFloor) || (diagCount === 1 && eFloor > 0) ? "topwall_side1_n_side2_1" : "topwall_side_n";
					}
					if (roofTex === "topwall_side1_n_side2_1" && sFloor > nFloor) {
						scaleX = -scaleX;
					}
				}
			} else if (count === 2) {
				if (n && s) {
					roofTex = "topwall_side_1xn";
					roofRot = 90;
				} else if (e && w) {
					roofTex = "topwall_side_1xn";
					roofRot = 0;
				} else {
					// Determinamos si la esquina es "maciza" (tiene el muro diagonal interno)
					const isThick = (n && e && ne) || (e && s && se) || (s && w && sw) || (w && n && nw);

					// Si no es maciza (isThick = false), aplicamos inandout
					roofTex = isThick ? "topwall_corner_nxn" : "topwall_corner_inandout";

					// Mantenemos tus rotaciones originales para orientar la esquina correctamente
					if (n && e) {
						roofRot = 90;
					} else if (e && s) {
						roofRot = 0;
					} else if (s && w) {
						roofRot = 270;
					} else if (w && n) {
						roofRot = 180;
					}
				}
			} else if (count === 1) {
				// NUEVO CASO: Punta de columna de 1 tile de ancho
				roofTex = "topwall1xn";
				// Orientación basada en el único vecino cardinal existente
				if (n) {
					roofRot = 90;
				} else if (s) {
					roofRot = 270;
				} else if (e) {
					roofRot = 0;
				} else if (w) {
					roofRot = 180;
				}
			} else {
				roofTex = "topwall_1x1"; // Pilar aislado
				roofRot = 0;
			}

			// --- CREACIÓN ÚNICA DEL TECHO (VITAL) ---
			const top = Mesh3D.createPlane();
			top.scale.set(scaleX, 1, scaleZ);
			top.position.set(0, this.TILE_SIZE, 0);
			const topMat = new StandardMaterial();

			// Si es Corazón o Portal, el techo es invisible para que se vea el modelo,
			// pero existe para que el autotiling de los vecinos sea correcto.
			if (type === TileType.HEART || type === TileType.PORTAL) {
				top.visible = false;
				wallGroup.visible = false;
			}
			if (hasExposure) {
				topMat.baseColorTexture = Texture.from(roofTex);
				topMat.doubleSided = true; // Permite ver la textura cuando scaleX es negativo
				top.rotationQuaternion.setEulerAngles(0, roofRot, 0);
			} else {
				topMat.baseColor = this.markedTiles[x][z] ? COLORS.MARKED : this.getTileColor(type);
				top.rotationQuaternion.setEulerAngles(0, 0, 0);
			}
			top.material = topMat;
			wallGroup.addChild(top);

			// Ladrillos laterales (Mantenemos tu lógica anterior)
			const checkDirs = [
				{ dx: 0, dz: -1, r: 180 },
				{ dx: 0, dz: 1, r: 0 },
				{ dx: 1, dz: 0, r: 90 },
				{ dx: -1, dz: 0, r: -90 },
			];
			checkDirs.forEach((d) => {
				if (!isW(d.dx, d.dz)) {
					const side = Mesh3D.createPlane();
					side.scale.set(this.TILE_SIZE / 2);
					side.position.set(d.dx * (this.TILE_SIZE / 2), this.TILE_SIZE / 2, d.dz * (this.TILE_SIZE / 2));
					side.rotationQuaternion.setEulerAngles(90, d.r, 0);
					const sideMat = new StandardMaterial();
					sideMat.baseColorTexture = Texture.from("brickwall");
					side.material = sideMat;
					wallGroup.addChild(side);
				}
			});

			wallGroup.position.set(posX, 0, posZ);
		}
		this.updateRoomProps(x, z);
	}

	private getTileColor(type: TileType): Color {
		switch (type) {
			case TileType.WALL:
				return COLORS.EARTH;
			case TileType.GOLD_WALL:
				return COLORS.GOLD_VEIN;
			case TileType.HEART:
				return COLORS.HEART;
			case TileType.LIBRARY:
				return COLORS.LIBRARY;
			case TileType.TRAINING:
				return COLORS.TRAINING;
			case TileType.TORTURE:
				return COLORS.TORTURE;
			case TileType.REST:
				return COLORS.REST;
			case TileType.PORTAL:
				return COLORS.PORTAL;
			default:
				return COLORS.FLOOR;
		}
	}

	private setupEvents() {
		this.eventMode = "static";

		window.addEventListener("keydown", (e) => {
			this.keys[e.code] = true;

			// Salir de posesión con Escape
			if (e.code === "Escape" && this.possessedMinion) {
				this.exitPossession();
			}
			if (e.code === "Space" || e.code === "KeyC") {
				const centerPos = Math.floor(this.GRID_SIZE / 2) * this.TILE_SIZE;

				// Cancelamos cualquier inercia previa
				this.dragVelocity.x = 0;
				this.dragVelocity.z = 0;

				// Animación suave del target de la cámara
				new Tween(cameraControl.target)
					.to({ x: centerPos, z: centerPos }, 1000) // 1000ms (1 segundo)
					.easing(Easing.Quadratic.Out) // Comienza rápido y frena suave
					.start();
			}
		});

		window.addEventListener("keyup", (e) => {
			this.keys[e.code] = false;
		});

		this.on("pointerdown", (e) => {
			const coords = this.getGridCoords(e.global);
			if (!coords) {
				return;
			}

			if (e.button === 2) {
				this.isDragging = true;
				this.lastMousePos.copyFrom(mousePosition);
			} else if (e.button === 0) {
				this.isSelecting = true;
				this.selectionStart = coords;
				this.selectionAreaVisual.visible = true;

				// MODO INTELIGENTE: Si el primer tile ya está marcado,
				// entra en modo "desmarcar" para toda el área.
				this.isDeselectingMode = this.markedTiles[coords.gx][coords.gz];

				// Cambiamos el color del visual de área para dar feedback
				const mat = this.selectionAreaVisual.material as StandardMaterial;
				mat.baseColor = this.isDeselectingMode
					? new Color(1, 0, 0, 0.3) // Rojo tenue si va a desmarcar
					: new Color(0, 0.5, 1, 0.3); // Azul tenue si va a marcar
			}
		});

		window.addEventListener(
			"wheel",
			(e) => {
				cameraControl.distance = Math.max(10, Math.min(100, cameraControl.distance + e.deltaY * 0.05));
			},
			{ passive: false }
		);
		this.on("globalpointermove", (e) => {
			if (this.isDragging) {
				// Sensibilidad ajustada para que el mapa "se pegue" al mouse
				const sensitivity = cameraControl.distance * 0.002;
				const dx = -(e.global.x - this.lastMousePos.x) * sensitivity;
				const dy = (e.global.y - this.lastMousePos.y) * sensitivity;

				// A 45 grados, cos y sin son iguales (0.707), pero usamos las variables
				// para que el código sea robusto si decides cambiar el ángulo después.
				const angle = cameraControl.angles.y * (Math.PI / 180);
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);

				// LOGICA ISOMÉTRICA CORRECTA:
				// El movimiento horizontal del mouse (dx) debe mover los ejes X y Z
				// en la misma dirección para desplazar lateralmente la vista.
				// El movimiento vertical (dy) debe moverlos de forma opuesta.
				cameraControl.target.z += (dx + dy) * sin;
				cameraControl.target.x -= (dx - dy) * cos;

				// 2. Guardamos este desplazamiento como velocidad para la inercia
				this.dragVelocity.z = (dx + dy) * sin;
				this.dragVelocity.x = -(dx - dy) * cos;

				this.lastMousePos.copyFrom(e.global);
			}

			// 2. Lógica del cursor verde (Nueva)
			const ray = cameraControl.camera.screenToRay(e.global.x, e.global.y);
			if (ray) {
				// Intersectamos con el plano superior (Y = TILE_SIZE)
				const t = (this.TILE_SIZE - ray.origin.y) / ray.direction.y;
				const hitX = ray.origin.x + ray.direction.x * t;
				const hitZ = ray.origin.z + ray.direction.z * t;

				const gx = Math.floor((hitX + this.TILE_SIZE / 2) / this.TILE_SIZE);
				const gz = Math.floor((hitZ + this.TILE_SIZE / 2) / this.TILE_SIZE);

				if (gx >= 0 && gx < this.GRID_SIZE && gz >= 0 && gz < this.GRID_SIZE) {
					this.selectionVisual.visible = true;
					this.selectionVisual.position.x = gx * this.TILE_SIZE;
					this.selectionVisual.position.z = gz * this.TILE_SIZE;
				} else {
					this.selectionVisual.visible = false;
				}
			}

			const currentCoords = this.getGridCoords(e.global);
			if (!currentCoords) {
				return;
			}

			// Lógica de Cursor Verde (Unitario)
			this.selectionVisual.visible = true;
			this.selectionVisual.position.x = currentCoords.gx * this.TILE_SIZE;
			this.selectionVisual.position.z = currentCoords.gz * this.TILE_SIZE;

			// Lógica de Área Azul (Múltiple)
			// Dentro de globalpointermove, donde se maneja la lógica de Área Azul:
			if (this.isSelecting && this.selectionStart) {
				this.updateSelectionVisual(this.selectionStart, currentCoords);

				// Cambiar color dinámicamente según la herramienta
				const mat = this.selectionAreaVisual.material as StandardMaterial;
				if (this.selectedTool === "SELL") {
					mat.baseColor = new Color(1, 0.2, 0.2, 0.4); // Rojo para venta
				} else if (this.isDeselectingMode) {
					mat.baseColor = new Color(1, 0, 0, 0.3); // Rojo para desmarcar picar
				} else {
					mat.baseColor = new Color(0, 0.5, 1, 0.3); // Azul para construir/marcar
				}
			}

			if (this.isSelecting && this.selectionStart && typeof this.selectedTool === "number") {
				const currentCoords = this.getGridCoords(e.global);
				if (currentCoords) {
					const config = ROOM_CONFIG[this.selectedTool];

					// Calculamos el área
					const minX = Math.max(0, Math.min(this.selectionStart.gx, currentCoords.gx));
					const maxX = Math.min(this.GRID_SIZE - 1, Math.max(this.selectionStart.gx, currentCoords.gx));
					const minZ = Math.max(0, Math.min(this.selectionStart.gz, currentCoords.gz));
					const maxZ = Math.min(this.GRID_SIZE - 1, Math.max(this.selectionStart.gz, currentCoords.gz));

					let validTilesCount = 0;
					for (let x = minX; x <= maxX; x++) {
						for (let z = minZ; z <= maxZ; z++) {
							// Solo cobramos si es suelo virgen y no la misma sala
							if (this.grid[x][z] === TileType.FLOOR) {
								validTilesCount++;
							}
						}
					}

					const totalCost = validTilesCount * config.cost;
					this.costPreviewText.text = totalCost > 0 ? `-$${totalCost}` : "";
					this.costPreviewText.visible = totalCost > 0;
					this.costPreviewText.position.set(e.global.x + 20, e.global.y - 20);

					// Cambiar color a rojo si no alcanza el oro
					this.costPreviewText.style.fill = totalCost > this.gold ? "#ff0000" : "#ffffff";
				}
			} else {
				this.costPreviewText.visible = false;
			}
		});

		this.on("pointerup", () => {
			if (this.isSelecting && this.selectionStart) {
				this.applyAreaSelection();
			}
			this.isDragging = false;
			this.isSelecting = false;
			this.selectionAreaVisual.visible = false;
		});
		// Escuchar el movimiento del mouse para la cámara
		window.addEventListener("mousemove", (e) => {
			if (this.possessedMinion) {
				// Rotación Horizontal (Yaw)
				cameraControl.angles.y -= e.movementX * this.MOUSE_SENSITIVITY;

				// Rotación Vertical (Pitch) con límites para no dar la vuelta completa
				cameraControl.angles.x = Math.max(-this.LOOK_LIMIT, Math.min(this.LOOK_LIMIT, cameraControl.angles.x + e.movementY * this.MOUSE_SENSITIVITY));
			}
		});
	}

	private getGridCoords(mousePos: Point) {
		const ray = cameraControl.camera.screenToRay(mousePos.x, mousePos.y);
		if (!ray) {
			return null;
		}
		const t = (this.TILE_SIZE - ray.origin.y) / ray.direction.y;
		const gx = Math.floor((ray.origin.x + ray.direction.x * t + this.TILE_SIZE / 2) / this.TILE_SIZE);
		const gz = Math.floor((ray.origin.z + ray.direction.z * t + this.TILE_SIZE / 2) / this.TILE_SIZE);
		return { gx, gz };
	}

	private updateSelectionVisual(start: { gx: number; gz: number }, end: { gx: number; gz: number }) {
		const minX = Math.min(start.gx, end.gx);
		const maxX = Math.max(start.gx, end.gx);
		const minZ = Math.min(start.gz, end.gz);
		const maxZ = Math.max(start.gz, end.gz);

		const width = (maxX - minX + 1) * this.TILE_SIZE;
		const depth = (maxZ - minZ + 1) * this.TILE_SIZE;

		// Posicionamos en el centro del área seleccionada
		this.selectionAreaVisual.position.x = ((minX + maxX) * this.TILE_SIZE) / 2;
		this.selectionAreaVisual.position.z = ((minZ + maxZ) * this.TILE_SIZE) / 2;

		// Escalamos el plano (el plano base de Pixi3D es de 1x1, scale ajusta su tamaño)
		this.selectionAreaVisual.scale.set(width / 2, 1, depth / 2);
	}

	// 2. Modifica applyAreaSelection para incluir el cobro
	private applyAreaSelection() {
		const start = this.selectionStart;
		const coordsEnd = this.getGridCoords(mousePosition);
		if (!start || !coordsEnd) {
			return;
		}

		if (this.selectedTool === "VIEW_INFO") {
			this.showTileDebugReport(coordsEnd.gx, coordsEnd.gz);
			return;
		}

		// --- LÓGICA DE GRAB (LA MANO) ---
		if (this.selectedTool === "GRAB") {
			if (this.grabbedMinion) {
				// Si ya tenemos uno, lo soltamos en la posición del mouse
				this.grabbedMinion.gx = coordsEnd.gx;
				this.grabbedMinion.gz = coordsEnd.gz;
				this.grabbedMinion.targetX = coordsEnd.gx;
				this.grabbedMinion.targetZ = coordsEnd.gz;
				this.grabbedMinion.state = "IDLE";
				this.grabbedMinion.visual.position.y = 1.2; // Altura normal de caminata
				this.grabbedMinion = null;
			} else {
				// Buscamos un minion en esa celda exacta para agarrarlo
				const found = this.minions.find((m) => m.gx === coordsEnd.gx && m.gz === coordsEnd.gz);
				if (found) {
					this.grabbedMinion = found;
					this.grabbedMinion.path = []; // Cancelamos cualquier camino que tuviera
				}
			}
			return; // IMPORTANTE: Detenemos aquí para no procesar minas o construcciones
		}

		if (this.selectedTool === "POSSESS") {
			const found = this.minions.find((m) => m.gx === coordsEnd.gx && m.gz === coordsEnd.gz);
			if (found) {
				this.enterPossession(found);
			}
			return;
		}

		const minX = Math.max(0, Math.min(start.gx, coordsEnd.gx));
		const maxX = Math.min(this.GRID_SIZE - 1, Math.max(start.gx, coordsEnd.gx));
		const minZ = Math.max(0, Math.min(start.gz, coordsEnd.gz));
		const maxZ = Math.min(this.GRID_SIZE - 1, Math.max(start.gz, coordsEnd.gz));

		// Si es MINE o SELL, lo dejamos instantáneo por UX
		if (this.selectedTool === "MINE" || this.selectedTool === "SELL") {
			for (let x = minX; x <= maxX; x++) {
				for (let z = minZ; z <= maxZ; z++) {
					const current = this.grid[x][z];
					if (this.selectedTool === "MINE") {
						if (current === TileType.WALL || current === TileType.GOLD_WALL) {
							this.markedTiles[x][z] = !this.isDeselectingMode;
							this.updateTileMesh(x, z);
						}
					} else if (this.selectedTool === "SELL") {
						const config = ROOM_CONFIG[current];
						if (config) {
							this.gold += Math.floor(config.cost / 2);
							this.grid[x][z] = TileType.FLOOR;
							this.uiText.text = `ORO: ${this.gold}`;

							// --- INICIO EFECTO PUFF ---
							const posX = x * this.TILE_SIZE;
							const posZ = z * this.TILE_SIZE;

							// Creamos una esfera para el "humo"
							const smoke = Mesh3D.createSphere();
							smoke.position.set(posX, 0.5, posZ); // Un poco elevada del suelo
							smoke.scale.set(this.TILE_SIZE / 4); // Empieza pequeña

							const smokeMat = new StandardMaterial();
							smokeMat.baseColor = new Color(0.9, 0.9, 0.9, 0.8); // Color grisáceo/blanco
							smoke.material = smokeMat;

							this.worldContainer.addChild(smoke);
							this.smokeEffects.push({ mesh: smoke, alpha: 0.8 });
							// --- FIN EFECTO PUFF ---
							this.updateRoomProps(x, z); // LIMPIAR EL PROP AL VENDER
							this.updateTileMesh(x, z);
						}
					}
				}
			}
			return;
		}

		// LÓGICA DE CONSTRUCCIÓN GRADUAL (SALAS)
		const toolTypeNumber = this.selectedTool as number; // Casting seguro tras el check
		const config = ROOM_CONFIG[toolTypeNumber];
		if (!config) {
			return;
		}

		for (let x = minX; x <= maxX; x++) {
			for (let z = minZ; z <= maxZ; z++) {
				if (this.grid[x][z] === TileType.FLOOR && !this.isDeselectingMode) {
					// Solo lo agregamos a la cola si no está ya en proceso o ya es de ese tipo
					this.constructionQueue.push({ x, z, type: toolTypeNumber });
				} else if (this.isDeselectingMode && this.grid[x][z] === toolTypeNumber) {
					// Para borrar salas también podemos usar la cola si quieres el efecto
					this.constructionQueue.push({ x, z, type: TileType.FLOOR });
				}
			}
		}
	}

	private enterPossession(minion: Minion) {
		if (this.possessedMinion) {
			return;
		}

		// Guardar estado original
		this.savedCameraState = {
			distance: cameraControl.distance,
			angles: { x: cameraControl.angles.x, y: cameraControl.angles.y },
			target: { ...cameraControl.target },
		};

		this.possessedMinion = minion;
		this.possessedMinion.state = "IDLE";
		this.possessedMinion.path = [];

		cameraControl.distance = 0.1;
		this.uiLayer.visible = false;
	}

	private exitPossession() {
		if (!this.possessedMinion) {
			return;
		}

		// Liberar mouse
		document.exitPointerLock?.();

		// Restaurar cámara
		cameraControl.distance = this.savedCameraState.distance;
		cameraControl.angles.x = this.savedCameraState.angles.x;
		cameraControl.angles.y = this.savedCameraState.angles.y;
		cameraControl.target = this.savedCameraState.target;

		this.possessedMinion = null;
		this.uiLayer.visible = true;
	}

	private showTileDebugReport(x: number, z: number) {
		if (!this.DEBUG_TILE_SETTINGS) {
			return;
		}

		const isW = (dx: number, dz: number) => {
			const nx = x + dx,
				nz = z + dz;
			if (nx < 0 || nx >= this.GRID_SIZE || nz < 0 || nz >= this.GRID_SIZE) {
				return false;
			}
			const t = this.grid[nx][nz];
			return t === TileType.WALL || t === TileType.GOLD_WALL || t === TileType.HEART || t === TileType.PORTAL;
		};

		// Obtenemos los estados exactos que usa tu updateTileMesh
		const n = isW(0, -1),
			s = isW(0, 1),
			e = isW(1, 0),
			w = isW(-1, 0);
		const ne = isW(1, -1),
			se = isW(1, 1),
			sw = isW(-1, 1),
			nw = isW(-1, -1);
		const count = (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0);
		const diagCount = (!nw ? 1 : 0) + (!ne ? 1 : 0) + (!se ? 1 : 0) + (!sw ? 1 : 0);

		// Re-calculamos roofTex para ver qué nombre le asigna el código
		let roofTex = "???";
		if (count === 4) {
			roofTex = diagCount === 1 ? "corner_inside" : diagCount === 2 ? "T_corner" : "cross";
		} // Dentro de showTileDebugReport...
		// Dentro de showTileDebugReport...
		else if (count === 3) {
			let side1 = 0,
				side2 = 0,
				backFloor = 0;
			if (!n) {
				side1 = ne ? 1 : 0;
				side2 = nw ? 1 : 0;
				backFloor = (!sw ? 1 : 0) + (!se ? 1 : 0);
			} else if (!s) {
				side1 = se ? 1 : 0;
				side2 = sw ? 1 : 0;
				backFloor = (!nw ? 1 : 0) + (!ne ? 1 : 0);
			} else if (!e) {
				side1 = ne ? 1 : 0;
				side2 = nw ? 1 : 0;
				backFloor = (!nw ? 1 : 0) + (!sw ? 1 : 0);
			} else if (!w) {
				side1 = nw ? 1 : 0;
				side2 = ne ? 1 : 0;
				backFloor = (!ne ? 1 : 0) + (!se ? 1 : 0);
			}

			if (diagCount >= 3) {
				roofTex = "side1_n_T";
			} else {
				// Sincronizamos la condición de activación con la malla
				const hasTransition = (diagCount >= 2 && side1 !== side2) || (diagCount === 1 && backFloor > 0);
				roofTex = hasTransition ? "side1_n_side2_1" : "side_n";
			}
		} else if (count === 2) {
			const isThick = (n && e && ne) || (e && s && se) || (s && w && sw) || (w && n && nw);
			roofTex = isThick ? "corner_nxn" : "corner_inandout";
		} else if (count === 1) {
			// Reflejamos la punta de columna en el debug
			roofTex = "topwall1xn";
		} else {
			roofTex = "1x1";
		}
		let roofTexName = "???";

		if (count === 4) {
			roofTexName = diagCount === 1 ? "corner_inside" : diagCount === 2 ? "T_corner" : "cross";
		} else if (count === 3) {
			// Sincronizamos con la lógica de asimetría y diagCount
			let side1 = 0,
				side2 = 0;
			if (!n || !s) {
				side1 = (ne ? 1 : 0) + (se ? 1 : 0);
				side2 = (nw ? 1 : 0) + (sw ? 1 : 0);
			} else {
				side1 = (nw ? 1 : 0) + (ne ? 1 : 0);
				side2 = (sw ? 1 : 0) + (se ? 1 : 0);
			}
			// Si diagCount < 2, DEBE ser side_n aunque haya asimetría
			roofTexName = diagCount >= 2 && side1 !== side2 ? "side1_n_side2_1" : "side_n";
		} // Dentro de showTileDebugReport...
		// Dentro de showTileDebugReport...
		else if (count === 2) {
			if ((n && s) || (e && w)) {
				roofTexName = "side_1xn";
			} else {
				const isThick = (n && e && ne) || (e && s && se) || (s && w && sw) || (w && n && nw);
				// Reflejamos la lógica de inandout en el texto
				roofTexName = isThick ? "corner_nxn" : "corner_inandout";
			}
		} else {
			roofTexName = count === 0 ? "1x1" : "side_1xn";
		}

		this.debugInfoPanel.visible = true;
		this.debugInfoText.text =
			`TILE DEBUG [${x}, ${z}]\n` +
			`---------------------\n` +
			`Cardinal Neighbours:\n` +
			`  N: ${n} | S: ${s}\n` +
			`  E: ${e} | W: ${w}\n` +
			`Count: ${count}\n\n` +
			`Diagonal Neighbours:\n` +
			`  NW: ${nw} | NE: ${ne}\n` +
			`  SW: ${sw} | SE: ${se}\n` +
			`DiagCount (Floor): ${diagCount}\n\n` +
			`RoofTextName: ${roofTexName}\n\n` +
			`Texture Assigned:\n` +
			`> ${roofTex}\n` +
			`---------------------\n` +
			`Type: ${TileType[this.grid[x][z]]}`;
	}

	private revealArea(gx: number, gz: number) {
		for (let x = gx - this.FOG_RADIUS; x <= gx + this.FOG_RADIUS; x++) {
			for (let z = gz - this.FOG_RADIUS; z <= gz + this.FOG_RADIUS; z++) {
				if (x >= 0 && x < this.GRID_SIZE && z >= 0 && z < this.GRID_SIZE) {
					this.visibility[x][z] = true;
				}
			}
		}
	}

	// Llamar esto en el constructor después de createUI()
	private createMinimap() {
		this.minimapContainer = new Container();
		this.minimapContainer.position.set(20, this.height - this.minimapSize - 20);
		this.uiLayer.addChild(this.minimapContainer);

		// Fondo y Máscara Circular
		const bg = new Graphics()
			.beginFill(0x000000, 0.8)
			.lineStyle(3, 0x666666)
			.drawCircle(this.minimapSize / 2, this.minimapSize / 2, this.minimapSize / 2)
			.endFill();
		this.minimapContainer.addChild(bg);

		this.minimapGraphics = new Graphics();
		this.minimapContainer.addChild(this.minimapGraphics);

		// Máscara para que nada se salga del círculo
		const mask = new Graphics()
			.beginFill(0xffffff)
			.drawCircle(this.minimapSize / 2, this.minimapSize / 2, this.minimapSize / 2)
			.endFill();
		this.minimapContainer.addChild(mask);
		this.minimapGraphics.mask = mask;

		// Texto de previsualización de costo
		this.costPreviewText = new Text("", {
			fill: "#ff4444",
			fontSize: 20,
			fontWeight: "bold",
			stroke: "#000000",
			strokeThickness: 4,
		});
		this.costPreviewText.visible = false;
		this.uiLayer.addChild(this.costPreviewText);
	}

	private updateMinimap() {
		this.minimapGraphics.clear();

		const radius = this.minimapSize / 2;
		const centerX = radius;
		const centerZ = radius;

		const camGridX = cameraControl.target.x / this.TILE_SIZE;
		const camGridZ = cameraControl.target.z / this.TILE_SIZE;
		const cameraAngleRad = cameraControl.angles.y * (Math.PI / 180) + 90;

		// --- Lógica del Centro de la Mazmorra (Corazón) ---
		const heartGrid = Math.floor(this.GRID_SIZE / 2);
		const dxH = heartGrid - camGridX;
		const dzH = heartGrid - camGridZ;
		const distH = Math.sqrt(dxH * dxH + dzH * dzH);
		const maxRange = 15; // El mismo rango que usas para los tiles

		// Ángulo hacia el centro ajustado por la rotación de la cámara
		const angleH = Math.atan2(dzH, dxH) - cameraAngleRad;

		if (distH <= maxRange) {
			// Si está cerca, dibujamos el cuadrado rojo normal
			const factor = Math.pow(distH / maxRange, 1.2) * radius;
			const drawX = centerX + Math.cos(angleH) * factor;
			const drawZ = centerZ + Math.sin(angleH) * factor;

			this.minimapGraphics.beginFill(0xff0000);
			this.minimapGraphics.drawRect(drawX - 4, drawZ - 4, 8, 8);
			this.minimapGraphics.endFill();
		} else {
			// SI ESTÁ LEJOS: Dibujamos marcador en la PERIFERIA
			// Calculamos la posición justo en el borde del radio (menos un margen de 5px)
			const borderPos = radius - 5;
			const drawX = centerX + Math.cos(angleH) * borderPos;
			const drawZ = centerZ + Math.sin(angleH) * borderPos;

			// Dibujamos un triángulo o flecha apuntando al centro
			this.minimapGraphics.beginFill(0xff0000);
			this.minimapGraphics.lineStyle(2, 0xffffff, 1);
			this.minimapGraphics.drawCircle(drawX, drawZ, 5); // Un punto rojo con borde blanco
			this.minimapGraphics.endFill();

			// Opcional: Texto pequeño "CENTRO"
			/*
const heartLabel = new Text("H", { fill: 0xffffff, fontSize: 10 });
heartLabel.anchor.set(0.5);
heartLabel.position.set(drawX, drawZ);
// Nota: esto requeriría manejo de objetos de texto en el minimapa
*/
		}
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				if (!this.visibility[x][z]) {
					continue;
				}

				const dx = x - camGridX;
				const dz = z - camGridZ;
				const dist = Math.sqrt(dx * dx + dz * dz);
				const maxVisibleRange = 15;

				// CORRECCIÓN: Si está fuera del rango, no lo dibujamos
				if (dist > maxVisibleRange) {
					continue;
				}

				// Rotamos el ángulo de dibujo según la cámara para que "arriba" sea el frente
				const angle = Math.atan2(dz, dx) - cameraAngleRad;

				const strength = 1.2;
				const factor = Math.pow(dist / maxVisibleRange, strength) * radius;

				const drawX = centerX + Math.cos(angle) * factor;
				const drawZ = centerZ + Math.sin(angle) * factor;

				const baseSize = this.minimapSize / maxVisibleRange;
				const size = baseSize * (1 - (dist / maxVisibleRange) * 0.5);

				const type = this.grid[x][z];
				const color = this.markedTiles[x][z] ? 0xffaa00 : this.getHexColor(type);

				this.minimapGraphics.beginFill(color);
				this.minimapGraphics.drawRect(drawX - size / 2, drawZ - size / 2, size, size);
				this.minimapGraphics.endFill();
			}
		}

		// Dibujar Minions con rotación sincronizada
		this.minions.forEach((m) => {
			const dx = m.gx - camGridX;
			const dz = m.gz - camGridZ;
			const dist = Math.sqrt(dx * dx + dz * dz);

			if (dist <= 15) {
				const angle = Math.atan2(dz, dx) - cameraAngleRad; // Sincronizado con cámara
				const factor = Math.pow(dist / 15, 1.2) * radius;
				const drawX = centerX + Math.cos(angle) * factor;
				const drawZ = centerZ + Math.sin(angle) * factor;

				this.minimapGraphics.beginFill(0x00ff00);
				this.minimapGraphics.drawCircle(drawX, drawZ, 3);
				this.minimapGraphics.endFill();
			}
		});

		// Indicador central de posición
		this.minimapGraphics.lineStyle(2, 0xffffff, 0.5);
		this.minimapGraphics.drawCircle(centerX, centerZ, 5);
	}
	// Helper para convertir Color a Hexadecimal para Pixi Graphics
	private getHexColor(type: TileType): number {
		const c = this.getTileColor(type);
		return (Math.round(c.r * 255) << 16) + (Math.round(c.g * 255) << 8) + Math.round(c.b * 255);
	}

	private spawnMinions(count: number) {
		const c = Math.floor(this.GRID_SIZE / 2);
		for (let i = 0; i < count; i++) {
			const visual = new Container3D();
			const body = Mesh3D.createSphere();
			body.scale.set(0.6);
			body.position.y = 1.2;

			const mat = new StandardMaterial();
			mat.baseColor = new Color(0, 1, 0); // Color verde para trabajadores iniciales
			body.material = mat;

			visual.addChild(body);
			this.worldContainer.addChild(visual);

			this.minions.push({
				gx: c + (i % 2),
				gz: c + 1 + Math.floor(i / 2),
				visual,
				targetX: c,
				targetZ: c + 1,
				state: "IDLE",
				path: [],
				type: "WORKER", // Requerido por la interfaz
				level: 1, // Requerido por la interfaz
			});
		}
	}

	private updateGrabbedMinionLogic() {
		if (!this.grabbedMinion) {
			return;
		}
		const ray = cameraControl.camera.screenToRay(mousePosition.x, mousePosition.y);
		if (ray) {
			const t = (2.5 - ray.origin.y) / ray.direction.y;
			const hitX = ray.origin.x + ray.direction.x * t;
			const hitZ = ray.origin.z + ray.direction.z * t;
			this.grabbedMinion.visual.position.x += (hitX - this.grabbedMinion.visual.position.x) * 0.2;
			this.grabbedMinion.visual.position.z += (hitZ - this.grabbedMinion.visual.position.z) * 0.2;
			this.grabbedMinion.visual.position.y = 2.5 + Math.sin(Date.now() * 0.01) * 0.2;
		}
	}

	private processConstructionQueue() {
		if (this.constructionQueue.length > 0) {
			this.constructionTimer++;
			if (this.constructionTimer >= this.CONSTRUCTION_DELAY) {
				this.constructionTimer = 0;
				const task = this.constructionQueue.shift()!;
				const config = ROOM_CONFIG[task.type];
				if (task.type !== TileType.FLOOR && config && this.gold >= config.cost) {
					this.gold -= config.cost;
					this.grid[task.x][task.z] = task.type;
					this.uiText.text = `ORO: ${this.gold}`;
					this.updateTileMesh(task.x, task.z, true);
				} else if (task.type === TileType.FLOOR) {
					this.grid[task.x][task.z] = TileType.FLOOR;
					this.updateTileMesh(task.x, task.z, true);
				}
			}
		}
	}

	public override update(dt: number) {
		super.update(dt);
		Group.shared.update();

		if (this.possessedMinion) {
			this.handlePossessionMovement(dt);
			// La cámara sigue al personaje
			cameraControl.target.x = this.possessedMinion.visual.position.x;
			cameraControl.target.y = 1.3;
			cameraControl.target.z = this.possessedMinion.visual.position.z;
		}
		if (this.isDiscoverySequencePlaying) {
			return;
		}

		// 1. Lógica de Rotación y Pulsos (Corregido para que no exploten los meshes)
		this.rotationTimer += dt * 0.002;
		const pulse = Math.sin(this.rotationTimer * 10) * 0.5 + 0.5;

		// Rotar Portal y Corazón de forma segura
		this.updateRotatingElements(pulse);

		// 2. Lógica de la Mano (Grab) - Movimiento fluido
		if (this.grabbedMinion) {
			this.updateGrabbedMinionLogic();
		}

		// 3. Actualización de Minions (Una sola vez por frame)
		// ACTUALIZACIÓN DE MINIONS:
		this.minions.forEach((m) => {
			// IMPORTANTE: Si está poseído o agarrado, NO ejecutar updateMinion
			if (m !== this.grabbedMinion && m !== this.possessedMinion) {
				this.updateMinion(m, dt);
			}
		});

		// 4. Inercia de Cámara
		this.updateCameraInertia();

		// 5. Timer de Inmigración (Tu lógica original)
		this.immigrationTimer++;
		if (this.immigrationTimer >= this.IMMIGRATION_COOLDOWN) {
			this.immigrationTimer = 0;
			this.tryImmigration();
		}

		// 6. OPTIMIZACIÓN: Lógica pesada solo cada 10 frames
		this.frameThrottle++;
		if (this.frameThrottle >= 10) {
			this.updateFogOfWar();
			this.updateMinimap();
			this.updateUnitBar();
			this.updateDebugUI();
			this.frameThrottle = 0;
		}

		// 7. Procesar efectos visuales y colas (Funciones separadas abajo)
		this.processConstructionQueue();
		this.processSmokeEffects(dt);
		this.processAppearingMeshes();
		this.processDebris(dt); // Nueva línea
	}

	private handlePossessionMovement(dt: number) {
		const m = this.possessedMinion;
		const speed = 0.01 * dt;

		// Calculamos los vectores de dirección basados en el ángulo actual de la cámara (Yaw)
		// El ángulo de Pixi3D suele estar desplazado 90 grados respecto al círculo trigonométrico estándar
		const angleRad = (cameraControl.angles.y - 90) * (Math.PI / 180);

		// Vector Adelante (Forward)
		const forwardX = Math.cos(angleRad);
		const forwardZ = Math.sin(angleRad);

		// Vector Derecha (Right) - Es el perpendicular al Forward
		const rightX = Math.cos(angleRad + Math.PI / 2);
		const rightZ = Math.sin(angleRad + Math.PI / 2);

		let moveX = 0;
		let moveZ = 0;

		// W / S: Adelante y Atrás
		if (this.keys["KeyW"]) {
			moveX += forwardX * speed;
			moveZ += forwardZ * speed;
		}
		if (this.keys["KeyS"]) {
			moveX -= forwardX * speed;
			moveZ -= forwardZ * speed;
		}

		// A / D: Movimiento Lateral (Strafe)
		if (this.keys["KeyA"]) {
			moveX += rightX * speed;
			moveZ += rightZ * speed;
		}
		if (this.keys["KeyD"]) {
			moveX -= rightX * speed;
			moveZ -= rightZ * speed;
		}

		const nextX = m.visual.position.x + moveX;
		const nextZ = m.visual.position.z + moveZ;

		// Colisión con el Grid
		const nextGx = Math.round(nextX / this.TILE_SIZE);
		const nextGz = Math.round(nextZ / this.TILE_SIZE);
		const tile = this.grid[nextGx]?.[nextGz];

		if (tile !== undefined && tile !== TileType.WALL && tile !== TileType.GOLD_WALL) {
			m.visual.position.x = nextX;
			m.visual.position.z = nextZ;
			m.gx = nextGx;
			m.gz = nextGz;
		}

		// Actualizar el target de la cámara a la "cara" del minion
		cameraControl.target.x = m.visual.position.x;
		cameraControl.target.y = 1.3; // Un poco más bajo para sensación de criatura
		cameraControl.target.z = m.visual.position.z;

		this.revealArea(m.gx, m.gz);
	}

	private updateMinion(m: Minion, dt: number) {
		const targetWorldX = m.gx * this.TILE_SIZE;
		const targetWorldZ = m.gz * this.TILE_SIZE;

		// Suavizado de movimiento visual
		m.visual.position.x += (targetWorldX - m.visual.position.x) * 0.1;
		m.visual.position.z += (targetWorldZ - m.visual.position.z) * 0.1;

		switch (m.state) {
			case "IDLE":
				if (m.type === "WORKER") {
					// TRABAJADORES: Buscan muros marcados para picar
					const job = this.findNearestMarked(m.gx, m.gz);
					if (job) {
						m.targetX = job.standX;
						m.targetZ = job.standZ;
						m.targetWallX = job.wallX;
						m.targetWallZ = job.wallZ;
						m.path = job.path;
						m.state = "MOVING_TO_WORK";
					}
				} else {
					// GUERREROS Y MAGOS: No pican muros. Buscan actividades.
					// Prioridad: 30% Probabilidad de ir a comer, 70% ir a su sala especial.
					const wantsToEat = Math.random() < 0.3;
					let targetRoomType = TileType.FOOD;

					if (!wantsToEat) {
						targetRoomType = m.type === "WARRIOR" ? TileType.TRAINING : TileType.LIBRARY;
					}

					const room = this.findNearestRoom(m.gx, m.gz, [targetRoomType]);
					if (room) {
						m.targetX = room.x;
						m.targetZ = room.z;
						m.path = room.path;
						m.state = "MOVING_TO_WORK";
					} else {
						// Si no hay sala de su tipo, deambulan por cualquier suelo cercano (área conquistada)
						const wander = this.findNearestRoom(m.gx, m.gz, [TileType.FLOOR, TileType.HEART]);
						if (wander && Math.random() < 0.01) {
							// Solo se mueven de vez en cuando si están vagando
							m.targetX = wander.x;
							m.targetZ = wander.z;
							m.path = wander.path;
							m.state = "MOVING_TO_WORK";
						}
					}
				}
				break;

			case "MOVING_TO_WORK":
				const dist = Math.abs(m.visual.position.x - targetWorldX) + Math.abs(m.visual.position.z - targetWorldZ);
				if (dist < 0.1) {
					if (m.gx === m.targetX && m.gz === m.targetZ) {
						// Llegó a su destino
						if (m.type === "WORKER" && m.targetWallX !== undefined) {
							m.state = "MINING";
						} else {
							m.state = "IN_ROOM";
							m.roomTimer = 200 + Math.random() * 300; // Tiempo que se queda en la sala
						}
					} else if (m.path.length > 0) {
						const next = m.path.shift()!;
						m.gx = next.x;
						m.gz = next.z;
					}
				}
				break;

			case "MINING":
				// Solo para Workers
				if (m.targetWallX === undefined || m.targetWallZ === undefined) {
					m.state = "IDLE";
					break;
				}
				this.wallHealth[m.targetWallX][m.targetWallZ] -= dt * MINING_SPEED;
				m.visual.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.5;
				if (this.wallHealth[m.targetWallX][m.targetWallZ] <= 0) {
					this.completeMining(m.targetWallX, m.targetWallZ);
					m.state = "IDLE";
					m.visual.position.y = 0;
				}
				break;

			case "IN_ROOM":
				// Animación de estar haciendo algo (pequeños saltitos o giros)
				m.visual.position.y = Math.abs(Math.sin(Date.now() * 0.005)) * 0.2;

				if (m.roomTimer) {
					m.roomTimer -= dt;
					if (m.roomTimer <= 0) {
						m.state = "IDLE";
						m.visual.position.y = 0;
					}
				}
				break;
		}
	}

	private completeMining(x: number, z: number) {
		const isGold = this.grid[x][z] === TileType.GOLD_WALL;
		this.grid[x][z] = TileType.FLOOR;
		this.markedTiles[x][z] = false;
		this.gold += isGold ? GOLD_AWARD : WALL_AWARD;
		SoundLib.playSound("shovel", { loop: false });
		this.uiText.text = `ORO: ${this.gold}`;

		// Actualizar la celda actual
		this.updateTileMesh(x, z);
		this.revealArea(x, z);

		for (let dx = -1; dx <= 1; dx++) {
			for (let dz = -1; dz <= 1; dz++) {
				const nx = x + dx;
				const nz = z + dz;
				if (this.grid[nx]?.[nz] === TileType.WALL || this.grid[nx]?.[nz] === TileType.GOLD_WALL) {
					this.updateTileMesh(nx, nz);
					// Solo spawneamos partículas si la pared "reaccionó" al picar
					if (Math.random() < 0.4) {
						this.spawnDebris(nx, nz);
					}
				}
			}
		}

		this.portals.forEach((p) => {
			if (!p.isDiscovered) {
				const dist = Math.max(Math.abs(p.x - x), Math.abs(p.z - z));
				if (dist <= 2) {
					p.isDiscovered = true;
					// Disparamos la nueva secuencia
					this.playPortalDiscoverySequence(p);
				}
			}
		});
	}

	private playPortalDiscoverySequence(portal: PortalData) {
		this.isDiscoverySequencePlaying = true;

		// 1. Posición del mundo del portal
		const targetX = portal.x * this.TILE_SIZE;
		const targetZ = portal.z * this.TILE_SIZE;

		// 2. Guardamos los valores iniciales para el retorno
		const initialDistance = cameraControl.distance;

		// 3. SECUENCIA DE TWEENS
		// Movemos el objetivo de la cámara al portal y hacemos zoom
		new Tween(cameraControl.target)
			.to({ x: targetX, z: targetZ }, 1500)
			.easing(Easing.Quadratic.InOut)
			.onStart(() => {
				// Hacemos que la luz del portal brille intensamente
				new Tween(this.portalLight)
					.to({ intensity: 100, range: 25 }, 1000)
					.easing(Easing.Quadratic.Out)
					.yoyo(true) // Vuelve a la intensidad normal
					.repeat(1)
					.start();

				new Tween(cameraControl).to({ distance: 25 }, 1500).easing(Easing.Quadratic.InOut).start();
			})
			.onComplete(() => {
				// Pequeña pausa enfocando el portal antes de retomar
				setTimeout(() => {
					new Tween(cameraControl)
						.to({ distance: initialDistance }, 1000)
						.easing(Easing.Quadratic.Out)
						.onComplete(() => {
							this.isDiscoverySequencePlaying = false;
							console.log("Secuencia finalizada: Mazmorra reanudada");
						})
						.start();
				}, 1000);
			})
			.start();
	}

	private updateFogOfWar() {
		const lit = new Set<string>();

		// 1. Los minions proporcionan luz
		this.minions.forEach((m) => this.markLit(m.gx, m.gz, lit));

		// 2. Salas, Corazón y Portales Descubiertos
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				const type = this.grid[x][z];

				const isRoom = ROOM_CONFIG[type];
				const isHeart = type === TileType.HEART; // Siempre ilumina el corazón
				const isPortalFound = type === TileType.PORTAL && this.portals.find((p) => p.x === x && p.z === z)?.isDiscovered;

				if (isRoom || isHeart || isPortalFound) {
					this.markLit(x, z, lit); // Ilumina el tile y su área 3x3
				}
			}
		}
		// 2. Las salas construidas proporcionan luz
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				const type = this.grid[x][z];
				if (ROOM_CONFIG[type]) {
					this.markLit(x, z, lit);
				}
			}
		}

		// 3. Aplicar la iluminación a los objetos
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				const isVisible = this.visibility[x][z];
				const isLit = lit.has(`${x},${z}`);
				const wall = this.meshes[x][z];
				const floor = this.floorMeshes[x][z];

				const exposure = isLit ? 1.0 : this.FOG_DIM_FACTOR;

				// Procesamos tanto el suelo como la pared (que ahora puede ser un grupo)
				[wall, floor].forEach((m) => {
					if (!m) {
						return;
					}

					// La visibilidad se aplica al objeto completo (sea malla o grupo)
					m.visible = isVisible;

					if (isVisible) {
						// Llamamos a la función recursiva para aplicar el brillo a los materiales
						this.applyExposureRecursive(m, exposure);
					}
				});
			}
		}
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				const isVisible = this.visibility[x][z];
				const isLit = lit.has(`${x},${z}`);
				const wall = this.meshes[x][z];
				const floor = this.floorMeshes[x][z];
				const prop = this.propMeshes[x][z]; // Nuevo

				const exposure = isLit ? 1.0 : this.FOG_DIM_FACTOR;

				[wall, floor, prop].forEach((m) => {
					if (!m) {
						return;
					}
					m.visible = isVisible;
					if (isVisible) {
						this.applyExposureRecursive(m, exposure);
					}
				});
			}
		}
	}
	private applyExposureRecursive(obj: any, exposure: number) {
		// Si el objeto tiene un material (es un Mesh3D), aplicamos la exposición
		if (obj.material) {
			(obj.material as StandardMaterial).exposure = exposure;
		}

		// Si el objeto tiene hijos (es un Container3D como nuestras nuevas paredes),
		// aplicamos la misma lógica a cada hijo de forma recursiva.
		if (obj.children && obj.children.length > 0) {
			obj.children.forEach((child: any) => this.applyExposureRecursive(child, exposure));
		}
	}
	private markLit(gx: number, gz: number, set: Set<string>) {
		for (let x = gx - 2; x <= gx + 2; x++) {
			for (let z = gz - 2; z <= gz + 2; z++) {
				set.add(`${x},${z}`);
			}
		}
	}

	private findNearestRoom(sx: number, sz: number, types: TileType[]) {
		const queue = [{ x: sx, z: sz }];
		const visited = new Set<string>();
		const parents = new Map<string, { x: number; z: number }>();

		while (queue.length > 0) {
			const curr = queue.shift()!;
			const dirs = [
				[0, 1],
				[0, -1],
				[1, 0],
				[-1, 0],
			];

			for (const [dx, dz] of dirs) {
				const nx = curr.x + dx,
					nz = curr.z + dz;
				if (nx < 0 || nx >= this.GRID_SIZE || nz < 0 || nz >= this.GRID_SIZE) {
					continue;
				}

				const key = `${nx},${nz}`;
				if (visited.has(key)) {
					continue;
				}
				visited.add(key);

				// Solo pueden caminar por suelos o salas
				const tile = this.grid[nx][nz];
				if (tile === TileType.WALL || tile === TileType.GOLD_WALL || tile === TileType.EMPTY) {
					continue;
				}

				parents.set(key, curr);

				// ¿Es la sala que buscamos?
				if (types.includes(tile)) {
					const path = [];
					let temp = { x: nx, z: nz };
					while (temp.x !== sx || temp.z !== sz) {
						path.push(temp);
						const p = parents.get(`${temp.x},${temp.z}`);
						if (!p) {
							break;
						}
						temp = p;
					}
					return { x: nx, z: nz, path: path.reverse() };
				}
				queue.push({ x: nx, z: nz });
			}
		}
		return null;
	}

	private findNearestMarked(sx: number, sz: number) {
		const queue = [{ x: sx, z: sz }];
		const visited = new Set<string>();
		const parents = new Map<string, { x: number; z: number }>();

		while (queue.length > 0) {
			const curr = queue.shift()!;
			const dirs = [
				[0, 1],
				[0, -1],
				[1, 0],
				[-1, 0],
			];

			for (const [dx, dz] of dirs) {
				const nx = curr.x + dx,
					nz = curr.z + dz;
				if (nx < 0 || nx >= this.GRID_SIZE || nz < 0 || nz >= this.GRID_SIZE) {
					continue;
				}

				const key = `${nx},${nz}`;
				if (visited.has(key)) {
					continue;
				}

				if (this.grid[nx][nz] === TileType.WALL || this.grid[nx][nz] === TileType.GOLD_WALL) {
					if (this.markedTiles[nx][nz]) {
						const path = [];
						let temp = curr;
						while (temp.x !== sx || temp.z !== sz) {
							path.push(temp);
							const p = parents.get(`${temp.x},${temp.z}`);
							if (!p) {
								break;
							}
							temp = p;
						}
						return { wallX: nx, wallZ: nz, standX: curr.x, standZ: curr.z, path: path.reverse() };
					}
					continue;
				}

				visited.add(key);
				parents.set(key, curr);
				queue.push({ x: nx, z: nz });
			}
		}
		return null;
	}

	private createUI() {
		const style = new TextStyle({ fill: "#FFD700", fontSize: 24, fontWeight: "bold", dropShadow: true });
		this.uiText = new Text(`ORO: 0`, style);
		this.uiText.position.set(20, 20);
		this.uiLayer.addChild(this.uiText);

		// Lista extendida de herramientas
		const tools = [
			{ type: "MINE", label: "PICAR", color: 0x555555 },
			{ type: "GRAB", label: "MANO", color: 0x228822 },
			{ type: "POSSESS", label: "POSEER", color: 0xaa00ff },
			{ type: "SELL", label: "VENDER (50%)", color: 0x882222 },
			...Object.entries(ROOM_CONFIG).map(([type, cfg]) => ({
				type: Number(type),
				label: `${cfg.label} ($${cfg.cost})`,
				color: cfg.color,
			})),
		];

		tools.forEach((t, i) => {
			// Reducimos altura de 40 a 32 y espaciado a 38
			const btn = new Graphics().beginFill(t.color).drawRoundedRect(0, 0, 130, 32, 5).endFill();
			btn.x = 20;
			btn.y = 60 + i * 38;
			btn.eventMode = "static";
			btn.on("pointerdown", (e) => {
				e.stopPropagation();
				this.selectedTool = t.type as any;

				// Feedback visual: opacidad para saber cuál está seleccionado
				this.uiLayer.children.forEach((c) => (c.alpha = 1));
				btn.alpha = 0.6;
			});

			const txt = new Text(t.label, { fill: 0xffffff, fontSize: 10, fontWeight: "bold" });
			txt.anchor.set(0.5);
			txt.position.set(65, 16); // Centrado en la nueva altura
			btn.addChild(txt);
			this.uiLayer.addChild(btn);
		});
		// Dentro de createUI()
		this.debugText = new Text("", { fill: "#ffffff", fontSize: 14 });
		this.debugText.position.set(20, 500);
		this.uiLayer.addChild(this.debugText);

		// Crear el contenedor de la barra de unidades (Posicionado a la derecha del minimapa)
		this.unitBarContainer = new Container();
		// Lo movemos a la derecha del minimapa: x = 20 (margen) + 150 (minimap) + 20 (gap)
		this.uiLayer.addChild(this.unitBarContainer);

		// Inicializamos el texto de Debug y otros elementos
		this.debugText = new Text("", { fill: "#ffffff", fontSize: 14 });
		this.debugText.position.set(20, 500);
		this.uiLayer.addChild(this.debugText);

		if (this.DEBUG_TILE_SETTINGS) {
			// 1. Botón para activar la herramienta VIEW_INFO
			const btn = new Graphics().beginFill(0x00aaff).drawRoundedRect(0, 0, 130, 40, 5).endFill();
			btn.x = 20;
			btn.y = 70 + (Object.keys(ROOM_CONFIG).length + 3) * 50; // Posicionar al final de la lista
			btn.eventMode = "static";
			btn.on("pointerdown", (e) => {
				e.stopPropagation();
				this.selectedTool = "VIEW_INFO";
				this.uiLayer.children.forEach((c) => (c.alpha = 1));
				btn.alpha = 0.6;
			});

			const txt = new Text("VIEW INFO", { fill: 0xffffff, fontSize: 11, fontWeight: "bold" });
			txt.anchor.set(0.5);
			txt.position.set(65, 20);
			btn.addChild(txt);
			this.uiLayer.addChild(btn);

			// 2. Panel de Información Detallada (Lado Derecho)
			this.debugInfoPanel = new Container();
			this.debugInfoPanel.position.set(this.width + 50, 50);
			this.debugInfoPanel.visible = false;

			const bg = new Graphics().beginFill(0x000000, 0.8).drawRect(0, 0, 230, 300).endFill();
			this.debugInfoText = new Text("", { fill: "#00FF00", fontSize: 14, fontFamily: "monospace" });
			this.debugInfoText.position.set(10, 10);

			this.debugInfoPanel.addChild(bg, this.debugInfoText);
			this.uiLayer.addChild(this.debugInfoPanel);
		}
	}

	private updateUnitBar() {
		this.unitBarContainer.removeChildren();

		const stats = this.getDungeonStats();
		// Mapeamos los nombres internos a etiquetas visibles
		const units = [
			{ type: "WORKER", count: stats.workers, color: 0x22aa22, label: "OBRERO" },
			{ type: "WARRIOR", count: stats.warriors, color: 0xaa2222, label: "GUERRERO" },
			{ type: "MAGE", count: stats.mages, color: 0x2244aa, label: "MAGO" },
		];

		let currentX = 0;
		const cardW = 80;
		const cardH = 120;

		units.forEach((u) => {
			if (u.count > 0) {
				const card = new Container();
				card.x = currentX;

				// Fondo de la card
				const bg = new Graphics().beginFill(0x333333).lineStyle(2, 0x666666).drawRoundedRect(0, 0, cardW, cardH, 5).endFill();

				// Icono representativo (un círculo del color de la unidad)
				const icon = new Graphics()
					.beginFill(u.color)
					.drawCircle(cardW / 2, 30, 15)
					.endFill();

				// Nombre de la unidad
				const nameTxt = new Text(u.label, { fill: "#ffffff", fontSize: 10, fontWeight: "bold" });
				nameTxt.anchor.set(0.5, 0);
				nameTxt.position.set(cardW / 2, 50);

				// Contador abajo a la derecha (estilo Dungeon Keeper)
				const countTxt = new Text(u.count.toString(), {
					fill: "#ffff00",
					fontSize: 16,
					fontWeight: "bold",
					stroke: 0x000000,
					strokeThickness: 3,
				});
				countTxt.anchor.set(1, 1);
				countTxt.position.set(cardW - 5, cardH - 5);

				card.addChild(bg, icon, nameTxt, countTxt);
				this.unitBarContainer.addChild(card);

				currentX += cardW + 10; // Espacio entre cards
			}
		});
	}

	private updateRotatingElements(pulse: number) {
		const rotSpeed = this.rotationTimer * 50;

		// Helper para rotar solo el portal dentro del grupo
		const rotatePart = (gx: number, gz: number, speed: number) => {
			const group = this.meshes[gx]?.[gz];
			if (group) {
				// Realizamos el cast a Container3D para acceder a rotationQuaternion
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
				const part = group.getChildByName("rotating_part") as Container3D;
				if (part) {
					part.rotationQuaternion.setEulerAngles(0, speed, 0);
				}
			}
		};

		// Girar Portal Azul
		if (this.portalPos) {
			rotatePart(this.portalPos.x, this.portalPos.z, rotSpeed);
			this.portalLight.intensity = 5 + pulse * 15;
		}

		// Girar Portal Rojo del Corazón
		const c = Math.floor(this.GRID_SIZE / 2);
		rotatePart(c, c, -rotSpeed);
		if (this.heartLight) {
			this.heartLight.intensity = 5 + pulse * 15;
		}
	}

	private updateCameraInertia() {
		if (!this.isDragging) {
			cameraControl.target.x += this.dragVelocity.x;
			cameraControl.target.z += this.dragVelocity.z;
			this.dragVelocity.x *= this.FRICTION;
			this.dragVelocity.z *= this.FRICTION;

			if (Math.abs(this.dragVelocity.x) < 0.001) {
				this.dragVelocity.x = 0;
			}
			if (Math.abs(this.dragVelocity.z) < 0.001) {
				this.dragVelocity.z = 0;
			}
		}
	}

	private updateDebugUI() {
		const stats = this.getDungeonStats();
		const discoveredCount = this.portals.filter((p) => p.isDiscovered).length;
		this.debugText.text =
			`--- DEBUG ---\n` +
			`Portales: ${discoveredCount}/${this.portals.length} ACTIVOS\n` +
			`Camas: ${this.minions.length}/${stats.beds}\n` +
			`Comida: ${stats.food} (Min 6)\n` +
			`Guerreros: ${stats.warriors} | Magos: ${stats.mages}`;
	}

	// Estos son los que te daban error de "Property does not exist"
	private processSmokeEffects(dt: number) {
		const smokeDt = dt / 10;
		for (let i = this.smokeEffects.length - 1; i >= 0; i--) {
			const effect = this.smokeEffects[i];
			effect.mesh.scale.set(effect.mesh.scale.x + smokeDt * 0.05);
			effect.alpha -= smokeDt * 0.02;
			const mat = effect.mesh.material as StandardMaterial;
			if (mat) {
				mat.baseColor = new Color(0.9, 0.9, 0.9, effect.alpha);
			}
			if (effect.alpha <= 0) {
				effect.mesh.removeFromParent();
				this.smokeEffects.splice(i, 1);
			}
		}
	}

	private processAppearingMeshes() {
		for (let i = this.appearingMeshes.length - 1; i >= 0; i--) {
			const item = this.appearingMeshes[i];
			item.mesh.position.y += (item.targetY - item.mesh.position.y) * 0.15;
			if (Math.abs(item.mesh.position.y - item.targetY) < 0.01) {
				item.mesh.position.y = item.targetY;
				this.appearingMeshes.splice(i, 1);
			}
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		this.minimapContainer.x = 20;
		this.minimapContainer.y = _newH - this.minimapContainer.height - 20;

		this.unitBarContainer.x = 190;
		this.unitBarContainer.y = _newH - this.minimapContainer.height - 5;
	}
}
