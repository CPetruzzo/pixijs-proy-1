/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Graphics, Text, TextStyle, Point } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

enum TileType {
	WALL = 0,
	FLOOR = 1,
	HEART = 2,
	GOLD_WALL = 3,
	LIBRARY = 4, // Nueva: Biblioteca (Azul)
	TRAINING = 5, // Nueva: Entrenamiento (Rojo/Naranja)
	TORTURE = 6, // Nueva: Tortura (Púrpura)
}

const COLORS = {
	EARTH: 0x2c1e14,
	GOLD_VEIN: 0xffd700,
	FLOOR: 0x1a1a1a,
	HEART: 0xaa0000,
	LIBRARY: 0x2244aa,
	TRAINING: 0xaa4422,
	TORTURE: 0x660066,
};

interface Minion {
	gx: number;
	gy: number;
	visualX: number;
	visualY: number;
	targetX: number;
	targetY: number;
	targetWallX?: number;
	targetWallY?: number;
	path: { x: number; y: number }[]; // <-- Nueva propiedad
	state: "IDLE" | "MOVING_TO_WORK" | "MINING";
	miningTimer: number;
}

export class DungeonScene extends PixiScene {
	private readonly GRID_SIZE = 50;
	private readonly T_WIDTH_HALF = 40;
	private readonly T_HEIGHT_HALF = 25;
	private readonly WALL_HEIGHT = 35;
	private readonly FOG_DIM_FACTOR = 0.3; // 30% de brillo para zonas exploradas
	private minimapGraphics: Graphics;
	private readonly MINIMAP_SIZE = 400; // Tamaño en píxeles
	private grid: TileType[][] = [];
	private markedTiles: boolean[][] = [];

	private worldContainer: Container;
	private dungeonLayer: Graphics;
	private uiLayer: Container;

	private minions: Minion[] = [];
	private gold = 0;
	private uiText: Text;
	private isDragging = false;
	private lastDragPoint: Point = new Point();
	private visibility: boolean[][] = [];
	private readonly FOG_RADIUS = 2; // El radio que pediste

	// Dentro de la clase DungeonScene
	private wallHealth: number[][] = [];
	private readonly BASE_WALL_HEALTH = 100; // Tierra normal
	private readonly GOLD_WALL_HEALTH = 500; // El oro es 5 veces más duro

	private selectedTool: TileType | "MINE" = "MINE"; // Por defecto, modo minar
	private roomMenu: Container;

	// Dentro de la clase DungeonScene
	public trainingTilesCount = 0;
	public trainingPoints = 0;
	public readonly TOTEM_BONUS = 10; // Cada tótem vale por 10 celdas extra
	constructor() {
		super();
		this.initGrid();

		this.worldContainer = new Container();
		this.addChild(this.worldContainer);

		this.dungeonLayer = new Graphics();
		this.worldContainer.addChild(this.dungeonLayer);

		this.uiLayer = new Container();
		this.addChild(this.uiLayer);

		(this as any).interactive = true;

		this.setupEvents();
		this.spawnMinions(4);
		this.createUI();
		this.createRoomMenu();
	}

	private setupEvents() {
		this.on("pointerdown", this.onPointerDown, this);
		this.on("pointermove", this.onPointerMove, this);
		this.on("pointerup", this.onPointerUp, this);
		this.on("pointerupoutside", this.onPointerUp, this);

		// Evitar que aparezca el menú al hacer click derecho
		window.addEventListener("contextmenu", (e) => e.preventDefault());
		window.addEventListener("wheel", (e) => this.handleZoom(e), { passive: false });
	}

	private drawTrainingTotem(x: number, y: number) {
		// Sombra sutil
		this.dungeonLayer.beginFill(0x000000, 0.4);
		this.dungeonLayer.drawEllipse(x, y, 12, 6);

		// Base metálica
		this.dungeonLayer.beginFill(0x555555);
		this.dungeonLayer.drawRect(x - 6, y - 4, 12, 4);

		// Poste
		this.dungeonLayer.beginFill(0x999999);
		this.dungeonLayer.drawRect(x - 2, y - 24, 4, 20);

		// Cabezal de entrenamiento (Rojo)
		this.dungeonLayer.beginFill(0xff3333);
		this.dungeonLayer.drawCircle(x, y - 24, 6);
		this.dungeonLayer.endFill();
	}

