/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Sprite, Text, TextStyle, Texture, Graphics, BLEND_MODES, AlphaFilter } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Tween } from "tweedle.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../../engine/utils/InteractableManager";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager } from "../../..";
import { IsometricHouseScene } from "./IsometricHouseScene";

// Tipos de celda adaptados
enum TileType {
	EMPTY = 0,
	FLOOR = 1,
	WALL = 2,
	STAIRS_UP = 3,
	STAIRS_DOWN = 4,
	BED = 5,
	WOOD_FLOOR = 6,
	GATE = 7,
	BARGATE = 8,
	CLEANBUCKET = 9,
	TORCH = 10,
	PRISONER = 11,
	PORTAL = 12,
}

interface Entity {
	gx: number;
	gy: number;
	gz: number;
	visualX: number;
	visualY: number;
}

/**
 * Escena Top-Down con perspectiva frontal (estilo 3/4) corregida.
 */
export class TopDownHouseScene extends PixiScene {
	private readonly GRID_SIZE = 15;
	private readonly NUM_LEVELS = 5;
	private readonly TILE_SIZE = 48;
	private readonly WALL_HEIGHT = 64;

	private grid: TileType[][][] = [];
	private worldContainer: Container;
	private dungeonLayer: Container;
	private uiLayer: Container;

	private player: Entity;
	private uiText: Text;
	private animator: StateMachineAnimator;
	private isMoving: boolean = false;

	private interactManagers: InteractableManager[] = [];
	private darknessContainer: Container;
	private lightHole: Sprite;

	private keys: Set<string> = new Set();
	private lastDashTime: number = 0;
	private readonly DASH_COOLDOWN: number = 500;

	private spritePool: Sprite[] = [];
	private activeSprites: Sprite[] = [];
	private activeEffects: { displayObject: Container; gx: number; gy: number; gz: number }[] = [];

	private uiBottomLeftLayer: Container = new Container();
	private uiTopRightLayer: Container = new Container();
	private minimapGraphics: Graphics;
	private discoveredTiles: boolean[][][] = [];
	public static readonly BUNDLES = ["isometric", "ggj", "donotdelete"];

	private levelNames: Record<number, string> = {
		0: "Sótano - Celda",
		1: "Planta Baja",
		2: "Entrepiso",
		3: "Prisionero",
		4: "Pasillo Profundo",
	};
	public savedPos: { gx: number; gy: number; gz: number };

	constructor(startPos?: { gx: number; gy: number; gz: number }) {
		super();
		this.worldContainer = new Container();
		this.addChild(this.worldContainer);

		for (let i = 0; i < this.NUM_LEVELS; i++) {
			this.interactManagers.push(new InteractableManager(this.worldContainer));
		}

		if (startPos) {
			// Guardar para usar en createPlayer()
			this.savedPos = startPos;
		}
		this.dungeonLayer = new Container();
		this.dungeonLayer.sortableChildren = true;
		this.worldContainer.addChild(this.dungeonLayer);

		this.uiLayer = new Container();
		this.addChild(this.uiLayer, this.uiBottomLeftLayer, this.uiTopRightLayer);

		this.startScene();
	}

	private async startScene() {
		await this.initWorld();
		this.createLighting();

		DialogueOverlayManager.init(this);
		this.setupEvents();
		this.createPlayer();
		this.renderDungeon();

		this.createUI();
		this.setupInteractions();
		this.centerCameraOnPlayer();

		SoundLib.playMusic("crickets", { loop: true, volume: 0.3 });
	}

	private async initWorld() {
		const levelFiles = [
			"./img/isometric/maps/level0.png",
			"./img/isometric/maps/level1.png",
			"./img/isometric/maps/level2.png",
			"./img/isometric/maps/level3.png",
			"./img/isometric/maps/level-1.png",
		];

		for (let z = 0; z < this.NUM_LEVELS; z++) {
			this.grid[z] = await this.loadLevelFromImage(levelFiles[z]);
			this.discoveredTiles[z] = [];
			for (let x = 0; x < this.GRID_SIZE; x++) {
				this.discoveredTiles[z][x] = new Array(this.GRID_SIZE).fill(false);
			}
		}
	}

