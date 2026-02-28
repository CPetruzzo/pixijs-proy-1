/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Container, Graphics, Sprite, Text, Texture, TilingSprite, Rectangle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Timer } from "../../../engine/tweens/Timer";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
// import { Keyboard } from "../../../engine/input/Keyboard";
// import { DataManager } from "../../../engine/datamanager/DataManager";
import { UIContainerRight } from "../GlobalGameJam/BubbleUI";
import { Manager } from "../../..";
import { filters } from "@pixi/sound";

// --- CONFIGURACIÓN ---
const GameConfig = {
	// Coordenadas originales exactas
	LANES_Y: [800, 880, 960],
	PLAYER_X_START: 650,
	BASE_SPEED: -420,
	LIMIT_X_RESET: -500, // Margen para resetear objetos
};

// --- UTILIDADES ---
function getTextureOrFallback(key: string): Texture | null {
	try {
		const tex = Texture.from(key);
		if (tex && tex.baseTexture && tex.baseTexture.valid) {
			return tex;
		}
		return null;
	} catch {
		return null;
	}
}

interface ItemOption {
	name: string;
	texture: string;
	effect: (scene: MotoRunnerScene) => void;
}

// ==========================================
// CLASES DE OBSTÁCULOS (BASE OPTIMIZADA)
// ==========================================

class BaseObstacle extends Container {
	public active = false;
	public speedX = 0;
	public radius = 20; // Para colisión circular simple si se necesita

	// Hitbox rectangular
	protected hitbox: Rectangle = new Rectangle(0, 0, 40, 40);

	constructor() {
		super();
		this.visible = false;
	}

	public spawn(x: number, y: number, speedX: number, scale = 1): void {
		this.position.set(x, y);
		this.speedX = speedX;
		this.scale.set(scale);
		this.active = true;
		this.visible = true;
		this.onSpawn();
	}

	protected onSpawn(): void { }

	public update(dtMs: number): void {
		if (!this.active) {
			return;
		}

		this.x += (this.speedX * dtMs) / 1000;

		if (this.x < GameConfig.LIMIT_X_RESET) {
			this.reset();
		}
	}

	public reset(): void {
		this.active = false;
		this.visible = false;
		this.position.set(-9999, -9999);
		if (this.parent) {
			this.parent.removeChild(this);
		}
	}

	public getHitbox(): Rectangle {
		// Ajustamos la hitbox a la posición global relativa al contenedor padre
		return new Rectangle(this.x + this.hitbox.x, this.y + this.hitbox.y, this.hitbox.width, this.hitbox.height);
	}
}

class Stone extends BaseObstacle {
	constructor(radius = 18) {
		super();
		this.radius = radius;

		const g = new Graphics();
		g.beginFill(0x6b6b6b);
		g.lineStyle(2, 0x333333);
		g.drawCircle(0, 0, this.radius);
		g.endFill();
		this.addChild(g);

		// Hitbox centrada en el círculo
		this.hitbox = new Rectangle(-radius, -radius, radius * 2, radius * 2);
	}
}

class Checkpoint extends BaseObstacle {
	public id: number;
	constructor(radius = 22, id = 0) {
		super();
		this.radius = radius;
		this.id = id;

		const g = new Graphics();
		g.beginFill(0xffd700);
		g.lineStyle(3, 0xbb8f00);
		g.drawCircle(0, 0, this.radius);
		g.endFill();

		g.beginFill(0x000000);
		g.drawCircle(0, -2, this.radius * 0.35);
		g.endFill();
		this.addChild(g);

		this.hitbox = new Rectangle(-radius, -radius, radius * 2, radius * 2);
	}
}

class Car extends BaseObstacle {
	private sprite?: Sprite;