	private createRoomMenu() {
		this.roomMenu = new Container();
		this.uiLayer.addChild(this.roomMenu);

		const tools = [
			{ type: "MINE", color: 0x555555, label: "Picar" },
			{ type: TileType.LIBRARY, color: COLORS.LIBRARY, label: "Biblio" },
			{ type: TileType.TRAINING, color: COLORS.TRAINING, label: "Entrenar" },
			{ type: TileType.TORTURE, color: COLORS.TORTURE, label: "Tortura" },
		];

		tools.forEach((tool, i) => {
			const btn = new Graphics().beginFill(tool.color).lineStyle(2, 0xffffff, 1).drawRoundedRect(0, 0, 80, 40, 8).endFill();

			btn.x = i * 90;
			btn.eventMode = "static"; // Pixi v7+
			btn.cursor = "pointer";

			const txt = new Text(tool.label, { fill: "#ffffff", fontSize: 12 });
			txt.anchor.set(0.5);
			txt.position.set(40, 20);
			btn.addChild(txt);

			btn.on("pointerdown", (e) => {
				e.stopPropagation(); // Evitar que el click atraviese al mapa
				this.selectedTool = tool.type as any;
				// Feedback visual: podrías resaltar el botón aquí
			});

			this.roomMenu.addChild(btn);
		});
	}

	private renderMinimap() {
		this.minimapGraphics.clear();

		// Fondo del minimapa
		this.minimapGraphics.beginFill(0x000000, 0.8);
		this.minimapGraphics.drawRect(0, 0, this.MINIMAP_SIZE, this.MINIMAP_SIZE);
		this.minimapGraphics.endFill();

		const pixelSize = this.MINIMAP_SIZE / this.GRID_SIZE;

		for (let y = 0; y < this.GRID_SIZE; y++) {
			for (let x = 0; x < this.GRID_SIZE; x++) {
				// Solo dibujar si está explorado
				if (!this.visibility[x][y]) {
					continue;
				}

				const tile = this.grid[x][y];
				let color = 0x333333; // Color base para suelos explorados

				// Asignar colores según el tipo de tile
				if (tile === TileType.HEART) {
					color = 0xff0000;
				} // Centro Rojo
				else if (tile === TileType.GOLD_WALL) {
					color = 0xffff00;
				} // Oro Amarillo
				else if (tile === TileType.WALL) {
					color = 0x555555;
				} // Paredes Gris
				else if (tile === TileType.FLOOR) {
					color = 0x222222;
				} // Suelos Gris oscuro

				this.minimapGraphics.beginFill(color);
				this.minimapGraphics.drawRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
				this.minimapGraphics.endFill();
			}
		}

		// Dibujar a los minions como puntos verdes brillantes
		for (const m of this.minions) {
			if (this.visibility[m.gx][m.gy]) {
				this.minimapGraphics.beginFill(0x00ff00);
				this.minimapGraphics.drawRect(m.gx * pixelSize, m.gy * pixelSize, pixelSize * 1.5, pixelSize * 1.5);
				this.minimapGraphics.endFill();
			}
		}
	}

	private handleZoom(e: WheelEvent) {
		e.preventDefault();
		const zoomSpeed = 0.001;
		const minZoom = 0.2; // Un poco más de alejamiento para mapas grandes
		const maxZoom = 3.0;

		// Calculamos el factor de cambio
		const delta = -e.deltaY * zoomSpeed;
		const oldScale = this.worldContainer.scale.x;
		const newScale = Math.min(Math.max(oldScale + delta, minZoom), maxZoom);

		// Aplicamos la escala uniformemente
		this.worldContainer.scale.set(newScale);
	}

	private onPointerDown(e: any) {
		const pos = e.data.global;
		const button = e.data.originalEvent.button;

		if (button === 2) {
			// Click Derecho: Iniciar arrastre (Cámara)
			this.isDragging = true;
			this.lastDragPoint.copyFrom(pos);
		} else if (button === 0) {
			// Click Izquierdo: Minar
			const localPos = this.worldContainer.toLocal(pos);
			this.handleInteraction(localPos.x, localPos.y);
		}
	}

