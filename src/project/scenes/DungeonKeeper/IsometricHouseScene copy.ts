/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Graphics, Text, TextStyle, Point } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

enum TileType {
	EMPTY = 0,
	FLOOR = 1,
	WALL = 2,
	STAIRS_UP = 3,
	STAIRS_DOWN = 4,
	BED = 5,
	WOOD_FLOOR = 6,
}

const COLORS = {
	WALL_DARK: 0x4a3b31,
	WALL_LIGHT: 0x6d5a4d,
	FLOOR_STONE: 0x333333,
	FLOOR_WOOD: 0x5d4037,
	STAIRS: 0x8d6e63,
	PLAYER: 0x00ffcc,
	BED: 0x5c6bc0,
};

interface Entity {
	gx: number;
	gy: number;
	gz: number; // Nivel actual (0, 1, 2...)
	visualX: number;
	visualY: number;
	color: number;
}

export class IsometricHouseScene extends PixiScene {
	// Configuración de la Grilla Isométrica
	private readonly GRID_SIZE = 12;
	private readonly NUM_LEVELS = 3;
	private readonly T_WIDTH_HALF = 40;
	private readonly T_HEIGHT_HALF = 24;
	private readonly LEVEL_HEIGHT = 60; // Distancia vertical entre pisos
	private readonly WALL_HEIGHT = 50;

	private grid: TileType[][][] = []; // [z][x][y]

	private worldContainer: Container;
	private dungeonLayer: Graphics;
	private uiLayer: Container;

	private player: Entity;
	private uiText: Text;
	private isDragging = false;
	private lastDragPoint: Point = new Point();

	constructor() {
		super();
		this.initWorld();

		this.worldContainer = new Container();
		this.addChild(this.worldContainer);

		this.dungeonLayer = new Graphics();
		this.worldContainer.addChild(this.dungeonLayer);

		this.uiLayer = new Container();
		this.addChild(this.uiLayer);

		this.setupEvents();
		this.createPlayer();
		this.createUI();

		// Centrar cámara inicialmente
		this.centerCameraOnPlayer();
	}

	private initWorld() {
		// Inicializar grilla 3D vacía
		for (let z = 0; z < this.NUM_LEVELS; z++) {
			this.grid[z] = [];
			for (let x = 0; x < this.GRID_SIZE; x++) {
				this.grid[z][x] = [];
				for (let y = 0; y < this.GRID_SIZE; y++) {
					this.grid[z][x][y] = TileType.EMPTY;
				}
			}
		}

		// --- CONSTRUCCIÓN DEL NIVEL 0 (Sótano/Cocina) ---
		for (let x = 2; x < 8; x++) {
			for (let y = 2; y < 8; y++) {
				this.grid[0][x][y] = TileType.FLOOR;
				// Paredes en el "fondo"
				if (x === 2 || y === 2) {
					this.grid[0][x][y] = TileType.WALL;
				}
				if (x === 7 || y === 7) {
					this.grid[0][x][y] = TileType.WALL;
				}
			}
		}
		this.grid[0][4][7] = TileType.STAIRS_UP; // Sube al 1 en (4,7)

		// --- CONSTRUCCIÓN DEL NIVEL 1 (Sala de Estar) ---
		for (let x = 2; x < 8; x++) {
			for (let y = 2; y < 8; y++) {
				this.grid[1][x][y] = TileType.WOOD_FLOOR;
				if (x === 2 || y === 2) {
					this.grid[1][x][y] = TileType.WALL;
				}
				if (x === 7 || y === 7) {
					this.grid[1][x][y] = TileType.WALL;
				}
			}
		}
		this.grid[1][4][7] = TileType.STAIRS_DOWN; // Coincide con nivel 0
		this.grid[1][7][4] = TileType.STAIRS_UP; // Sube al 2 en (8,4)

		// --- CONSTRUCCIÓN DEL NIVEL 2 (Dormitorio) ---
		// Expandimos el rango X hasta 9 para que la escalera en (8,4) tenga suelo debajo
		for (let x = 2; x < 8; x++) {
			for (let y = 2; y < 7; y++) {
				this.grid[2][x][y] = TileType.WOOD_FLOOR;
				// Paredes del fondo para efecto diorama
				if (x === 8 || y === 6) {
					this.grid[2][x][y] = TileType.WALL;
				}
			}
		}
		this.grid[2][5][3] = TileType.BED;
		this.grid[2][7][4] = TileType.STAIRS_DOWN; // AHORA COINCIDE con la subida del nivel 1
	}

	private createPlayer() {
		const startGZ = 0;
		const startGX = 4;
		const startGY = 4;
		const pos = this.gridToScreen(startGX, startGY, startGZ);

		this.player = {
			gx: startGX,
			gy: startGY,
			gz: startGZ,
			visualX: pos.x,
			visualY: pos.y,
			color: COLORS.PLAYER,
		};
	}

