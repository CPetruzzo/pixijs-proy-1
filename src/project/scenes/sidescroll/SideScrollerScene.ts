/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Sprite, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
// import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Tween } from "tweedle.js";

// Tipos de bloque para el Side-Scroller
enum TileType {
	EMPTY = 0,
	GROUND = 1, // Suelo sólido (colisión)
	PLATFORM = 2, // Plataforma atravesable (opcional)
	SPIKES = 3, // Trampa
	COIN = 4, // Item
	PLAYER_START = 5,
	BACK_WALL = 6, // Decoración de fondo (sin colisión)
	DOOR = 7, // Cambio de nivel
}

interface PlayerEntity {
	x: number;
	y: number;
	vx: number;
	vy: number;
	onGround: boolean;
}

export class SideScrollerScene2 extends PixiScene {
	private readonly TILE_SIZE = 64;
	private readonly GRAVITY = 0.1;
	private readonly JUMP_FORCE = -6;
	private readonly MOVE_SPEED = 4;

	private worldContainer: Container;
	private backgroundLayer: Container;
	private gameLayer: Container;
	private uiLayer: Container;

	private grid: TileType[][] = [];
	private player: PlayerEntity;
	private animator: StateMachineAnimator;

	private keys: Set<string> = new Set();
	private levelWidth = 0;
	public levelHeight = 0;
	private readonly PLAYER_WIDTH = 20; // Mitad del ancho
	private readonly PLAYER_HEIGHT = 108; // Altura total desde los pies
	public static readonly BUNDLES = ["isometric", "ggj", "platformer", "common", "donotdelete"];
	private currentAnimation: string = "idle";
	constructor() {
		super();

		// 1. Capas principales
		this.worldContainer = new Container();
		this.backgroundLayer = new Container(); // Para el parallax o paredes de fondo
		this.gameLayer = new Container(); // Bloques y jugador
		this.uiLayer = new Container();

		this.gameLayer.sortableChildren = true;
		this.worldContainer.addChild(this.backgroundLayer, this.gameLayer);
		this.addChild(this.worldContainer, this.uiLayer);

		this.startScene();
	}

	private async startScene() {
		// 2. Carga del nivel mediante imagen (1px = 1 bloque)
		// Cambia esta ruta a tu archivo .png de Luna Paint
		this.grid = await this.loadLevelFromImage("./img/levels/level_side_01.png");

		this.renderLevel();
		this.createPlayer();
		this.setupEvents();

		DialogueOverlayManager.init(this);
		// SoundLib.playMusic("forest_theme", { loop: true, volume: 0.2 });
	}

	private async loadLevelFromImage(url: string): Promise<TileType[][]> {
		return new Promise((resolve) => {
			const img = new Image();
			img.src = url;
			img.onload = () => {
				const canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				this.levelWidth = img.width * this.TILE_SIZE;
				this.levelHeight = img.height * this.TILE_SIZE;

				const ctx = canvas.getContext("2d")!;
				ctx.drawImage(img, 0, 0);

				const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
				const levelData: TileType[][] = [];

				// Inicializar matriz (X horizontal, Y vertical)
				for (let x = 0; x < img.width; x++) {
					levelData[x] = [];
					for (let y = 0; y < img.height; y++) {
						const i = (y * img.width + x) * 4;
						const r = imageData[i];
						const g = imageData[i + 1];
						const b = imageData[i + 2];
						levelData[x][y] = this.getColorMapping(r, g, b);
					}
				}
				resolve(levelData);
			};
		});
	}

	private getColorMapping(r: number, g: number, b: number): TileType {
		const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase();
		switch (hex) {
			case "FFFFFF":
				return TileType.GROUND; // Blanco: Suelo
			case "808080":
				return TileType.BACK_WALL; // Gris: Pared fondo
			case "FF0000":
				return TileType.SPIKES; // Rojo: Trampa
			case "FFFF00":
				return TileType.COIN; // Amarillo: Moneda
			case "00FF00":
				return TileType.PLAYER_START; // Verde: Inicio
			case "0000FF":
				return TileType.DOOR; // Azul: Puerta
			default:
				return TileType.EMPTY;
		}
	}