	private onPointerMove(e: any) {
		if (this.isDragging) {
			const pos = e.data.global;

			// Dividimos por la escala para que el movimiento sea 1:1 con el mouse
			const dx = (pos.x - this.lastDragPoint.x) / this.worldContainer.scale.x;
			const dy = (pos.y - this.lastDragPoint.y) / this.worldContainer.scale.y;

			// En lugar de mover X/Y del contenedor, movemos el PIVOT.
			// Esto mantiene el zoom centrado donde sea que arrastres la cámara.
			this.worldContainer.pivot.x -= dx;
			this.worldContainer.pivot.y -= dy;

			this.lastDragPoint.copyFrom(pos);
		}
	}

	private onPointerUp() {
		this.isDragging = false;
	}

	private handleInteraction(worldX: number, worldY: number) {
		const tryGetTile = (offY: number) => {
			const x = worldX;
			const y = worldY + offY;
			const gx = Math.floor((x / this.T_WIDTH_HALF + y / this.T_HEIGHT_HALF) / 2 + 0.5);
			const gy = Math.floor((y / this.T_HEIGHT_HALF - x / this.T_WIDTH_HALF) / 2 + 0.5);
			return { gx, gy };
		};

		let coords = tryGetTile(this.WALL_HEIGHT);

		// CAMBIO AQUÍ: Verificamos si es WALL o GOLD_WALL para la detección inicial
		const tileAtCoords = coords.gx >= 0 && coords.gx < this.GRID_SIZE && coords.gy >= 0 && coords.gy < this.GRID_SIZE ? this.grid[coords.gx][coords.gy] : null;

		if (tileAtCoords !== TileType.WALL && tileAtCoords !== TileType.GOLD_WALL) {
			coords = tryGetTile(0);
		}

		if (coords.gx >= 0 && coords.gx < this.GRID_SIZE && coords.gy >= 0 && coords.gy < this.GRID_SIZE) {
			const currentTile = this.grid[coords.gx][coords.gy];

			if (currentTile === TileType.WALL || currentTile === TileType.GOLD_WALL) {
				// Si es pared, siempre marcamos para minar (ignora herramienta de sala)
				this.markedTiles[coords.gx][coords.gy] = !this.markedTiles[coords.gx][coords.gy];
			} else if (currentTile !== TileType.HEART) {
				if (this.selectedTool === "MINE") {
					this.grid[coords.gx][coords.gy] = TileType.FLOOR;
				} else {
					this.grid[coords.gx][coords.gy] = this.selectedTool;
					// Revelar el área permanentemente al construir la sala
					this.revealArea(coords.gx, coords.gy);
				}
			}
		}
	}

