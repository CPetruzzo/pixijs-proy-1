import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Timer } from "../../../engine/tweens/Timer";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Keyboard } from "../../../engine/input/Keyboard";
import { DataManager } from "../../../engine/datamanager/DataManager";
import { UIContainerRight } from "../GlobalGameJam/BubbleUI";
import { Manager } from "../../..";
import { filters } from "@pixi/sound";

/** ---------- Placeholder Stone (obstáculo) ---------- */
class Stone extends Container {
	public radius = 18;
	public active = false;
	public speedX = -420;

	private g: Graphics;
	constructor(radius = 18) {
		super();
		this.radius = radius;
		this.g = new Graphics();
		this.addChild(this.g);
		this.visible = false;
		this.draw();
	}

	private draw(): void {
		this.g.clear();
		this.g.beginFill(0x6b6b6b);
		this.g.lineStyle(2, 0x333333);
		this.g.drawCircle(0, 0, this.radius);
		this.g.endFill();
	}

	public spawn(x: number, y: number, speedX: number, scale = 1): void {
		this.position.set(x, y);
		this.speedX = speedX;
		this.scale.set(scale);
		this.active = true;
		this.visible = true;
		this.draw();
	}

	public update(dtMs: number): void {
		if (!this.active) {
			return;
		}
		this.x += (this.speedX * dtMs) / 1000;
		if (this.x < -200) {
			this.reset();
		}
	}

	public reset(): void {
		this.active = false;
		this.visible = false;
		this.position.set(-9999, -9999);
		// remover del parent para mantener el display list limpio
		try {
			if (this.parent) {
				this.parent.removeChild(this);
			}
			// eslint-disable-next-line prettier/prettier
		} catch { }
	}
}

/** ---------- Checkpoint (similar a Stone, no daña) ---------- */
class Checkpoint extends Container {
	public radius = 22;
	public active = false;
	public speedX = -420;
	private g: Graphics;
	public id: number; // opcional, útil para debug

	constructor(radius = 22, id = 0) {
		super();
		this.radius = radius;
		this.id = id;
		this.g = new Graphics();
		this.addChild(this.g);
		this.visible = false;
		this.draw();
	}

	private draw(): void {
		this.g.clear();
		this.g.beginFill(0xffd700); // color dorado para checkpoint
		this.g.lineStyle(3, 0xbb8f00);
		this.g.drawCircle(0, 0, this.radius);
		this.g.endFill();

		// dibujar un ícono "?" en el centro (opcional, simple)
		this.g.beginFill(0x000000);
		this.g.drawCircle(0, -2, this.radius * 0.35);
		this.g.endFill();
	}

	public spawn(x: number, y: number, speedX: number, scale = 1): void {
		this.position.set(x, y);
		this.speedX = speedX;
		this.scale.set(scale);
		this.active = true;
		this.visible = true;
		this.draw();
	}

	public update(dtMs: number): void {
		if (!this.active) {
			return;
		}
		this.x += (this.speedX * dtMs) / 1000;
		if (this.x < -300) {
			this.reset();
		}
	}

	public reset(): void {
		this.active = false;
		this.visible = false;
		this.position.set(-9999, -9999);
		try {
			if (this.parent) {
				this.parent.removeChild(this);
			}
			// eslint-disable-next-line prettier/prettier
		} catch { }
	}
}

/** ---------- Player (moto) placeholder ---------- */
class PlayerBike extends Container {
	public sprite?: Sprite;
	public graphic?: Graphics; // fallback
	public lanesY: number[] = [800, 880, 960];
	public laneIndex = 1;
	public isJumping = false;
	public invulnerable = false;
	// si la sprite está disponible usaremos sus dimensiones; si no, estos valores sirven de fallback
	public widthBox = 120;
	public heightBox = 64;
	public speedTrail?: Sprite | Graphics; // efecto visual para speed-up
	public speedTrailVisible = false;
	// shake internals
	private bob: Container; // contenedor interno que se "shakerea"
	private shakeTween?: any;

	constructor() {
		super();

		// preparar bob container antes de crear children para poder animarlo
		this.bob = new Container();
		this.addChild(this.bob);

		// Intentar crear sprite "espert"
		try {
			const tex = Texture.from("espert");
			this.sprite = new Sprite(tex);
			this.sprite.anchor.set(0.5, 0.7);
			// tamaño por defecto de la sprite (puedes ajustarlo)
			this.sprite.scale.set(0.5); // cambia si quieres otra escala
			this.addChild(this.sprite);

			new Tween(this.sprite).from({ y: 0 }).to({ y: 3 }, 70).start().yoyo(true).repeat(Infinity);
			// Si la textura todavía no está lista, opcionalmente dibujamos un fallback gráfico debajo
			// (se reemplazará automáticamente cuando la textura cargue)
			if (!tex.baseTexture.valid) {
				this.createGraphicFallback();
				// cuando la textura cargue, removemos el fallback
				tex.baseTexture.on("loaded", () => {
					if (this.graphic && this.graphic.parent) {
						this.removeChild(this.graphic);
						this.graphic.destroy();
						this.graphic = undefined;
					}
					// actualizar bounds aproximados basados en sprite
					this.updateHitboxFromSprite();
				});
			} else {
				// textura ya válida: actualizamos hitbox
				this.updateHitboxFromSprite();
			}
		} catch (err) {
			// Si algo falla, usamos graphic fallback completo
			console.warn("[PlayerBike] could not create 'espert' sprite, using graphic fallback:", err);
			this.createGraphicFallback();
		}

		try {
			const trailTex = Texture.from("espertSpeedUp");
			if (trailTex && trailTex.baseTexture) {
				this.speedTrail = new Sprite(trailTex);
				this.speedTrail.anchor.set(0.5, 0.5);
				// colocarlo un poco detrás/arriba de la moto (ajusta valores si hace falta)
				this.speedTrail.position.set(-40, 4);
				this.speedTrail.scale.set(0.5);
				this.speedTrail.alpha = 0.0;
				// ponerlo al fondo del container para que quede detrás
				this.addChildAt(this.speedTrail, 0);
			} else {
				// fallback gráfico si la textura no está disponible aún
				const g = new Graphics();
				g.beginFill(0xffa500, 0.9);
				g.drawEllipse(-40, 6, 28, 12);
				g.endFill();
				g.alpha = 0.0;
				this.speedTrail = g;
				this.addChildAt(this.speedTrail, 0);
			}
		} catch (err) {
			// fallback gráfico
			const g = new Graphics();
			g.beginFill(0xffa500, 0.9);
			g.drawEllipse(-40, 6, 28, 12);
			g.endFill();
			g.alpha = 0.0;
			this.speedTrail = g;
			this.addChildAt(this.speedTrail, 0);
		}
	}

