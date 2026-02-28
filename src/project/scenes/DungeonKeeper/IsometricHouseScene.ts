/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { Graphics } from "pixi.js";
import { Container, Sprite, Text, TextStyle, Point, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Easing, Tween } from "tweedle.js";

// Tipos de celda para la lógica de construcción del nivel
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
	PLAYER: 0x00ffcc,
};

interface Entity {
	gx: number;
	gy: number;
	gz: number;
	visualX: number;
	visualY: number;
}

/**
 * Escena que simula una casa isométrica 2D con múltiples niveles.
 * Utiliza texturas inclinadas para replicar la perspectiva del diorama.
 */
export class IsometricHouseScene extends PixiScene {
	private readonly GRID_SIZE = 15;
	private readonly NUM_LEVELS = 4;
	private readonly T_WIDTH_HALF = 40;
	private readonly T_HEIGHT_HALF = 24;
	private readonly LEVEL_HEIGHT = 60;

	private grid: TileType[][][] = [];
	private worldContainer: Container;
	private dungeonLayer: Container;
	private uiLayer: Container;

	private player: Entity;
	private uiText: Text;
	private isDragging = false;
	private lastDragPoint: Point = new Point();

	private spritePool: Sprite[] = [];
	private activeSprites: Sprite[] = [];
	public static readonly BUNDLES = ["isometric"];

	// Reemplaza playerLayer por esto:
	private playerSprite: Sprite;
	private isMoving: boolean = false; // <--- NUEVA VARIABLE
	constructor() {
		super();
		this.initWorld();

		this.worldContainer = new Container();
		this.addChild(this.worldContainer);

		this.dungeonLayer = new Container();
		this.worldContainer.addChild(this.dungeonLayer);

		// BORRAMOS la inicialización de this.playerLayer aquí

		this.uiLayer = new Container();
		this.addChild(this.uiLayer);

		this.setupEvents();
		this.createPlayer();
		this.createUI();
		this.centerCameraOnPlayer();
	}

	private initWorld() {
		for (let z = 0; z < this.NUM_LEVELS; z++) {
			this.grid[z] = [];
			for (let x = 0; x < this.GRID_SIZE; x++) {
				this.grid[z][x] = [];
				for (let y = 0; y < this.GRID_SIZE; y++) {
					this.grid[z][x][y] = TileType.EMPTY;
				}
			}
		}

		// Nivel 0: Sótano
		for (let x = 2; x < 8; x++) {
			for (let y = 2; y < 8; y++) {
				this.grid[0][x][y] = TileType.FLOOR;
				if (x === 2 || y === 2 || x === 7 || y === 7) {
					this.grid[0][x][y] = TileType.WALL;
				}
			}
		}
		this.grid[0][4][7] = TileType.STAIRS_UP;

		// Nivel 1: Sala
		for (let x = 2; x < 15; x++) {
			for (let y = 2; y < 15; y++) {
				this.grid[1][x][y] = TileType.WOOD_FLOOR;
				if (x === 2 || y === 2 || x === 14 || y === 14 || x === 6) {
					this.grid[1][x][y] = TileType.WALL;
				}

				this.grid[1][6][7] = TileType.FLOOR;
			}
		}

		this.grid[1][4][7] = TileType.STAIRS_DOWN;
		this.grid[1][7][2] = TileType.STAIRS_UP;

		// Nivel 2: Ático
		for (let x = 2; x < 10; x++) {
			for (let y = 2; y < 8; y++) {
				this.grid[2][x][y] = TileType.WOOD_FLOOR;
				if (x === 9 || y === 7 || y === 2 || x === 2) {
					this.grid[2][x][y] = TileType.WALL;
				}
			}
		}
		this.grid[2][5][3] = TileType.BED;
		this.grid[2][7][2] = TileType.STAIRS_DOWN;
		this.grid[2][5][4] = TileType.STAIRS_UP;

		// Nivel 3: Rooftop
		for (let x = 2; x < 10; x++) {
			for (let y = 2; y < 8; y++) {
				this.grid[3][x][y] = TileType.FLOOR;
				if (x === 9 || y === 7 || y === 2 || x === 2) {
					this.grid[2][x][y] = TileType.WALL;
				}
			}
		}
		this.grid[2][7][2] = TileType.STAIRS_DOWN;
		this.grid[3][5][4] = TileType.STAIRS_DOWN;
	}