	private renderDungeon() {
		this.dungeonLayer.clear();

		// 1. Calcular qué celdas están iluminadas actualmente
		const litTiles = new Set<string>();

		// El corazón siempre ilumina su área
		const c = Math.floor(this.GRID_SIZE / 2);
		this.markLitArea(c, c, litTiles);

		// Cada minion ilumina su posición actual
		for (const m of this.minions) {
			this.markLitArea(m.gx, m.gy, litTiles);
		}

		// --- NUEVO: LAS SALAS TAMBIÉN ILUMINAN ---
		for (let y = 0; y < this.GRID_SIZE; y++) {
			for (let x = 0; x < this.GRID_SIZE; x++) {
				const tile = this.grid[x][y];
				// Si el tile es LIBRARY, TRAINING o TORTURE (todos > FLOOR)
				if (tile >= TileType.LIBRARY) {
					// Esto hace que la propia sala y su radio brillen
					this.markLitArea(x, y, litTiles);
				}
			}
		}

		const placedTotems = new Set<string>(); // Para rastrear tótems en este frame

		// 2. Dibujar Suelos
		for (let y = 0; y < this.GRID_SIZE; y++) {
			for (let x = 0; x < this.GRID_SIZE; x++) {
				if (!this.visibility[x][y]) {
					continue;
				} // Negro total si no explorado

				const isLit = litTiles.has(`${x},${y}`);
				const tile = this.grid[x][y];
				const pos = this.gridToScreen(x, y);

				let color = COLORS.FLOOR;
				if (tile === TileType.HEART) {
					color = COLORS.HEART;
				} else if (tile === TileType.LIBRARY) {
					color = COLORS.LIBRARY;
				} else if (tile === TileType.TRAINING) {
					color = COLORS.TRAINING;
				} else if (tile === TileType.TORTURE) {
					color = COLORS.TORTURE;
				}

				// Si está explorado pero NO hay minions, oscurecemos el color
				if (!isLit) {
					color = this.multiplyColor(color, this.FOG_DIM_FACTOR);
				}

				this.drawIsometricTile(pos.x, pos.y, color);

				// --- LÓGICA DE TÓTEM DINÁMICO ---
				if (this.canPlaceTotem(x, y, placedTotems)) {
					this.drawTrainingTotem(pos.x, pos.y);
					placedTotems.add(`${x},${y}`);
					this.trainingPoints += 10; // Bono por tótem
				}
			}
		}
		// 2. Objetos con profundidad (Solo si son visibles)
		const depthObjects: any[] = [];
		for (let y = 0; y < this.GRID_SIZE; y++) {
			for (let x = 0; x < this.GRID_SIZE; x++) {
				if (!this.visibility[x][y]) {
					continue;
				} // <--- SALTAR SI HAY NIEBLA

				const tile = this.grid[x][y];
				if (tile === TileType.WALL || tile === TileType.GOLD_WALL) {
					depthObjects.push({ type: "wall", gx: x, gy: y, depth: x + y + 0.1 });
				}
			}
		}

		// Los minions siempre se dibujan (o podrías ocultarlos también si no están en área visible)
		for (const m of this.minions) {
			if (this.visibility[m.gx][m.gy]) {
				// Solo dibujar minion si está en zona visible
				const depth = m.visualY / this.T_HEIGHT_HALF;
				depthObjects.push({ type: "minion", data: m, depth: depth });
			}
		}

		depthObjects.sort((a, b) => a.depth - b.depth);

		// 3. Dibujar en orden
		for (const obj of depthObjects) {
			if (obj.type === "wall") {
				const isLit = litTiles.has(`${obj.gx},${obj.gy}`);
				const tileType = this.grid[obj.gx][obj.gy];
				let color = tileType === TileType.GOLD_WALL ? COLORS.GOLD_VEIN : COLORS.EARTH;

				if (this.markedTiles[obj.gx][obj.gy]) {
					color = 0xffaa00;
				}

				// Aplicar niebla a la pared si no está iluminada
				if (!isLit) {
					color = this.multiplyColor(color, this.FOG_DIM_FACTOR);
				}

				const screenPos = this.gridToScreen(obj.gx, obj.gy);
				this.drawWallSides(screenPos.x, screenPos.y, color);
				this.drawIsometricTile(screenPos.x, screenPos.y - this.WALL_HEIGHT, color);
			} else {
				// Los minions solo se dibujan si están en zona visible (ya lo tienes en tu código)
				this.drawMinionInLayer(obj.data);
			}
		}
	}

	private canPlaceTotem(cx: number, cy: number, placedTotems: Set<string>): boolean {
		// 1. Solo evaluamos si esta celda es de entrenamiento
		if (this.grid[cx][cy] !== TileType.TRAINING) {
			return false;
		}

		// 2. Verificar que haya espacio para un 3x3 (margen de 1 celda)
		if (cx < 1 || cx >= this.GRID_SIZE - 1 || cy < 1 || cy >= this.GRID_SIZE - 1) {
			return false;
		}

		// 3. Comprobar que las 9 celdas del bloque sean de entrenamiento
		for (let x = cx - 1; x <= cx + 1; x++) {
			for (let y = cy - 1; y <= cy + 1; y++) {
				if (this.grid[x][y] !== TileType.TRAINING) {
					return false;
				}
			}
		}

		// 4. Evitar "amontonamiento": No poner un tótem si hay otro muy cerca (radio de 2)
		for (const posStr of placedTotems) {
			const [px, py] = posStr.split(",").map(Number);
			const dist = Math.max(Math.abs(px - cx), Math.abs(py - cy));
			if (dist < 3) {
				return false;
			}
		}

		return true;
	}

	private markLitArea(gx: number, gy: number, litSet: Set<string>) {
		for (let x = gx - this.FOG_RADIUS; x <= gx + this.FOG_RADIUS; x++) {
			for (let y = gy - this.FOG_RADIUS; y <= gy + this.FOG_RADIUS; y++) {
				if (x >= 0 && x < this.GRID_SIZE && y >= 0 && y < this.GRID_SIZE) {
					litSet.add(`${x},${y}`);
				}
			}
		}
	}