	// método público para encender/apagar el trail por un tiempo (ms)
	public showSpeedTrail(durationMs: number): void {
		if (!this.speedTrail) {
			return;
		}
		// si ya estaba visible, reiniciamos timer y animación
		this.speedTrailVisible = true;
		// animación de entrada (fade + scale pequeño)
		try {
			this.speedTrail.alpha = 0;
			this.speedTrail.x = -110;
			this.speedTrail.y = -70;
			this.speedTrail.scale.set(0, 0.6);
			new Tween(this.speedTrail)
				.to({ alpha: 1, scale: { x: 0.6, y: 0.6 } }, 220)
				.easing(Easing.Back.Out)
				.start();
			new Tween(this.speedTrail)
				.from({ scale: { x: 0.6, y: 0.6 } })
				.to({ scale: { x: 0.7 } }, 220)
				.easing(Easing.Back.Out)
				.repeat(Infinity)
				.yoyo(true)
				.start();
		} catch (e) {
			// en caso de Graphics (no soporta scale object) aplicamos scale.x/y si existen
			try {
				new Tween(this.speedTrail).to({ alpha: 1 }, 220).start();
				// eslint-disable-next-line prettier/prettier
			} catch { }
		}

		// apagar después del duration
		// guardamos referencia si necesitas cancelar en el futuro (aquí usamos Timer.delay)
		new Timer()
			.to(durationMs)
			.start()
			.onComplete(() => {
				if (!this.speedTrail) {
					return;
				}
				try {
					new Tween(this.speedTrail).to({ alpha: 0 }, 180).easing(Easing.Quadratic.In).start();
				} catch {
					try {
						this.speedTrail.alpha = 0;
						// eslint-disable-next-line prettier/prettier
					} catch { }
				}
				this.speedTrailVisible = false;
			});
	}

	private createGraphicFallback(): void {
		this.graphic = new Graphics();
		this.addChildAt(this.graphic, 0);
		// dibujo simple de moto
		this.graphic.clear();
		this.graphic.beginFill(0x0099ff);
		this.graphic.lineStyle(2, 0x003f5c);
		this.graphic.drawRoundedRect(-50, -20, 100, 40, 8);
		this.graphic.endFill();
		this.graphic.beginFill(0x111111);
		this.graphic.drawCircle(-30, 22, 14);
		this.graphic.drawCircle(30, 22, 14);
		this.graphic.endFill();

		// mantener hitbox con el fallback
		this.widthBox = 120;
		this.heightBox = 64;
	}

	private updateHitboxFromSprite(): void {
		if (!this.sprite) {
			return;
		}
		const w = Math.abs(this.sprite.width * (this.sprite.scale?.x ?? 1));
		const h = Math.abs(this.sprite.height * (this.sprite.scale?.y ?? 1));
		// dejar algo de margen
		this.widthBox = Math.max(80, w * 0.8);
		this.heightBox = Math.max(48, h * 0.8);
	}

	public setLanes(yTop: number, gap: number): void {
		this.lanesY = [yTop, yTop + gap, yTop + gap * 2];
		this.gotoLane(1, false);
	}

	public gotoLane(index: number, tween = true): void {
		index = Math.max(0, Math.min(2, index));
		this.laneIndex = index;
		const targetY = this.lanesY[index];
		if (tween) {
			new Tween(this).to({ y: targetY }, 180).easing(Easing.Cubic.Out).start();
		} else {
			this.y = targetY;
		}
	}

	public dodgeUp(): void {
		this.gotoLane(this.laneIndex - 1, true);
	}
	public dodgeDown(): void {
		this.gotoLane(this.laneIndex + 1, true);
	}

	public jump(): void {
		if (this.isJumping) {
			return;
		}
		this.isJumping = true;
		const origY = this.y;
		new Tween(this)
			.from({ y: origY })
			.to({ y: origY - 90 }, 260)
			.easing(Easing.Sinusoidal.Out)
			.start()
			.onComplete(() => {
				new Tween(this)
					.from({ y: origY - 90 })
					.to({ y: origY }, 320)
					.easing(Easing.Sinusoidal.In)
					.start()
					.onComplete(() => (this.isJumping = false));
			});
	}

	public getBoundsRect(): { x: number; y: number; w: number; h: number } {
		// si tenemos sprite, usar sus dimensiones; si no, fallback a widthBox/heightBox
		const w = this.sprite ? Math.abs(this.sprite.width * (this.sprite.scale?.x ?? 1)) : this.widthBox;
		const h = this.sprite ? Math.abs(this.sprite.height * (this.sprite.scale?.y ?? 1)) : this.heightBox;
		const boxW = Math.max(48, w * 0.8);
		const boxH = Math.max(28, h * 0.8);
		return {
			x: this.x - boxW / 2,
			y: this.y - boxH / 2,
			w: boxW,
			h: boxH,
		};
	}

	/** * SHAKE control ** */
	public startShake(): void {
		// no arranquemos si ya está corriendo o si estamos saltando
		if (this.shakeTween || this.isJumping) {
			return;
		}
		try {
			// pequeña oscilación de rotation y x, rápida y suave
			// ajustá amplitud/duración si la quieres más o menos marcada
			this.shakeTween = new Tween(this.bob)
				.from({ rotation: -0.04, x: -2 })
				.to({ rotation: 0.04, x: 2 }, 160)
				.easing(Easing.Sinusoidal.InOut)
				.repeat(Infinity)
				.yoyo(true)
				.start();
		} catch (err) {
			// fallback: hacer un "manual jitter" simple si tween falla
			console.warn("[PlayerBike] startShake failed:", err);
			try {
				this.bob.rotation = 0;
				this.bob.x = 0;
				// eslint-disable-next-line prettier/prettier
			} catch { }
		}
	}

	public stopShake(): void {
		if (!this.shakeTween) {
			// asegurarse de resetear a estado neutro
			try {
				this.bob.rotation = 0;
				this.bob.x = 0;
				// eslint-disable-next-line prettier/prettier
			} catch { }
			return;
		}
		try {
			this.shakeTween.stop();
			// eslint-disable-next-line prettier/prettier
		} catch { }
		this.shakeTween = undefined;
		// resetear bob a neutro
		try {
			this.bob.rotation = 0;
			this.bob.x = 0;
			// eslint-disable-next-line prettier/prettier
		} catch { }
	}
}

/** ---------- Car (auto que cruza un carril) ---------- */
class Car extends Container {
	public active = false;
	public speedX = -520;
	public widthBox = 120;
	public heightBox = 60;
	private sprite?: Sprite;
	private g?: Graphics;

	constructor() {
		super();
		try {
			const tex = Texture.from("espertCar");
			if (tex && tex.baseTexture) {
				this.sprite = new Sprite(tex);
				this.sprite.anchor.set(0.5, 1); // centrado abajo
				this.sprite.scale.set(0.5);
				this.addChild(this.sprite);

				// hitbox inicial aproximada (se ajusta con factor)
				this.widthBox = Math.abs(this.sprite.width * (this.sprite.scale.x ?? 1));
				this.heightBox = Math.abs(this.sprite.height * (this.sprite.scale.y ?? 1));
			} else {
				throw new Error("texture not valid");
			}
		} catch {
			this.g = new Graphics();
			this.g.beginFill(0xff3333);
			this.g.drawRoundedRect(-60, -30, 120, 60, 8);
			this.g.endFill();
			this.addChild(this.g);
			this.widthBox = 120;
			this.heightBox = 60;
		}
		this.visible = false;
	}