	private createPlayer() {
		const pos = this.gridToScreen(4, 4, 0);
		this.player = {
			gx: 4,
			gy: 4,
			gz: 0,
			visualX: pos.x,
			visualY: pos.y,
		};

		// Dibujamos el gráfico del jugador UNA SOLA VEZ
		this.playerSprite = Sprite.from("player");
		this.playerSprite.scale.set(0.6);
		this.playerSprite.anchor.set(0.5, 0.9);
	}

	private getSpriteFromPool(): Sprite {
		let sprite = this.spritePool.pop();
		if (!sprite) {
			sprite = new Sprite();
		}
		sprite.visible = true;
		this.activeSprites.push(sprite);
		this.dungeonLayer.addChild(sprite);
		return sprite;
	}

	private resetSpritePool() {
		for (const sprite of this.activeSprites) {
			sprite.visible = false;
			sprite.tint = 0xffffff;
			sprite.skew.set(0, 0);
			sprite.rotation = 0;
			sprite.scale.set(1, 1);
			this.spritePool.push(sprite);
		}
		this.activeSprites = [];
		this.dungeonLayer.removeChildren();
	}

	private renderDungeon() {
		this.resetSpritePool();
		// this.playerLayer.clear(); <- Eliminar esta línea

		for (let z = 0; z < this.NUM_LEVELS; z++) {
			for (let sum = 0; sum < this.GRID_SIZE * 2; sum++) {
				for (let x = 0; x <= sum; x++) {
					const y = sum - x;
					if (x >= this.GRID_SIZE || y >= this.GRID_SIZE) {
						continue;
					}

					const tile = this.grid[z][x][y];

					// 1. Dibujamos el tile (si existe)
					if (tile !== TileType.EMPTY) {
						const pos = this.gridToScreen(x, y, z);
						const isAbove = z > this.player.gz;
						const alpha = isAbove ? 0.01 : 1.0;

						this.updateTileSprite(tile, pos.x, pos.y, alpha);
					}

					// 2. Insertamos al jugador JUSTO DESPUÉS de la celda donde está parado
					if (this.player.gx === x && this.player.gy === y && this.player.gz === z) {
						this.playerSprite.position.set(this.player.visualX, this.player.visualY);
						// Al hacer addChild, Pixi lo mueve automáticamente al final de la lista,
						// dejándolo ordenado perfectamente para la profundidad isométrica.
						this.dungeonLayer.addChild(this.playerSprite);
					}
				}
			}
		}
	}

