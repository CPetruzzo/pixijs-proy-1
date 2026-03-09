/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { Container, Sprite, Text, TextStyle, Point, Texture, Graphics, BLEND_MODES, AlphaFilter, AnimatedSprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Tween } from "tweedle.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../../engine/utils/InteractableManager";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

// Tipos de celda para la lógica de construcción del nivel
enum TileType {
	EMPTY = 0,
	FLOOR = 1,
	WALL = 2,
	STAIRS_UP = 3,
	STAIRS_DOWN = 4,
	BED = 5,
	WOOD_FLOOR = 6,
	GATE = 7, // <--- NUEVO TIPO
	BARGATE = 8,
	CLEANBUCKET = 9,
	TORCH = 10,
	PRISONER = 11,
}

const TILE_MAP: Record<string, TileType> = {
	".": TileType.EMPTY,
	F: TileType.FLOOR,
	W: TileType.WALL,
	U: TileType.STAIRS_UP,
	D: TileType.STAIRS_DOWN,
	B: TileType.BED,
	X: TileType.WOOD_FLOOR,
	G: TileType.GATE,
	I: TileType.BARGATE,
	C: TileType.CLEANBUCKET,
	T: TileType.TORCH,
	P: TileType.PRISONER,
};

// Nivel 0: Sótano (15x15)
const LEVEL_0 = [
	"...............",
	"...............",
	"..WWGWWW.......", // <--- y=2 (Aquí ves tu puerta 'G' en x=4)
	"..WFFFFW.......", // <--- y=3
	"..WFFFFW.......", // <--- y=4
	"..WFFFFW.......", // <--- y=5
	"..WFFFFW.......", // <--- y=6
	"..WWUWWW.......", // <--- y=7 (Aquí ves tu escalera 'U' en x=4)
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
];

// Nivel 1: Sala
const LEVEL_1 = [
	"...............",
	"...............",
	"..WWWWWWWWWWWWW",
	"..WXUXIFFFXXXXW",
	"..WXXXTXXFXXXXW",
	"..WWWWWXXFXXXXW",
	"..WFFFXXXFXXXXW",
	"..TFDFFFFFXXXXW",
	"..WFFFXXXXXXXXW",
	"..WXXXXXXXXXXXW",
	"..TXXXXXXCXXXXW",
	"..WXXXXXXXXXXXW",
	"..WXXXXXXXXXXXW",
	"..WXXXXXXXXXXXW",
	"..WWWWWWWWWWWWW",
];

const LEVEL_2 = [
	"...............",
	"...............",
	"..WWWWWWWWWWWWW",
	"..WXDXXXXXXXXXW",
	"..WXXBBXXUXXXXW",
	"..WXXXXXXXXXXXW",
	"..WXXXXXXXXXXXW",
	"..WWWWWWWWWWWWW",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
];

const LEVEL_3 = [
	"...............",
	"...............",
	"....WWWWWWWT...",
	"....TXXXXXXW...",
	"....WXPXXDXW...",
	"....WXXXXXXW...",
	"....TXXXXXXW...",
	"....WWWWWWWT...",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
	"...............",
];

interface Entity {
	gx: number;
	gy: number;
	gz: number;
	renderGx: number; // <--- Nueva (para profundidad)
	renderGy: number; // <--- Nueva (para profundidad)
	renderGz: number; // <--- Nueva (para profundidad)
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
	public static readonly BUNDLES = ["isometric", "ggj", "donotdelete"];
	private animator: StateMachineAnimator; // <--- ESTE ES TU NUEVO JUGADOR
	// Reemplaza playerLayer por esto:
	private isMoving: boolean = false; // <--- NUEVA VARIABLE
	// --- CAMBIO: Ahora tendremos un manager por cada piso ---
	private interactManagers: InteractableManager[] = [];
	// --- NUEVAS VARIABLES PARA LA LUZ ---
	private darknessContainer: Container;
	private lightHole: Sprite;
	private torchLights: { hole: Sprite; glow: Sprite; gz: number }[] = []; // <--- NUEVO

	private keys: Set<string> = new Set();
	private lastDashTime: number = 0;
	private readonly DASH_COOLDOWN: number = 500;
	private tileOffsets: Record<string, { x: number; y: number; open: boolean }> = {};

	private prisonerScale = { x: 0.15, y: 0.15 };
	private uiBottomLeftLayer: Container = new Container();
	private uiBottomRightLayer: Container = new Container();
	private lastFacing = { dx: 1, dy: 0 }; // Dirección por defecto
	private shieldActive = false; // Control para no espamear el escudo
	private uiTopRightLayer: Container = new Container(); // <--- NUEVA CAPA

	private minimapGraphics: Graphics; // <--- DIBUJADOR DEL MAPA
	private discoveredTiles: boolean[][][] = []; // <--- MATRIZ DE NIEBLA DE GUERRA
	// Array para mantener vivos los efectos visuales (magias) en cada frame
	private activeEffects: { displayObject: Container; gx: number; gy: number; gz: number; zIndexOffset: number }[] = [];
	constructor() {
		super();
		this.initWorld();

		this.worldContainer = new Container();
		this.addChild(this.worldContainer);
		this.zoomOut();
		// --- CAMBIO: Inicializar un manager por nivel ---
		this.interactManagers = [];
		for (let i = 0; i < this.NUM_LEVELS; i++) {
			this.interactManagers.push(new InteractableManager(this.worldContainer));
		}
		this.dungeonLayer = new Container();
		this.dungeonLayer.sortableChildren = true; // <--- Añadir esta línea
		this.worldContainer.addChild(this.dungeonLayer);

		SoundLib.playMusic("crickets", { loop: true, volume: 0.3 });
		SoundLib.playMusic("ambience", { loop: true, volume: 0.3 });
		this.createLighting(); // <--- AÑADE ESTA LÍNEA AQUÍ
		this.createTorchLights(); // <--- AÑADE ESTO AQUÍ
		DialogueOverlayManager.init(this); // <--- INICIALIZAR DIÁLOGO
		DialogueOverlayManager.changeTalkerImage("wizardface");
		// BORRAMOS la inicialización de this.playerLayer aquí

		this.uiLayer = new Container();
		this.addChild(this.uiLayer, this.uiBottomLeftLayer, this.uiBottomRightLayer, this.uiTopRightLayer);
		this.setupEvents();
		this.createPlayer();
		this.createUI();

		this.setupInteractions(); // <--- CREAR LOS PUNTOS DE INTERACCIÓN

		this.centerCameraOnPlayer();

		// --- NUEVO: Tween para la respiración del prisionero ---
		// Se ensancha sutilmente (X) y se encoje un poco (Y) simulando el pecho al respirar
		new Tween(this.prisonerScale).to({ x: 0.153, y: 0.147 }, 1500).repeat(Infinity).yoyo(true).start();
	}