	// 🚗 hitbox reducida (ej. 50% del sprite visible)
	public getBoundsRect(): { x: number; y: number; w: number; h: number } {
		const w = this.sprite ? Math.abs(this.sprite.width * (this.sprite.scale?.x ?? 1)) : this.widthBox;
		const h = this.sprite ? Math.abs(this.sprite.height * (this.sprite.scale?.y ?? 1)) : this.heightBox;

		const boxW = Math.max(60, w * 0.5); // 50% del ancho
		const boxH = Math.max(30, h * 0.4); // 40% del alto

		return {
			x: this.x - boxW / 2,
			y: this.y - boxH,
			w: boxW,
			h: boxH,
		};
	}

	public spawn(x: number, y: number, speedX: number, scale = 1): void {
		this.position.set(x, y);
		this.speedX = speedX;
		this.scale.set(scale);
		this.active = true;
		this.visible = true;
	}

	public update(dtMs: number): void {
		if (!this.active) {
			return;
		}
		this.x += (this.speedX * dtMs) / 1000;
		if (this.x < -400) {
			this.reset();
		}
	}

	public reset(): void {
		this.active = false;
		this.visible = false;
		this.position.set(-9999, -9999);
		try {
			if (this.parent) {
				this.parent.removeChild(this);
			}
			// eslint-disable-next-line prettier/prettier
		} catch { }
	}
}

// al inicio de la clase o fuera si preferís
interface ItemOption {
	name: string;
	texture: string; // key de la textura en tu loader/atlas
	effect: (scene: MotoRunnerScene) => void; // callback que puede usar la escena
}

/** ---------- MotoRunnerScene (debuggable) ---------- */
export class MotoRunnerScene extends PixiScene {
	private sceneContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	private movingContainer: Container = new Container();

	private player: PlayerBike;
	private stonesPool: Stone[] = [];
	public activeStones: Stone[] = [];
	private milei: Sprite;
	private obstacleSpawnTime = 1200;
	private obstacleSpawnTimer!: Timer;
	public spawnVariation = 250;
	private baseSpeed = -420;
	private difficultyLevel = 1;
	public timeElapsed = 0;
	private score = 0;
	private lives = 3;
	private started = false;
	private paused = false;
	private gameOver = false;
	private backgrounds: TilingSprite[] = [];

	// try/catch safe UIs
	private uiMiddle: Container;
	private uiRight: Container;

	// parallax tiles
	private bgFarTiles: Graphics[] = [];
	private bgMidTiles: Graphics[] = [];
	private tileWidthFar: number = ScaleHelper.IDEAL_WIDTH;
	private tileWidthMid: number = ScaleHelper.IDEAL_WIDTH;
	private numTiles = 2;

	// speeds (ajustables)
	private farSpeed = 0.02;
	private midSpeed = 0.08;

	public static readonly BUNDLES = ["espert"];
	private espertBGLayer1: TilingSprite;
	private espertBGLayer2: TilingSprite;

	// checkpoint pool + timers
	private checkpointsPool: Checkpoint[] = [];
	private activeCheckpoints: Checkpoint[] = [];
	private checkpointSpawnTime = 8000; // ms, ajustable
	public checkpointSpawnTimer!: Timer;

	// item menu
	private itemMenuOpen = false;
	private itemMenu: Container | null = null;
	public static initialEspertSpeed = 0.2;
	private espertSpeed: number = 0.2;

	// cars
	private carsPool: Car[] = [];
	private carSpawnTime = 6000; // ms
	public carSpawnTimer!: Timer;
	// dentro de la clase MotoRunnerScene (campos)
	private laneContainers: Container[] = [];
	// estado del audio para los coches
	private carMusicPlaying: boolean = false;
	// scoring (enteros por intervalo)
	private scoreInt: number = 0;
	private scoreAccumulatorMs: number = 0;
	private scoreIntervalMs: number = 1000; // cada cuántos ms sumamos puntos (1000ms = 1s)
	private pointsPerInterval: number = 1; // cuantos puntos sumar cada intervalo
	private scoreText?: Text;
	private gameOverPanel?: Container;

	private startButton?: Container;
	private availableItems: ItemOption[] = [];