	private setupEvents() {
		this.eventMode = "static";
		this.on("pointerdown", this.onPointerDown, this);
		this.on("pointermove", this.onPointerMove, this);
		this.on("pointerup", this.onPointerUp, this);
		this.on("pointerupoutside", this.onPointerUp, this);

		window.addEventListener("contextmenu", (e) => e.preventDefault());
		window.addEventListener("keydown", (e) => this.handleKeyboard(e));
		window.addEventListener("wheel", (e) => this.handleZoom(e), { passive: false });
	}

	private handleKeyboard(e: KeyboardEvent) {
		let dx = 0;
		let dy = 0;

		switch (e.key) {
			case "ArrowUp":
			case "w":
				dy = -1;
				break;
			case "ArrowDown":
			case "s":
				dy = 1;
				break;
			case "ArrowLeft":
			case "a":
				dx = -1;
				break;
			case "ArrowRight":
			case "d":
				dx = 1;
				break;
		}

		if (dx !== 0 || dy !== 0) {
			this.movePlayer(dx, dy);
		}
	}

	private movePlayer(dx: number, dy: number) {
		const nx = this.player.gx + dx;
		const ny = this.player.gy + dy;
		const nz = this.player.gz;

		if (this.isValidMove(nx, ny, nz)) {
			this.player.gx = nx;
			this.player.gy = ny;

			// Lógica de escaleras: detectamos si el tile actual es una escalera
			const tile = this.grid[nz][nx][ny];
			if (tile === TileType.STAIRS_UP) {
				this.player.gz++;
				this.uiText.text = `Piso: ${this.player.gz}`;
			} else if (tile === TileType.STAIRS_DOWN) {
				this.player.gz--;
				this.uiText.text = `Piso: ${this.player.gz}`;
			}
		}
	}