	private createPlayer() {
		const startGX = this.savedPos?.gx ?? 4;
		const startGY = this.savedPos?.gy ?? 4;
		const startGZ = this.savedPos?.gz ?? 0;

		const pos = this.gridToScreen(startGX, startGY); // Nota: TopDown no usa GZ en gridToScreen
		this.player = { gx: startGX, gy: startGY, gz: startGZ, visualX: pos.x, visualY: pos.y };

		this.animator = new StateMachineAnimator();
		this.animator.scale.set(0.18);

		this.animator.addState(
			"idle",
			Array.from({ length: 20 }, (_, i) => Texture.from(`idle${i.toString().padStart(2, "0")}`)),
			0.5,
			true
		);
		this.animator.addState(
			"walk",
			Array.from({ length: 20 }, (_, i) => Texture.from(`walk${i.toString().padStart(2, "0")}`)),
			1,
			true
		);
		this.animator.addState(
			"dash",
			Array.from({ length: 15 }, (_, i) => Texture.from(`dash${i.toString().padStart(2, "0")}`)),
			1.2,
			false
		);

		this.animator.playState("idle");
		this.animator.anchor.set(0.5, 0.7);
	}

	private gridToScreen(gx: number, gy: number) {
		return {
			x: gx * this.TILE_SIZE,
			y: gy * this.TILE_SIZE,
		};
	}

	private renderDungeon() {
		this.resetSpritePool();

		const z = this.player.gz;
		for (let y = 0; y < this.GRID_SIZE; y++) {
			for (let x = 0; x < this.GRID_SIZE; x++) {
				const tile = this.grid[z][x][y];
				if (tile === TileType.EMPTY) {
					continue;
				}

				const pos = this.gridToScreen(x, y);
				this.drawTile(tile, pos.x, pos.y, x, y, z);
			}
		}

		// Re-añadir al jugador y actualizar su profundidad para evitar z-fighting
		this.dungeonLayer.addChild(this.animator);
		this.animator.position.set(this.player.visualX + this.TILE_SIZE / 2, this.player.visualY + this.TILE_SIZE / 2);

		// El zIndex del jugador tiene un pequeño offset (+5) para estar sobre el suelo pero bajo paredes de la fila siguiente
		this.animator.zIndex = this.animator.y * 100 + 5;

		for (const eff of this.activeEffects) {
			this.dungeonLayer.addChild(eff.displayObject);
			eff.displayObject.zIndex = eff.displayObject.y * 100 + 10;
		}
	}

	private drawTile(type: TileType, px: number, py: number, _gx: number, _gy: number, _gz: number) {
		const baseDepth = py * 100; // Usamos solo py para la fila

		// --- SUELO ---
		const floor = this.getSpriteFromPool();
		floor.texture = type === TileType.WOOD_FLOOR || type === TileType.BED ? Texture.from("iso_floor") : Texture.from("iso_suelo");
		floor.position.set(px, py);
		// Un pixel extra de solapamiento evita las líneas de costura (gaps)
		floor.width = this.TILE_SIZE + 1;
		floor.height = this.TILE_SIZE + 1;
		floor.zIndex = baseDepth - 100; // Siempre muy por debajo de cualquier objeto

		if (type === TileType.WALL) {
			// Frente de pared
			const wallFront = this.getSpriteFromPool();
			wallFront.texture = Texture.from("iso_pared");
			wallFront.position.set(px, py + 30);
			wallFront.width = this.TILE_SIZE + 1;
			wallFront.height = this.WALL_HEIGHT;
			wallFront.anchor.set(0, 0.7);
			wallFront.zIndex = baseDepth + 20;
			wallFront.tint = 0x999999;

			// Tapa de pared
			const wallTop = this.getSpriteFromPool();
			wallTop.texture = Texture.from("iso_top_pared");
			wallTop.position.set(px, py - this.WALL_HEIGHT);
			wallTop.width = this.TILE_SIZE + 1;
			wallTop.height = this.TILE_SIZE;
			wallTop.zIndex = baseDepth + 21;
		}

		if (type === TileType.PRISONER) {
			const prisoner = this.getSpriteFromPool();
			prisoner.texture = Texture.from("prisoner");
			prisoner.scale.set(0.15);
			prisoner.anchor.set(0.5, 0.85);
			prisoner.position.set(px + this.TILE_SIZE / 2, py + this.TILE_SIZE / 2);
			prisoner.zIndex = baseDepth + 10;
		}

		if (type === TileType.TORCH) {
			const torch = this.getSpriteFromPool();
			torch.texture = Texture.from("iso_torch");
			torch.scale.set(0.4);
			torch.anchor.set(0.5, 1);
			torch.position.set(px + this.TILE_SIZE / 2, py);
			torch.zIndex = baseDepth + 25;
		}
	}