	private drawMinionInLayer(m: Minion) {
		let bounce = 0;
		if (m.state === "MINING") {
			bounce = Math.abs(Math.sin(Date.now() * 0.02)) * 3;
		}

		// Sombra
		this.dungeonLayer.beginFill(0x000000, 0.2).drawEllipse(m.visualX, m.visualY, 6, 3);
		// Cuerpo
		this.dungeonLayer.beginFill(m.state === "MINING" ? 0xffff00 : 0x00ff00).drawCircle(m.visualX, m.visualY - 12 - bounce, 6);
		this.dungeonLayer.endFill();
	}

	private drawWallSides(x: number, y: number, color: number) {
		const w2 = this.T_WIDTH_HALF,
			h2 = this.T_HEIGHT_HALF,
			h = this.WALL_HEIGHT;
		// Cara izquierda
		this.dungeonLayer.beginFill(this.multiplyColor(color, 0.6)).drawPolygon([x - w2, y, x, y + h2, x, y + h2 - h, x - w2, y - h]);
		// Cara derecha
		this.dungeonLayer.beginFill(this.multiplyColor(color, 0.4)).drawPolygon([x + w2, y, x, y + h2, x, y + h2 - h, x + w2, y - h]);
		this.dungeonLayer.endFill();
	}

	private drawIsometricTile(x: number, y: number, color: number) {
		this.dungeonLayer.beginFill(color).lineStyle(1, 0x000000, 0.1);
		this.dungeonLayer.drawPolygon([x, y - this.T_HEIGHT_HALF, x + this.T_WIDTH_HALF, y, x, y + this.T_HEIGHT_HALF, x - this.T_WIDTH_HALF, y]).endFill();
	}

	private gridToScreen(gx: number, gy: number) {
		return { x: (gx - gy) * this.T_WIDTH_HALF, y: (gx + gy) * this.T_HEIGHT_HALF };
	}

	private updateMinion(m: Minion, dt: number) {
		// Al principio del update, el minion revela donde está parado
		this.revealArea(m.gx, m.gy);
		const targetPos = this.gridToScreen(m.gx, m.gy);

		switch (m.state) {
			case "IDLE":
				const job = this.findNearestMarked(m.gx, m.gy);
				if (job) {
					m.targetX = job.standX;
					m.targetY = job.standY;
					m.targetWallX = job.wallX;
					m.targetWallY = job.wallY;
					m.path = job.path; // Guardamos el camino calculado
					m.state = "MOVING_TO_WORK";
				} else if (Math.random() < 0.01) {
					this.moveMinionRandomly(m);
				}
				break;

			case "MOVING_TO_WORK":
				const visualDist = Math.abs(m.visualX - targetPos.x) + Math.abs(m.visualY - targetPos.y);

				// Solo intentamos movernos al siguiente tile si ya casi llegamos visualmente al actual
				if (visualDist < 1) {
					if (m.gx === m.targetX && m.gy === m.targetY) {
						// Llegamos al destino final (el suelo junto a la pared)
						m.state = "MINING";
						m.miningTimer = 100;
					} else if (m.path && m.path.length > 0) {
						// Tomamos el siguiente paso del camino azul
						const nextStep = m.path.shift()!;
						m.gx = nextStep.x;
						m.gy = nextStep.y;
					} else {
						// Por si acaso se queda sin camino pero no llegó
						m.state = "IDLE";
					}
				}
				break;

			case "MINING":
				// Seguridad: Si no hay objetivo, volver a IDLE
				if (m.targetWallX === undefined || m.targetWallY === undefined) {
					m.state = "IDLE";
					break;
				}

				const tx = m.targetWallX;
				const ty = m.targetWallY;

				// 1. Verificar si la pared todavía existe (por si otro minion la rompió justo antes)
				const tile = this.grid[tx][ty];
				if (tile !== TileType.WALL && tile !== TileType.GOLD_WALL) {
					m.state = "IDLE";
					break;
				}

				// 2. Aplicar "daño" al bloque.
				// Como esto ocurre en el update de CADA minion, el efecto es acumulativo.
				const miningPower = dt * 0.05; // Fuerza de picado por minion
				this.wallHealth[tx][ty] -= miningPower;

				// Feedback visual (chispas)
				if (Math.random() > 0.8) {
					this.drawSpark(m.visualX, m.visualY - 10);
				}

				// 3. Si la salud llega a cero, el bloque se rompe
				if (this.wallHealth[tx][ty] <= 0) {
					this.completeMining(tx, ty);
					m.state = "IDLE";
				}
				break;
		}
	}

