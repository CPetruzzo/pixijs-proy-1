/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { isMobile, Manager } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Sprite, Texture, Graphics, Container, Text, TextStyle } from "pixi.js";
import { Keyboard } from "../../../engine/input/Keyboard";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Easing, Tween } from "tweedle.js";
import { DialogueOverlay } from "../Soul/Utils/DialogOverlay";

const LOGS = false;
const CLASS_NAME = "[SOUL] ";
const logger = {
	log: (...args: any[]) => LOGS && console.log(CLASS_NAME, ...args),
	warn: (...args: any[]) => LOGS && console.warn(CLASS_NAME, ...args),
	error: (...args: any[]) => LOGS && console.error(CLASS_NAME, ...args),
};

interface Enemy {
	sprite: Sprite;
	health: number;
	maxHealth: number;
	healthBar: Graphics;
	speed: number;
	state: "patrol" | "chase" | "dead";
	patrolDirection: { x: number; y: number };
	patrolTimer: number;
}

interface Interactable {
	x: number;
	y: number;
	radius: number;
	prompt: Container;
	action: () => void;
	isActive: boolean;
	condition?: () => boolean; // retorna true si se puede interactuar
}
export class SoulMountainScene extends PixiScene {
	private readonly DEBUG_MODE: boolean = false;

	public static readonly BUNDLES = ["fallrungame", "sfx", "myfriend"];
	private player: StateMachineAnimator;
	private enemies: Enemy[] = [];
	private attackHitbox: Graphics;
	private camera: Container;
	private world: Container;
	private movementDirection: string = "idle";
	private attackCooldown: number = 0;
	private attackDuration: number = 0;
	private playerHealth: number = 100;
	private playerMaxHealth: number = 100;
	private healthBar: Graphics;
	private worldObjects: Sprite[] = [];
	private currentState: string = "idleback";
	private facingDirection: "up" | "down" | "left" | "right" = "down";
	private playerSpeed: number = this.DEBUG_MODE ? 6 : 0.6;
	private collisionBlocks: Graphics[] = [];
	private collisionRects: { x: number; y: number; width: number; height: number }[] = [];

	private readonly WORLD_WIDTH = ScaleHelper.IDEAL_WIDTH;
	private readonly WORLD_HEIGHT = (ScaleHelper.IDEAL_WIDTH * 1248) / 832;

	private walkableZoneSprite: Sprite | null = null;
	private walkableZoneCanvas: HTMLCanvasElement | null = null;
	private walkableZoneContext: CanvasRenderingContext2D | null = null;

	// --- Propiedades para el ciclo Día/Noche ---
	private bgDay: Sprite;
	private bgAfternoon: Sprite;
	private bgNight: Sprite;
	private readonly CYCLE_HOLD_TIME = 15000; // Tiempo que se mantiene en una hora (ms)
	private readonly CYCLE_FADE_TIME = 5000; // Tiempo que tarda en cambiar (ms)

	private readonly DEAD_ZONE_WIDTH: number = 15; // Ancho de la zona muerta (en píxeles de pantalla)
	private readonly DEAD_ZONE_HEIGHT: number = 15; // Alto de la zona muerta (en píxeles de pantalla)

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public readonly MOVEMENT_SPEED: number = 0.01;
	private readonly CAMERA_LERP: number = 0.08;

	private interactables: Interactable[] = [];
	private interactionCooldown: number = 0;

	private dialogueOverlay: DialogueOverlay;
	private uiContainer: Container;

	private isZoomedEvent: boolean = false;
	private catNPC: Sprite;

	private tutorialText: Text;
	private tutorialActive: boolean = false;
	constructor() {
		super();
		this.createScene();
	}

	private createScene(): void {
		this.world = new Container();
		this.addChild(this.world);

		SoundLib.stopAllMusic();
		SoundLib.playMusic("initialBGM", { loop: true, volume: 0.2 });
		SoundLib.playSound("winter-wind", { loop: true, volume: 0.05 });

		this.camera = new Container();
		this.world.addChild(this.camera);

		this.createWorldBackground();

		this.startDayNightCycle();

		this.createWalkableZone();

		this.player = new StateMachineAnimator();
		this.player.anchor.set(0.5);
		this.player.addState("idle", [Texture.from("soul_walk0")], 0.2, true);
		this.player.addState("idleback", [Texture.from("soul_walkback0")], 0.2, true);
		this.player.addState(
			"move",
			[
				Texture.from("soul_walk1"),
				Texture.from("soul_walk2"),
				Texture.from("soul_walk3"),
				Texture.from("soul_walk4"),
				Texture.from("soul_walk5"),
				Texture.from("soul_walk6"),
				Texture.from("soul_walk7"),
				Texture.from("soul_walk8"),
				Texture.from("soul_walk9"),
			],
			12,
			true
		);
		this.player.addState(
			"move_back",
			[
				Texture.from("soul_walkback0"),
				Texture.from("soul_walkback1"),
				Texture.from("soul_walkback2"),
				Texture.from("soul_walkback3"),
				Texture.from("soul_walkback4"),
				Texture.from("soul_walkback5"),
				Texture.from("soul_walkback6"),
			],
			6,
			true
		);
		this.player.addState("attack", [Texture.from("player3")], 0.1, false);
		this.player.playState("idleback");
		this.player.scale.set(1.3);

		this.player.x = this.WORLD_WIDTH * 0.5;
		this.player.y = this.WORLD_HEIGHT - 100;
		this.player.anchor.y = 0.8;

		this.createCatNPC();

		this.camera.addChild(this.player);

		// Crear la hitbox de ataque
		this.attackHitbox = new Graphics();
		this.attackHitbox.beginFill(0xff0000, 0.3);
		this.attackHitbox.drawCircle(0, 0, 40);
		this.attackHitbox.endFill();
		this.attackHitbox.visible = false;
		this.camera.addChild(this.attackHitbox);

		const monk = Sprite.from("NPC_monk");
		monk.scale.set(-1, 1);
		this.camera.addChild(monk);
		monk.position.set(460, 2300);

		const frontLayer = Sprite.from("trees_day");
		frontLayer.alpha = 0.8;
		frontLayer.width = this.WORLD_WIDTH;
		frontLayer.height = this.WORLD_HEIGHT;
		frontLayer.name = "frontlayer";
		this.camera.addChild(frontLayer);

		// Crear UI (barra de vida)
		this.createUI();
		this.createInteractionPoints();

		// Centrar la cámara en el jugador
		this.updateCamera();
		this.snapCamera();
	}