	constructor() {
		super();

		console.log("[MotoRunnerScene] constructor start");

		// Música (si existe)
		try {
			// SoundLib.playMusic?.("bouncy", { loop: true, volume: 0.08 });
		} catch (err) {
			console.warn("[MotoRunnerScene] SoundLib.playMusic failed:", err);
		}

		// agregar containers
		this.addChild(this.backgroundContainer);

		this.uiMiddle = new Container();
		try {
			this.uiRight = new (UIContainerRight as any)();
			console.log("[MotoRunnerScene] uiRight created");
		} catch (err) {
			console.error("[MotoRunnerScene] could not create UIContainerRight, using fallback Container", err);
			this.uiRight = new Container();
		}
		// crear botón de inicio
		this.startButton = this.createStartButton();
		this.addChild(this.startButton);

		// add UIs last so they render on top
		// this.addChild(this.uiMiddle, this.uiRight);
		this.addChild(this.uiMiddle);
		// this.backgroundContainer.addChild(this.bgFar, this.bgMid);
		this.sceneContainer.addChild(this.movingContainer);

		// crear 3 containers para controlar z-order por lane
		for (let i = 0; i < 3; i++) {
			const laneC = new Container();
			laneC.name = `LANE_CONTAINER_${i}`;
			// añadimos en orden 0,1,2 -> el ultimo (2) queda encima
			this.laneContainers.push(laneC);
			this.movingContainer.addChild(laneC);
		}

		// reemplaza las 3 líneas problemáticas por esto (versión mínima y segura)
		const tex1 = Texture.from("streetLayer1");
		const tex2 = Texture.from("streetLayer2");

		const w = Math.max(window.innerWidth || ScaleHelper.IDEAL_WIDTH, ScaleHelper.IDEAL_WIDTH);
		const h = Math.max(window.innerHeight || ScaleHelper.IDEAL_HEIGHT, ScaleHelper.IDEAL_HEIGHT);

		this.espertBGLayer1 = new TilingSprite(tex1, w * 1.15, h);
		this.espertBGLayer2 = new TilingSprite(tex2, w * 1.15, h);

		this.backgroundContainer.addChild(this.espertBGLayer2, this.espertBGLayer1);
		this.backgrounds.push(this.espertBGLayer2, this.espertBGLayer1);

		this.milei = Sprite.from("milei");
		this.milei.anchor.set(0.5);
		this.milei.scale.set(0.25);
		// player
		this.player = new PlayerBike();
		this.player.position.set(0, this.player.lanesY[1]);
		this.milei.position = this.player.position;
		this.sceneContainer.addChild(this.milei);
		// agregar al lane container central (1)
		this.movePlayerToLane(1);

		// pool de piedras (placeholders)
		for (let i = 0; i < 12; i++) {
			const st = new Stone(12 + Math.round(Math.random() * 18));
			this.stonesPool.push(st);
			this.movingContainer.addChild(st);
		}

		// pool de checkpoints (2-3 por ciclo)
		for (let i = 0; i < 4; i++) {
			const cp = new Checkpoint(20, i);
			this.checkpointsPool.push(cp);
			this.movingContainer.addChild(cp);
		}

		// pool de coches
		for (let i = 0; i < 4; i++) {
			const c = new Car();
			this.carsPool.push(c);
			this.movingContainer.addChild(c);
		}

		// bloqueo inicial de input
		try {
			if (Keyboard && Keyboard.shared) {
				Keyboard.shared.enabled = false;
			}
		} catch (err) {
			console.warn("[MotoRunnerScene] Keyboard.shared not available", err);
		}
		this.sceneContainer.eventMode = "none";
		this.sceneContainer.interactive = false;
		new Timer()
			.to(350)
			.start()
			.onComplete(() => {
				try {
					if (Keyboard && Keyboard.shared) {
						Keyboard.shared.enabled = true;
					}
					// eslint-disable-next-line prettier/prettier
				} catch { }
				this.sceneContainer.interactive = true;
				this.sceneContainer.eventMode = "static";
				console.log("[MotoRunnerScene] input unlocked");
			});

		// schedule spawn
		this.scheduleSpawn();

		// schedule de checkpoints (más espaciados)
		this.checkpointSpawnTimer = new Timer()
			.to(this.checkpointSpawnTime)
			.repeat(Infinity)
			.start()
			.onRepeat(() => {
				if (!this.paused && !this.gameOver && this.started && !this.itemMenuOpen) {
					this.spawnCheckpoint();
				}
			});

		// schedule de coches (más esporádico)
		this.carSpawnTimer = new Timer()
			.to(this.carSpawnTime)
			.repeat(Infinity)
			.start()
			.onRepeat(() => {
				if (!this.paused && !this.gameOver && this.started && !this.itemMenuOpen) {
					this.spawnCar();
				}
			});

		// controles pointer + keyboard
		this.setupControls();

		// start on first tap/click -- si querés forzar que arranque sin tap probá descomentar la siguiente línea:
		// this.started = true;

		// debug info
		console.log("[MotoRunnerScene] constructor end - scene ready (waiting start:", this.started, ")");

		this.backgroundContainer.name = "BACKGROUND_CONTAINER";
		this.movingContainer.name = "MOVING_CONTAINER";
		this.sceneContainer.name = "SCENE_CONTAINER";
		// this.openItemMenu();

		const ui = Sprite.from("uiBar");
		ui.anchor.set(0.5, 0);
		this.uiMiddle.addChild(ui);

		// texto de puntaje (enteros) en uiMiddle
		this.scoreText = new Text("0", {
			fontFamily: "Pixelate-Regular",
			fontSize: 46,
			fill: 0xffffff,
			fontWeight: "bold",
			stroke: 0x000000,
			strokeThickness: 4,
		});
		this.scoreText.anchor.set(0.5, 0);
		this.scoreText.position.set(575, 32); // ajusta verticalmente si es necesario
		this.uiMiddle.addChild(this.scoreText);

		this.itemMenu = this.createItemMenu();
		this.itemMenu.name = "ITEM_CONTAINER";
		this.addChild(this.itemMenu);
		this.itemMenu.visible = false;

		this.backgroundContainer.addChild(this.sceneContainer);

		// this.player.showSpeedTrail(5000);

		// ---------------- Botones de control de lanes ----------------
		const btnUp = new Graphics();
		btnUp.beginFill(0x00ccff, 0.7);
		btnUp.drawPolygon([-80, 80, 80, 80, 0, -80]); // flecha hacia arriba
		btnUp.endFill();
		btnUp.position.set(-ScaleHelper.IDEAL_WIDTH / 2 + 80, ScaleHelper.IDEAL_HEIGHT / 2 - 150);
		btnUp.eventMode = "static";
		btnUp.interactive = true;
		btnUp.cursor = "pointer";
		btnUp.on("pointerdown", () => {
			this.player.dodgeUp();
		});

		const btnDown = new Graphics();
		btnDown.beginFill(0xff6600, 0.7);
		btnDown.drawPolygon([0, 80, 80, -80, -80, -80]); // flecha hacia abajo
		btnDown.endFill();
		btnDown.position.set(-ScaleHelper.IDEAL_WIDTH / 2 + 80, ScaleHelper.IDEAL_HEIGHT / 2 + 150);
		btnDown.eventMode = "static";
		btnDown.interactive = true;
		btnDown.cursor = "pointer";
		btnDown.on("pointerdown", () => {
			this.player.dodgeDown();
		});

		// Agregar los botones a la UI o escena
		this.uiMiddle.addChild(btnUp);
		this.uiMiddle.addChild(btnDown);

		const gameOverPanel = this.createGameOverPanel();
		this.addChild(gameOverPanel);
		this.gameOverPanel = gameOverPanel;

		this.setAvailableItems([
			{
				name: "Bicicletoto",
				texture: "toto",
				effect: (s) => {
					s.scoreInt += 50;
				},
			},
			{
				name: "3%",
				texture: "karina",
				effect: (s) => {
					s.paused = true;
					Timer.delay(3000, () => (s.paused = false));
				}, // ejemplo: te bloquea 3s
			},
			{
				name: "Ministra",
				texture: "bullrich",
				effect: (s) => {
					s.lives++;
				},
			},
		]);
	}

	public setAvailableItems(items: ItemOption[]): void {
		this.availableItems = items || [];
		// si el menu ya existe lo reconstruimos con los nuevos items
		if (this.itemMenu) {
			this.rebuildItemMenu();
		}
	}