	constructor() {
		super();
		const tex = getTextureOrFallback("espertCar");

		if (tex) {
			this.sprite = new Sprite(tex);
			this.sprite.anchor.set(0.5, 1);
			this.sprite.scale.set(0.5);
			this.addChild(this.sprite);

			// Hitbox basada en el sprite (aprox 50% ancho, 40% alto)
			const w = Math.abs(this.sprite.width);
			const h = Math.abs(this.sprite.height);
			this.hitbox = new Rectangle(-w * 0.25, -h * 0.4, w * 0.5, h * 0.4);
		} else {
			// Fallback
			const g = new Graphics();
			g.beginFill(0xff3333);
			g.drawRoundedRect(-60, -60, 120, 60, 8);
			g.endFill();
			this.addChild(g);
			this.hitbox = new Rectangle(-50, -50, 100, 50);
		}
	}
}

class PlayerBike extends Container {
	public sprite?: Sprite;
	public graphic?: Graphics;
	public laneIndex = 1;
	public isJumping = false;
	public invulnerable = false;
	public lanesY = GameConfig.LANES_Y;

	private bob: Container;
	private speedTrail?: Sprite | Graphics;

	constructor() {
		super();
		this.bob = new Container();
		this.addChild(this.bob);

		const tex = getTextureOrFallback("espert");
		if (tex) {
			this.sprite = new Sprite(tex);
			this.sprite.anchor.set(0.5, 0.7);
			this.sprite.scale.set(0.5);
			this.bob.addChild(this.sprite);

			new Tween(this.sprite).from({ y: 0 }).to({ y: 3 }, 70).start().yoyo(true).repeat(Infinity);
		} else {
			this.createGraphicFallback();
		}

		// Speed Trail
		const trailTex = getTextureOrFallback("espertSpeedUp");
		if (trailTex) {
			this.speedTrail = new Sprite(trailTex);
			this.speedTrail.anchor.set(0.5, 0.5);
		} else {
			const g = new Graphics();
			g.beginFill(0xffa500, 0.9);
			g.drawEllipse(0, 0, 28, 12);
			g.endFill();
			this.speedTrail = g;
		}

		if (this.speedTrail) {
			this.speedTrail.position.set(-40, 4);
			this.speedTrail.scale.set(0.5);
			this.speedTrail.alpha = 0;
			this.bob.addChildAt(this.speedTrail, 0);
		}
	}

	private createGraphicFallback(): void {
		this.graphic = new Graphics();
		this.bob.addChild(this.graphic);
		this.graphic.clear();
		this.graphic.beginFill(0x0099ff);
		this.graphic.lineStyle(2, 0x003f5c);
		this.graphic.drawRoundedRect(-50, -40, 100, 40, 8);
		this.graphic.endFill();
	}

	public showSpeedTrail(durationMs: number): void {
		if (!this.speedTrail) {
			return;
		}
		this.speedTrail.alpha = 1;
		new Tween(this.speedTrail).to({ alpha: 1 }, 200).start();
		new Timer()
			.to(durationMs)
			.start()
			.onComplete(() => {
				if (this.speedTrail) {
					new Tween(this.speedTrail).to({ alpha: 0 }, 500).start();
				}
			});
	}

	public setLane(index: number, tween = true): void {
		const prevIndex = this.laneIndex;
		this.laneIndex = Math.max(0, Math.min(2, index));
		const targetY = this.lanesY[this.laneIndex];

		if (tween && prevIndex !== this.laneIndex) {
			new Tween(this).to({ y: targetY }, 180).easing(Easing.Cubic.Out).start();
			// Tilt visual
			new Tween(this.bob)
				.to({ rotation: this.laneIndex > prevIndex ? 0.1 : -0.1 }, 90)
				.yoyo(true)
				.repeat(1)
				.start();
		} else {
			this.y = targetY;
		}
	}

	public dodgeUp(): void {
		this.setLane(this.laneIndex - 1, true);
	}
	public dodgeDown(): void {
		this.setLane(this.laneIndex + 1, true);
	}

	public jump(): void {
		if (this.isJumping) {
			return;
		}
		this.isJumping = true;
		const origY = 0; // Relativo al bob
		new Tween(this.bob)
			.to({ y: origY - 90 }, 260)
			.easing(Easing.Sinusoidal.Out)
			.start()
			.onComplete(() => {
				new Tween(this.bob)
					.to({ y: origY }, 320)
					.easing(Easing.Sinusoidal.In)
					.start()
					.onComplete(() => (this.isJumping = false));
			});
	}