	private createCatNPC(): void {
		this.catNPC = Sprite.from("blackcat");
		this.catNPC.anchor.set(0.5);
		this.catNPC.scale.set(0.3);
		// Posición ejemplo (cerca de la casa o colina)
		this.catNPC.position.set(400, 1950);

		// Inicialmente invisible y alpha 0 (porque el juego empieza de día)
		this.catNPC.visible = false;
		this.catNPC.alpha = 0;

		this.camera.addChild(this.catNPC);

		// Agregamos la interacción CON CONDICIÓN
		this.addInteractable(
			this.catNPC.x,
			this.catNPC.y,
			(_target) => {
				this.dialogueOverlay.setPortraitImage("blackcatface");
				this.dialogueOverlay.show("Miau... (El gato parece sonreir... qué extraño nunca vi un gato hacer eso)", "Miau", "#ffff00");
			},
			() => this.catNPC.visible // <--- Condición: Solo interactuar si el gato es visible
		);
	}

	private createWorldBackground(): void {
		// --- 1. CAPA DE DÍA (Base) ---
		// Se queda siempre visible (alpha 1) al fondo.
		this.bgDay = new Sprite(Texture.from("soul_map2"));
		this.bgDay.width = this.WORLD_WIDTH;
		this.bgDay.height = this.WORLD_HEIGHT;
		this.camera.addChildAt(this.bgDay, 0);

		// --- 2. CAPA DE TARDE (Intermedia) ---
		// Empieza invisible. Se desvanecerá sobre el día.
		this.bgAfternoon = new Sprite(Texture.from("soul_map4"));
		this.bgAfternoon.width = this.WORLD_WIDTH;
		this.bgAfternoon.height = this.WORLD_HEIGHT;
		this.bgAfternoon.alpha = 0;
		this.camera.addChildAt(this.bgAfternoon, 1);

		// --- 3. CAPA DE NOCHE (Superior) ---
		// Empieza invisible. Se desvanecerá sobre la tarde.
		this.bgNight = new Sprite(Texture.from("soul_map3"));
		this.bgNight.width = this.WORLD_WIDTH;
		this.bgNight.height = this.WORLD_HEIGHT;
		this.bgNight.alpha = 0;
		this.camera.addChildAt(this.bgNight, 2);
	}

	/**
	 * Inicia la secuencia de tweens infinita: Día -> Tarde -> Noche -> Día
	 */
	private startDayNightCycle(): void {
		console.log(CLASS_NAME, "Iniciando ciclo día/noche");

		// Estado inicial: Estamos en DÍA (Day=1, Aft=0, Night=0)
		// Esperamos el tiempo de "hold" antes de empezar a atardecer
		new Tween({ val: 0 })
			.to({ val: 1 }, this.CYCLE_HOLD_TIME) // Espera simulada
			.onComplete(() => {
				// --- FASE 1: Atardecer (Aparece bgAfternoon) ---
				console.log(CLASS_NAME, "Transición a TARDE");
				new Tween(this.bgAfternoon)
					.to({ alpha: 1 }, this.CYCLE_FADE_TIME)
					.easing(Easing.Linear.None)
					.start()
					.onComplete(() => {
						// Esperamos mientras es tarde...
						new Tween({ val: 0 })
							.to({ val: 1 }, this.CYCLE_HOLD_TIME)
							.onComplete(() => {
								// --- FASE 2: Anochecer (Aparece bgNight) ---
								console.log(CLASS_NAME, "Transición a NOCHE");

								this.catNPC.visible = true;
								new Tween(this.catNPC).to({ alpha: 1 }, this.CYCLE_FADE_TIME).start();

								new Tween(this.bgNight)
									.to({ alpha: 1 }, this.CYCLE_FADE_TIME)
									.easing(Easing.Linear.None)
									.start()
									.onComplete(() => {
										// Esperamos mientras es noche...
										new Tween({ val: 0 })
											.to({ val: 1 }, this.CYCLE_HOLD_TIME)
											.onComplete(() => {
												// --- FASE 3: Amanecer (Ocultamos Night y Afternoon) ---
												// Al bajar la opacidad de ambos a 0, se revela el bgDay que está al fondo
												console.log(CLASS_NAME, "Transición a DÍA");
												// AQUI: DESAPARECE EL GATO
												new Tween(this.catNPC)
													.to({ alpha: 0 }, this.CYCLE_FADE_TIME)
													.onComplete(() => {
														this.catNPC.visible = false;
													}) // Apagar visible al terminar fade
													.start();
												new Tween(this.bgNight).to({ alpha: 0 }, this.CYCLE_FADE_TIME).start();

												new Tween(this.bgAfternoon)
													.to({ alpha: 0 }, this.CYCLE_FADE_TIME)
													.start()
													.onComplete(() => {
														// El ciclo ha terminado, volvemos a empezar
														this.startDayNightCycle();
													});
											})
											.start();
									});
							})
							.start();
					});
			})
			.start();
	}