	public override update(_dt: number): void {
		super.update(_dt);
		for (const m of this.minions) {
			const targetPos = this.gridToScreen(m.gx, m.gy);
			m.visualX += (targetPos.x - m.visualX) * 0.1;
			m.visualY += (targetPos.y - m.visualY) * 0.1;
			this.updateMinion(m, _dt);
		}
		this.renderDungeon();
		this.renderMinimap();
	}

	// --- Métodos de utilidad que se mantienen similares ---
	private initGrid() {
		for (let i = 0; i < this.GRID_SIZE; i++) {
			this.grid[i] = [];
			this.markedTiles[i] = [];
			this.visibility[i] = [];
			this.wallHealth[i] = []; // Inicializar la nueva matriz
			for (let j = 0; j < this.GRID_SIZE; j++) {
				this.grid[i][j] = TileType.WALL;
				this.markedTiles[i][j] = false;
				this.visibility[i][j] = false;

				// Asignar salud inicial según el tipo
				if (Math.random() < 0.03) {
					this.grid[i][j] = TileType.GOLD_WALL;
					this.wallHealth[i][j] = this.GOLD_WALL_HEALTH;
				} else {
					this.wallHealth[i][j] = this.BASE_WALL_HEALTH;
				}
			}
		}

		const c = Math.floor(this.GRID_SIZE / 2);
		this.grid[c][c] = TileType.HEART;

		// Revelar el área inicial del corazón
		this.revealArea(c, c);

		// El resto de tu lógica de FLOOR para el centro...
		for (let x = c - 1; x <= c + 1; x++) {
			for (let y = c - 1; y <= c + 1; y++) {
				if (this.grid[x][y] !== TileType.HEART) {
					this.grid[x][y] = TileType.FLOOR;
				}
			}
		}
	}

	private revealArea(gx: number, gy: number) {
		for (let x = gx - this.FOG_RADIUS; x <= gx + this.FOG_RADIUS; x++) {
			for (let y = gy - this.FOG_RADIUS; y <= gy + this.FOG_RADIUS; y++) {
				if (x >= 0 && x < this.GRID_SIZE && y >= 0 && y < this.GRID_SIZE) {
					this.visibility[x][y] = true;
				}
			}
		}
	}
	private spawnMinions(count: number) {
		const c = Math.floor(this.GRID_SIZE / 2);
		for (let i = 0; i < count; i++) {
			const pos = this.gridToScreen(c, c + 1);
			this.minions.push({
				gx: c,
				gy: c + 1,
				visualX: pos.x,
				visualY: pos.y,
				targetX: c,
				targetY: c + 1,
				state: "IDLE",
				miningTimer: 0,
				path: [],
			});
		}
	}

	private drawSpark(x: number, y: number) {
		const spark = new Graphics().beginFill(0xffd700).drawCircle(0, 0, 2).endFill();
		spark.x = x + (Math.random() - 0.5) * 15;
		spark.y = y + (Math.random() - 0.5) * 15;
		this.worldContainer.addChild(spark);
		setTimeout(() => !spark.destroyed && spark.destroy(), 300);
	}