	public getBoundsRect(): Rectangle {
		// Hitbox fija centrada en la moto
		return new Rectangle(this.x - 40, this.y - 30, 80, 40);
	}
}

// ==========================================
// SCENE PRINCIPAL
// ==========================================

export class MotoRunnerScene extends PixiScene {
	// Contenedores (Estructura Original)
	private backgroundContainer = new Container();
	private sceneContainer = new Container(); // Dentro de background
	private movingContainer = new Container(); // Dentro de scene
	private laneContainers: Container[] = []; // Dentro de moving

	private uiMiddle = new Container();
	private uiRight = new Container(); // Para compatibilidad
	public static readonly BUNDLES = ["espert"];

	// Entidades
	private player!: PlayerBike;
	private milei!: Sprite;

	// Pools
	private stonesPool: Stone[] = [];
	private checkpointsPool: Checkpoint[] = [];
	private carsPool: Car[] = [];

	// Estado
	private score = 0;
	private scoreInt = 0;
	private lives = 3;
	private started = false;
	private paused = false;
	private gameOver = false;
	private difficultyLevel = 1;
	private baseSpeed = GameConfig.BASE_SPEED;

	// Spawners
	private obstacleSpawnTimer!: Timer;
	public carSpawnTimer!: Timer;
	public checkpointSpawnTimer!: Timer;
	private activeCarsCount = 0;

	// UI & Backgrounds
	private scoreText?: Text;
	private gameOverPanel?: Container;
	private itemMenu?: Container;
	private startButton?: Container;
	private backgrounds: TilingSprite[] = [];

	// Items disponibles
	private availableItems: ItemOption[] = [];

	constructor() {
		super();
		this.setupSceneStructure();
		this.createUI();
		this.setupInputs();
		this.setupDefaults();
	}

	private setupDefaults(): void {
		this.setAvailableItems([
			{ name: "Speed", texture: "money", effect: (s) => this.applyBoost(s) },
			{ name: "Limpiar", texture: "helmet", effect: (s) => s.clearObstacles() },
			{
				name: "Vida",
				texture: "money",
				effect: (s) => {
					s.lives++;
					SoundLib.playSound?.("sound_collectable", {});
				},
			},
		]);
	}

	private setupSceneStructure(): void {
		// 1. Fondo y Jerarquía Principal
		this.addChild(this.backgroundContainer);
		// IMPORTANTE: sceneContainer dentro de backgroundContainer para que escale junto
		this.backgroundContainer.addChild(this.sceneContainer);
		this.sceneContainer.addChild(this.movingContainer);

		// 2. Tiling Sprites
		const tex1 = getTextureOrFallback("streetLayer1") || Texture.WHITE;
		const tex2 = getTextureOrFallback("streetLayer2") || Texture.WHITE;
		const w = ScaleHelper.IDEAL_WIDTH * 1.15;
		const h = ScaleHelper.IDEAL_HEIGHT;

		const bg1 = new TilingSprite(tex1, w, h);
		const bg2 = new TilingSprite(tex2, w, h);
		this.backgrounds.push(bg2, bg1);
		this.backgroundContainer.addChildAt(bg2, 0);
		this.backgroundContainer.addChildAt(bg1, 1);

		// 3. Lane Containers (Z-Order)
		for (let i = 0; i < 3; i++) {
			const lc = new Container();
			this.laneContainers.push(lc);
			this.movingContainer.addChild(lc);
		}

		// 4. Entidades
		this.milei = Sprite.from(getTextureOrFallback("milei") || Texture.WHITE);
		this.milei.anchor.set(0.5);
		this.milei.scale.set(0.25);
		this.milei.position.set(0, GameConfig.LANES_Y[1]); // Posición dummy inicial
		this.sceneContainer.addChild(this.milei); // Milei fuera de los lanes, o dentro si debe moverse en profunidad

		this.player = new PlayerBike();
		this.player.setLane(1, false);
		this.movePlayerToLaneContainer(1);

		this.initPools();
	}