	private createWalkableZone(): void {
		// Cargar el sprite de la zona caminable
		this.walkableZoneSprite = new Sprite(Texture.from("soul_map4_walkablezone"));
		this.walkableZoneSprite.x = 0;
		this.walkableZoneSprite.y = 0;
		this.walkableZoneSprite.alpha = 0.01;
		this.walkableZoneSprite.width = this.WORLD_WIDTH;
		this.walkableZoneSprite.height = this.WORLD_HEIGHT;

		// En modo DEBUG, mostrar la zona caminable con transparencia
		if (this.DEBUG_MODE) {
			this.walkableZoneSprite.alpha = 0.5;
			this.walkableZoneSprite.tint = 0x00ff00; // Verde
			this.camera.addChild(this.walkableZoneSprite);
		}

		// Crear canvas para verificar píxeles
		this.walkableZoneCanvas = document.createElement("canvas");
		this.walkableZoneCanvas.width = this.walkableZoneSprite.texture.baseTexture.width;
		this.walkableZoneCanvas.height = this.walkableZoneSprite.texture.baseTexture.height;

		// ← CAMBIO AQUÍ: Agregar willReadFrequently
		this.walkableZoneContext = this.walkableZoneCanvas.getContext("2d", { willReadFrequently: true });

		// Dibujar la textura en el canvas
		const img = this.walkableZoneSprite.texture.baseTexture.resource as any;
		if (img && img.source) {
			this.walkableZoneContext?.drawImage(img.source, 0, 0);
		}
	}

	public createWorldObjects(): void {
		// Crear árboles/obstáculos aleatorios por el mundo
		const objectCount = 30;
		for (let i = 0; i < objectCount; i++) {
			const obj = new Sprite(Texture.from("player1"));
			obj.anchor.set(0.5);
			obj.tint = 0x8b4513; // Color café para simular árboles
			obj.scale.set(2);

			// Posición aleatoria evitando el centro donde aparece el jugador
			let x, y;
			do {
				x = Math.random() * (this.WORLD_WIDTH - 200) + 100;
				y = Math.random() * (this.WORLD_HEIGHT - 200) + 100;
			} while (Math.abs(x - this.WORLD_WIDTH * 0.5) < 200 && Math.abs(y - this.WORLD_HEIGHT * 0.5) < 200);

			obj.x = x;
			obj.y = y;
			this.worldObjects.push(obj);
			this.camera.addChild(obj);
		}
	}

	// no se usa si se usa la walkable zone
	public createCollisionBlocks(): void {
		// Define aquí las posiciones de tus bloques de colisión
		// Formato: { x, y, width, height }
		const collisionData = [
			// Ejemplo: paredes del borde superior
			{ x: 0, y: 0, width: this.WORLD_WIDTH, height: 50 },

			// Ejemplo: pared izquierda
			{ x: 0, y: 0, width: 50, height: this.WORLD_HEIGHT },

			// Ejemplo: pared derecha
			{ x: this.WORLD_WIDTH - 50, y: 0, width: 50, height: this.WORLD_HEIGHT },

			// Ejemplo: pared inferior
			{ x: 0, y: this.WORLD_HEIGHT - 50, width: this.WORLD_WIDTH, height: 50 },

			{ x: 0, y: 0, width: 700, height: 600 },
			{ x: 1300, y: 0, width: 700, height: 600 }, // Obstáculo en el medio del mapa
			{ x: 700, y: 0, width: 700, height: 300 },
			{ x: 700, y: 300, width: 200, height: 300 },
			{ x: 1100, y: 300, width: 200, height: 300 },
			{ x: 0, y: 600, width: 700, height: 700 },
			{ x: 700, y: 600, width: 100, height: 500 },
			{ x: 1300, y: 600, width: 700, height: 700 },

			{ x: 1150, y: 1735, width: 300, height: 280 },
			// { x: 500, y: 400, width: 150, height: 80 },
		];

		this.collisionRects = collisionData;

		// Crear visualización de los bloques
		collisionData.forEach((rect) => {
			const block = new Graphics();

			if (this.DEBUG_MODE) {
				// En modo DEBUG: rojo semi-transparente
				block.beginFill(0xff0000, 0.3);
				block.lineStyle(2, 0xff0000, 1);
			} else {
				// Fuera de DEBUG: completamente invisible
				block.beginFill(0xff0000, 0);
				block.lineStyle(0, 0xff0000, 0);
			}

			block.drawRect(rect.x, rect.y, rect.width, rect.height);
			block.endFill();

			this.collisionBlocks.push(block);
			this.camera.addChild(block);
		});
	}