	private updateTileSprite(type: TileType, x: number, y: number, alpha: number) {
		const edgeLength = Math.sqrt(Math.pow(this.T_WIDTH_HALF, 2) + Math.pow(this.T_HEIGHT_HALF, 2));
		const isoAngle = Math.atan(this.T_HEIGHT_HALF / this.T_WIDTH_HALF);
		if (type === TileType.WALL) {
			const wallHeight = this.LEVEL_HEIGHT * 0.8;

			// --- SOMBREADO DIRECCIONAL ---
			// Simulamos que la luz viene de arriba a la izquierda
			const colorTop = 0xffffff; // Luz directa (Suelo/Techo)
			const colorLeft = 0xcccccc; // Sombra media
			const colorRight = 0x686767; // Sombra profunda

			// 1. Cara Lateral Izquierda
			const leftSide = this.getSpriteFromPool();
			leftSide.texture = Texture.from("iso_pared");
			leftSide.anchor.set(0, 1); // Anclamos abajo a la izquierda local
			// Posicionamos exactamente en la esquina izquierda del rombo del suelo
			leftSide.position.set(x - this.T_WIDTH_HALF, y);
			leftSide.width = edgeLength; // Pixi estirará la diagonal automáticamente
			leftSide.height = wallHeight;
			leftSide.rotation = 0;
			leftSide.skew.set(0, isoAngle); // Sesgo hacia abajo a la derecha
			leftSide.tint = colorLeft;
			leftSide.alpha = alpha;

			// 2. Cara Lateral Derecha
			const rightSide = this.getSpriteFromPool();
			rightSide.texture = Texture.from("iso_pared");
			rightSide.anchor.set(0, 1); // Anclamos abajo a la izquierda local
			// Posicionamos exactamente en la punta inferior del rombo del suelo
			rightSide.position.set(x, y + this.T_HEIGHT_HALF);
			rightSide.width = edgeLength;
			rightSide.height = wallHeight;
			rightSide.rotation = 0;
			rightSide.skew.set(0, -isoAngle); // Sesgo hacia arriba a la derecha
			rightSide.tint = colorRight;
			rightSide.alpha = alpha;

			// 3. Cara Superior (Remate)
			const topSide = this.getSpriteFromPool();
			topSide.texture = Texture.from("iso_top_pared");
			this.applyIsometricTransform(topSide, x, y - wallHeight);
			topSide.tint = colorTop;
			topSide.alpha = alpha;
		} else {
			// --- SUELO ---
			const floor = this.getSpriteFromPool();
			const texName = type === TileType.WOOD_FLOOR || type === TileType.BED ? "iso_floor" : "iso_suelo";
			floor.texture = Texture.from(texName);

			// 1. Aplicamos la transformación base que armamos antes
			this.applyIsometricTransform(floor, x, y);

			// 2. Reseteamos el color por defecto o aplicamos tintes especiales
			if (type === TileType.STAIRS_UP || type === TileType.STAIRS_DOWN) {
				const wallHeight = this.LEVEL_HEIGHT * 0.8;

				floor.texture = Texture.from("iso_stair_up");
				floor.rotation = 0;
				floor.width = edgeLength;
				floor.height = wallHeight;
				// Invertimos la textura verticalmente para las escaleras que bajan
				if (type === TileType.STAIRS_DOWN) {
					floor.texture = Texture.from("iso_stair_down");

					floor.scale.y *= -1;
				}
				// (Nota: Si ves que la textura original ya apuntaba hacia abajo,
				// simplemente mueve este *= -1 al bloque del STAIRS_UP).
			} else if (type === TileType.BED) {
				floor.tint = 0x9999ff;
			} else {
				floor.tint = 0xffffff; // Suelo normal sin sombra
			}

			floor.alpha = alpha;
		}
	}
	private applyIsometricTransform(sprite: Sprite, x: number, y: number) {
		sprite.anchor.set(0.5);
		sprite.position.set(x, y);

		// 1. Limpiamos cualquier rotación previa que rompa la matriz
		sprite.rotation = 0;

		// 2. Ángulos de inclinación (skew) basados en tu proporción isométrica
		const isoAngle = Math.atan(this.T_HEIGHT_HALF / this.T_WIDTH_HALF);
		sprite.skew.y = isoAngle;
		sprite.skew.x = Math.atan(-this.T_WIDTH_HALF / this.T_HEIGHT_HALF);

		// 3. Calculamos la hipotenusa (la longitud física de la arista del rombo)
		const edgeLength = Math.sqrt(Math.pow(this.T_WIDTH_HALF, 2) + Math.pow(this.T_HEIGHT_HALF, 2));

		// 4. Ajustamos la escala para que la textura original cubra exactamente la arista
		const texW = sprite.texture.width || 1;
		const texH = sprite.texture.height || 1;

		sprite.scale.set(edgeLength / texW, edgeLength / texH);
	}

	private gridToScreen(gx: number, gy: number, gz: number) {
		return {
			x: (gx - gy) * this.T_WIDTH_HALF,
			y: (gx + gy) * this.T_HEIGHT_HALF - gz * this.LEVEL_HEIGHT,
		};
	}