	private initPools(): void {
		for (let i = 0; i < 12; i++) {
			this.stonesPool.push(new Stone(15 + Math.random() * 10));
		}
		for (let i = 0; i < 4; i++) {
			this.checkpointsPool.push(new Checkpoint(20));
		}
		for (let i = 0; i < 5; i++) {
			this.carsPool.push(new Car());
		}

		// Agregar todos al movingContainer inicialmente (luego se mueven a lanes al spawnear)
		[...this.stonesPool, ...this.checkpointsPool, ...this.carsPool].forEach((e) => this.movingContainer.addChild(e));
	}

	private createUI(): void {
		this.addChild(this.uiMiddle);
		try {
			this.uiRight = new (UIContainerRight as any)();
			this.addChild(this.uiRight);
		} catch {
			/* Fallback */
		}

		// Score Bar
		const uiBg = Sprite.from(getTextureOrFallback("uiBar") || Texture.WHITE);
		uiBg.anchor.set(0.5, 0);
		this.uiMiddle.addChild(uiBg);

		this.scoreText = new Text("0", {
			fontFamily: "Pixelate-Regular",
			fontSize: 46,
			fill: 0xffffff,
			stroke: 0x000000,
			strokeThickness: 4,
			fontWeight: "bold",
		});
		this.scoreText.position.set(575, 32);
		this.uiMiddle.addChild(this.scoreText);

		this.startButton = this.createStartButton();
		this.addChild(this.startButton);

		this.gameOverPanel = this.createGameOverPanel();
		this.addChild(this.gameOverPanel);

		this.itemMenu = this.createItemMenu();
		this.itemMenu.visible = false;
		this.addChild(this.itemMenu);

		this.createTouchControls();
	}

	private createTouchControls(): void {
		// Flechas visuales
		const createArrow = (yOff: number, rot: number, color: number) => {
			const g = new Graphics();
			g.beginFill(color, 0.7);
			g.drawPolygon([-60, 60, 60, 60, 0, -60]);
			g.endFill();
			g.rotation = rot;
			g.position.set(-ScaleHelper.IDEAL_WIDTH / 2 + 100, ScaleHelper.IDEAL_HEIGHT / 2 + yOff);
			g.eventMode = "static";
			g.cursor = "pointer";
			return g;
		};

		const btnUp = createArrow(-150, 0, 0x00ccff);
		btnUp.on("pointerdown", () => this.handleInput("up"));

		const btnDown = createArrow(150, Math.PI, 0xff6600);
		btnDown.on("pointerdown", () => this.handleInput("down"));

		this.uiMiddle.addChild(btnUp, btnDown);
	}

	private setupInputs(): void {
		const onKeyDown = (e: KeyboardEvent) => {
			if (this.paused || this.gameOver) {
				return;
			}
			switch (e.code) {
				case "ArrowUp":
					this.handleInput("up");
					break;
				case "ArrowDown":
					this.handleInput("down");
					break;
				case "Space":
					if (!this.started) {
						this.startGame();
					} else {
						this.handleInput("jump");
					}
					break;
				case "KeyP":
					this.paused = !this.paused;
					break;
				case "Escape":
					this.endGame();
					break;
			}
		};
		window.addEventListener("keydown", onKeyDown);
		(this as any)._cleanupInput = () => window.removeEventListener("keydown", onKeyDown);

		this.sceneContainer.eventMode = "static";
		this.sceneContainer.on("pointerdown", (e) => {
			if (!this.started) {
				return;
			}
			const local = e.getLocalPosition(this.player);
			if (local.y < -30) {
				this.handleInput("up");
			} else if (local.y > 30) {
				this.handleInput("down");
			} else {
				this.handleInput("jump");
			}
		});
	}

	private handleInput(action: "up" | "down" | "jump"): void {
		if (action === "jump") {
			this.player.jump();
		} else {
			if (action === "up") {
				this.player.dodgeUp();
			}
			if (action === "down") {
				this.player.dodgeDown();
			}
			this.movePlayerToLaneContainer(this.player.laneIndex);
		}
	}

	private movePlayerToLaneContainer(index: number): void {
		const safeIndex = Math.max(0, Math.min(2, index));
		if (this.player.parent) {
			this.player.parent.removeChild(this.player);
		}
		this.laneContainers[safeIndex].addChild(this.player);
	}