	private rebuildItemMenu(): void {
		// vaciar children actuales
		if (!this.itemMenu) {
			this.itemMenu = new Container();
			this.itemMenu.name = "ITEM_CONTAINER";

			this.addChild(this.itemMenu);
		}
		// limpiar
		while (this.itemMenu.children.length > 0) {
			const c = this.itemMenu.removeChildAt(0);
			if ((c as any).destroy) {
				try {
					(c as any).destroy({ children: true });
				} catch { }
			}
		}

		// fondo / titulo si quieres (opcional)
		// Crear lista de items a usar (fallback si no hay ninguno)
		const items = this.availableItems.length
			? this.availableItems
			: [
				{
					name: "Speed",
					texture: "money",
					effect: (scene: MotoRunnerScene) => {
						// ejemplo: Speed boost (misma lógica que antes)
						const boostAmount = -220;
						const prev = scene.baseSpeed;
						scene.baseSpeed += boostAmount;
						scene.player.showSpeedTrail(5000);
						Timer.delay(5000, () => {
							scene.baseSpeed = prev;
						});
					},
				},
				{
					name: "Clear",
					texture: "helmet",
					effect: (scene: MotoRunnerScene) => {
						for (const s of scene.stonesPool) {
							if (s.active) {
								s.reset();
							}
						}
					},
				},
				{
					name: "Extra Life",
					texture: "money",
					effect: (scene: MotoRunnerScene) => {
						scene.lives++;
					},
				},
			];

		// crear botones según items.length
		const spacing = 220;
		const centerY = 40;

		for (let i = 0; i < items.length; i++) {
			const it = items[i];
			const btn = new Container();
			btn.x = (i - (items.length - 1) / 2) * spacing; // centrado dinámico
			btn.y = centerY;
			btn.eventMode = "static";
			btn.interactive = true;
			btn.cursor = "pointer";

			// background del botón: intentamos usar textura "itemBg" si existe, si no fallback gráfico
			let bgSprite: Sprite | null = null;
			try {
				const bgTex = Texture.from("itemBg");
				if (bgTex && bgTex.baseTexture && bgTex.baseTexture.valid) {
					bgSprite = new Sprite(bgTex);
					bgSprite.anchor.set(0.5);
					btn.addChild(bgSprite);
				}
			} catch {
				bgSprite = null;
			}

			// icono basado en la textura pasada
			let icon: Sprite | null = null;
			try {
				const tex = Texture.from(it.texture);
				if (tex && tex.baseTexture && tex.baseTexture.valid) {
					icon = new Sprite(tex);
					icon.anchor.set(0.5);
					// ajustar tamaño razonable si la textura es grande
					icon.scale.set(0.15);
					btn.addChild(icon);
				}
			} catch {
				icon = null;
			}
			// si no hay icon, dibujamos un placeholder
			if (!icon) {
				const circ = new Graphics();
				circ.beginFill(0x999999);
				circ.drawCircle(0, -10, 36);
				circ.endFill();
				btn.addChild(circ);
				const txt = new Text(it.name[0] || "?", { fontFamily: "Pixelate-Regular", fontSize: 46, fill: 0xffffff, fontWeight: "bold", stroke: 0x000000, strokeThickness: 4 });
				txt.anchor.set(0.5);
				txt.y = -10;
				btn.addChild(txt);
			}

			// nombre debajo
			const label = new Text(it.name, { fontFamily: "Pixelate-Regular", fontSize: 46, fill: 0xffffff, fontWeight: "bold", stroke: 0x000000, strokeThickness: 4 });
			label.anchor.set(0.5);
			label.position.set(0, 90);
			btn.addChild(label);

			btn.on("pointerdown" as any, () => {
				// reproducir feedback sonoro
				SoundLib.playSound?.("sound_collectable", { volume: 0.5 });
				// Ejecutar efecto (pasamos la escena para que la callback actúe sobre esta)
				try {
					it.effect?.(this);
				} catch (err) {
					console.warn("[MotoRunnerScene] item effect failed:", err);
				}
				this.closeItemMenu();
			});
			btn.on("pointerover" as any, () => new Tween(btn.scale).to({ x: 1.05, y: 1.05 }, 120).start());
			btn.on("pointerout" as any, () => new Tween(btn.scale).to({ x: 1, y: 1 }, 120).start());

			this.itemMenu.addChild(btn);
		}
	}

	private createStartButton(): Container {
		const container = new Container();
		container.name = "START_BUTTON";
		container.eventMode = "static";
		container.interactive = true;
		container.cursor = "pointer";

		// intentar usar una textura "btnStart" (pon el nombre que tengas en tu atlas),
		// si no existe, dibujamos un fallback con Graphics + Text.
		const tex = Texture.from("btnStart");
		let hasTex = false;
		try {
			hasTex = Boolean(tex && tex.baseTexture && tex.baseTexture.valid);
		} catch {
			hasTex = false;
		}

		if (hasTex) {
			const spr = new Sprite(tex);
			spr.anchor.set(0.5);
			container.addChild(spr);
			// opcional texto encima si quieres (usa tu fuente)
			const label = new Text("Iniciar", { fontFamily: "Pixelate-Regular", fontSize: 28, fill: 0xffffff, stroke: 0x000000, strokeThickness: 3 });
			label.anchor.set(0.5);
			container.addChild(label);
		} else {
			const bg = new Graphics();
			bg.beginFill(0x00ccff);
			bg.drawRoundedRect(-160, -40, 320, 80, 16);
			bg.endFill();
			container.addChild(bg);

			const label = new Text("Iniciar", {
				fontFamily: "Pixelate-Regular",
				fontSize: 28,
				fill: 0x000000,
				fontWeight: "bold",
			});
			label.anchor.set(0.5);
			container.addChild(label);
		}

		// pos inicial (se ajusta en onResize también)
		container.x = (window.innerWidth || ScaleHelper.IDEAL_WIDTH) * 0.5;
		container.y = (window.innerHeight || ScaleHelper.IDEAL_HEIGHT) - 120;

		// comportamiento al pulsar
		container.on("pointerdown", () => {
			if (this.started) {
				// si ya está arrancado no hacemos nada
				return;
			}
			// arrancar partida
			this.started = true;
			this.paused = false;
			new Tween(this.player.position).to({ x: 650, y: this.player.lanesY[1] }, 2500).easing(Easing.Exponential.Out).start();
			new Tween(this.milei.position).to({ x: 2550, y: this.player.lanesY[1] }, 15500).easing(Easing.Exponential.Out).start();

			// reproducir sonido "moto-idle" en bucle
			try {
				// preferimos playMusic si la librería lo ofrece para música en loop
				if (typeof (SoundLib as any).playMusic === "function") {
					SoundLib.playSound("arranque", { loop: false, volume: 0.18 });
					new Timer()
						.to(2000)
						.start()
						.onComplete(() => {
							SoundLib.playMusic("andando", { loop: true, volume: 0.18 });
						});
				} else {
					// fallback a playSound con loop (si tu SoundLib lo soporta)
					SoundLib.playSound("arranque", { loop: false, volume: 0.18 });
					new Timer()
						.to(2000)
						.start()
						.onComplete(() => {
							SoundLib.playMusic("andando", { loop: true, volume: 0.18 });
						});
				}
			} catch (err) {
				console.warn("[MotoRunnerScene] could not play moto-idle:", err);
			}

			// esconder botón
			container.visible = false;
		});

		return container;
	}

	private getCarFromPool(): Car | null {
		for (const c of this.carsPool) {
			if (!c.active) {
				return c;
			}
		}
		return null;
	}

	private createGameOverPanel(): Container {
		const panel = new Container();
		panel.visible = false; // oculto por defecto
		panel.name = "GAME_OVER_PANEL";

		// fondo translúcido
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.7);
		bg.drawRoundedRect(-300, -200, 600, 400, 24);
		bg.endFill();
		panel.addChild(bg);

		// título
		const title = new Text("Game Over", {
			fontFamily: "Pixelate-Regular",
			fontSize: 64,
			fill: 0xff3333,
			fontWeight: "bold",
			stroke: 0x000000,
			strokeThickness: 6,
		});
		title.anchor.set(0.5);
		title.position.set(0, -120);
		panel.addChild(title);

		// puntaje
		const scoreLbl = new Text("Puntaje: 0", {
			fontFamily: "Pixelate-Regular",
			fontSize: 36,
			fill: 0xffffff,
			stroke: 0x000000,
			strokeThickness: 4,
		});
		scoreLbl.anchor.set(0.5);
		scoreLbl.position.set(0, -20);
		scoreLbl.name = "SCORE_LABEL";
		panel.addChild(scoreLbl);

		// botón repetir
		const btn = new Container();
		btn.position.set(0, 100);
		btn.eventMode = "static";
		btn.interactive = true;
		btn.cursor = "pointer";

		const btnBg = new Graphics();
		btnBg.beginFill(0x00ccff);
		btnBg.drawRoundedRect(-160, -40, 320, 80, 16);
		btnBg.endFill();
		btn.addChild(btnBg);

