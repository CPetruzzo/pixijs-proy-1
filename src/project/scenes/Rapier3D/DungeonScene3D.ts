/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Color, StandardMaterial, Light, LightType, LightingEnvironment, Container3D } from "pixi3d/pixi7";
import { Container, Text, TextStyle, Graphics, Point, Rectangle } from "pixi.js";
import { cameraControl, mousePosition } from "../../..";

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
	MARKED: new Color(1, 0.66, 0),
};

// 1. Agrega este objeto de configuración fuera o dentro de la clase
const ROOM_CONFIG: Record<number, { cost: number; label: string; color: number }> = {
	[TileType.LIBRARY]: { cost: 50, label: "BIBLIO", color: 0x2244aa },
	[TileType.TRAINING]: { cost: 100, label: "ENTRENAR", color: 0xaa4422 },
	// Aquí puedes agregar más salas fácilmente:
	[TileType.TORTURE]: { cost: 150, label: "TORTURA", color: 0x660066 },
	[TileType.REST]: { cost: 150, label: "DESCANSO", color: 0x922044 },
	// [TileType.TORTURE]: { cost: 150, label: "TORTURA", color: 0x660066 },
};

interface Minion {
	gx: number;
	gz: number; // Cambiado de gy a gz para consistencia 3D
	visual: Container3D;
	targetX: number;
	targetZ: number;
	targetWallX?: number;
	targetWallZ?: number;
	path: { x: number; z: number }[];
	state: "IDLE" | "MOVING_TO_WORK" | "MINING";
}

export class DungeonScene3D extends PixiScene {
	private readonly GRID_SIZE = 40;
	private readonly TILE_SIZE = 2;
	private readonly FOG_RADIUS = 3;
	private readonly FOG_DIM_FACTOR = 0.3;

	private grid: TileType[][] = [];
	private markedTiles: boolean[][] = [];
	private visibility: boolean[][] = [];
	private wallHealth: number[][] = [];
	private meshes: (Mesh3D | null)[][] = [];
	private floorMeshes: (Mesh3D | null)[][] = [];

	private worldContainer: Container3D;
	private uiLayer: Container;
	private minions: Minion[] = [];
	private gold = 0;
	private uiText: Text;
	private selectedTool: TileType | "MINE" | "SELL" = "MINE";
	private selectionVisual: Mesh3D;
	private isDragging = false;
	private lastMousePos = new Point();
	private isSelecting = false;
	private selectionStart: { gx: number; gz: number } | null = null;
	private selectionAreaVisual: Mesh3D; // Reemplazaremos o añadiremos esta
	private isDeselectingMode = false; // Define si el arrastre actual borra marcas

	// Dentro de la clase DungeonScene3D
	private minimapContainer: Container;
	private minimapGraphics: Graphics;
	private minimapSize = 150; // Tamaño del círculo
	// Cerca de donde defines isDragging
	private dragVelocity = { x: 0, z: 0 };
	private readonly FRICTION = 0.97; // Cuanto más alto, más tarda en frenar (0.9 a 0.98 recomendado)
	private costPreviewText: Text;
	// Lista para animar las baldosas que acaban de nacer
	private appearingMeshes: { mesh: Mesh3D; targetY: number }[] = [];
	// Cerca de appearingMeshes
	private constructionQueue: { x: number; z: number; type: TileType }[] = [];
	private constructionTimer = 0;
	private readonly CONSTRUCTION_DELAY = 8; // Frames entre cada tile (bájalo para más velocidad)

	// Lista para manejar las partículas de humo/desvanecimiento
	private smokeEffects: { mesh: Mesh3D; alpha: number }[] = [];

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

	private setupCamera() {
		cameraControl.allowControl = false;
		cameraControl.angles.x = 60; // Inclinación vertical
		cameraControl.angles.y = 45; // ROTACIÓN: Volvemos a 45 grados
		cameraControl.distance = 50;

		const center = (this.GRID_SIZE * this.TILE_SIZE) / 2;
		cameraControl.target = { x: center, y: 0, z: center };
	}