	// --- GAMEPLAY LOOP ---

	private startGame(): void {
		if (this.started) {
			return;
		}
		this.started = true;
		this.startButton.visible = false;

		// Animaciones de entrada
		new Tween(this.player).to({ x: GameConfig.PLAYER_X_START }, 1500).easing(Easing.Exponential.Out).start();
		new Tween(this.milei.position).to({ x: 2550, y: GameConfig.LANES_Y[1] }, 15500).easing(Easing.Exponential.Out).start();

		this.startSpawners();

		// Audio
		SoundLib.playSound?.("arranque", { volume: 0.3 });
		Timer.delay(1000, () => SoundLib.playMusic?.("andando", { loop: true, volume: 0.18 }));
	}

	private startSpawners(): void {
		this.obstacleSpawnTimer = new Timer()
			.to(1200)
			.repeat(Infinity)
			.start()
			.onRepeat(() => this.spawnGeneric(this.stonesPool));
		this.carSpawnTimer = new Timer()
			.to(6000)
			.repeat(Infinity)
			.start()
			.onRepeat(() => this.spawnGeneric(this.carsPool, true));
		this.checkpointSpawnTimer = new Timer()
			.to(8000)
			.repeat(Infinity)
			.start()
			.onRepeat(() => this.spawnGeneric(this.checkpointsPool));
	}

	private spawnGeneric(pool: BaseObstacle[], isCar = false): void {
		if (this.paused || this.gameOver || this.itemMenu?.visible) {
			return;
		}

		const entity = pool.find((e) => !e.active);
		if (!entity) {
			return;
		}

		const lane = Math.floor(Math.random() * 3);
		const y = GameConfig.LANES_Y[lane];
		const worldW = ScaleHelper.IDEAL_WIDTH;
		// Posición de spawn relativa al backgroundContainer (que tiene tamaño de IDEAL_WIDTH aprox)
		const spawnX = worldW + 200 + Math.random() * 200;

		const speed = this.baseSpeed - Math.random() * (isCar ? 100 : 50);

		entity.spawn(spawnX, y, speed);

		if (entity.parent) {
			entity.parent.removeChild(entity);
		}
		this.laneContainers[lane].addChild(entity);

		if (isCar) {
			this.activeCarsCount++;
			this.updateCarAudio();
		}
	}

	public override update(dt: number): void {
		if (!this.started || this.paused || this.gameOver) {
			return;
		}

		const dtMs = dt; // Asumiendo dt en ms

		// Scroll Background
		this.backgrounds.forEach((bg, i) => {
			bg.tilePosition.x -= Math.abs(this.baseSpeed) * 0.05 * (i + 1) * dt * 0.01;
		});

		// Score
		this.score += dt * 0.02;
		if (Math.floor(this.score) > this.scoreInt) {
			this.scoreInt = Math.floor(this.score);
			if (this.scoreText) {
				this.scoreText.text = this.scoreInt.toString();
			}
			this.checkDifficulty();
		}

		const playerHitbox = this.player.getBoundsRect();
		const jumping = this.player.isJumping;

		// Update loop genérico
		const checkEntity = (e: BaseObstacle, type: "damage" | "collect") => {
			if (e.active) {
				e.update(dtMs);

				// Audio Car Logic
				if (e instanceof Car && e.x < GameConfig.LIMIT_X_RESET && e.active) {
					this.activeCarsCount = Math.max(0, this.activeCarsCount - 1);
					this.updateCarAudio();
				}

				// Colisiones
				if (!jumping && !this.player.invulnerable && this.rectIntersect(playerHitbox, e.getHitbox())) {
					if (type === "collect") {
						this.collectItem(e as Checkpoint);
					} else {
						this.hitObstacle(e);
					}
				}
			}
		};

		this.stonesPool.forEach((s) => checkEntity(s, "damage"));
		this.carsPool.forEach((c) => checkEntity(c, "damage"));
		this.checkpointsPool.forEach((cp) => checkEntity(cp, "collect"));
	}

	private rectIntersect(r1: Rectangle, r2: Rectangle): boolean {
		return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
	}