		const btnTxt = new Text("Escapar de nuevo", {
			fontFamily: "Pixelate-Regular",
			fontSize: 28,
			fill: 0x000000,
			fontWeight: "bold",
		});
		btnTxt.anchor.set(0.5);
		btn.addChild(btnTxt);

		// evento de reinicio
		btn.on("pointerdown", () => {
			SoundLib.playSound?.("beep", {}); // opcional
			this.restartGame();
		});

		panel.addChild(btn);

		// centrar en pantalla
		panel.position.set(0, 0);

		return panel;
	}

	private ensureCarMusicPlaying(): void {
		if (this.carMusicPlaying) {
			return;
		}
		try {
			// si existe playMusic
			SoundLib.playMusic?.("altaCoimera", { loop: true, volume: 0.18, filters: [new filters.TelephoneFilter()] });
		} catch (err) {
			console.warn("[MotoRunnerScene] could not play car music:", err);
		}
		this.carMusicPlaying = true;
	}

	private stopCarMusic(): void {
		if (!this.carMusicPlaying) {
			return;
		}
		try {
			// si la lib tiene stopMusic la usamos con nombre, si no fallback a stopAllMusic
			if (typeof (SoundLib as any).stopMusic === "function") {
				(SoundLib as any).stopMusic("altaCoimera");
			} else {
				SoundLib.stopAllMusic?.();
			}
		} catch (err) {
			console.warn("[MotoRunnerScene] could not stop car music:", err);
		}
		this.carMusicPlaying = false;
	}

	private spawnCar(): void {
		const car = this.getCarFromPool();
		if (!car) {
			// pool lleno
			return;
		}
		// elige carril aleatorio (0..2)
		const lane = Math.floor(Math.random() * 3);
		const y = this.player.lanesY ? this.player.lanesY[lane] : 250 + lane * 80;

		// spawn más a la derecha (usar scene width / window)
		const worldWidth = Math.max(this.sceneContainer.width || 0, window.innerWidth || 0, ScaleHelper.IDEAL_WIDTH);
		// spawn más fuera de pantalla
		const spawnX = Math.round(worldWidth) + 900 + Math.random() * 300;
		// velocidad: similar a piedras pero algo variable
		const speedX = this.baseSpeed - 40 - Math.random() * 60;
		const scale = 0.8 + Math.random() * 0.4;
		car.spawn(spawnX, y, speedX, scale);
		// spawnCar (tras car.spawn(...))
		try {
			this.laneContainers[lane].addChild(car);
		} catch {
			this.movingContainer.addChild(car);
		}
		this.ensureCarMusicPlaying();

		// animación de entrada sutil
		new Tween(car)
			.from({ y: y - 8 })
			.to({ y }, 380)
			.easing(Easing.Sinusoidal.In)
			.start();
	}

	private getCheckpointFromPool(): Checkpoint | null {
		for (const c of this.checkpointsPool) {
			if (!c.active) {
				return c;
			}
		}
		return null;
	}

	private movePlayerToLane(index: number): void {
		index = Math.max(0, Math.min(2, index));
		try {
			// quitar player del parent actual (si tiene)
			if (this.player.parent) {
				this.player.parent.removeChild(this.player);
			}
			// añadir al container de la lane (asegurate que laneContainers ya existe)
			this.laneContainers[index].addChild(this.player);
		} catch (err) {
			// fallback: si algo falla lo dejamos en sceneContainer
			try {
				if (this.player.parent !== this.sceneContainer) {
					this.sceneContainer.addChild(this.player);
				}
				// eslint-disable-next-line prettier/prettier
			} catch { }
		}
	}

	private spawnCheckpoint(): void {
		const cp = this.getCheckpointFromPool();
		if (!cp) {
			console.warn("[MotoRunnerScene] spawnCheckpoint: pool empty");
			return;
		}
		const lane = Math.floor(Math.random() * 3);
		const y = this.player.lanesY ? this.player.lanesY[lane] : 250 + lane * 80;
		const worldWidth = Math.max(this.sceneContainer.width || 0, window.innerWidth || 0, ScaleHelper.IDEAL_WIDTH);
		const spawnX = Math.round(worldWidth) + 700 + Math.random() * 300; // spawn más a la derecha
		const speedX = this.baseSpeed - Math.random() * 50; // un poco más lento que piedras
		const scale = 1;

		cp.spawn(spawnX, y, speedX, scale);
		// spawnCheckpoint (tras cp.spawn(...))
		try {
			this.laneContainers[lane].addChild(cp);
		} catch {
			this.movingContainer.addChild(cp);
		}

		// pequeña animación de entrada
		new Tween(cp)
			.from({ y: y - 10 })
			.to({ y }, 420)
			.easing(Easing.Sinusoidal.In)
			.start();
		// track active list
		this.activeCheckpoints.push(cp);
	}

	private scheduleSpawn(): void {
		console.log("[MotoRunnerScene] scheduleSpawn()");
		this.obstacleSpawnTime = 1200;
		// guardamos el timer en la instancia
		this.obstacleSpawnTimer = new Timer()
			.to(this.obstacleSpawnTime)
			.repeat(Infinity)
			.start()
			.onRepeat(() => {
				if (!this.paused && !this.gameOver && this.started) {
					try {
						this.spawnObstacle();
					} catch (err) {
						console.error("[MotoRunnerScene] spawnObstacle error:", err);
					}
				}
			});
	}

	private getStoneFromPool(): Stone | null {
		for (const s of this.stonesPool) {
			if (!s.active) {
				return s;
			}
		}
		return null;
	}

	private spawnObstacle(): void {
		const stone = this.getStoneFromPool();
		if (!stone) {
			console.warn("[MotoRunnerScene] spawnObstacle: pool empty");
			return;
		}
		const lane = Math.floor(Math.random() * 3);
		const y = this.player.lanesY ? this.player.lanesY[lane] : 250 + lane * 80;

		// worldWidth: intenta tomar sceneContainer.width; si no está, usa window.innerWidth o ideal
		const worldWidth = Math.max(this.sceneContainer.width || 0, window.innerWidth || 0, ScaleHelper.IDEAL_WIDTH);

		const spawnX = Math.round(worldWidth) + 250; // más a la derecha
		const speedX = this.baseSpeed - Math.random() * 120; // variable
		const scale = 0.8 + Math.random() * 0.8;
		// ejemplo dentro de spawnObstacle()
		stone.spawn(spawnX, y, speedX, scale);
		// reparentar al container de la lane para controlar z-order
		try {
			this.laneContainers[lane].addChild(stone);
		} catch (err) {
			// fallback: si algo sale mal lo ponemos en movingContainer
			this.movingContainer.addChild(stone);
		}
		new Tween(stone)
			.from({ y: y - 18 })
			.to({ y }, 520)
			.easing(Easing.Sinusoidal.In)
			.start();
	}

	private setupControls(): void {
		// teclado
		window.addEventListener("keydown", (e) => {
			if (Keyboard && Keyboard.shared && !Keyboard.shared.enabled) {
				return;
			}
			if (e.code === "Space") {
				this.player.jump();
			}
			if (e.code === "ArrowUp") {
				this.player.dodgeUp();
				this.movePlayerToLane(this.player.laneIndex);
			}
			if (e.code === "ArrowDown") {
				this.player.dodgeDown();
				this.movePlayerToLane(this.player.laneIndex);
			}

			if (e.code === "KeyP") {
				this.paused = !this.paused;
			}
			if (e.code === "Escape") {
				SoundLib.stopAllMusic?.();
				// Comentado porque redirigir a la misma escena puede confundir. Reemplaza por tu escena de menú:
				// Manager.changeScene?.(YourMainScene, { transitionClass: FadeColorTransition });
				console.log("[MotoRunnerScene] Escape pressed - implement changeScene to menu if needed");
			}
		});

		// pointer simple: arriba/abajo/centro
		this.sceneContainer.on("pointerdown", (ev: any) => {
			if (!this.started) {
				return;
			}
			const gy = ev.data.global.y;
			if (gy < this.player.y - 20) {
				this.player.dodgeUp();
				this.movePlayerToLane(this.player.laneIndex);
			} else if (gy > this.player.y + 20) {
				this.player.dodgeDown();
				this.movePlayerToLane(this.player.laneIndex);
			} else {
				this.player.jump();
			}
		});
	}

	private hitTestRects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): any {
		return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
	}

	public override update(dt: number): void {
		// debug: confirmamos que update se está llamando
		// console.log("[MotoRunnerScene] update dt=", dt, "started=", this.started);

		if (!this.started) {
			return;
		}
		if (this.paused) {
			return;
		}

		// sumar puntos enteros cada cierto tiempo (solo si el juego está corriendo)
		this.scoreAccumulatorMs += dt;
		if (this.scoreAccumulatorMs >= this.scoreIntervalMs) {
			const steps = Math.floor(this.scoreAccumulatorMs / this.scoreIntervalMs);
			this.scoreAccumulatorMs -= steps * this.scoreIntervalMs;
			this.scoreInt += steps * this.pointsPerInterval;
			// actualizar UI
			if (this.scoreText) {
				this.scoreText.text = String(this.scoreInt);
			}
		}

		this.timeElapsed += dt;
		this.score += dt * 0.02;
		for (let i = 0; i < this.backgrounds.length; i++) {
			const background = this.backgrounds[i];

			if (this.player.x < 0) {
				background.tilePosition.x += this.espertSpeed * dt * i + 1;
			} else {
				background.tilePosition.x -= this.espertSpeed * dt * i + 1;
			}
		}
		// mover y envolver tiles far
		for (const t of this.bgFarTiles) {
			t.x -= this.farSpeed * dt;
			// si la tile salió completamente a la izquierda, reubicarla al final
			if (t.x <= -this.tileWidthFar) {
				t.x += this.tileWidthFar * this.numTiles;
			}
		}
		// mover y envolver tiles mid
		for (const t of this.bgMidTiles) {
			t.x -= this.midSpeed * dt;
			if (t.x <= -this.tileWidthMid) {
				t.x += this.tileWidthMid * this.numTiles;
			}
		}

		for (const s of this.stonesPool) {
			if (s.active) {
				s.update(dt);
			}
		}

		const playerRect = this.player.getBoundsRect();
		for (const s of this.stonesPool) {
			if (!s.active) {
				continue;
			}
			const stRect = { x: s.x - s.radius, y: s.y - s.radius, w: s.radius * 2, h: s.radius * 2 };
			if (this.player.isJumping) {
				continue;
			}
			if (this.hitTestRects(playerRect, stRect)) {
				this.onPlayerHit(s);
			}
		}

		// collisions with checkpoints (no te dañan; abren menu)
		for (const cp of this.checkpointsPool) {
			if (!cp.active) {
				continue;
			}
			const cpRect = { x: cp.x - cp.radius, y: cp.y - cp.radius, w: cp.radius * 2, h: cp.radius * 2 };
			if (this.player.isJumping) {
				continue;
			}
			if (this.hitTestRects(playerRect, cpRect)) {
				// activar menú y resetear checkpoint (evita re-trigger)
				cp.reset();
				this.openItemMenu(cp);
				// rompemos para procesar solo 1 checkpoint por frame
				break;
			}
		}

		// actualizar checkpoints activos (moverlos hacia la izquierda)
		for (const cp of this.checkpointsPool) {
			if (cp.active) {
				cp.update(dt);
			}
		}

		// actualizar coches activos
		for (const c of this.carsPool) {
			if (c.active) {
				c.update(dt);
			}
		}

		// colisiones con coches
		for (const c of this.carsPool) {
			if (!c.active) {
				continue;
			}
			if (this.player.isJumping) {
				continue;
			}

			const playerRect = this.player.getBoundsRect();
			const carRect = c.getBoundsRect();

			if (this.hitTestRects(playerRect, carRect)) {
				c.reset();
				this.onPlayerHit(c as unknown as Stone);
				break;
			}
		}

		// Después de actualizar coches:
		const anyCarActive = this.carsPool.some((c) => c.active);
		if (anyCarActive) {
			this.ensureCarMusicPlaying();
		} else {
			this.stopCarMusic();
		}

		const newLevel = Math.floor(this.score / 100);
		if (newLevel > this.difficultyLevel) {
			this.difficultyLevel = newLevel;
			this.obstacleSpawnTime = Math.max(450, 1200 - this.difficultyLevel * 80);
			// actualiza timer en runtime con protección
			try {
				this.obstacleSpawnTimer?.to(this.obstacleSpawnTime);
			} catch (err) {
				console.warn("[MotoRunnerScene] failed to update obstacleSpawnTimer", err);
			}
			this.baseSpeed -= 12;
			console.log("Dificultad ->", this.difficultyLevel, " spawnTime:", this.obstacleSpawnTime, " baseSpeed:", this.baseSpeed);
		}
	}

	private onPlayerHit(stone: Stone): void {
		if (this.player.invulnerable) {
			return;
		}

		this.lives--;
		this.player.invulnerable = true;
		SoundLib.playSound("sfxWhoosh", { volume: 0.4, speed: 5 });

		new Tween(this.player.sprite).from({ alpha: 0.3 }).to({ alpha: 1 }, 150).yoyo(true).yoyoEasing(Easing.Bounce.Out).repeat(4).start();

		// Asegurarse de no acceder a .graphic si no existe; usar sprite si está disponible
		new Timer()
			.to(120)
			.start()
			.onComplete(() => {
				if ((this.player as any).graphic) {
					(this.player as any).graphic.visible = true;
				} else if ((this.player as any).sprite) {
					(this.player as any).sprite.visible = true;
				}
				this.player.invulnerable = false;
			});

		stone.reset();

		if (this.lives <= 0) {
			this.endGame();
		}
	}

	private endGame(): void {
		this.gameOver = true;
		this.paused = true;

		if (this.gameOverPanel) {
			// actualizar puntaje
			const lbl: any = this.gameOverPanel.getChildByName("SCORE_LABEL");
			if (lbl) {
				lbl.text = `Puntaje: ${this.scoreInt}`;
			}
			this.gameOverPanel.visible = true;
			this.gameOverPanel.alpha = 0;
			new Tween(this.gameOverPanel).to({ alpha: 1 }, 500).start(); // fade-in suave
		}
	}

	private restartGame(): void {
		// la forma más simple: recargar la escena completa
		Manager.changeScene(MotoRunnerScene);
	}

	public override onResize(newW: number, newH: number): void {
		// --- scale containers como antes
		ScaleHelper.setScaleRelativeToIdeal(this.uiMiddle, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiMiddle.x = newW * 0.5;
		this.uiMiddle.y = 0;
		ScaleHelper.setScaleRelativeToIdeal(this.uiRight, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiRight.x = 0;
		this.uiRight.y = 0;

		// reubicar player lanes como antes
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW, newH, 1536, 1024, ScaleHelper.forceHeight);
		this.backgroundContainer.x = newW * 0.5 - this.backgroundContainer.width * 0.5;
		ScaleHelper.setScaleRelativeToIdeal(this.itemMenu, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.itemMenu.x = newW * 0.5;
		this.itemMenu.y = newH * 0.5;
		if (this.startButton) {
			ScaleHelper.setScaleRelativeToIdeal(this.startButton, newW, newH, 1920, 1080, ScaleHelper.FIT);
			this.startButton.x = newW * 0.5;
			this.startButton.y = newH - 120;
		}

		ScaleHelper.setScaleRelativeToIdeal(this.gameOverPanel, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.gameOverPanel.x = newW * 0.5;
		this.gameOverPanel.y = newH * 0.5;

		// recalcular tile widths y reposicionar tiles
		this.tileWidthFar = Math.max(newW, ScaleHelper.IDEAL_WIDTH);
		this.tileWidthMid = Math.max(newW, ScaleHelper.IDEAL_WIDTH);

		for (let i = 0; i < this.bgFarTiles.length; i++) {
			this.bgFarTiles[i].x = i * this.tileWidthFar;
			// si es graphics, redibujar en función del nuevo ancho podría ser necesario (omito por simplicidad)
		}

		for (let i = 0; i < this.bgMidTiles.length; i++) {
			const tile = this.bgMidTiles[i] as any;
			// si es Sprite, recalculamos la escala para que su ancho sea tileWidthMid
			if (tile.texture && tile.texture.width) {
				const texW = tile.texture.width;
				const scaleX = this.tileWidthMid / texW;
				tile.scale.set(scaleX);
				tile.x = i * this.tileWidthMid;
			} else {
				// si es Graphics, simplemente reposicionamos
				tile.x = i * this.tileWidthMid;
			}
		}
	}

	/*
	private createItemMenu(): Container {
		const menu = new Container();

		// fondo (ahora como sprite, suponiendo que tengas una textura "itemMenuBg")
		// const bg = Sprite.from("itemMenuBg"); // reemplaza por el nombre de tu textura
		// bg.anchor.set(0.5);
		// bg.scale.set(0.8);
		// menu.addChild(bg);

		// título
		// const title = new Text("Choose an item", { fontFamily: "Arial", fontSize: 28, fill: 0xffffff });
		// title.anchor.set(0.5);
		// title.position.set(0, -120);
		// menu.addChild(title);

		const labels = ["Speed", "Clear", "Extra Life"];
		const iconKeys = ["money", "helmet", "money"]; // nombres de texturas para los iconos
		const descriptions: string[] = [];

		// crear 3 botones
		for (let i = 0; i < 3; i++) {
			const btn = new Container();
			btn.x = (i - 1) * 220;
			btn.y = 40;
			btn.eventMode = "static";
			btn.interactive = true;

			// botón circular como sprite (ej: una textura de círculo blanco)
			const circle = Sprite.from(Texture.WHITE);
			circle.anchor.set(0.5);
			circle.scale.set(0.5);
			btn.addChild(circle);

			// icono (sprite distinto por cada item)
			const icon = Sprite.from(iconKeys[i]);
			icon.anchor.set(0.5);
			icon.scale.set(0.6);
			btn.addChild(icon);

			// label
			const lbl = new Text(labels[i], { fontFamily: "Arial", fontSize: 18, fill: 0x000000 });
			lbl.anchor.set(0.5);
			lbl.position.set(0, 80);
			btn.addChild(lbl);

			// descripción
			const desc = new Text(descriptions[i], { fontFamily: "Arial", fontSize: 12, fill: 0xffffff });
			desc.anchor.set(0.5);
			desc.position.set(0, 110);
			menu.addChild(desc);

			btn.on("pointerdown" as any, () => {
				SoundLib.playSound?.("sound_collectable", { volume: 0.5 });
				this.applyItem(i);
				this.closeItemMenu();
			});
			btn.on("pointerover" as any, () => {
				new Tween(btn.scale).to({ x: 1.05, y: 1.05 }, 120).start();
			});
			btn.on("pointerout" as any, () => {
				new Tween(btn.scale).to({ x: 1, y: 1 }, 120).start();
			});

			menu.addChild(btn);
		}

		return menu;
	}
		*/

	private createItemMenu(): Container {
		const menu = new Container();
		this.itemMenu = menu;
		this.rebuildItemMenu();
		return menu;
	}

	private openItemMenu(_cp?: Checkpoint): void {
		if (this.itemMenuOpen) {
			return;
		}
		this.itemMenu.visible = true;
		this.itemMenuOpen = true;
		this.paused = true; // pausa todo el update del juego
		// bloquear input sobre sceneContainer
		this.sceneContainer.interactive = false;
		Keyboard.shared.enabled = false;

		// animación de entrada
		this.itemMenu.scale.set(0.6);
		new Tween(this.itemMenu.scale).to({ x: 1, y: 1 }, 300).easing(Easing.Back.Out).start();
	}

	private closeItemMenu(): void {
		if (!this.itemMenuOpen) {
			return;
		}
		// quitar menu
		if (this.itemMenu && this.itemMenu.parent) {
			this.itemMenu.visible = false;
		}
		this.itemMenuOpen = false;
		this.paused = false;
		this.sceneContainer.interactive = true;
		try {
			Keyboard.shared.enabled = true;
			// eslint-disable-next-line prettier/prettier
		} catch { }
	}

	public applyItem(index: number): void {
		switch (index) {
			case 0: // Speed Boost
				{
					const boostAmount = -220; // reduce baseSpeed (más negativo => más rápido)
					const prev = this.baseSpeed;
					this.baseSpeed += boostAmount; // aumentar velocidad de movimiento de obstáculos (negativo)
					// efecto visual y revertir
					this.player.showSpeedTrail(5000);
					// revertir después de 5s
					Timer.delay(5000, () => {
						this.baseSpeed = prev;
					});
					console.log("Item: Speed Boost applied");
					this.espertSpeed += 0.2;
					new Timer()
						.to(5000)
						.start()
						.onComplete(() => {
							this.espertSpeed = MotoRunnerScene.initialEspertSpeed;
						});
					SoundLib.playSound?.("sound_collectable", {});
				}
				break;
			case 1: // Clear obstacles
				{
					for (const s of this.stonesPool) {
						if (s.active) {
							s.reset();
						}
					}
					console.log("Item: Clear obstacles applied");
					SoundLib.playSound?.("sound_collectable", {});
				}
				break;
			case 2: // Extra life
				{
					this.lives++;
					console.log("Item: Extra life applied. Lives:", this.lives);
					SoundLib.playSound?.("sound_collectable", {});
				}
				break;
		}
		// guardamos la elección (opcional)
		DataManager.setValue("lastPickedItem", index);
	}
}