	public createEnemies(): void {
		const enemyPositions = [
			{ x: this.WORLD_WIDTH * 0.3, y: this.WORLD_HEIGHT * 0.3 },
			{ x: this.WORLD_WIDTH * 0.7, y: this.WORLD_HEIGHT * 0.3 },
			{ x: this.WORLD_WIDTH * 0.3, y: this.WORLD_HEIGHT * 0.7 },
			{ x: this.WORLD_WIDTH * 0.7, y: this.WORLD_HEIGHT * 0.7 },
			{ x: this.WORLD_WIDTH * 0.5, y: this.WORLD_HEIGHT * 0.2 },
			{ x: this.WORLD_WIDTH * 0.2, y: this.WORLD_HEIGHT * 0.5 },
		];

		enemyPositions.forEach((pos) => {
			const sprite = new Sprite(Texture.from("player1"));
			sprite.anchor.set(0.5);
			sprite.tint = 0xff0000;
			sprite.scale.set(1.2);
			sprite.x = pos.x;
			sprite.y = pos.y;
			this.camera.addChild(sprite);

			// Crear barra de vida del enemigo
			const healthBar = new Graphics();
			this.camera.addChild(healthBar);

			const enemy: Enemy = {
				sprite,
				health: 30,
				maxHealth: 30,
				healthBar,
				speed: 2,
				state: "patrol",
				patrolDirection: { x: Math.random() - 0.5, y: Math.random() - 0.5 },
				patrolTimer: 0,
			};

			this.enemies.push(enemy);
		});
	}

	public createUI(): void {
		// Crear contenedor de UI (no se mueve con la cámara)
		this.uiContainer = new Container();
		this.addChild(this.uiContainer);

		// // Barra de vida del jugador
		// this.healthBar = new Graphics();
		// this.updateHealthBar();
		// uiContainer.addChild(this.healthBar);

		// // Texto de instrucciones
		// const instructions = new Graphics();
		// instructions.beginFill(0x000000, 0.7);
		// instructions.drawRoundedRect(10, Manager.height - 100, 300, 90, 5);
		// instructions.endFill();
		// uiContainer.addChild(instructions);
		// Instanciar el Overlay de Diálogo (ENCIMA DE TODO)
		this.dialogueOverlay = new DialogueOverlay();
		this.uiContainer.addChild(this.dialogueOverlay);

		this.dialogueOverlay.show(
			"Uh... Dónde estoy... Un bosque? Seguro me golpeé la cabeza. Pero bueno lo importante: Donde está Cuba? Tengo que buscarla, seguro está asustada",
			"Cuba", // Palabra a resaltarw
			"#ff0000" // Color rojo
		);

		// --- NUEVO: TEXTO DE TUTORIAL ---
		const style = new TextStyle({
			fontFamily: "Pixelate-Regular", // Asegúrate de que la fuente esté cargada
			fontSize: 40,
			lineHeight: 60,
			fill: 0xffffff,
			align: "center",
		});

		if (isMobile) {
			style.wordWrap = true;
			style.wordWrapWidth = 360;
		}

		this.tutorialText = new Text("Usa WASD o Flechas para moverte", style);
		this.tutorialText.anchor.set(0.5);
		// Lo ponemos abajo al centro de la pantalla
		this.tutorialText.position.set(Manager.width / 2, Manager.height - 100);
		this.tutorialText.alpha = 0; // Invisible al inicio
		this.uiContainer.addChild(this.tutorialText);
	}

	private updateHealthBar(): void {
		this.healthBar.clear();

		// Fondo de la barra
		this.healthBar.beginFill(0x333333);
		this.healthBar.drawRoundedRect(10, 10, 200, 20, 5);
		this.healthBar.endFill();

		// Vida actual
		const healthPercent = this.playerHealth / this.playerMaxHealth;
		const color = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffaa00 : 0xff0000;

		this.healthBar.beginFill(color);
		this.healthBar.drawRoundedRect(10, 10, 200 * healthPercent, 20, 5);
		this.healthBar.endFill();

		// Borde
		this.healthBar.lineStyle(2, 0xffffff);
		this.healthBar.drawRoundedRect(10, 10, 200, 20, 5);
	}