	private triggerScreenShake(duration: number = 300, initialIntensity: number = 10, _onComplete?: any) {
		const shakeData = { intensity: initialIntensity };

		new Tween(shakeData)
			.to({ intensity: 0 }, duration)
			.onUpdate(() => {
				// Desplazamos la escena entera de forma aleatoria
				this.x = (Math.random() - 0.5) * shakeData.intensity;
				this.y = (Math.random() - 0.5) * shakeData.intensity;
			})
			.onComplete(() => {
				// Nos aseguramos de devolver la cámara a su posición original exacta
				this.x = 0;
				this.y = 0;
				_onComplete;
			})
			.start();
	}

	private createTorchLights() {
		// 1. Textura para el "agujero" en la oscuridad (ERASE)
		const holeCanvas = document.createElement("canvas");
		const size = 180;
		holeCanvas.width = size;
		holeCanvas.height = size;
		const holeCtx = holeCanvas.getContext("2d")!;
		const holeGradient = holeCtx.createRadialGradient(size / 2, size / 2, 5, size / 2, size / 2, size / 2);

		// BAJAMOS la opacidad de 0.5 a 0.3 para que mantenga más la sombra
		holeGradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
		holeGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

		holeCtx.fillStyle = holeGradient;
		holeCtx.fillRect(0, 0, size, size);
		const torchHoleTex = Texture.from(holeCanvas);

		// 2. Textura para el "brillo" cálido del fuego (ADD)
		const glowCanvas = document.createElement("canvas");
		glowCanvas.width = size;
		glowCanvas.height = size;
		const glowCtx = glowCanvas.getContext("2d")!;
		const glowGradient = glowCtx.createRadialGradient(size / 2, size / 2, 5, size / 2, size / 2, size / 2);

		// CAMBIAMOS el color a un naranja más amarillento y bajamos la opacidad a la mitad
		glowGradient.addColorStop(0, "rgba(255, 140, 0, 0.4)"); // Centro más cálido y suave
		glowGradient.addColorStop(0.4, "rgba(255, 60, 0, 0.15)"); // Transición más corta y sutil
		glowGradient.addColorStop(1, "rgba(255, 0, 0, 0)"); // Borde

		glowCtx.fillStyle = glowGradient;
		glowCtx.fillRect(0, 0, size, size);
		const torchGlowTex = Texture.from(glowCanvas);

		// 3. Buscar antorchas y asignarles las luces
		for (let z = 0; z < this.NUM_LEVELS; z++) {
			for (let x = 0; x < this.GRID_SIZE; x++) {
				for (let y = 0; y < this.GRID_SIZE; y++) {
					if (this.grid[z][x][y] === TileType.TORCH) {
						const pos = this.gridToScreen(x, y, z);

						// Ajuste visual para que la luz nazca desde el fuego y no desde el suelo
						const lightX = pos.x + this.T_HEIGHT_HALF;
						const lightY = pos.y - 30;

						// El borrador va a la capa oscura
						const hole = new Sprite(torchHoleTex);
						hole.anchor.set(0.5, 0.3);
						hole.position.set(lightX, lightY);
						hole.blendMode = BLEND_MODES.ERASE;
						this.darknessContainer.addChild(hole);

						// El resplandor rojo va al contenedor principal (encima de la oscuridad)
						const glow = new Sprite(torchGlowTex);
						glow.anchor.set(0.5);
						glow.position.set(lightX, lightY);
						glow.blendMode = BLEND_MODES.COLOR_BURN;
						this.worldContainer.addChild(glow);

						this.torchLights.push({ hole, glow, gz: z });
					}
				}
			}
		}
	}