	private updateCarAudio(): void {
		try {
			if (this.activeCarsCount > 0) {
				SoundLib.playMusic?.("altaCoimera", { loop: true, volume: 0.18, filters: [new filters.TelephoneFilter()] });
			} else {
				(SoundLib as any).stopMusic?.("altaCoimera");
			}
		} catch { }
	}

	private hitObstacle(obs: BaseObstacle): void {
		this.lives--;
		this.player.invulnerable = true;
		SoundLib.playSound?.("sfxWhoosh", { volume: 0.4 });

		new Tween(this.player)
			.to({ alpha: 0.3 }, 100)
			.yoyo(true)
			.repeat(5)
			.start()
			.onComplete(() => {
				this.player.alpha = 1;
				this.player.invulnerable = false;
			});

		obs.reset();
		if (this.lives <= 0) {
			this.endGame();
		}
	}

	private collectItem(cp: Checkpoint): void {
		cp.reset();
		this.openItemMenu();
	}

	private checkDifficulty(): void {
		const level = Math.floor(this.scoreInt / 100);
		if (level > this.difficultyLevel) {
			this.difficultyLevel = level;
			this.baseSpeed -= 15;
			this.obstacleSpawnTimer.to(Math.max(500, 1200 - level * 60));
		}
	}

	// --- ITEM SYSTEM ---

	public setAvailableItems(items: ItemOption[]): void {
		this.availableItems = items;
		if (this.itemMenu) {
			this.itemMenu.destroy({ children: true });
			this.itemMenu = this.createItemMenu();
			this.addChild(this.itemMenu); // Re-add
		}
	}

	private createItemMenu(): Container {
		const menu = new Container();
		const bg = new Graphics().beginFill(0x000000, 0.9).drawRoundedRect(-350, -150, 700, 300, 20).endFill();
		menu.addChild(bg);

		const items = this.availableItems.length ? this.availableItems : [];
		const spacing = 220;

		items.forEach((item, i) => {
			const btn = new Container();
			btn.x = (i - (items.length - 1) / 2) * spacing;

			// Icono
			let icon: Sprite;
			const tex = getTextureOrFallback(item.texture);
			if (tex) {
				icon = new Sprite(tex);
				icon.scale.set(0.6); // Ajustar según asset real
			} else {
				icon = Sprite.from(Texture.WHITE); // Fallback
			}
			icon.anchor.set(0.5);

			const txt = new Text(item.name, { fill: 0xffffff, fontSize: 24, fontWeight: "bold" });
			txt.anchor.set(0.5);
			txt.y = 80;

			btn.addChild(icon, txt);

			btn.eventMode = "static";
			btn.cursor = "pointer";
			btn.on("pointerdown", () => {
				item.effect(this);
				this.closeItemMenu();
			});

			menu.addChild(btn);
		});

		menu.position.set(ScaleHelper.IDEAL_WIDTH / 2, ScaleHelper.IDEAL_HEIGHT / 2);
		return menu;
	}

	private openItemMenu(): void {
		if (!this.itemMenu) {
			return;
		}
		this.paused = true;
		this.itemMenu.visible = true;
		this.itemMenu.scale.set(0);
		new Tween(this.itemMenu.scale).to({ x: 1, y: 1 }, 300).easing(Easing.Back.Out).start();
	}

	private closeItemMenu(): void {
		if (!this.itemMenu) {
			return;
		}
		new Tween(this.itemMenu.scale)
			.to({ x: 0, y: 0 }, 200)
			.easing(Easing.Back.In)
			.start()
			.onComplete(() => {
				if (this.itemMenu) {
					this.itemMenu.visible = false;
				}
				this.paused = false;
			});
	}

	// Efectos de items
	public applyBoost(s: MotoRunnerScene): void {
		const prev = s.baseSpeed;
		s.baseSpeed -= 200;
		s.player.showSpeedTrail(5000);
		Timer.delay(5000, () => (s.baseSpeed = prev));
		SoundLib.playSound?.("sound_collectable", {});
	}

	public clearObstacles(): void {
		this.stonesPool.forEach((s) => s.reset());
		SoundLib.playSound?.("sound_collectable", {});
	}