	private updateCamera(): void {
		const currentScale = this.camera.scale.x; // Asumimos escala uniforme X e Y

		// 1. Calcular la posición del jugador RELATIVA a la pantalla CON ESCALA.
		// La fórmula cambia: (PosMundo * Escala) + PosCamara
		const playerScreenX = this.player.x * currentScale + this.camera.x;
		const playerScreenY = this.player.y * currentScale + this.camera.y;

		// 2. Definir los límites de la Zona Muerta (Dead Zone).
		const centerX = Manager.width * 0.5;
		const centerY = Manager.height * 0.5;

		const minDeadZoneX = centerX - this.DEAD_ZONE_WIDTH * 0.5;
		const maxDeadZoneX = centerX + this.DEAD_ZONE_WIDTH * 0.5;
		const minDeadZoneY = centerY - this.DEAD_ZONE_HEIGHT * 0.5;
		const maxDeadZoneY = centerY + this.DEAD_ZONE_HEIGHT * 0.5;

		// 3. Calcular el Target X y Target Y.
		let targetX = this.camera.x;
		let targetY = this.camera.y;

		// --- Lógica de la Zona Muerta en X ---
		if (playerScreenX < minDeadZoneX) {
			targetX += minDeadZoneX - playerScreenX;
		} else if (playerScreenX > maxDeadZoneX) {
			targetX += maxDeadZoneX - playerScreenX;
		}

		// --- Lógica de la Zona Muerta en Y ---
		if (playerScreenY < minDeadZoneY) {
			targetY += minDeadZoneY - playerScreenY;
		} else if (playerScreenY > maxDeadZoneY) {
			targetY += maxDeadZoneY - playerScreenY;
		}

		// 4. Limitar a los bordes del mundo (Clamping con ESCALA)
		// El ancho efectivo del mundo crece con el zoom, así que el límite cambia
		const minWorldX = Manager.width - this.WORLD_WIDTH * currentScale;
		const minWorldY = Manager.height - this.WORLD_HEIGHT * currentScale;

		// Asegurar que la cámara no se salga (0 es el límite superior/izquierdo)
		targetX = Math.max(minWorldX, Math.min(0, targetX));
		targetY = Math.max(minWorldY, Math.min(0, targetY));

		// 5. Aplicar LERP
		this.camera.x += (targetX - this.camera.x) * this.CAMERA_LERP;
		this.camera.y += (targetY - this.camera.y) * this.CAMERA_LERP;
	}

	/**
	 * Realiza un zoom suave de la cámara.
	 * @param targetScale Escala objetivo (ej: 1.5 para zoom in, 1.0 para normal)
	 * @param duration Duración en ms
	 */
	private animateCameraZoom(targetScale: number, duration: number = 2000): void {
		new Tween({ val: this.camera.scale.x })
			.to({ val: targetScale }, duration)
			.easing(Easing.Quadratic.Out) // Un suavizado agradable
			.onUpdate((obj) => {
				// Aplicar escala
				this.camera.scale.set(obj.val);
				// Forzar actualización de cámara inmediatamente para evitar "saltos" visuales
				// ya que al cambiar la escala, el updateCamera necesita recalibrar la posición X/Y
				this.updateCamera();
			})
			.start();
	}

	private snapCamera(): void {
		// En el snap inicial, simplemente centramos la cámara en el jugador sin Dead Zone.
		let targetX = Manager.width * 0.5 - this.player.x;
		let targetY = Manager.height * 0.5 - this.player.y;

		const minX = Manager.width - this.WORLD_WIDTH;
		const minY = Manager.height - this.WORLD_HEIGHT;

		this.camera.x = Math.max(minX, Math.min(0, targetX));
		this.camera.y = Math.max(minY, Math.min(0, targetY));
	}

	private movePlayer(dx: number, dy: number): void {
		const newX = this.player.x + dx;
		const newY = this.player.y + dy;

		// Verificar si la nueva posición es caminable
		const canWalk = this.isWalkable(newX, newY);

		if (canWalk) {
			// Limitar el movimiento a los bordes del mundo
			if (newX >= 50 && newX <= this.WORLD_WIDTH - 50) {
				this.player.x = newX;
			}
			if (newY >= 50 && newY <= this.WORLD_HEIGHT - 50) {
				this.player.y = newY;
			}
		} else {
			// Si no puede caminar en diagonal, intentar solo X
			const canWalkX = this.isWalkable(newX, this.player.y);
			if (canWalkX && newX >= 50 && newX <= this.WORLD_WIDTH - 50) {
				this.player.x = newX;
			}

			// Intentar solo Y
			const canWalkY = this.isWalkable(this.player.x, newY);
			if (canWalkY && newY >= 50 && newY <= this.WORLD_HEIGHT - 50) {
				this.player.y = newY;
			}
		}

		this.updateCamera();
	}

	public checkCollision(x: number, y: number, radius: number = 25): boolean {
		// Verificar colisión con cada bloque
		for (const rect of this.collisionRects) {
			// Encontrar el punto más cercano del rectángulo al círculo del jugador
			const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
			const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));

			// Calcular distancia entre el punto más cercano y el centro del jugador
			const distanceX = x - closestX;
			const distanceY = y - closestY;
			const distanceSquared = distanceX * distanceX + distanceY * distanceY;