	private createLighting() {
		this.darknessContainer = new Container();

		// 1. Crear la capa oscura gigante (azul muy oscuro/casi negro)
		const darknessGraphics = new Graphics();
		darknessGraphics.beginFill(0x050510, 0.98); // 0.92 es la opacidad (0=transparente, 1=completamente negro)
		darknessGraphics.drawRect(-10000, -10000, 20000, 20000);
		darknessGraphics.endFill();
		this.darknessContainer.addChild(darknessGraphics);

		// 2. Crear la textura de la "aureola" difuminada usando HTML Canvas
		const canvas = document.createElement("canvas");
		const size = 300; // Tamaño total del círculo de luz
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d")!;

		const gradient = ctx.createRadialGradient(size / 2, size / 2, 30, size / 2, size / 2, size / 2);
		gradient.addColorStop(0, "rgba(255, 255, 255, 1)"); // Centro: Borra el 100% de la oscuridad
		gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.4)"); // Transición suave
		gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.05)"); // Transición suave
		gradient.addColorStop(1, "rgba(255, 255, 255, 0)"); // Borde: No borra nada, se funde con el negro

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, size, size);

		// 3. Crear el Sprite que actuará como "borrador"
		this.lightHole = new Sprite(Texture.from(canvas));
		this.lightHole.anchor.set(0.5, 0.45);
		this.lightHole.blendMode = BLEND_MODES.ERASE;

		this.darknessContainer.addChild(this.lightHole);

		// TRUCO DE PIXIJS: Para que ERASE borre solo la oscuridad y no el mapa de fondo,
		// el contenedor padre necesita tener un filtro aplicado.
		this.darknessContainer.filters = [new AlphaFilter()];

		// Añadimos la capa al mundo
		this.worldContainer.addChild(this.darknessContainer);
	}

	private setupInteractions() {
		// Interacción 1: Sótano (Nivel 0)
		const posBasement = this.gridToScreen(4, 5, 0);
		this.interactManagers[0].add(posBasement.x, posBasement.y, () => {
			DialogueOverlayManager.chainEvent(() => {
				this.zoomIn();
			});
			DialogueOverlayManager.talk("El sótano está bastante oscuro y húmedo.");
			DialogueOverlayManager.talk("Debería subir a la sala.");
			DialogueOverlayManager.chainEvent(() => {
				this.zoomOut();
			});
		});

		// Interacción 2: Sala (Nivel 1)
		const posLivingRoom = this.gridToScreen(10, 10, 1);
		this.interactManagers[1].add(posLivingRoom.x, posLivingRoom.y, () => {
			DialogueOverlayManager.talk("Un piso de madera impecable.");
			DialogueOverlayManager.talk("Parece que alguien estuvo limpiando aquí hace poco.");
		});

		// Interacción 3: Ático (Nivel 2)
		const posBed = this.gridToScreen(5, 3, 2);
		this.interactManagers[2].add(posBed.x, posBed.y, () => {
			DialogueOverlayManager.talk("Una cama de aspecto muy cómodo.");
			DialogueOverlayManager.talk("Lamentablemente, hay mucho por hacer. ¡No hay tiempo para siestas!");
		});

		// Interacción 4: Puerta del Sótano (Nivel 0)
		const posGate = this.gridToScreen(4, 2, 0);
		this.interactManagers[0].add(posGate.x, posGate.y, () => {
			DialogueOverlayManager.talk("Una puerta de madera muy pesada.");
			DialogueOverlayManager.talk("Parece estar cerrada con llave desde el otro lado.");
			DialogueOverlayManager.talk("Qué tal si...");

			DialogueOverlayManager.chainEvent(() => {
				// --- NUEVO: Disparamos el temblor de pantalla ---
				// 500ms de duración y una intensidad de 15 píxeles de fuerza
				this.triggerScreenShake(500, 15, DialogueOverlayManager.talk("Toma!"));

				// Opcional: ¡Si tienes un sonido de golpe metálico, este es el lugar para ponerlo!
				SoundLib.playSound("ironsmash", { volume: 0.3, end: 1 });

				DialogueOverlayManager.talk("No, no abre por la fuerza");
			});
		});

		// Interacción 5: Puerta del Primer piso (Nivel 1)
		const posGateOpen = this.gridToScreen(6, 3, 1);
		const gateKey = "1_6_3";

		this.tileOffsets[gateKey] = { x: 0, y: 0, open: false };

		const interactGate = this.interactManagers[1].add(posGateOpen.x, posGateOpen.y, () => {
			DialogueOverlayManager.talk("Esta reja se debería poder abrir con un poco de fuerza.");
			DialogueOverlayManager.chainEvent(() => {
				this.tileOffsets[gateKey].open = true;

				// --- NUEVO: Disparamos el temblor de pantalla ---
				// 500ms de duración y una intensidad de 15 píxeles de fuerza
				this.triggerScreenShake(500, 15);

				// Opcional: ¡Si tienes un sonido de golpe metálico, este es el lugar para ponerlo!
				SoundLib.playSound("ironsmash", { volume: 0.3 });

				new Tween(this.tileOffsets[gateKey])
					.to({ x: -this.T_WIDTH_HALF * 1.5, y: this.T_HEIGHT_HALF }, 1600)
					.onComplete(() => {
						// IMPORTANTE: Asegúrate de borrarla también del manager del piso 1
						this.interactManagers[1].remove(interactGate);
					})
					.start();
			});
		});

		// Interacción 6: Prisionero (Nivel 3)
		const prisonerPos = this.gridToScreen(6, 3, 3);
		this.interactManagers[3].add(prisonerPos.x, prisonerPos.y, () => {
			// 1. Habla el prisionero
			this.zoomIn();
			DialogueOverlayManager.changeTalkerImage("prisonerface");
			DialogueOverlayManager.talk("Alguien... vino... a... visitarme?");

			// 2. Cuando termina la frase anterior, encadenamos al Mago
			DialogueOverlayManager.chainEvent(() => {
				DialogueOverlayManager.changeTalkerImage("wizardface");
				DialogueOverlayManager.talk("Hey! Estás bien? Estoy perdido en este castillo y la puerta de abajo no abre");
				DialogueOverlayManager.talk("Te encontré de casualidad. Sabés cómo salir de acá?");

				// 3. Cuando el Mago termina sus dos frases, encadenamos de vuelta al Prisionero
				DialogueOverlayManager.chainEvent(() => {
					DialogueOverlayManager.changeTalkerImage("prisonerface");
					DialogueOverlayManager.talk("Si, pero deberás ayudarme antes con estas cadenas");

					// 4. (Opcional pero muy recomendado) Restablecer la cara del Mago al terminar todo
					// para que si interactúas con una puerta después, no aparezca la cara del prisionero.
					DialogueOverlayManager.chainEvent(() => {
						DialogueOverlayManager.changeTalkerImage("wizardface");
						this.zoomOut();
					});
				});
			});
		});
	}

	// private initWorld() {
	// 	for (let z = 0; z < this.NUM_LEVELS; z++) {
	// 		this.grid[z] = [];
	// 		for (let x = 0; x < this.GRID_SIZE; x++) {
	// 			this.grid[z][x] = [];
	// 			for (let y = 0; y < this.GRID_SIZE; y++) {
	// 				this.grid[z][x][y] = TileType.EMPTY;
	// 			}
	// 		}
	// 	}

	// 	// Nivel 0: Sótano
	// 	for (let x = 2; x < 8; x++) {
	// 		for (let y = 2; y < 8; y++) {
	// 			this.grid[0][x][y] = TileType.FLOOR;
	// 			if (x === 2 || y === 2 || x === 7 || y === 7) {
	// 				this.grid[0][x][y] = TileType.WALL;
	// 			}
	// 		}
	// 	}
	// 	this.grid[0][4][7] = TileType.STAIRS_UP;
	// 	// NUEVO: Reemplazamos un pedazo de pared (ej: x=4, y=2) por la puerta
	// 	this.grid[0][4][2] = TileType.GATE;
	// 	// Nivel 1: Sala
	// 	for (let x = 2; x < 15; x++) {
	// 		for (let y = 2; y < 15; y++) {
	// 			this.grid[1][x][y] = TileType.WOOD_FLOOR;
	// 			if (x === 2 || y === 2 || x === 14 || y === 14 || x === 6) {
	// 				this.grid[1][x][y] = TileType.WALL;
	// 			}

	// 			this.grid[1][6][7] = TileType.FLOOR;
	// 		}
	// 	}

	// 	this.grid[1][4][7] = TileType.STAIRS_DOWN;
	// 	this.grid[1][7][2] = TileType.STAIRS_UP;

	// 	// Nivel 2: Ático
	// 	for (let x = 2; x < 10; x++) {
	// 		for (let y = 2; y < 8; y++) {
	// 			this.grid[2][x][y] = TileType.WOOD_FLOOR;
	// 			if (x === 9 || y === 7 || y === 2 || x === 2) {
	// 				this.grid[2][x][y] = TileType.WALL;
	// 			}
	// 		}
	// 	}
	// 	this.grid[2][5][3] = TileType.BED;
	// 	this.grid[2][7][2] = TileType.STAIRS_DOWN;
	// 	this.grid[2][5][4] = TileType.STAIRS_UP;

	// 	// Nivel 3: Rooftop
	// 	for (let x = 2; x < 10; x++) {
	// 		for (let y = 2; y < 8; y++) {
	// 			this.grid[3][x][y] = TileType.FLOOR;
	// 			if (x === 9 || y === 7 || y === 2 || x === 2) {
	// 				this.grid[2][x][y] = TileType.WALL;
	// 			}
	// 		}
	// 	}
	// 	this.grid[2][7][2] = TileType.STAIRS_DOWN;
	// 	this.grid[3][5][4] = TileType.STAIRS_DOWN;
	// }

	private initWorld() {
		const mapStrings = [LEVEL_0, LEVEL_1, LEVEL_2, LEVEL_3];

		for (let z = 0; z < this.NUM_LEVELS; z++) {
			this.grid[z] = [];
			this.discoveredTiles[z] = []; // <--- INICIALIZAR NIEBLA Z

			const currentMap = mapStrings[z];

			for (let x = 0; x < this.GRID_SIZE; x++) {
				this.grid[z][x] = [];
				this.discoveredTiles[z][x] = []; // <--- INICIALIZAR NIEBLA X

				for (let y = 0; y < this.GRID_SIZE; y++) {
					const char = currentMap[y][x];
					this.grid[z][x][y] = TILE_MAP[char] || TileType.EMPTY;

					// <--- AL EMPEZAR, NADIE VIO ESTA CASILLA
					this.discoveredTiles[z][x][y] = false;
				}
			}
		}
	}

	private createPlayer() {
		const pos = this.gridToScreen(4, 4, 0);
		this.player = {
			gx: 4,
			gy: 4,
			gz: 0,
			renderGx: 4,
			renderGy: 4,
			renderGz: 0, // Empezamos en la misma posición
			visualX: pos.x,
			visualY: pos.y,
		};

		this.animator = new StateMachineAnimator();
		this.animator.scale.set(0.15);

		// Estados
		this.animator.addState(
			"idle",
			Array.from({ length: 20 }, (_, i) => Texture.from(`idle${i.toString().padStart(2, "0")}`)),
			0.5,
			true
		); // Bajé un poco la velocidad (0.5) para que no sea frenético

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

		this.animator.playState("idle");
		this.animator.anchor.set(0.5, 0.7); // Ajusta el anchor para que los pies toquen el suelo
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

						this.updateTileSprite(tile, pos.x, pos.y, alpha, x, y, z);
					}

					// 2. Insertamos al jugador JUSTO DESPUÉS de la celda donde está parado
					// Dentro de renderDungeon, en el triple bucle for:

					// Comparamos usando Math.round para que el cambio de capa sea fluido
					const isPlayerHere = Math.round(this.player.renderGx) === x && Math.round(this.player.renderGy) === y && Math.round(this.player.renderGz) === z;

					if (isPlayerHere) {
						this.animator.position.set(this.player.visualX, this.player.visualY);

						// CAMBIO 2: Fórmula mágica para el Z-Index del jugador
						const playerZ = (x + y) * 100 + z * 10000 + x * 2;
						this.animator.zIndex = playerZ + 20; // +20 lo mantiene siempre por encima del suelo que pisa

						this.dungeonLayer.addChild(this.animator);
					}
				}
			}
		}

		// --- NUEVO: Dibujar magias en curso con la profundidad correcta ---
		for (const eff of this.activeEffects) {
			// Recalculamos la profundidad por si la magia se está moviendo (ej. Tornado)
			const baseZ = (eff.gx + eff.gy) * 100 + eff.gz * 10000 + eff.gx * 2;
			eff.displayObject.zIndex = baseZ + eff.zIndexOffset;
			this.dungeonLayer.addChild(eff.displayObject);
		}
	}

	// --- HELPERS PARA MANEJAR EFECTOS ---
	private addEffect(displayObject: Container, gx: number, gy: number, gz: number, zOffset: number = 50) {
		const effect = { displayObject, gx, gy, gz, zIndexOffset: zOffset };
		this.activeEffects.push(effect);
		return effect;
	}

	private removeEffect(effect: any) {
		const index = this.activeEffects.indexOf(effect);
		if (index > -1) {
			this.activeEffects.splice(index, 1);
		}
		effect.displayObject.destroy();
	}

	// --- HABILIDADES ---
	private useSkillQ() {
		// Disparo Rojo (1 celda adelante)
		const tgx = this.player.gx + this.lastFacing.dx;
		const tgy = this.player.gy + this.lastFacing.dy;

		// --- NUEVO: Comprobar si le damos al prisionero ---
		// Primero nos aseguramos de no revisar fuera de los límites del mapa
		if (tgx >= 0 && tgx < this.GRID_SIZE && tgy >= 0 && tgy < this.GRID_SIZE) {
			const targetTile = this.grid[this.player.gz][tgx][tgy];

			if (targetTile === TileType.PRISONER) {
				// 1. Habla el prisionero
				DialogueOverlayManager.changeTalkerImage("prisonerface");
				DialogueOverlayManager.talk("Esto es... estoy... LIBRE!");

				// 2. Encadenamos el temblor y la reacción del jugador
				DialogueOverlayManager.chainEvent(() => {
					// Temblor de pantalla más largo (2000ms) y un poco más fuerte (20)
					this.triggerScreenShake(10000, 20);

					DialogueOverlayManager.changeTalkerImage("wizardface");
					DialogueOverlayManager.talk("Qué... está pasando?!");
				});
			}
		}

		const pos = this.gridToScreen(tgx, tgy, this.player.gz);

		const gfx = new AnimatedSprite([
			Texture.from("smallhit00"),
			Texture.from("smallhit01"),
			Texture.from("smallhit02"),
			Texture.from("smallhit03"),
			Texture.from("smallhit04"),
			Texture.from("smallhit05"),
			Texture.from("smallhit06"),
			Texture.from("smallhit07"),
			Texture.from("smallhit08"),
			Texture.from("smallhit09"),
			Texture.from("smallhit10"),
			Texture.from("smallhit11"),
			Texture.from("smallhit12"),
			Texture.from("smallhit13"),
			Texture.from("smallhit14"),
		]);

		gfx.scale.set(0.13);
		// Le asignamos la posición en la grilla isométrica
		gfx.position.set(pos.x - 3, pos.y + 1);

		// Centramos el punto de origen del sprite para que no se dibuje desde una esquina
		gfx.anchor.set(0.5, 0.5);

		// Ajustar la velocidad de la animación
		gfx.animationSpeed = 0.3;

		gfx.play();
		SoundLib.playSound("skillQ", { end: 2, volume: 0.1 });
		const effect = this.addEffect(gfx, tgx, tgy, this.player.gz);

		// Tu Tween se encarga de destruirlo a los 500ms
		new Tween(gfx)
			.to({}, 500)
			.onComplete(() => this.removeEffect(effect))
			.start();
	}
	private useSkillW() {
		// Ataque en Área (Cruz)
		const dirs = [
			{ dx: 1, dy: 0 },
			{ dx: -1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: 0, dy: -1 },
		];

		for (const d of dirs) {
			const tgx = this.player.gx + d.dx;
			const tgy = this.player.gy + d.dy;
			const pos = this.gridToScreen(tgx, tgy, this.player.gz);

			const gfx = new Graphics();
			gfx.beginFill(0xffaa00, 0.8).drawCircle(0, 0, 15).endFill();
			gfx.position.set(pos.x, pos.y);

			const effect = this.addEffect(gfx, tgx, tgy, this.player.gz);

			new Tween(gfx)
				.to({ alpha: 0, scale: { x: 1.5, y: 1.5 } }, 400)
				.onComplete(() => this.removeEffect(effect))
				.start();
		}
	}

	private useSkillE() {
		// Disparo Azul (1 celda adelante)
		const tgx = this.player.gx + this.lastFacing.dx;
		const tgy = this.player.gy + this.lastFacing.dy;
		const pos = this.gridToScreen(tgx, tgy, this.player.gz);

		const gfx = new Graphics();
		gfx.beginFill(0x0000ff, 0.8).drawCircle(0, 0, 15).endFill();
		gfx.position.set(pos.x, pos.y);

		const effect = this.addEffect(gfx, tgx, tgy, this.player.gz);

		new Tween(gfx)
			.to({ alpha: 0, y: pos.y - 20 }, 300)
			.onComplete(() => this.removeEffect(effect))
			.start();
	}

	private useSkillR() {
		// Tornado (Avanza 2 celdas)
		const tgx1 = this.player.gx + this.lastFacing.dx;
		const tgy1 = this.player.gy + this.lastFacing.dy;
		const pos1 = this.gridToScreen(tgx1, tgy1, this.player.gz);

		const tgx2 = this.player.gx + this.lastFacing.dx * 2;
		const tgy2 = this.player.gy + this.lastFacing.dy * 2;
		const pos2 = this.gridToScreen(tgx2, tgy2, this.player.gz);

		const gfx = new Graphics();
		gfx.beginFill(0xcccccc, 0.8).drawEllipse(0, -15, 15, 25).endFill();
		gfx.position.set(pos1.x, pos1.y);

		const effect = this.addEffect(gfx, tgx1, tgy1, this.player.gz, 60);

		// Animar la posición física en pantalla
		new Tween(gfx.position).to({ x: pos2.x + this.T_HEIGHT_HALF, y: pos2.y }, 600).start();

		// Animar la posición lógica (gx, gy) para que el Z-Index cambie en pleno vuelo
		new Tween(effect)
			.to({ gx: tgx2, gy: tgy2 }, 600)
			.onComplete(() => {
				new Tween(gfx)
					.to({ alpha: 0, scale: { x: 0, y: 0 } }, 200)
					.onComplete(() => this.removeEffect(effect))
					.start();
			})
			.start();
	}

	private useSkill1() {
		// Curar
		const gfx = new AnimatedSprite([
			Texture.from("heal00"),
			Texture.from("heal01"),
			Texture.from("heal02"),
			Texture.from("heal03"),
			Texture.from("heal04"),
			Texture.from("heal05"),
			Texture.from("heal06"),
			Texture.from("heal07"),
			Texture.from("heal08"),
			Texture.from("heal09"),
			Texture.from("heal10"),
			Texture.from("heal11"),
			Texture.from("heal12"),
			Texture.from("heal13"),
			Texture.from("heal14"),
		]);
		gfx.gotoAndPlay(0);
		gfx.loop = true;
		gfx.scale.set(1);

		// Centramos el punto de origen del sprite para que no se dibuje desde una esquina
		gfx.anchor.set(0.5, 0.7);

		// Opcional: Ajustar la velocidad de la animación (1 es normal, 0.5 es la mitad, etc.)
		gfx.animationSpeed = 1;

		gfx.play();
		SoundLib.playSound("skillQ", { end: 2 });

		// Como esto va al jugador, lo atachamos directo a su Container
		this.animator.addChild(gfx);

		new Tween(gfx)
			.to({ y: -60, alpha: 0 }, 1000)
			.onComplete(() => gfx.destroy())
			.start();
	}

	private useSkill2() {
		// Escudo (Dura 2 segundos)
		if (this.shieldActive) {
			return;
		}
		this.shieldActive = true;

		const shield = new Graphics();
		shield.beginFill(0x00ffff, 0.3);
		shield.lineStyle(2, 0x00ffff, 0.8);
		shield.drawCircle(0, -95, 150);
		shield.endFill();

		this.animator.addChild(shield);

		// Lo destruimos a los 2000 milisegundos (2 segundos)
		setTimeout(() => {
			new Tween(shield)
				.to({ alpha: 0 }, 200)
				.onComplete(() => {
					shield.destroy();
					this.shieldActive = false;
				})
				.start();
		}, 1800);
	}

	private updateTileSprite(type: TileType, x: number, y: number, alpha: number, gx: number, gy: number, gz: number) {
		const edgeLength = Math.sqrt(Math.pow(this.T_WIDTH_HALF, 2) + Math.pow(this.T_HEIGHT_HALF, 2));
		const isoAngle = Math.atan(this.T_HEIGHT_HALF / this.T_WIDTH_HALF);

		// --- FÓRMULA MÁGICA ISOMÉTRICA ---
		// (gx + gy) define la profundidad diagonal principal.
		// gz * 10000 asegura que un piso superior NUNCA quede tapado por un piso inferior.
		// gx * 2 desempata el orden de dibujo de izquierda a derecha.
		const baseZ = (gx + gy) * 100 + gz * 10000 + gx * 2;

		if (type === TileType.WALL) {
			const wallHeight = this.LEVEL_HEIGHT * 0.8;
			const colorTop = 0xffffff;
			const colorLeft = 0xcccccc;
			const colorRight = 0x686767;

			const leftSide = this.getSpriteFromPool();
			leftSide.texture = Texture.from("iso_pared");
			leftSide.anchor.set(0, 1);
			leftSide.position.set(x - this.T_WIDTH_HALF, y);
			leftSide.width = edgeLength;
			leftSide.height = wallHeight;
			leftSide.rotation = 0;
			leftSide.skew.set(0, isoAngle);
			leftSide.tint = colorLeft;
			leftSide.alpha = alpha;
			leftSide.zIndex = baseZ; // Asignamos profundidad

			const rightSide = this.getSpriteFromPool();
			rightSide.texture = Texture.from("iso_pared");
			rightSide.anchor.set(0, 1);
			rightSide.position.set(x, y + this.T_HEIGHT_HALF);
			rightSide.width = edgeLength;
			rightSide.height = wallHeight;
			rightSide.rotation = 0;
			rightSide.skew.set(0, -isoAngle);
			rightSide.tint = colorRight;
			rightSide.alpha = alpha;
			rightSide.zIndex = baseZ; // Asignamos profundidad

			const topSide = this.getSpriteFromPool();
			topSide.texture = Texture.from("iso_top_pared");
			this.applyIsometricTransform(topSide, x, y - wallHeight);
			topSide.tint = colorTop;
			topSide.alpha = alpha;
			topSide.zIndex = baseZ; // Asignamos profundidad
		} else {
			const floor = this.getSpriteFromPool();
			const texName = type === TileType.WOOD_FLOOR || type === TileType.BED ? "iso_floor" : "iso_suelo";
			floor.texture = Texture.from(texName);

			this.applyIsometricTransform(floor, x, y);
			floor.zIndex = baseZ; // El suelo base toma la profundidad normal

			if (type === TileType.STAIRS_UP || type === TileType.STAIRS_DOWN) {
				const wallHeight = this.LEVEL_HEIGHT * 0.8;
				floor.texture = Texture.from("iso_stair_up");
				floor.rotation = 0;
				floor.width = edgeLength;
				floor.height = wallHeight;
				if (type === TileType.STAIRS_DOWN) {
					floor.texture = Texture.from("iso_stair_down");
					floor.scale.y *= -1;
				}
			} else if (type === TileType.BED) {
				floor.tint = 0x9999ff;
			} else if (type === TileType.GATE) {
				// 1. Convertimos el suelo de la puerta en un suelo estándar limpio
				floor.texture = Texture.from("iso_suelo");
				floor.tint = 0xffffff;

				// 2. Dibujamos la puerta encima
				const gate = this.getSpriteFromPool();
				gate.texture = Texture.from("gate");
				gate.scale.set(0.26);
				gate.angle += 2;
				gate.anchor.set(0.55, 0.6);
				gate.position.set(x, y - this.T_HEIGHT_HALF);
				gate.alpha = alpha;

				// TRUCO CLAVE: Le damos +110.
				// Esto le da prioridad sobre la pared a su derecha (+100), pero pierde contra
				// el jugador si se para justo enfrente (+120 en total).
				gate.zIndex = baseZ + 110;
			} else if (type === TileType.BARGATE) {
				floor.texture = Texture.from("iso_suelo");
				floor.tint = 0xffffff;

				// 1. Buscamos si esta reja en específico tiene una animación en curso
				const key = `${gz}_${gx}_${gy}`;
				const offset = this.tileOffsets[key] || { x: 0, y: 0, open: false };

				const gate = this.getSpriteFromPool();
				gate.texture = Texture.from("bargate");
				gate.scale.set(0.3);
				gate.anchor.set(0.63);

				// 2. Le SUMAMOS el offset a su posición normal
				gate.position.set(x + this.T_HEIGHT_HALF + offset.x, y + offset.y);
				gate.alpha = alpha;
				gate.zIndex = baseZ;

				// TRUCO CLAVE: Le damos +110.
				// Esto le da prioridad sobre la pared a su derecha (+100), pero pierde contra
				// el jugador si se para justo enfrente (+120 en total).
			} else if (type === TileType.CLEANBUCKET) {
				floor.tint = 0xffffff;

				// 2. Dibujamos la puerta encima
				const gate = this.getSpriteFromPool();
				gate.texture = Texture.from("cleanbucket");
				gate.scale.set(0.2);
				gate.anchor.set(0.95, 0.8);
				gate.position.set(x + this.T_HEIGHT_HALF, y);
				gate.alpha = alpha;
				gate.zIndex = baseZ; // Asignamos profundidad
			} else if (type === TileType.TORCH) {
				const wallHeight = this.LEVEL_HEIGHT * 0.8;
				const colorTop = 0xffffff;
				const colorLeft = 0xcccccc;
				const colorRight = 0x686767;

				const leftSide = this.getSpriteFromPool();
				leftSide.texture = Texture.from("iso_pared");
				leftSide.anchor.set(0, 1);
				leftSide.position.set(x - this.T_WIDTH_HALF, y);
				leftSide.width = edgeLength;
				leftSide.height = wallHeight;
				leftSide.rotation = 0;
				leftSide.skew.set(0, isoAngle);
				leftSide.tint = colorLeft;
				leftSide.alpha = alpha;
				leftSide.zIndex = baseZ; // Asignamos profundidad

				const rightSide = this.getSpriteFromPool();
				rightSide.texture = Texture.from("iso_pared");
				rightSide.anchor.set(0, 1);
				rightSide.position.set(x, y + this.T_HEIGHT_HALF);
				rightSide.width = edgeLength;
				rightSide.height = wallHeight;
				rightSide.rotation = 0;
				rightSide.skew.set(0, -isoAngle);
				rightSide.tint = colorRight;
				rightSide.alpha = alpha;
				rightSide.zIndex = baseZ; // Asignamos profundidad

				const topSide = this.getSpriteFromPool();
				topSide.texture = Texture.from("iso_top_pared");
				this.applyIsometricTransform(topSide, x, y - wallHeight);
				topSide.tint = colorTop;
				topSide.alpha = alpha;
				topSide.zIndex = baseZ; // Asignamos profundidad

				const torch = this.getSpriteFromPool();
				torch.texture = Texture.from("iso_torch");
				torch.scale.set(-0.4, 0.4);
				torch.anchor.set(0.58, 0.9);
				torch.position.set(x + this.T_HEIGHT_HALF, y);
				torch.alpha = alpha;
				torch.zIndex = baseZ; // Asignamos profundidad
			} else if (type === TileType.PRISONER) {
				floor.tint = 0xffffff;

				const prisoner = this.getSpriteFromPool();
				prisoner.texture = Texture.from("prisoner");

				// --- CAMBIO: Le pasamos los valores de nuestra variable animada ---
				prisoner.scale.set(this.prisonerScale.x, this.prisonerScale.y);

				prisoner.anchor.set(0.98, 0.92);
				prisoner.position.set(x + this.T_HEIGHT_HALF, y);
				prisoner.alpha = alpha;
				prisoner.zIndex = baseZ;

				// (Se eliminó el new Tween de aquí adentro porque generaba fugas de memoria)
			} else {
				floor.tint = 0xffffff;
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

	private movePlayer(dx: number, dy: number, attemptDash: boolean = false) {
		if (this.isMoving) {
			return;
		}

		// --- NUEVO: Guardar la dirección hacia donde intentamos movernos/mirar ---
		this.lastFacing = { dx, dy };

		// --- PASO 1: Calcular la primera casilla ---
		const nx1 = this.player.gx + dx;
		const ny1 = this.player.gy + dy;
		const nz1 = this.player.gz;

		if (!this.isValidMove(nx1, ny1, nz1)) {
			return; // Bloqueado de inmediato, no se mueve
		}

		let finalX = nx1;
		let finalY = ny1;
		let finalZ = nz1;
		let isDashing = false;

		// Revisamos escaleras en el primer paso
		const tile1 = this.grid[nz1][nx1][ny1];
		if (tile1 === TileType.STAIRS_UP) {
			finalZ++;
		} else if (tile1 === TileType.STAIRS_DOWN) {
			finalZ--;
		}

		// --- PASO 2: Calcular la segunda casilla si intenta dashear ---
		if (attemptDash) {
			const nx2 = finalX + dx;
			const ny2 = finalY + dy;
			const nz2 = finalZ;

			// Si el segundo paso es válido, confirmamos el dash
			if (this.isValidMove(nx2, ny2, nz2)) {
				isDashing = true;
				finalX = nx2;
				finalY = ny2;

				// Revisamos escaleras en el segundo paso
				const tile2 = this.grid[nz2][nx2][ny2];
				if (tile2 === TileType.STAIRS_UP) {
					finalZ++;
				} else if (tile2 === TileType.STAIRS_DOWN) {
					finalZ--;
				}
			}
		}

		// --- APLICAR RESULTADOS ---
		if (isDashing) {
			this.lastDashTime = Date.now(); // Reiniciamos cooldown
			this.animator.playState("dash");
			SoundLib.playSound("dash", {});
		} else {
			this.animator.playState("walk");
		}

		// Bloqueamos el movimiento lógico
		this.player.gx = finalX;
		this.player.gy = finalY;
		this.player.gz = finalZ;
		this.uiText.text = `Piso: ${this.player.gz}`;

		const targetPos = this.gridToScreen(finalX, finalY, finalZ);
		this.isMoving = true;

		// Ajustar la dirección (espejado) de la animación
		const visualDeltaX = dx - dy;
		if (visualDeltaX !== 0) {
			this.animator.scale.x = Math.abs(this.animator.scale.x) * (visualDeltaX > 0 ? 1 : -1);
		}

		// El TWEEN dura 300ms. Si avanza 2 casillas, irá al doble de velocidad automáticamente.
		new Tween(this.player)
			.to(
				{
					visualX: targetPos.x,
					visualY: targetPos.y,
					renderGx: finalX,
					renderGy: finalY,
					renderGz: finalZ,
				},
				300
			)
			.onComplete(() => {
				this.isMoving = false;
				this.animator.playState("idle");
			})
			.start();
	}

	private isValidMove(x: number, y: number, z: number): boolean {
		if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) {
			return false;
		}
		const tile = this.grid[z][x][y];

		// --- VERIFICAR SI LA REJA ESTÁ ABIERTA ---
		if (tile === TileType.BARGATE) {
			const key = `${z}_${x}_${y}`;
			// Si la reja está registrada y su estado es 'open', permitimos pasar
			if (this.tileOffsets[key] && this.tileOffsets[key].open) {
				return true;
			}
		}

		// Añadimos && tile !== TileType.GATE para bloquear el paso
		return tile !== TileType.WALL && tile !== TileType.EMPTY && tile !== TileType.GATE && tile !== TileType.BARGATE && tile !== TileType.TORCH && tile !== TileType.PRISONER;
	}

	public override update(_dt: number): void {
		super.update(_dt);
		this.animator.update(_dt);

		// Actualizar interactuables basándose en la posición VISUAL 2D del jugador
		// --- CAMBIO: Actualizar interacciones según el piso ---
		for (let i = 0; i < this.NUM_LEVELS; i++) {
			if (i === this.player.gz) {
				// Piso actual: le pasamos la posición real del jugador para que detecte la cercanía
				this.interactManagers[i].update(_dt, this.player.visualX, this.player.visualY);
			} else {
				// Otros pisos: le decimos al manager que el jugador está en coordenadas inalcanzables (-99999).
				// Esto forzará al manager a ocultar la "E" y desactivar el objeto.
				this.interactManagers[i].update(_dt, -99999, -99999);
			}
		}
		// --- LÓGICA DE MOVIMIENTO Y DASH CONTINUO ---
		if (DialogueOverlayManager.isOpen) {
			this.uiBottomLeftLayer.alpha = 0;
			this.keys.clear(); // Evitar que el jugador se siga moviendo si se abre un diálogo
		} else if (!this.isMoving) {
			this.uiBottomLeftLayer.alpha = 1;

			let dx = 0,
				dy = 0;

			// Evaluamos direcciones usando los códigos universales (KeyW, ArrowUp, etc.)
			if (this.keys.has("ArrowUp")) {
				dy = -1;
			} else if (this.keys.has("ArrowDown")) {
				dy = 1;
			}

			// Evitamos movimiento diagonal estricto priorizando el eje Y si ambos están presionados
			if (dy === 0) {
				if (this.keys.has("ArrowLeft")) {
					dx = -1;
				} else if (this.keys.has("ArrowRight")) {
					dx = 1;
				}
			}

			// Si el jugador quiere moverse
			if (dx !== 0 || dy !== 0) {
				const now = Date.now();
				const canDash = this.keys.has("Space") && now - this.lastDashTime >= this.DASH_COOLDOWN;

				this.movePlayer(dx, dy, canDash);
			}
		} else {
			this.uiBottomLeftLayer.alpha = 1;
		}

		// const targetPos = this.gridToScreen(this.player.gx, this.player.gy, this.player.gz);
		// this.player.visualX += (targetPos.x - this.player.visualX) * 0.2;
		// this.player.visualY += (targetPos.y - this.player.visualY) * 0.2;
		this.centerCameraOnPlayer();

		this.lightHole.position.set(this.player.visualX, this.player.visualY - 30);

		// --- ACTUALIZAR LUCES DE ANTORCHAS ---
		for (const t of this.torchLights) {
			// Solo mostramos la luz si la antorcha está en el MISMO piso que el jugador
			const isSameFloor = t.gz === this.player.gz;
			const targetAlpha = isSameFloor ? 1.0 : 0;

			t.hole.alpha = targetAlpha;
			t.glow.alpha = targetAlpha;

			// Efecto de parpadeo (flicker) aleatorio si está visible
			if (isSameFloor) {
				const flicker = 0.95 + Math.random() * 0.1; // Escala entre 0.95 y 1.05
				t.hole.scale.set(flicker);
				t.glow.scale.set(flicker);
			}
		}
		this.renderDungeon();
		this.updateMinimap(); // <--- AÑADE ESTA LÍNEA AL FINAL
	}

	private setupEvents() {
		this.eventMode = "static";

		// Guardar tecla si se presiona
		window.addEventListener("keydown", (e) => {
			if (!DialogueOverlayManager.isOpen) {
				this.keys.add(e.code);

				// --- NUEVO: Disparar habilidades de la UI ---
				switch (e.code) {
					case "KeyQ":
						this.useSkillQ();
						break;
					case "KeyW":
						this.useSkillW();
						break;
					case "KeyA":
						this.useSkillE();
						break;
					case "KeyR":
						this.useSkillR();
						break;
					case "Digit1":
						this.useSkill1();
						break;
					case "Digit2":
						this.useSkill2();
						break;
				}
			}
		});

		// Borrar tecla si se suelta
		window.addEventListener("keyup", (e) => {
			this.keys.delete(e.code);
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
	private handleZoom(_e: WheelEvent) {
		_e.preventDefault();
		const delta = -_e.deltaY * 0.001;
		const newScale = Math.min(Math.max(this.worldContainer.scale.x + delta, 3), 5.0);
		this.worldContainer.scale.set(newScale);
	}

	private zoomIn(): void {
		const newScale = Math.min(Math.max(this.worldContainer.scale.x * 5, 3), 5.0);
		new Tween(this.worldContainer.scale).to({ x: newScale, y: newScale }, 500).start();
		// this.worldContainer.scale.set(newScale);
	}

	private zoomOut(): void {
		const newScale = Math.min(Math.max(this.worldContainer.scale.x / 5, 3), 5.0);
		new Tween(this.worldContainer.scale).to({ x: newScale, y: newScale }, 500).start();
	}

	private centerCameraOnPlayer() {
		this.worldContainer.pivot.x += (this.player.visualX - this.worldContainer.pivot.x) * 0.02;
		this.worldContainer.pivot.y += (this.player.visualY - this.worldContainer.pivot.y) * 0.02;
	}

	private createUI() {
		const style = new TextStyle({ fill: "#ffffff", fontSize: 18, fontWeight: "bold" });
		this.uiText = new Text(`Piso: 0`, style);
		this.uiText.position.set(20, 20);
		this.uiLayer.addChild(this.uiText);

		const baseUI = Sprite.from("baseUI");
		baseUI.anchor.set(0.5);
		baseUI.position.set(baseUI.width / 2, -baseUI.height / 2);
		this.uiBottomLeftLayer.addChild(baseUI);

		const icons = Sprite.from("icons");
		icons.anchor.set(0.5);
		icons.position.set(baseUI.x + baseUI.width / 2 + icons.width / 2, -icons.height / 2);
		this.uiBottomLeftLayer.addChild(icons);

		// --- NUEVO: CREAR GRÁFICOS DEL MINIMAPA ---
		this.minimapGraphics = new Graphics();
		this.uiTopRightLayer.addChild(this.minimapGraphics);
	}

	private updateMinimap() {
		const z = this.player.gz;
		// Usamos math.round por si el jugador está en medio de una animación (TWEEN)
		const px = Math.round(this.player.renderGx);
		const py = Math.round(this.player.renderGy);

		// 1. ACTUALIZAR NIEBLA DE GUERRA (Visión circular de 5 casillas)
		for (let dx = -5; dx <= 5; dx++) {
			for (let dy = -5; dy <= 5; dy++) {
				// Fórmula de distancia Euclidiana para hacer un círculo
				if (Math.sqrt(dx * dx + dy * dy) <= 5.5) {
					const nx = px + dx;
					const ny = py + dy;
					// Si está dentro de los límites del mapa, lo marcamos como visto
					if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE) {
						this.discoveredTiles[z][nx][ny] = true;
					}
				}
			}
		}

		// 2. DIBUJAR MINIMAPA
		this.minimapGraphics.clear();

		const tileSize = 8; // Tamaño en píxeles de cada cuadrito
		const mapSize = this.GRID_SIZE * tileSize;

		// Fondo semi-transparente estilo "pergamino/UI oscura"
		this.minimapGraphics.beginFill(0x1a1a24, 0.8);
		this.minimapGraphics.lineStyle(3, 0x4a4a55, 1);
		this.minimapGraphics.drawRect(-10, -10, mapSize + 20, mapSize + 20);
		this.minimapGraphics.endFill();

		// Dibujar las casillas descubiertas
		this.minimapGraphics.lineStyle(0);
		for (let x = 0; x < this.GRID_SIZE; x++) {
			for (let y = 0; y < this.GRID_SIZE; y++) {
				if (this.discoveredTiles[z][x][y]) {
					const tile = this.grid[z][x][y];
					if (tile === TileType.EMPTY) {
						continue;
					}

					// Asignar colores según el tipo de Tile
					let color = 0x444444; // Suelo normal (Gris)
					if (tile === TileType.WALL) {
						color = 0x888888;
					} // Pared (Gris claro)
					else if (tile === TileType.WOOD_FLOOR || tile === TileType.BED) {
						color = 0x6e5239;
					} // Madera
					else if (tile === TileType.STAIRS_UP) {
						color = 0x00ff00;
					} // Escalera subir (Verde)
					else if (tile === TileType.STAIRS_DOWN) {
						color = 0xffaa00;
					} // Escalera bajar (Naranja)
					else if (tile === TileType.GATE || tile === TileType.BARGATE) {
						color = 0xaa5500;
					} // Puertas
					else if (tile === TileType.PRISONER) {
						color = 0xff0000;
					} // Enemigos/NPCs (Rojo)

					this.minimapGraphics.beginFill(color, 1);
					this.minimapGraphics.drawRect(x * tileSize, y * tileSize, tileSize, tileSize);
					this.minimapGraphics.endFill();
				}
			}
		}

		// 3. DIBUJAR AL JUGADOR (Un puntito Cyan encima de todo)
		this.minimapGraphics.beginFill(0x00ffff, 1);
		this.minimapGraphics.drawCircle(px * tileSize + tileSize / 2, py * tileSize + tileSize / 2, tileSize / 2);
		this.minimapGraphics.endFill();
	}

	public override onResize(_newW: number, _newH: number): void {
		this.worldContainer.x = _newW / 2;
		this.worldContainer.y = _newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.uiBottomLeftLayer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.uiBottomLeftLayer.y = _newH;

		ScaleHelper.setScaleRelativeToIdeal(this.uiBottomRightLayer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.uiBottomRightLayer.y = _newH;
		this.uiBottomRightLayer.x = _newW;

		// --- NUEVO: ESCALAR Y POSICIONAR MINIMAPA ARRIBA A LA DERECHA ---
		ScaleHelper.setScaleRelativeToIdeal(this.uiTopRightLayer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		// El "200" depende del tamaño que te ocupe el minimapa visualmente
		this.uiTopRightLayer.x = _newW - 200 * this.uiTopRightLayer.scale.x;
		this.uiTopRightLayer.y = 50 * this.uiTopRightLayer.scale.y;
	}
}