	private initGrid() {
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

				if (Math.random() < 0.05) {
					this.grid[x][z] = TileType.GOLD_WALL;
					this.wallHealth[x][z] = 500;
				} else {
					this.grid[x][z] = TileType.WALL;
					this.wallHealth[x][z] = 100;
				}
				this.updateTileMesh(x, z);
			}
		}

		// 2. Crear el Corazón de la Mazmorra
		const c = Math.floor(this.GRID_SIZE / 2);
		this.grid[c][c] = TileType.HEART;
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
	}

	private updateTileMesh(x: number, z: number, animate = false) {
		const type = this.grid[x][z];
		if (this.meshes[x][z]) {
			this.meshes[x][z]?.removeFromParent();
		}
		if (this.floorMeshes[x][z]) {
			this.floorMeshes[x][z]?.removeFromParent();
		}

		const posX = x * this.TILE_SIZE;
		const posZ = z * this.TILE_SIZE;

		if (type !== TileType.WALL && type !== TileType.GOLD_WALL) {
			const floor = Mesh3D.createPlane();
			floor.scale.set(this.TILE_SIZE / 2);
			floor.position.set(posX, 0, posZ);
			const mat = new StandardMaterial();
			mat.baseColor = this.getTileColor(type);
			floor.material = mat;
			this.worldContainer.addChild(floor);

			const targetY = 0;
			if (animate) {
				floor.position.set(posX, -2, posZ); // Empieza 2 unidades abajo
				this.appearingMeshes.push({ mesh: floor, targetY });
			} else {
				floor.position.set(posX, targetY, posZ);
			}

			this.floorMeshes[x][z] = floor;
		}

		if (type === TileType.WALL || type === TileType.GOLD_WALL || type === TileType.HEART || type === TileType.PORTAL) {
			const wall = Mesh3D.createCube();
			wall.scale.set(this.TILE_SIZE / 2);
			wall.position.set(posX, this.TILE_SIZE / 2, posZ);
			const mat = new StandardMaterial();
			mat.baseColor = this.markedTiles[x][z] ? COLORS.MARKED : this.getTileColor(type);
			wall.material = mat;
			this.worldContainer.addChild(wall);
			this.meshes[x][z] = wall;
		}
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

							this.updateTileMesh(x, z);
						}
					}
				}
			}
			return;
		}

		// LÓGICA DE CONSTRUCCIÓN GRADUAL (SALAS)
		const toolType = this.selectedTool;
		const config = ROOM_CONFIG[toolType];
		if (!config) {
			return;
		}

		for (let x = minX; x <= maxX; x++) {
			for (let z = minZ; z <= maxZ; z++) {
				if (this.grid[x][z] === TileType.FLOOR && !this.isDeselectingMode) {
					// Solo lo agregamos a la cola si no está ya en proceso o ya es de ese tipo
					this.constructionQueue.push({ x, z, type: toolType });
				} else if (this.isDeselectingMode && this.grid[x][z] === toolType) {
					// Para borrar salas también podemos usar la cola si quieres el efecto
					this.constructionQueue.push({ x, z, type: TileType.FLOOR });
				}
			}
		}
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
			body.scale.set(0.6); // Un poco más grandes
			body.position.y = 1.2; // Caminan SOBRE el suelo, no enterrados

			const mat = new StandardMaterial();
			mat.baseColor = new Color(0, 1, 0);
			body.material = mat;

			visual.addChild(body);
			this.worldContainer.addChild(visual);

			this.minions.push({
				gx: c + (i % 2), // Separación básica para que no se solapen
				gz: c + 1 + Math.floor(i / 2),
				visual,
				targetX: c,
				targetZ: c + 1,
				state: "IDLE",
				path: [],
			});
		}
	}

	public override update(dt: number) {
		super.update(dt);
		// Aplicar inercia si NO estamos arrastrando
		if (!this.isDragging) {
			// Mover el target de la cámara según la velocidad acumulada
			cameraControl.target.x += this.dragVelocity.x;
			cameraControl.target.z += this.dragVelocity.z;

			// Aplicar fricción para frenar poco a poco
			this.dragVelocity.x *= this.FRICTION;
			this.dragVelocity.z *= this.FRICTION;

			// Si la velocidad es insignificante, la matamos para ahorrar cálculos
			if (Math.abs(this.dragVelocity.x) < 0.001) {
				this.dragVelocity.x = 0;
			}
			if (Math.abs(this.dragVelocity.z) < 0.001) {
				this.dragVelocity.z = 0;
			}
		}
		this.minions.forEach((m) => this.updateMinion(m, dt));
		this.updateFogOfWar();
		this.updateMinimap(); // Actualizar minimapa cada frame

		// PROCESAR CONSTRUCCIÓN GRADUAL
		if (this.constructionQueue.length > 0) {
			this.constructionTimer++;

			if (this.constructionTimer >= this.CONSTRUCTION_DELAY) {
				this.constructionTimer = 0;
				const task = this.constructionQueue.shift()!; // Sacamos el primer tile de la lista

				const config = ROOM_CONFIG[task.type];
				// Si es construcción de sala, cobramos aquí
				if (task.type !== TileType.FLOOR && config) {
					if (this.gold >= config.cost) {
						this.gold -= config.cost;
						this.grid[task.x][task.z] = task.type;
						this.uiText.text = `ORO: ${this.gold}`;
						this.updateTileMesh(task.x, task.z, true); // True activa la animación de subida
					}
				} else {
					// Si es "borrar" (volver a FLOOR)
					this.grid[task.x][task.z] = TileType.FLOOR;
					this.updateTileMesh(task.x, task.z, true);
				}
			}
		}

		const smokeDt = dt / 10;
		for (let i = this.smokeEffects.length - 1; i >= 0; i--) {
			const effect = this.smokeEffects[i];

			// El humo crece rápido
			effect.mesh.scale.set(effect.mesh.scale.x + smokeDt * 0.05);

			// El humo se desvanece
			effect.alpha -= smokeDt * 0.02;

			const mat = effect.mesh.material as StandardMaterial;
			if (mat) {
				mat.baseColor = new Color(0.9, 0.9, 0.9, effect.alpha);
			}

			// Eliminar cuando sea invisible
			if (effect.alpha <= 0) {
				effect.mesh.removeFromParent();
				this.smokeEffects.splice(i, 1);
			}
		}

		// Animación de meshes subiendo (appearingMeshes)
		for (let i = this.appearingMeshes.length - 1; i >= 0; i--) {
			const item = this.appearingMeshes[i];
			item.mesh.position.y += (item.targetY - item.mesh.position.y) * 0.15;
			if (Math.abs(item.mesh.position.y - item.targetY) < 0.01) {
				item.mesh.position.y = item.targetY;
				this.appearingMeshes.splice(i, 1);
			}
		}
	}

	private updateMinion(m: Minion, dt: number) {
		const targetWorldX = m.gx * this.TILE_SIZE;
		const targetWorldZ = m.gz * this.TILE_SIZE;

		m.visual.position.x += (targetWorldX - m.visual.position.x) * 0.1;
		m.visual.position.z += (targetWorldZ - m.visual.position.z) * 0.1;

		switch (m.state) {
			case "IDLE":
				const job = this.findNearestMarked(m.gx, m.gz);
				if (job) {
					m.targetX = job.standX;
					m.targetZ = job.standZ;
					m.targetWallX = job.wallX;
					m.targetWallZ = job.wallZ;
					m.path = job.path;
					m.state = "MOVING_TO_WORK";
				}
				break;

			case "MOVING_TO_WORK":
				const dist = Math.abs(m.visual.position.x - targetWorldX) + Math.abs(m.visual.position.z - targetWorldZ);
				if (dist < 0.1) {
					if (m.gx === m.targetX && m.gz === m.targetZ) {
						m.state = "MINING";
					} else if (m.path.length > 0) {
						const next = m.path.shift()!;
						m.gx = next.x;
						m.gz = next.z;
						this.revealArea(m.gx, m.gz);
					}
				}
				break;

			case "MINING":
				if (m.targetWallX === undefined || m.targetWallZ === undefined) {
					m.state = "IDLE";
					break;
				}
				const tx = m.targetWallX;
				const tz = m.targetWallZ;

				this.wallHealth[tx][tz] -= dt * 0.5;
				m.visual.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.5;

				if (this.wallHealth[tx][tz] <= 0) {
					this.completeMining(tx, tz);
					m.state = "IDLE";
					m.visual.position.y = 0;
				}
				break;
		}
	}

	private completeMining(x: number, z: number) {
		const isGold = this.grid[x][z] === TileType.GOLD_WALL;
		this.grid[x][z] = TileType.FLOOR;
		this.markedTiles[x][z] = false;
		this.gold += isGold ? 100 : 10;
		this.uiText.text = `ORO: ${this.gold}`;
		this.updateTileMesh(x, z);
		this.revealArea(x, z);
	}

	private updateFogOfWar() {
		const lit = new Set<string>();
		this.minions.forEach((m) => this.markLit(m.gx, m.gz, lit));

		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let z = 0; z < this.GRID_SIZE; z++) {
				const isVisible = this.visibility[x][z];
				const isLit = lit.has(`${x},${z}`);
				const wall = this.meshes[x][z];
				const floor = this.floorMeshes[x][z];

				[wall, floor].forEach((m) => {
					if (!m) {
						return;
					}
					if (!isVisible) {
						m.visible = false;
					} else {
						m.visible = true;
						const exposure = isLit ? 1.0 : this.FOG_DIM_FACTOR;
						(m.material as StandardMaterial).exposure = exposure;
					}
				});
			}
		}
	}

	private markLit(gx: number, gz: number, set: Set<string>) {
		for (let x = gx - 2; x <= gx + 2; x++) {
			for (let z = gz - 2; z <= gz + 2; z++) {
				set.add(`${x},${z}`);
			}
		}
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
			{ type: "SELL", label: "VENDER (50%)", color: 0x882222 }, // Botón de vender
			...Object.entries(ROOM_CONFIG).map(([type, cfg]) => ({
				type: Number(type),
				label: `${cfg.label} ($${cfg.cost})`,
				color: cfg.color,
			})),
		];

		tools.forEach((t, i) => {
			const btn = new Graphics().beginFill(t.color).drawRoundedRect(0, 0, 130, 40, 5).endFill();
			btn.x = 20;
			btn.y = 70 + i * 50;
			btn.eventMode = "static";
			btn.on("pointerdown", (e) => {
				e.stopPropagation();
				this.selectedTool = t.type as any;

				// Feedback visual: opacidad para saber cuál está seleccionado
				this.uiLayer.children.forEach((c) => (c.alpha = 1));
				btn.alpha = 0.6;
			});

			const txt = new Text(t.label, { fill: 0xffffff, fontSize: 11, fontWeight: "bold" });
			txt.anchor.set(0.5);
			txt.position.set(65, 20);
			btn.addChild(txt);
			this.uiLayer.addChild(btn);
		});
	}

	public override onResize(_newW: number, _newH: number): void {
		this.minimapContainer.x = 20;
		this.minimapContainer.y = _newH - this.minimapContainer.height - 20;
	}
}