			// Si la distancia es menor al radio, hay colisión
			if (distanceSquared < radius * radius) {
				return true;
			}
		}
		return false;
	}

	private isWalkable(x: number, y: number): boolean {
		if (!this.walkableZoneContext || !this.walkableZoneCanvas) {
			return true; // Si no hay zona caminable, permitir todo
		}

		// Convertir coordenadas del mundo a coordenadas de la textura
		const textureX = (x / this.WORLD_WIDTH) * this.walkableZoneCanvas.width;
		const textureY = (y / this.WORLD_HEIGHT) * this.walkableZoneCanvas.height;

		// Asegurar que sean números válidos y enteros
		const pixelX = Math.floor(textureX);
		const pixelY = Math.floor(textureY);

		// Verificar que esté dentro de los límites
		if (
			!Number.isFinite(pixelX) ||
			!Number.isFinite(pixelY) ||
			pixelX < 0 ||
			pixelX >= this.walkableZoneCanvas.width ||
			pixelY < 0 ||
			pixelY >= this.walkableZoneCanvas.height
		) {
			return false;
		}

		try {
			// Obtener el píxel en esa posición
			const pixelData = this.walkableZoneContext.getImageData(pixelX, pixelY, 1, 1).data;

			// Si el píxel tiene alpha > 128, es caminable (blanco o visible)
			// Si el alpha es bajo o es negro/transparente, no es caminable
			const alpha = pixelData[3];

			return alpha > 128;
		} catch (error) {
			console.error("Error checking walkable zone:", error);
			return true; // En caso de error, permitir movimiento
		}
	}

	private updateEnemies(dt: number): void {
		this.enemies.forEach((enemy, _index) => {
			if (enemy.state === "dead") {
				return;
			}

			const dx = this.player.x - enemy.sprite.x;
			const dy = this.player.y - enemy.sprite.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Actualizar estado del enemigo
			if (distance < 250) {
				enemy.state = "chase";
			} else {
				enemy.state = "patrol";
			}

			// Comportamiento según el estado
			if (enemy.state === "chase") {
				// Perseguir al jugador
				const moveX = (dx / distance) * enemy.speed;
				const moveY = (dy / distance) * enemy.speed;
				enemy.sprite.x += moveX;
				enemy.sprite.y += moveY;

				// Daño por contacto
				if (distance < 40 && this.movementDirection !== "attack") {
					this.playerHealth -= 0.3;
					this.playerHealth = Math.max(0, this.playerHealth);
					this.updateHealthBar();
				}
			} else {
				// Patrullar
				enemy.patrolTimer += dt;
				if (enemy.patrolTimer > 2000) {
					enemy.patrolDirection = {
						x: Math.random() - 0.5,
						y: Math.random() - 0.5,
					};
					enemy.patrolTimer = 0;
				}

				enemy.sprite.x += enemy.patrolDirection.x * enemy.speed;
				enemy.sprite.y += enemy.patrolDirection.y * enemy.speed;

				// Limitar patrulla a los bordes del mundo
				enemy.sprite.x = Math.max(50, Math.min(this.WORLD_WIDTH - 50, enemy.sprite.x));
				enemy.sprite.y = Math.max(50, Math.min(this.WORLD_HEIGHT - 50, enemy.sprite.y));
			}

			// Actualizar barra de vida del enemigo
			this.updateEnemyHealthBar(enemy);
		});
	}

	private updateEnemyHealthBar(enemy: Enemy): void {
		enemy.healthBar.clear();

		if (enemy.health <= 0) {
			return;
		}

		const barWidth = 40;
		const barHeight = 5;
		const healthPercent = enemy.health / enemy.maxHealth;

		// Fondo
		enemy.healthBar.beginFill(0x000000);
		enemy.healthBar.drawRect(enemy.sprite.x - barWidth / 2, enemy.sprite.y - 40, barWidth, barHeight);
		enemy.healthBar.endFill();

		// Vida
		enemy.healthBar.beginFill(0xff0000);
		enemy.healthBar.drawRect(enemy.sprite.x - barWidth / 2, enemy.sprite.y - 40, barWidth * healthPercent, barHeight);
		enemy.healthBar.endFill();
	}

	private performAttack(): void {
		this.attackHitbox.x = this.player.x;
		this.attackHitbox.y = this.player.y;
		this.attackHitbox.visible = true;

		// Verificar colisión con enemigos
		this.enemies.forEach((enemy) => {
			if (enemy.state === "dead" || enemy.health <= 0) {
				return;
			}

			const dx = enemy.sprite.x - this.player.x;
			const dy = enemy.sprite.y - this.player.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < 50) {
				enemy.health -= 15;

				if (enemy.health <= 0) {
					enemy.state = "dead";
					enemy.sprite.alpha = 0.3;
					enemy.healthBar.clear();
					logger.log("¡Enemigo derrotado!");
				}
			}
		});
	}

	private createInteractionPoints(): void {
		// path1
		this.addInteractable(
			430, // X
			2450, // Y
			(_target) => {
				this.dialogueOverlay.setPortraitImage("NPC_monkface");
				this.animateCameraZoom(1.5, 1500); // Zoom x1.5 en 1.5 segundos
				this.isZoomedEvent = true; // Marcamos que estamos en un evento de zoom

				this.dialogueOverlay.show(
					"Hay muchos animales en el bosque, pero no recuerdo haber visto una Border Collie. Ten cuidado, si he visto una Sombra merodeando durante la noche.",
					"Sombra", // Palabra a resaltar
					"#ff0000" // Color rojo
				);
			}
		);
		// treehouse
		this.addInteractable(
			1230, // X
			2050, // Y
			(target) => {
				logger.log("¡Interactuaste con el objeto misterioso de la casa de arbol!");

				// Aquí podrías abrir un diálogo, cambiar de escena, etc.
				// Ejemplo visual: cambiar el color del indicador momentáneamente
				const graphics1 = target.prompt.getChildAt(0) as Graphics;
				graphics1.tint = 0x00ff00; // Se pone verde al usarlo
				setTimeout(() => (graphics1.tint = 0xffffff), 200);
			}
		);
		// hill prev
		this.addInteractable(
			950, // X
			630, // Y
			(target) => {
				logger.log("¡Interactuaste con el objeto misterioso de la colina!");

				// Aquí podrías abrir un diálogo, cambiar de escena, etc.
				// Ejemplo visual: cambiar el color del indicador momentáneamente
				const graphics = target.prompt.getChildAt(0) as Graphics;
				graphics.tint = 0x00ff00; // Se pone verde al usarlo
				setTimeout(() => (graphics.tint = 0xffffff), 200);
			}
		);
		// hill
		this.addInteractable(
			930, // X
			330, // Y
			(_target) => {
				// 1. Activar el Zoom In
				this.animateCameraZoom(1.5, 1500); // Zoom x1.5 en 1.5 segundos
				this.isZoomedEvent = true; // Marcamos que estamos en un evento de zoom

				this.dialogueOverlay.setPortraitImage("playerface");
				this.dialogueOverlay.show(
					"Qué... paz se encuentra en esta vista.",
					"", // Palabra a resaltar
					"#ff0000" // Color rojo
				);
			}
		);
	}

	private addInteractable(
		x: number,
		y: number,
		callback: (target: Interactable) => void,
		condition?: () => boolean // <--- NUEVO
	): void {
		// 1. Crear el contenedor visual para la tecla "E"
		const promptContainer = new Container();
		promptContainer.x = x;
		promptContainer.y = y - 60; // Que flote un poco arriba del punto
		promptContainer.visible = false; // Invisible por defecto

		// --- Opción A: Gráfico simple con Texto (Sin assets externos) ---
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.7);
		bg.lineStyle(2, 0xffffff);
		bg.drawRoundedRect(-15, -15, 30, 30, 5); // Un cuadrado redondeado
		bg.endFill();

		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 20,
			fontWeight: "bold",
			fill: "#ffffff",
		});
		const letter = new Text("E", style);
		letter.anchor.set(0.5);

		promptContainer.addChild(bg, letter);

		// --- Opción B: Si tienes un Sprite (Descomenta esto y borra la Opción A) ---
		// const keySprite = new Sprite(Texture.from("keyboard_e_key"));
		// keySprite.anchor.set(0.5);
		// promptContainer.addChild(keySprite);

		this.camera.addChild(promptContainer);

		// 2. Animación de flotación (Tween infinito)
		new Tween(promptContainer)
			.to({ y: promptContainer.y - 10 }, 800) // Sube 10px
			.yoyo(true) // Vuelve a bajar
			.repeat(Infinity) // Repetir por siempre
			.easing(Easing.Quadratic.InOut)
			.start();

		// 3. Guardar en la lista
		this.interactables.push({
			x: x,
			y: y,
			radius: 80, // Distancia de activación
			prompt: promptContainer,
			action: () => callback(this.interactables[this.interactables.length - 1]),
			isActive: false,
			condition: condition, // <--- Guardamos la condición
		});
	}

	private updateInteractions(dt: number): void {
		if (this.interactionCooldown > 0) {
			this.interactionCooldown -= dt;
		}

		const playerX = this.player.x;
		const playerY = this.player.y;

		this.interactables.forEach((item) => {
			// 1. CHEQUEO DE CONDICIÓN EXTERNA (NUEVO)
			// Si tiene condición y esta devuelve false (ej: el gato no está), ocultamos todo y saltamos.
			if (item.condition && !item.condition()) {
				item.prompt.visible = false;
				return;
			}
			// Calcular distancia
			const dx = item.x - playerX;
			const dy = item.y - playerY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Mostrar u ocultar la "E"
			if (dist < item.radius) {
				if (!item.prompt.visible) {
					item.prompt.visible = true;
					// Resetear escala o alpha si quisieras una animación de entrada
					item.prompt.alpha = 0;
					new Tween(item.prompt).to({ alpha: 1 }, 200).start();
				}

				// Detectar Input (Tecla E)
				if (Keyboard.shared.isDown("KeyE") && this.interactionCooldown <= 0) {
					item.action();
					this.interactionCooldown = 500; // Cooldown de 0.5s
				}
			} else {
				if (item.prompt.visible) {
					item.prompt.visible = false;
				}
			}
		});
	}

	public override update(dt: number): void {
		if (this.dialogueOverlay.isOpen) {
			// Scroll con ArrowDown o S si el diálogo tiene contenido desbordado
			if ((Keyboard.shared.justPressed("ArrowDown") || Keyboard.shared.justPressed("KeyS")) && this.dialogueOverlay.canScroll()) {
				// Si hay espacio para scrollear, scrolleamos un paso (no cerramos)
				this.dialogueOverlay.scrollStepDown();
				// Si al scrollear quedamos al final, la siguiente pulsación de ArrowDown podría cerrar (ver abajo)
				return;
			}
			if (Keyboard.shared.justPressed("ArrowUp") || Keyboard.shared.justPressed("KeyW")) {
				if (this.dialogueOverlay.canScroll()) {
					this.dialogueOverlay.scrollStepUp();
					return;
				}
			}

			// Detectar cierre con Space o Enter (solo cuando no está tipeando)
			if (Keyboard.shared.justPressed("Space") || Keyboard.shared.justPressed("Enter")) {
				if (this.dialogueOverlay.isTyping) {
					// Opcional: forzar terminar texto (no implementado aquí)
				} else {
					this.dialogueOverlay.hide();

					// --- NUEVO: Mostrar tutorial al cerrar diálogo ---
					// Verificamos si el tutorial aún no ha sido activado nunca (alpha 0)
					if (this.tutorialText.alpha === 0 && !this.tutorialActive) {
						this.tutorialActive = true;
						new Tween(this.tutorialText)
							.to({ alpha: 1 }, 1000) // Aparece suavemente en 1 seg
							.start();
					}
					// ------------------------------------------------

					if (this.isZoomedEvent) {
						this.animateCameraZoom(1.0, 1000);
						this.isZoomedEvent = false;
					}
				}
			}
			return;
		}

		// --- NUEVO: Ocultar tutorial al moverse ---
		if (this.tutorialActive) {
			// Si presionan CUALQUIER tecla de movimiento
			if (
				Keyboard.shared.isDown("ArrowUp") ||
				Keyboard.shared.isDown("KeyW") ||
				Keyboard.shared.isDown("ArrowDown") ||
				Keyboard.shared.isDown("KeyS") ||
				Keyboard.shared.isDown("ArrowLeft") ||
				Keyboard.shared.isDown("KeyA") ||
				Keyboard.shared.isDown("ArrowRight") ||
				Keyboard.shared.isDown("KeyD")
			) {
				new Tween(this.tutorialText)
					.to({ alpha: 0 }, 500) // Desaparece en medio segundo
					.start();
			}
		}
		// ------------------------------------------

		let moved = false;
		let dx = 0;
		let dy = 0;
		let scalex = 1.3;
		let scaley = 1.3;

		// Actualizar cooldowns
		if (this.attackCooldown > 0) {
			this.attackCooldown -= dt;
		}
		if (this.attackDuration > 0) {
			this.attackDuration -= dt;
			if (this.attackDuration <= 0) {
				this.attackHitbox.visible = false;
			}
		}

		// Movimiento del jugador
		if (Keyboard.shared.isDown("ArrowUp") || Keyboard.shared.isDown("KeyW")) {
			dy -= this.MOVEMENT_SPEED;
			moved = true;
			this.facingDirection = "up";
		}
		if (Keyboard.shared.isDown("ArrowDown") || Keyboard.shared.isDown("KeyS")) {
			dy += this.MOVEMENT_SPEED;
			moved = true;
			this.facingDirection = "down";
		}
		if (Keyboard.shared.isDown("ArrowLeft") || Keyboard.shared.isDown("KeyA")) {
			dx -= this.MOVEMENT_SPEED;
			moved = true;
			scalex = -1.3;
			this.facingDirection = "left";
		}
		if (Keyboard.shared.isDown("ArrowRight") || Keyboard.shared.isDown("KeyD")) {
			dx += this.MOVEMENT_SPEED;
			moved = true;
			this.facingDirection = "right";
		}

		// Ataque
		if (Keyboard.shared.isDown("Space") && this.attackCooldown <= 0) {
			this.movementDirection = "attack";
			if (this.currentState !== "attack") {
				this.currentState = "attack";
				this.player.playState("attack");
			}
			this.performAttack();
			this.attackCooldown = 500; // 500ms de cooldown
			this.attackDuration = 200; // Duración del ataque
		}

		// Aplicar movimiento
		if (moved && this.attackDuration <= 0) {
			const magnitude = Math.sqrt(dx * dx + dy * dy);
			dx = (dx / magnitude) * this.playerSpeed;
			dy = (dy / magnitude) * this.playerSpeed;
			this.movePlayer(dx, dy);
			this.player.scale.set(scalex, scaley);

			if (this.movementDirection !== "attack") {
				// Determinar qué animación de movimiento usar según la dirección
				const newState = this.facingDirection === "up" ? "move_back" : "move";

				if (this.currentState !== newState) {
					this.currentState = newState;
					this.player.playState(newState);
					SoundLib.playMusic("leafwalk", { loop: true, volume: 0.1 });
				}
				this.movementDirection = "move";
			}
		} else if (!moved && this.attackDuration <= 0) {
			if (this.movementDirection !== "idle") {
				this.movementDirection = "idle";
				this.currentState = "idle";
				SoundLib.stopMusic("leafwalk");
				this.player.playState("idle");
			}
		}

		// Actualizar enemigos
		this.updateEnemies(dt);

		this.updateInteractions(dt);

		// Game Over
		if (this.playerHealth <= 0) {
			logger.log("Game Over!");
		}
	}
}