	// --- GAME OVER & UI HELPERS ---

	private endGame(): void {
		this.gameOver = true;
		SoundLib.stopAllMusic?.();
		if (this.gameOverPanel) {
			this.gameOverPanel.visible = true;
			const txt: Text = this.gameOverPanel.getChildByName("SCORE_LABEL");
			if (txt) {
				txt.text = `Puntaje: ${this.scoreInt}`;
			}
		}
	}

	private createStartButton(): Container {
		const c = new Container();
		const tex = getTextureOrFallback("btnStart");
		if (tex) {
			c.addChild(Sprite.from(tex));
		} else {
			const bg = new Graphics().beginFill(0x00ccff).drawRoundedRect(-100, -30, 200, 60, 15).endFill();
			const txt = new Text("INICIAR", { fontSize: 30, fontWeight: "bold" });
			txt.anchor.set(0.5);
			c.addChild(bg, txt);
		}
		c.eventMode = "static";
		c.cursor = "pointer";
		c.on("pointerdown", () => this.startGame());
		return c;
	}

	private createGameOverPanel(): Container {
		const c = new Container();
		c.visible = false;
		const bg = new Graphics()
			.beginFill(0x000000, 0.8)
			.drawRect(-ScaleHelper.IDEAL_WIDTH / 2, -ScaleHelper.IDEAL_HEIGHT / 2, ScaleHelper.IDEAL_WIDTH, ScaleHelper.IDEAL_HEIGHT)
			.endFill();

		const title = new Text("GAME OVER", { fill: 0xff3333, fontSize: 60, fontWeight: "bold" });
		title.anchor.set(0.5);
		title.y = -100;

		const score = new Text("Puntaje: 0", { fill: 0xffffff, fontSize: 40 });
		score.anchor.set(0.5);
		score.name = "SCORE_LABEL";

		const btn = new Graphics().beginFill(0xffffff).drawRoundedRect(-100, -30, 200, 60, 10).endFill();
		const btnTxt = new Text("RETRY", { fontSize: 24 });
		btnTxt.anchor.set(0.5);
		btn.addChild(btnTxt);
		btn.y = 100;
		btn.eventMode = "static";
		btn.cursor = "pointer";
		btn.on("pointerdown", () => Manager.changeScene(MotoRunnerScene));

		c.addChild(bg, title, score, btn);
		c.position.set(ScaleHelper.IDEAL_WIDTH / 2, ScaleHelper.IDEAL_HEIGHT / 2);
		return c;
	}

	// --- RESIZE (CRÍTICO: MANTENER LÓGICA ORIGINAL) ---
	public override onResize(newW: number, newH: number): void {
		// 1. UI Centrada
		ScaleHelper.setScaleRelativeToIdeal(this.uiMiddle, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiMiddle.position.set(newW / 2, 0);

		// 2. Fondo (Y ESCENA) Scaled Height Force
		// Al escalar backgroundContainer, sceneContainer escala con él.
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW, newH, 1536, 1024, ScaleHelper.forceHeight);
		this.backgroundContainer.position.set((newW - this.backgroundContainer.width) / 2, 0);

		// 3. Menús
		if (this.gameOverPanel) {
			this.gameOverPanel.position.set(newW / 2, newH / 2);
			ScaleHelper.setScaleRelativeToIdeal(this.gameOverPanel, newW, newH, 1920, 1080, ScaleHelper.FIT);
		}
		if (this.itemMenu) {
			this.itemMenu.position.set(newW / 2, newH / 2);
			ScaleHelper.setScaleRelativeToIdeal(this.itemMenu, newW, newH, 1920, 1080, ScaleHelper.FIT);
		}
		if (this.startButton) {
			this.startButton.x = newW * 0.5;
			this.startButton.y = newH - 120;
			ScaleHelper.setScaleRelativeToIdeal(this.startButton, newW, newH, 1920, 1080, ScaleHelper.FIT);
		}
	}

	public override onDestroy(): void {
		if ((this as any)._cleanupInput) {
			(this as any)._cleanupInput();
		}
		SoundLib.stopAllMusic?.();
	}
}