	private movePlayer(dx: number, dy: number) {
		if (this.isMoving) {
			return;
		} // Si ya se está moviendo, ignoramos el input

		const nx = this.player.gx + dx;
		const ny = this.player.gy + dy;
		let nz = this.player.gz;

		if (this.isValidMove(nx, ny, nz)) {
			const tile = this.grid[nz][nx][ny];

			if (tile === TileType.STAIRS_UP) {
				nz++;
			} else if (tile === TileType.STAIRS_DOWN) {
				nz--;
			}

			// Actualizamos la posición lógica de inmediato
			this.player.gx = nx;
			this.player.gy = ny;
			this.player.gz = nz;
			this.uiText.text = `Piso: ${this.player.gz}`;

			// Calculamos la posición visual destino en la pantalla
			const targetPos = this.gridToScreen(nx, ny, nz);

			// Bloqueamos nuevos movimientos
			this.isMoving = true;

			// Creamos la animación con tweedle.js
			new Tween(this.player)
				.to({ visualX: targetPos.x, visualY: targetPos.y }, 50) // 200 milisegundos
				.easing(Easing.Elastic.Out) // Un frenado suave al llegar a la casilla
				.onComplete(() => {
					this.isMoving = false; // Desbloqueamos el input al terminar
				})
				.start();
		}
	}

	private isValidMove(x: number, y: number, z: number): boolean {
		if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) {
			return false;
		}
		const tile = this.grid[z][x][y];
		return tile !== TileType.WALL && tile !== TileType.EMPTY;
	}

	public override update(_dt: number): void {
		super.update(_dt);
		const targetPos = this.gridToScreen(this.player.gx, this.player.gy, this.player.gz);
		this.player.visualX += (targetPos.x - this.player.visualX) * 0.2;
		this.player.visualY += (targetPos.y - this.player.visualY) * 0.2;
		this.centerCameraOnPlayer();
		this.renderDungeon();
	}

	private setupEvents() {
		this.eventMode = "static";
		window.addEventListener("keydown", (e) => {
			let dx = 0,
				dy = 0;
			if (e.key === "w" || e.key === "ArrowUp") {
				dy = -1;
			}
			if (e.key === "s" || e.key === "ArrowDown") {
				dy = 1;
			}
			if (e.key === "a" || e.key === "ArrowLeft") {
				dx = -1;
			}
			if (e.key === "d" || e.key === "ArrowRight") {
				dx = 1;
			}
			if (dx !== 0 || dy !== 0) {
				this.movePlayer(dx, dy);
			}
		});
		window.addEventListener("wheel", (e) => this.handleZoom(e), { passive: false });
		this.on("pointerdown", (e: any) => {
			if (e.data.originalEvent.button === 2) {
				this.isDragging = true;
				this.lastDragPoint.copyFrom(e.data.global);
			}
		});
		this.on("pointermove", (e) => {
			if (this.isDragging) {
				const pos = e.data.global;
				this.worldContainer.pivot.x -= (pos.x - this.lastDragPoint.x) / this.worldContainer.scale.x;
				this.worldContainer.pivot.y -= (pos.y - this.lastDragPoint.y) / this.worldContainer.scale.y;
				this.lastDragPoint.copyFrom(pos);
			}
		});
		this.on("pointerup", () => (this.isDragging = false));
		this.on("pointerupoutside", () => (this.isDragging = false));
	}

	private handleZoom(e: WheelEvent) {
		e.preventDefault();
		const delta = -e.deltaY * 0.001;
		const newScale = Math.min(Math.max(this.worldContainer.scale.x + delta, 0.2), 3.0);
		this.worldContainer.scale.set(newScale);
	}

	private centerCameraOnPlayer() {
		this.worldContainer.pivot.x += (this.player.visualX - this.worldContainer.pivot.x) * 0.04;
		this.worldContainer.pivot.y += (this.player.visualY - this.worldContainer.pivot.y) * 0.04;
	}

	private createUI() {
		const style = new TextStyle({ fill: "#ffffff", fontSize: 18, fontWeight: "bold" });
		this.uiText = new Text(`Piso: 0`, style);
		this.uiText.position.set(20, 20);
		this.uiLayer.addChild(this.uiText);
	}

	public override onResize(_newW: number, _newH: number): void {
		this.worldContainer.x = _newW / 2;
		this.worldContainer.y = _newH / 2;
	}
}