	private renderLevel() {
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				const type = this.grid[x][y];
				if (type === TileType.EMPTY || type === TileType.PLAYER_START) {
					continue;
				}

				const tile = Sprite.from(this.getTextureName(type));
				tile.x = x * this.TILE_SIZE;
				tile.y = y * this.TILE_SIZE;
				tile.width = this.TILE_SIZE;
				tile.height = this.TILE_SIZE;

				// Si es pared de fondo, lo mandamos a la capa de atrás
				if (type === TileType.BACK_WALL) {
					tile.tint = 0x777777; // Oscurecemos el fondo
					this.backgroundLayer.addChild(tile);
				} else {
					this.gameLayer.addChild(tile);
				}
			}
		}
	}

	private getTextureName(type: TileType): string {
		switch (type) {
			case TileType.GROUND:
				return "iso_pared";
			case TileType.BACK_WALL:
				return "iso_suelo";
			case TileType.SPIKES:
				return "iso_pared";
			case TileType.COIN:
				return "cleanbucket";
			case TileType.DOOR:
				return "iso_stair_down";
			default:
				return "";
		}
	}

	private createPlayer() {
		// Buscar spawn point en la grilla
		let startX = 100,
			startY = 100;
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				if (this.grid[x][y] === TileType.PLAYER_START) {
					startX = x * this.TILE_SIZE;
					startY = y * this.TILE_SIZE;
				}
			}
		}

		this.player = { x: startX, y: startY, vx: 0, vy: 0, onGround: false };

		this.animator = new StateMachineAnimator();
		this.animator.scale.set(0.45);

		// IDLE
		this.animator.addState(
			"idle",
			Array.from({ length: 20 }, (_, i) => Texture.from(`idle${i.toString().padStart(2, "0")}`)),
			0.5,
			true
		);

		// WALK
		this.animator.addState(
			"walk",
			Array.from({ length: 20 }, (_, i) => Texture.from(`walk${i.toString().padStart(2, "0")}`)),
			1,
			true
		);

		this.animator.addState(
			"dash",
			Array.from({ length: 15 }, (_, i) => Texture.from(`dash${i.toString().padStart(2, "0")}`)),
			1,
			true
		);

		// JUMP (Agregamos esto para evitar el error de la consola)
		// Si no tienes frames de salto, usa el frame "00" de idle por ahora
		this.animator.addState("jump", [Texture.from("idle00")], 1, false);

		this.animator.playState("idle");

		// IMPORTANTE: Anchor en 1.0 para que la base del sprite sea su coordenada Y
		this.animator.anchor.set(0.5, 0.78);
		this.gameLayer.addChild(this.animator);
	}

	public override update(_dt: number): void {
		// Si el diálogo está abierto O si el jugador aún no se ha creado, salimos.
		if (DialogueOverlayManager.isOpen || !this.player || !this.animator) {
			return;
		}

		super.update(_dt);
		this.handleInput();
		this.applyPhysics();
		this.resolveCollisions();
		this.updateAnimations();
		this.updateCamera();
	}

	private handleInput() {
		this.player.vx = 0;

		// Calculamos si está haciendo dash (Shift + en el suelo)
		const isDashing = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && this.player.onGround;
		const currentSpeed = isDashing ? this.MOVE_SPEED * 3 : this.MOVE_SPEED;

		if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) {
			this.player.vx = -currentSpeed;
			this.animator.scale.x = -Math.abs(this.animator.scale.x);
		} else if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) {
			this.player.vx = currentSpeed;
			this.animator.scale.x = Math.abs(this.animator.scale.x);
		}

		if ((this.keys.has("Space") || this.keys.has("ArrowUp")) && this.player.onGround) {
			this.player.vy = this.JUMP_FORCE;
			this.player.onGround = false;
		}
	}

	private isSolid(worldX: number, worldY: number): boolean {
		const gx = Math.floor(worldX / this.TILE_SIZE);
		const gy = Math.floor(worldY / this.TILE_SIZE);
		return this.grid[gx] && this.grid[gx][gy] === TileType.GROUND;
	}

	private applyPhysics() {
		// --- MOVIMIENTO HORIZONTAL ---
		this.player.x += this.player.vx;

		// Colisión lateral (Derecha)
		if (this.player.vx > 0) {
			if (this.isSolid(this.player.x + this.PLAYER_WIDTH, this.player.y - 10) || this.isSolid(this.player.x + this.PLAYER_WIDTH, this.player.y - this.PLAYER_HEIGHT + 10)) {
				// Si choca, lo pegamos al borde izquierdo del bloque
				this.player.x = Math.floor((this.player.x + this.PLAYER_WIDTH) / this.TILE_SIZE) * this.TILE_SIZE - this.PLAYER_WIDTH;
			}
		}
		// Colisión lateral (Izquierda)
		else if (this.player.vx < 0) {
			if (this.isSolid(this.player.x - this.PLAYER_WIDTH, this.player.y - 10) || this.isSolid(this.player.x - this.PLAYER_WIDTH, this.player.y - this.PLAYER_HEIGHT + 10)) {
				// Si choca, lo pegamos al borde derecho del bloque
				this.player.x = Math.ceil((this.player.x - this.PLAYER_WIDTH) / this.TILE_SIZE) * this.TILE_SIZE + this.PLAYER_WIDTH;
			}
		}

		// --- MOVIMIENTO VERTICAL ---
		this.player.vy += this.GRAVITY;
		this.player.y += this.player.vy;
		this.player.onGround = false;

		// Colisión Vertical (Suelo - Cayendo)
		if (this.player.vy >= 0) {
			if (this.isSolid(this.player.x - this.PLAYER_WIDTH + 5, this.player.y) || this.isSolid(this.player.x + this.PLAYER_WIDTH - 5, this.player.y)) {
				this.player.y = Math.floor(this.player.y / this.TILE_SIZE) * this.TILE_SIZE;
				this.player.vy = 0;
				this.player.onGround = true;
			}
		}
		// Colisión Vertical (Techo - Saltando)
		else if (this.player.vy < 0) {
			if (
				this.isSolid(this.player.x - this.PLAYER_WIDTH + 5, this.player.y - this.PLAYER_HEIGHT) ||
				this.isSolid(this.player.x + this.PLAYER_WIDTH - 5, this.player.y - this.PLAYER_HEIGHT)
			) {
				this.player.y = Math.ceil((this.player.y - this.PLAYER_HEIGHT) / this.TILE_SIZE) * this.TILE_SIZE + this.PLAYER_HEIGHT;
				this.player.vy = 0;
			}
		}
	}

	private resolveCollisions() {
		// Detectar si el centro del jugador toca una trampa o moneda
		const gx = Math.floor(this.player.x / this.TILE_SIZE);
		const gy = Math.floor((this.player.y - 10) / this.TILE_SIZE);

		if (this.grid[gx]) {
			if (this.grid[gx][gy] === TileType.SPIKES) {
				this.respawn();
			}
			// Aquí podrías añadir lógica para COIN o DOOR
		}
	}
	// con esto era que no hacia falta saltar para caminar

	// private applyPhysics() {
	// 	this.player.vy += this.GRAVITY;
	// 	this.player.x += this.player.vx;
	// 	this.player.y += this.player.vy;
	// 	this.player.onGround = false;
	// }

	// private resolveCollisions() {
	// 	// Colisión simple basada en grilla (AABB)
	// 	const left = Math.floor((this.player.x - 20) / this.TILE_SIZE);
	// 	const right = Math.floor((this.player.x + 20) / this.TILE_SIZE);
	// 	const top = Math.floor((this.player.y - 60) / this.TILE_SIZE);
	// 	const bottom = Math.floor(this.player.y / this.TILE_SIZE);

	// 	// Revisar bloques cercanos
	// 	for (let x = left; x <= right; x++) {
	// 		for (let y = top; y <= bottom; y++) {
	// 			if (this.grid[x] && this.grid[x][y] === TileType.GROUND) {
	// 				// Colisión con suelo (pies)
	// 				if (this.player.vy > 0 && this.player.y > y * this.TILE_SIZE) {
	// 					this.player.y = y * this.TILE_SIZE;
	// 					this.player.vy = 0;
	// 					this.player.onGround = true;
	// 				}
	// 			}
	// 			// Detectar trampas
	// 			if (this.grid[x] && this.grid[x][y] === TileType.SPIKES) {
	// 				this.respawn();
	// 			}
	// 		}
	// 	}
	// }

	private respawn() {
		// Efecto de muerte y reinicio
		this.player.vy = 0;
		this.startScene(); // Recarga lógica simple
	}

	private updateAnimations() {
		this.animator.position.set(this.player.x, this.player.y);
		this.animator.update(16);

		let newState = "idle";
		const isMoving = Math.abs(this.player.vx) > 0;
		const isHoldingShift = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");

		if (!this.player.onGround) {
			newState = "jump";
		} else if (isMoving) {
			// Si se mueve y presiona shift, ponemos DASH, si no, WALK
			newState = isHoldingShift ? "dash" : "walk";
		} else {
			newState = "idle";
		}

		// El truco de antes: solo cambiamos si el estado es diferente
		if (this.currentAnimation !== newState) {
			this.currentAnimation = newState;
			this.animator.playState(newState);
		}
	}

	private updateCamera() {
		const scale = this.worldContainer.scale.x;

		// 1. Calculamos la posición objetivo (Target)
		// Queremos que el (jugador * escala) quede en el (centro de la pantalla)
		// Usamos 0.5 para centrado total, o 0.6 para que se vea un poco más arriba.
		let targetX = window.innerWidth / 2 - this.player.x * scale;
		let targetY = window.innerHeight / 2 - (this.player.y - this.PLAYER_HEIGHT / 2) * scale;

		// 2. Calculamos los límites del mapa ESCALADOS
		const scaledLevelWidth = this.levelWidth * scale;
		const scaledLevelHeight = this.levelHeight * scale;

		// --- LÓGICA DE BORDES PARA X ---
		// Si el mapa es más pequeño que la pantalla (por mucho zoom out), lo centramos
		if (scaledLevelWidth < window.innerWidth) {
			targetX = (window.innerWidth - scaledLevelWidth) / 2;
		} else {
			// No permitir que la cámara vea más allá de la izquierda (0)
			// ni más allá de la derecha (ancho escalado - ancho pantalla)
			targetX = Math.min(0, Math.max(targetX, -(scaledLevelWidth - window.innerWidth)));
		}

		// --- LÓGICA DE BORDES PARA Y ---
		if (scaledLevelHeight < window.innerHeight) {
			targetY = (window.innerHeight - scaledLevelHeight) / 2;
		} else {
			targetY = Math.min(0, Math.max(targetY, -(scaledLevelHeight - window.innerHeight)));
		}

		// 3. Aplicamos el seguimiento suave (Lerp)
		// Nota: Usamos una velocidad mayor (0.1 o 0.2) para que no se sienta "lento" el seguimiento
		this.worldContainer.x += (targetX - this.worldContainer.x) * 0.1;
		this.worldContainer.y += (targetY - this.worldContainer.y) * 0.1;
	}

	private handleWheel(e: WheelEvent) {
		e.preventDefault(); // Evita el scroll de la página

		const zoomSpeed = 0.001; // Sensibilidad del zoom
		const minScale = 0.5; // Zoom mínimo (ver más lejos)
		const maxScale = 2.5; // Zoom máximo (ver más cerca)

		// e.deltaY es positivo cuando scrolleas hacia abajo (Zoom Out)
		// e.deltaY es negativo cuando scrolleas hacia arriba (Zoom In)
		let newScale = this.worldContainer.scale.x - e.deltaY * zoomSpeed;

		// Aplicamos los límites
		newScale = Math.max(minScale, Math.min(maxScale, newScale));

		// Aplicamos la escala a ambos ejes
		this.worldContainer.scale.set(newScale);
	}

	public zoomIn(): void {
		const newScale = Math.min(Math.max(this.worldContainer.scale.x * 2, 1), 1.2);
		new Tween(this.worldContainer.scale).to({ x: newScale, y: newScale }, 500).start();
		// this.worldContainer.scale.set(newScale);
	}

	public zoomOut(): void {
		const newScale = Math.min(Math.max(this.worldContainer.scale.x / 2, 1), 1.0);
		new Tween(this.worldContainer.scale).to({ x: newScale, y: newScale }, 500).start();
	}

	private setupEvents() {
		window.addEventListener("keydown", (e) => this.keys.add(e.code));
		window.addEventListener("keyup", (e) => this.keys.delete(e.code));
		window.addEventListener("wheel", (e) => this.handleWheel(e), { passive: false });
	}

	public override onResize(_newW: number, _newH: number): void {
		// Mantener la escala de la UI
		ScaleHelper.setScaleRelativeToIdeal(this.uiLayer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
	}
}