	private movePlayer(dx: number, dy: number, attemptDash: boolean = false) {
		if (this.isMoving) {
			return;
		}

		const nx = this.player.gx + dx;
		const ny = this.player.gy + dy;

		if (!this.isValidMove(nx, ny)) {
			return;
		}

		let finalX = nx;
		let finalY = ny;
		let isDashing = false;

		if (attemptDash) {
			const dnx = nx + dx;
			const dny = ny + dy;
			if (this.isValidMove(dnx, dny)) {
				finalX = dnx;
				finalY = dny;
				isDashing = true;
			}
		}

		this.player.gx = finalX;
		this.player.gy = finalY;
		this.isMoving = true;

		if (isDashing) {
			this.animator.playState("dash");
			this.lastDashTime = Date.now();
			SoundLib.playSound("dash", { volume: 0.2 });
		} else {
			this.animator.playState("walk");
		}

		if (dx !== 0) {
			this.animator.scale.x = Math.abs(this.animator.scale.x) * (dx > 0 ? 1 : -1);
		}

		const targetPos = this.gridToScreen(finalX, finalY);
		new Tween(this.player)
			.to({ visualX: targetPos.x, visualY: targetPos.y }, isDashing ? 150 : 250)
			.onComplete(() => {
				this.isMoving = false;
				this.animator.playState("idle");
				this.checkPortals();
			})
			.start();
	}