	private isValidMove(x: number, y: number, z: number): boolean {
		if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) {
			return false;
		}
		const tile = this.grid[z][x][y];
		// No se puede caminar sobre paredes ni vacío
		return tile !== TileType.WALL && tile !== TileType.EMPTY;
	}

	private gridToScreen(gx: number, gy: number, gz: number) {
		return {
			x: (gx - gy) * this.T_WIDTH_HALF,
			y: (gx + gy) * this.T_HEIGHT_HALF - gz * this.LEVEL_HEIGHT,
		};
	}

	private renderDungeon() {
		this.dungeonLayer.clear();

		// El orden de dibujo es CRÍTICO: de abajo (z) hacia arriba, de atrás (x+y) hacia adelante
		for (let z = 0; z < this.NUM_LEVELS; z++) {
			for (let sum = 0; sum < this.GRID_SIZE * 2; sum++) {
				for (let x = 0; x <= sum; x++) {
					const y = sum - x;
					if (x >= this.GRID_SIZE || y >= this.GRID_SIZE) {
						continue;
					}

					const tile = this.grid[z][x][y];
					if (tile === TileType.EMPTY) {
						continue;
					}

					const pos = this.gridToScreen(x, y, z);

					// Efecto de transparencia para pisos superiores al jugador
					const isAbove = z > this.player.gz;
					const alpha = isAbove ? 0.01 : 1.0;

					this.drawTileByType(tile, pos.x, pos.y, alpha);

					// Dibujar jugador en el momento justo del ciclo de profundidad
					if (this.player.gx === x && this.player.gy === y && this.player.gz === z) {
						this.drawPlayer(this.player.visualX, this.player.visualY);
					}
				}
			}
		}
	}

	private drawTileByType(type: TileType, x: number, y: number, alpha: number) {
		switch (type) {
			case TileType.FLOOR:
				this.drawIsometricFloor(x, y, COLORS.FLOOR_STONE, alpha);
				break;
			case TileType.WOOD_FLOOR:
				this.drawIsometricFloor(x, y, COLORS.FLOOR_WOOD, alpha);
				break;
			case TileType.WALL:
				this.drawWall(x, y, COLORS.WALL_LIGHT, alpha);
				break;
			case TileType.STAIRS_UP:
				this.drawIsometricFloor(x, y, COLORS.STAIRS, alpha);
				// Dibujar icono simple de flecha
				this.dungeonLayer.beginFill(0xffffff, alpha * 0.5);
				this.dungeonLayer.drawCircle(x, y, 5);
				break;
			case TileType.STAIRS_DOWN:
				this.drawIsometricFloor(x, y, COLORS.STAIRS, alpha);
				// Dibujar icono simple de flecha
				this.dungeonLayer.beginFill(0xffffff, alpha * 0.5);
				this.dungeonLayer.drawCircle(x, y, 5);
				break;
			case TileType.BED:
				this.drawIsometricFloor(x, y, COLORS.FLOOR_WOOD, alpha);
				this.drawBox(x, y - 5, 30, 15, COLORS.BED, alpha);
				break;
		}
	}

	private drawIsometricFloor(x: number, y: number, color: number, alpha: number) {
		this.dungeonLayer.beginFill(color, alpha).lineStyle(1, 0x000000, 0.1 * alpha);
		this.dungeonLayer.drawPolygon([x, y - this.T_HEIGHT_HALF, x + this.T_WIDTH_HALF, y, x, y + this.T_HEIGHT_HALF, x - this.T_WIDTH_HALF, y]).endFill();
	}

	private drawWall(x: number, y: number, color: number, alpha: number) {
		const w2 = this.T_WIDTH_HALF;
		const h2 = this.T_HEIGHT_HALF;
		const h = this.WALL_HEIGHT;

		// Lado Izquierdo
		this.dungeonLayer.beginFill(this.multiplyColor(color, 0.7), alpha);
		this.dungeonLayer.drawPolygon([x - w2, y, x, y + h2, x, y + h2 - h, x - w2, y - h]);

		// Lado Derecho
		this.dungeonLayer.beginFill(this.multiplyColor(color, 0.5), alpha);
		this.dungeonLayer.drawPolygon([x + w2, y, x, y + h2, x, y + h2 - h, x + w2, y - h]);

		// Parte Superior
		this.drawIsometricFloor(x, y - h, color, alpha);
	}

	private drawBox(x: number, y: number, w: number, h: number, color: number, alpha: number) {
		this.dungeonLayer
			.beginFill(color, alpha)
			.drawRoundedRect(x - w / 2, y - h / 2, w, h, 4)
			.endFill();
	}

	private drawPlayer(x: number, y: number) {
		// Sombra
		this.dungeonLayer.beginFill(0x000000, 0.3).drawEllipse(x, y, 10, 5);
		// Cuerpo (Cápsula)
		this.dungeonLayer.beginFill(COLORS.PLAYER);
		this.dungeonLayer.drawRoundedRect(x - 8, y - 35, 16, 30, 8);
		// Ojos
		this.dungeonLayer
			.beginFill(0x000000)
			.drawCircle(x - 3, y - 28, 2)
			.drawCircle(x + 3, y - 28, 2);
		this.dungeonLayer.endFill();
	}

	public override update(_dt: number): void {
		super.update(_dt);

		// Suavizado del movimiento visual del jugador
		const targetPos = this.gridToScreen(this.player.gx, this.player.gy, this.player.gz);
		this.player.visualX += (targetPos.x - this.player.visualX) * 0.2;
		this.player.visualY += (targetPos.y - this.player.visualY) * 0.2;

		// La cámara sigue al jugador
		this.centerCameraOnPlayer();

		this.renderDungeon();
	}

	private centerCameraOnPlayer() {
		const lerpSpeed = 0.04;
		this.worldContainer.pivot.x += (this.player.visualX - this.worldContainer.pivot.x) * lerpSpeed;
		this.worldContainer.pivot.y += (this.player.visualY - this.worldContainer.pivot.y) * lerpSpeed;
	}

	private createUI() {
		const style = new TextStyle({ fill: "#ffffff", fontSize: 18, fontWeight: "bold", dropShadow: true, dropShadowDistance: 2 });
		this.uiText = new Text(`Piso: 0`, style);
		this.uiText.position.set(20, 20);
		this.uiLayer.addChild(this.uiText);

		const controls = new Text("WASD / Flechas: Moverse\nPisa los círculos blancos para usar escaleras", { fill: "#ffffff", fontSize: 14 });
		controls.position.set(20, 50);
		this.uiLayer.addChild(controls);
	}

	private onPointerDown(e: any) {
		if (e.data.originalEvent.button === 2) {
			this.isDragging = true;
			this.lastDragPoint.copyFrom(e.data.global);
		}
	}

	private onPointerMove(e: any) {
		if (this.isDragging) {
			const pos = e.data.global;
			const dx = (pos.x - this.lastDragPoint.x) / this.worldContainer.scale.x;
			const dy = (pos.y - this.lastDragPoint.y) / this.worldContainer.scale.y;
			this.worldContainer.pivot.x -= dx;
			this.worldContainer.pivot.y -= dy;
			this.lastDragPoint.copyFrom(pos);
		}
	}

	private onPointerUp() {
		this.isDragging = false;
	}

	private multiplyColor(col: number, factor: number) {
		const r = Math.floor(((col >> 16) & 0xff) * factor);
		const g = Math.floor(((col >> 8) & 0xff) * factor);
		const b = Math.floor((col & 0xff) * factor);
		return (r << 16) | (g << 8) | b;
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
	public override onResize(_newW: number, _newH: number): void {
		this.worldContainer.x = _newW / 2;
		this.worldContainer.y = _newH / 2;
	}
}