	private findNearestMarked(minionGX: number, minionGY: number) {
		const queue: { x: number; y: number }[] = [{ x: minionGX, y: minionGY }];
		const visited = new Set<string>();
		const parentMap = new Map<string, { x: number; y: number }>();
		visited.add(`${minionGX},${minionGY}`);

		const directions = [
			[0, 1],
			[0, -1],
			[1, 0],
			[-1, 0],
		];

		while (queue.length > 0) {
			const curr = queue.shift()!;
			for (const [dx, dy] of directions) {
				const nx = curr.x + dx;
				const ny = curr.y + dy;

				if (nx < 0 || nx >= this.GRID_SIZE || ny < 0 || ny >= this.GRID_SIZE) {
					continue;
				}
				const key = `${nx},${ny}`;
				if (visited.has(key)) {
					continue;
				}

				// --- CAMBIO AQUÍ: Ahora detecta tanto WALL como GOLD_WALL ---
				const tile = this.grid[nx][ny];
				if (tile === TileType.WALL || tile === TileType.GOLD_WALL) {
					if (this.markedTiles[nx][ny]) {
						// Reconstruir camino... (el resto de tu lógica es correcta)
						const path: { x: number; y: number }[] = [];
						let temp = curr;
						while (temp.x !== minionGX || temp.y !== minionGY) {
							path.push({ x: temp.x, y: temp.y });
							temp = parentMap.get(`${temp.x},${temp.y}`)!;
						}
						path.reverse();

						return {
							wallX: nx,
							wallY: ny,
							standX: curr.x,
							standY: curr.y,
							path: path,
						};
					}
					continue; // Si es pared pero no está marcada, es un obstáculo infranqueable
				}

				visited.add(key);
				parentMap.set(key, curr);
				queue.push({ x: nx, y: ny });
			}
		}
		return null;
	}

	private completeMining(x: number, y: number) {
		const tile = this.grid[x][y];

		// Si el bloque ya no es pared (porque alguien lo rompió un milisegundo antes), salimos
		if (tile !== TileType.WALL && tile !== TileType.GOLD_WALL) {
			return;
		}

		const reward = tile === TileType.GOLD_WALL ? 100 : 10;
		this.grid[x][y] = TileType.FLOOR;
		this.markedTiles[x][y] = false;
		this.gold += reward;
		this.uiText.text = `ORO: ${this.gold}`;

		// Explosión de chispas según el valor
		const sparkCount = tile === TileType.GOLD_WALL ? 15 : 5;
		const pos = this.gridToScreen(x, y);
		for (let i = 0; i < sparkCount; i++) {
			this.drawSpark(pos.x, pos.y);
		}
	}

	private moveMinionRandomly(m: Minion) {
		const d = [
			[0, 1],
			[0, -1],
			[1, 0],
			[-1, 0],
		][Math.floor(Math.random() * 4)];
		const nx = m.gx + d[0],
			ny = m.gy + d[1];
		if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE && this.grid[nx][ny] !== TileType.WALL) {
			m.gx = nx;
			m.gy = ny;
		}
	}

	private createUI() {
		const style = new TextStyle({ fill: "#FFD700", fontSize: 18, fontWeight: "bold" });
		this.uiText = new Text(`ORO: 0`, style);
		this.uiText.position.set(20, 20);
		this.uiLayer.addChild(this.uiText);

		// Texto de ayuda en lugar de botones
		const helpText = new Text("Click Izquierdo: Marcar para minar\nClick Derecho: Mover cámara", { fill: "#FFFFFF", fontSize: 12 });
		helpText.position.set(20, 60);
		this.uiLayer.addChild(helpText);

		// Crear y posicionar el minimapa arriba a la derecha
		this.minimapGraphics = new Graphics();
		this.addChild(this.minimapGraphics);
	}

	private multiplyColor(col: number, factor: number) {
		const r = Math.floor(((col >> 16) & 0xff) * factor),
			g = Math.floor(((col >> 8) & 0xff) * factor),
			b = Math.floor((col & 0xff) * factor);
		return (r << 16) | (g << 8) | b;
	}

	public override onResize(_newW: number, _newH: number): void {
		// Centramos el contenedor en la pantalla
		this.worldContainer.x = _newW / 2;
		this.worldContainer.y = _newH / 2;

		// Calculamos el centro de la grilla (donde está el corazón)
		const c = Math.floor(this.GRID_SIZE / 2);
		const centerPos = this.gridToScreen(c, c);

		// El pivot es el punto "ancla" del contenedor.
		// Al ponerlo en centerPos, ese punto de la grilla coincidirá con (x, y) de la pantalla.
		this.worldContainer.pivot.set(centerPos.x, centerPos.y);

		this.minimapGraphics.x = _newW * 0.8 - this.minimapGraphics.width;
		this.minimapGraphics.y = _newH * 0.05;
		if (this.roomMenu) {
			this.roomMenu.x = (_newW - this.roomMenu.width) / 2;
			this.roomMenu.y = _newH - 60;
		}
	}
}