	private isValidMove(x: number, y: number): boolean {
		if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) {
			return false;
		}
		const tile = this.grid[this.player.gz][x][y];
		return tile !== TileType.WALL && tile !== TileType.EMPTY && tile !== TileType.PRISONER;
	}

	private checkPortals() {
		const tile = this.grid[this.player.gz][this.player.gx][this.player.gy];
		if (tile === TileType.STAIRS_UP && this.player.gz < this.NUM_LEVELS - 1) {
			this.changeFloor(this.player.gz + 1);
		} else if (tile === TileType.STAIRS_DOWN && this.player.gz > 0) {
			this.changeFloor(this.player.gz - 1);
		}
	}

	private changeFloor(newZ: number) {
		this.isMoving = true;
		new Tween(this.worldContainer)
			.to({ alpha: 0 }, 300)
			.onComplete(() => {
				this.player.gz = newZ;
				this.uiText.text = `Lugar: ${this.levelNames[newZ] || "Desconocido"}`;
				this.renderDungeon();
				new Tween(this.worldContainer)
					.to({ alpha: 1 }, 300)
					.onComplete(() => {
						this.isMoving = false;
					})
					.start();
			})
			.start();
	}

	public override update(_dt: number): void {
		if (!this.animator || !this.grid || this.grid.length === 0) {
			return;
		}

		super.update(_dt);
		this.animator.update(_dt);

		if (!this.isMoving && !DialogueOverlayManager.isOpen) {
			let dx = 0,
				dy = 0;
			if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) {
				dy = -1;
			} else if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) {
				dy = 1;
			}
			if (dy === 0) {
				if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) {
					dx = -1;
				} else if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) {
					dx = 1;
				}
			}

			if (dx !== 0 || dy !== 0) {
				const canDash = this.keys.has("Space") && Date.now() - this.lastDashTime > this.DASH_COOLDOWN;
				this.movePlayer(dx, dy, canDash);
			}
		}

		this.centerCameraOnPlayer();
		this.animator.position.set(this.player.visualX + this.TILE_SIZE / 2, this.player.visualY + this.TILE_SIZE / 2);
		this.animator.zIndex = this.animator.y * 100 + 5;
		this.updateLighting();
		this.updateMinimap();
	}

	private centerCameraOnPlayer() {
		const targetX = this.player.visualX + this.TILE_SIZE / 2;
		const targetY = this.player.visualY + this.TILE_SIZE / 2;
		this.worldContainer.pivot.x += (targetX - this.worldContainer.pivot.x) * 0.1;
		this.worldContainer.pivot.y += (targetY - this.worldContainer.pivot.y) * 0.1;
	}

	private createPerspectiveSwitcher() {
		const container = new Container();

		const bg = new Graphics().beginFill(0x222222, 0.9).lineStyle(2, 0xffffff, 0.5).drawRoundedRect(0, 0, 160, 45, 10).endFill();

		const text = new Text("VISTA ISOMÉTRICA", {
			fill: "#ffffff",
			fontSize: 14,
			fontWeight: "bold",
		});
		text.anchor.set(0.5);
		text.position.set(80, 22.5);

		container.addChild(bg, text);
		container.eventMode = "static";
		container.cursor = "pointer";

		container.on("pointerover", () => {
			bg.tint = 0x444444;
		});
		container.on("pointerout", () => {
			bg.tint = 0xffffff;
		});

		container.on("pointertap", () => {
			Manager.changeScene(IsometricHouseScene as any, {
				sceneParams: [
					{
						gx: this.player.gx,
						gy: this.player.gy,
						gz: this.player.gz,
					},
				],
			});
		});

		container.position.set(20, 60);
		this.uiLayer.addChild(container);
	}

	private createUI() {
		const style = new TextStyle({ fill: "#ffffff", fontSize: 18, fontWeight: "bold", dropShadow: true, dropShadowDistance: 2 });
		this.uiText = new Text(`Lugar: Sótano`, style);
		this.uiText.position.set(20, 20);
		this.uiLayer.addChild(this.uiText);

		this.minimapGraphics = new Graphics();
		this.uiTopRightLayer.addChild(this.minimapGraphics);

		this.createPerspectiveSwitcher();
	}

	private setupEvents() {
		this.eventMode = "static";
		window.addEventListener("keydown", (e) => this.keys.add(e.code));
		window.addEventListener("keyup", (e) => this.keys.delete(e.code));
		window.addEventListener("wheel", (e) => this.handleZoom(e), { passive: false });
	}

	private setupInteractions() {
		const pPos = this.gridToScreen(6, 3);
		this.interactManagers[3].add(pPos.x, pPos.y, () => {
			DialogueOverlayManager.talk("Prisionero: ¿Has venido a liberarme?");
		});
	}

	private updateMinimap() {
		const z = this.player.gz;
		const px = this.player.gx;
		const py = this.player.gy;

		for (let dx = -3; dx <= 3; dx++) {
			for (let dy = -3; dy <= 3; dy++) {
				const nx = px + dx,
					ny = py + dy;
				if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE) {
					this.discoveredTiles[z][nx][ny] = true;
				}
			}
		}

		this.minimapGraphics.clear();
		const mSize = 6;
		this.minimapGraphics.beginFill(0x000000, 0.6).drawRect(0, 0, this.GRID_SIZE * mSize, this.GRID_SIZE * mSize);

		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let y = 0; y < this.GRID_SIZE; y++) {
				if (this.discoveredTiles[z][x][y]) {
					const t = this.grid[z][x][y];
					if (t === TileType.WALL) {
						this.minimapGraphics.beginFill(0x666666).drawRect(x * mSize, y * mSize, mSize, mSize);
					} else if (t !== TileType.EMPTY) {
						this.minimapGraphics.beginFill(0x222222).drawRect(x * mSize, y * mSize, mSize, mSize);
					}
				}
			}
		}
		this.minimapGraphics.beginFill(0x00ffff).drawCircle(px * mSize + mSize / 2, py * mSize + mSize / 2, mSize / 2);
	}

	private createLighting() {
		this.darknessContainer = new Container();
		const dark = new Graphics().beginFill(0x00000a, 0.9).drawRect(-5000, -5000, 10000, 10000).endFill();
		this.darknessContainer.addChild(dark);

		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 400;
		const ctx = canvas.getContext("2d")!;
		const grad = ctx.createRadialGradient(200, 200, 20, 200, 200, 200);
		grad.addColorStop(0, "rgba(255,255,255,1)");
		grad.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, 400, 400);

		this.lightHole = new Sprite(Texture.from(canvas));
		this.lightHole.anchor.set(0.5);
		this.lightHole.blendMode = BLEND_MODES.ERASE;
		this.darknessContainer.addChild(this.lightHole);
		this.darknessContainer.filters = [new AlphaFilter()];
		this.worldContainer.addChild(this.darknessContainer);
	}

	private updateLighting() {
		if (this.animator) {
			this.lightHole.position.set(this.animator.x, this.animator.y - 20);
		}
	}

	private async loadLevelFromImage(url: string): Promise<TileType[][]> {
		return new Promise((resolve) => {
			const img = new Image();
			img.src = url;
			img.onload = () => {
				const canvas = document.createElement("canvas");
				canvas.width = canvas.height = this.GRID_SIZE;
				const ctx = canvas.getContext("2d")!;
				ctx.drawImage(img, 0, 0);
				const data = ctx.getImageData(0, 0, this.GRID_SIZE, this.GRID_SIZE).data;
				const level: TileType[][] = [];
				for (let x = 0; x < this.GRID_SIZE; x++) {
					level[x] = [];
					for (let y = 0; y < this.GRID_SIZE; y++) {
						const i = (y * this.GRID_SIZE + x) * 4;
						level[x][y] = this.getColorMapping(data[i], data[i + 1], data[i + 2]);
					}
				}
				resolve(level);
			};
		});
	}

	private getColorMapping(r: number, g: number, b: number): TileType {
		const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase();

		switch (hex) {
			case "808080":
				return TileType.WALL;
			case "FF00FF":
				return TileType.PORTAL; // Magenta para portales
			case "FFFFFF":
				return TileType.FLOOR;
			case "8B4513":
				return TileType.WOOD_FLOOR;
			case "FF0000":
				return TileType.PRISONER;
			case "FFFF00":
				return TileType.TORCH;
			case "00FFF0":
				return TileType.BARGATE;
			case "00FF00":
				return TileType.STAIRS_UP;
			case "0000FF":
				return TileType.STAIRS_DOWN;
			case "FFA500":
				return TileType.GATE;
			case "000000":
			default:
				return TileType.EMPTY;
		}
	}

	private getSpriteFromPool(): Sprite {
		const s = this.spritePool.pop() || new Sprite();

		// RESET TOTAL DE PROPIEDADES
		s.visible = true;
		s.tint = 0xffffff; // Reset color
		s.alpha = 1; // Reset transparencia
		s.anchor.set(0, 0); // Reset anchor al top-left por defecto
		s.scale.set(1, 1); // Reset escala
		s.width = this.TILE_SIZE; // Tamaño base
		s.height = this.TILE_SIZE; // Tamaño base
		s.zIndex = 0; // Reset profundidad

		this.activeSprites.push(s);
		this.dungeonLayer.addChild(s);
		return s;
	}

	private resetSpritePool() {
		for (const s of this.activeSprites) {
			s.visible = false;
			this.spritePool.push(s);
		}
		this.activeSprites = [];
		this.dungeonLayer.removeChildren();
	}

	private handleZoom(_e: WheelEvent) {
		_e.preventDefault();
		const delta = -_e.deltaY * 0.001;
		const newScale = Math.min(Math.max(this.worldContainer.scale.x + delta, 1), 5.0);
		this.worldContainer.scale.set(newScale);
	}

	public override onResize(_w: number, _h: number): void {
		this.worldContainer.position.set(_w / 2, _h / 2);
		ScaleHelper.setScaleRelativeToIdeal(this.uiTopRightLayer, _w, _h, 1920, 1080, ScaleHelper.FIT);
		this.uiTopRightLayer.position.set(_w - 150 * this.uiTopRightLayer.scale.x, 20);
	}
}
