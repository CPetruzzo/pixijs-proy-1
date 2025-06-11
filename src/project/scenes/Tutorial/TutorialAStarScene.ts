import { Text, TextStyle, Texture } from "pixi.js";
import { Container, Graphics, Point, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Easing, Tween } from "tweedle.js";
import { OverlayScene } from "../AbandonedShelter/OverlayScene";
import { GlitchFilter } from "@pixi/filter-glitch";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { filters } from "@pixi/sound";
import { UI } from "../AbandonedShelter/UI";
import { GameStateManager } from "../AbandonedShelter/game/GameStateManager";
import type { PausePopUp } from "../AbandonedShelter/game/PausePopUp";
import type { ProgressBar } from "@pixi/ui";
import { Trigger } from "../AbandonedShelter/classes/Trigger";
import { Manager, pixiRenderer } from "../../..";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { LoseGameOverScene } from "../AbandonedShelter/LoseGameOverScene";
import { Timer } from "../../../engine/tweens/Timer";
import { WinGameOverScene } from "../AbandonedShelter/WinGameOverScene";

class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}

enum DialoguePhase {
	PLAYER_INTRO,
	LLORONA_SCREAM,
	PLAYER_HURRY,
	DONE,
}

export class CameraAStarScene extends PixiScene {
	private grid: number[][] = [];
	private tileSize = 16;
	private player: Graphics | null = null;
	private worldContainer = new Container();
	private targetTileOutline!: Sprite;
	public static readonly BUNDLES = ["abandonedhouse"];

	// Movimiento suave por paso
	private pathQueue: Point[] = [];
	private stepStart: Point | null = null;
	private stepEnd: Point | null = null;
	private stepElapsed = 0;
	private stepDuration = 0;
	private speed = 200; // px/segundo
	// … otras propiedades …
	private zoom = 3;

	private viewWidth = 0;
	private viewHeight = 0;
	private uiContainer = new Container();
	private uiRightContainer = new Container();
	private uiCenterContainer = new Container();
	private uiLeftContainer = new Container();
	private pauseContainer = new Container();

	private pathDebug: Container | null = null; // <<<
	private debugText!: Text; // <<<
	private overlay: OverlayScene;
	private outlineTween?: Tween<{ x: number; y: number }>;

	private ghost!: Sprite;
	private walkableZones: Point[] = [];
	private lloronaOverlay: OverlayScene;
	private phase = DialoguePhase.PLAYER_INTRO;
	private tilesInteractive = false;

	private tiles: Array<{ tile: Graphics; i: number; j: number }> = [];
	private playerSprite!: Sprite;

	// --- NUEVO: overlay rojo para el “flash” al chocar ---
	private redOverlay!: Graphics;
	private redActive = false; // para evitar disparos simultáneos
	public ui: UI;

	private batteryBars: Sprite[] = [];
	private activeIcon!: Sprite | null;
	private weaponSprite!: Sprite;
	private pausePopUp: PausePopUp | null = null;
	private state = GameStateManager.instance;
	private lightCone!: Sprite;
	private hpBar: ProgressBar;
	private trigger: Trigger;
	private gameOverTriggered = false; // ← guard para no disparar FadeColorTransition más de una vez
	private ghostTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		super();
		this.grid = this.createGrid();
		this.addChild(this.worldContainer, this.uiContainer);
		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiCenterContainer);
		this.addChild(this.uiRightContainer);
		this.addChild(this.pauseContainer);
		this.createBackground();

		SoundLib.playMusic("AH_Eternal_Pursuit", { speed: 2, volume: 0.15, loop: false });

		const spr = Sprite.from("AH_topdown");
		spr.alpha = 0.7;
		spr.scale.set(0.532);

		this.worldContainer.addChild(spr);
		this.createPlayer();

		// Creamos el Text de debug (sin variables extras)
		this.debugText = new Text("0,0", new TextStyle({ fill: "#ffffff", fontSize: 14 }));
		this.debugText.position.set(10, 10);
		// this.uiContainer.addChild(this.debugText);

		this.overlay = new OverlayScene();
		this.uiContainer.addChild(this.overlay);
		this.overlay.typeText("Bien! Con ese ritual de perdón que acabo de conseguir me faltaría no más llegar hasta el altar. ", "ritual de perdón", "red", 20);

		// Vi que el camino tiene zonas de visión reducida, seguro me sirven para esconderme... aunque... es un fantasma, esperemos que funcione.
		// 1) Recolectar zonas caminables
		for (let i = 0; i < this.grid.length; i++) {
			for (let j = 0; j < this.grid[0].length; j++) {
				if (this.grid[i][j] === 0) {
					this.walkableZones.push(new Point(i, j));
				}
			}
		}

		// 2) Crear la “llorona” (placeholder AH_player_idle) y ocultarla
		this.ghost = Sprite.from("ghost_whiteeyes");
		this.ghost.anchor.set(0.5, 0.9);
		this.ghost.scale.set(0.05);
		this.ghost.alpha = 0;
		this.worldContainer.addChild(this.ghost);

		// Creamos el overlay rojo, **pero con tamaño 0 por ahora**.
		// Más abajo, en onResize, lo redibujaremos con las medidas correctas.
		this.redOverlay = new Graphics().beginFill(0xff0000, 0).drawRect(0, 0, this.viewWidth, this.viewHeight).endFill();
		this.redOverlay.visible = false;
		this.uiContainer.addChild(this.redOverlay);

		// 3) Arrancar el ciclo de aparición/desaparición
		this.spawnGhostLoop();

		this.ui = new UI(
			this.uiRightContainer,
			this.batteryBars,
			this.activeIcon,
			this.uiCenterContainer,
			this.pausePopUp,
			this.pauseContainer,
			this.hpBar,
			this.uiLeftContainer,
			this.state,
			this.weaponSprite,
			this.lightCone
		);

		this.trigger = new Trigger();
		this.trigger.createTrigger(this.worldContainer, 0.2, 0.24);
		this.trigger.triggerZone.x += 820;
		this.trigger.triggerText.x += 820;
		this.trigger.triggerZone.y += 340;
		this.trigger.triggerText.y += 340;
		this.trigger.scale.set(0.5);

		pixiRenderer.pixiRenderer.view.style.cursor = "";
	}

	/** Cada 3–6 segundos movemos y tweeneamos la aparición de la ghost */
	private spawnGhostLoop(): void {
		const delay = 3000 + Math.random() * 1000;
		this.ghostTimeout = setTimeout(() => {
			if (!this.player) {
				return;
			}

			// 1) Posición del jugador en celdas
			const px = this.player.x / this.tileSize;
			const py = this.player.y / this.tileSize;

			// 2) Filtrar por radio R...
			const R = 8;
			const candidates = this.walkableZones.filter((zone) => {
				const dx = zone.x + 0.5 - px;
				const dy = zone.y + 0.5 - py;
				return dx * dx + dy * dy <= R * R;
			});
			const pool = candidates.length ? candidates : this.walkableZones;

			// 3) Elegir zona
			const zone = pool[Math.floor(Math.random() * pool.length)];
			const worldX = zone.x * this.tileSize + this.tileSize / 2;
			const worldY = zone.y * this.tileSize + this.tileSize / 2;

			// 4) Aparecer con glitch
			const glitch = new GlitchFilter({ slices: 5, offset: 20, direction: 180, fillMode: 1 });
			this.ghost.filters = [glitch];
			this.ghost.position.set(worldX, worldY);

			const jitterTarget = { dummy: 0 };
			const jitterTween = new Tween<typeof jitterTarget>(jitterTarget)
				.to({ dummy: 1 }, 100)
				.repeat(Infinity)
				.onUpdate(() => {
					glitch.seed = Math.random();
					glitch.offset = 2 + Math.random() * 10;
					glitch.slices = Math.random() < 0.1 ? 10 : 5;
					jitterTarget.dummy = 0;
				})
				.start();

			// 5) Fade‑in y luego dash condicional
			new Tween<{ a: number }>({ a: this.ghost.alpha })
				.to({ a: 0.6 }, 500)
				.easing(Easing.Quadratic.Out)
				.onUpdate((p) => {
					this.ghost.alpha = p.a;
				})
				.onComplete(() => {
					// Coordenadas de celda del jugador
					const cellX = Math.floor(px);
					const cellY = Math.floor(py);

					// Solo dashea si la celda del jugador es caminable (grid == 0)
					if (this.grid[cellX] && this.grid[cellX][cellY] === 0) {
						// 1) Orientar el sprite según posición relativa
						const dir = this.player.x > this.ghost.x ? -1 : 1;
						this.ghost.scale.x = Math.abs(this.ghost.scale.x) * dir;

						// 2) Tween hacia el jugador
						new Tween(this.ghost.position)
							.to(
								{
									x: this.player.x + this.tileSize / 2,
									y: this.player.y + this.tileSize / 2,
								},
								200
							)
							.onStart(() => {
								this.ghost.texture = Texture.from("ghost_redeyes");
							})

							.easing(Easing.Linear.None)
							.start();
					}

					// Full‑screen glitch / fade‑out como antes...
					const fxContainer = new Graphics();
					const full = new Graphics().beginFill(0xffffff, 0).drawRect(0, 0, this.viewWidth, this.viewHeight).endFill();
					fxContainer.addChild(full);
					const dashGlitch = new GlitchFilter({ slices: 5, offset: 30, direction: 0, fillMode: 1 });
					fxContainer.filters = [dashGlitch];
					this.addChild(fxContainer);

					new Tween<{ t: number }>({ t: 0 })
						.to({ t: 1 }, 1000)
						.onUpdate(({ t }) => {
							dashGlitch.offset = 30 * (1 - t);
							dashGlitch.seed = Math.random() * 1000;
							dashGlitch.slices = Math.floor(5 + 5 * t);
							full.alpha = t * 0.3;
						})
						.onComplete(() => {
							fxContainer.filters = [];
							this.removeChild(fxContainer);
							this.ghost.texture = Texture.from("ghost_whiteeyes");
						})
						.start();

					// Fade‑out de la fantasma y restart
					setTimeout(() => {
						new Tween<{ a: number }>({ a: 1 })
							.to({ a: 0 }, 500)
							.easing(Easing.Quadratic.In)
							.onUpdate((p) => {
								this.ghost.alpha = p.a;
							})
							.onComplete(() => {
								jitterTween.stop();
								this.ghost.filters = [];
								this.spawnGhostLoop();
							})
							.start();
					}, 500);
				})
				.start();
		}, delay);
	}

	private checkUsedItem(): void {
		if (Keyboard.shared.justReleased("KeyU")) {
			const state = this.state;
			if (state.activeItem) {
				console.log("Usaste el ítem:", state.activeItem);
				if (state.activeItem === "holywater") {
					SoundLib.playSound("reload", { volume: 0.2 });
					this.state.fullHealth();
				}
			}
		}
	}

	public override update(dt: number): void {
		if (this.state.healthPoints <= 0 && !this.gameOverTriggered) {
			this.gameOverTriggered = true;

			// -- Limpiar cualquier timeout de spawnGhostLoop pendiente:
			if (this.ghostTimeout !== null) {
				clearTimeout(this.ghostTimeout);
				this.ghostTimeout = null;
			}
			// Si la salud es 0, cambio a la escena de Game Over
			Manager.changeScene(LoseGameOverScene, { transitionClass: FadeColorTransition });
			return;
		}
		this.followPath(dt);
		this.updateCamera(dt);

		// Actualizo el texto con row,col
		if (this.player) {
			const col = Math.floor(this.player.x / this.tileSize);
			const row = Math.floor(this.player.y / this.tileSize);
			if (this.debugText) {
				this.debugText.text = `${col}, ${row}`;
			}
		}

		if (this.player && this.ghost.alpha > 0 && this.phase === DialoguePhase.DONE) {
			const playerBounds = this.player.getBounds();
			const ghostBounds = this.ghost.getBounds();
			if (playerBounds.intersects(ghostBounds)) {
				this.triggerRedFlash();
				console.log("triggerRedFlash");
			}
		}

		const pb = this.player.getBounds();
		const tb = this.trigger.triggerZone.getBounds();
		const inTrig = pb.x + pb.width > tb.x && pb.x < tb.x + tb.width && pb.y + pb.height > tb.y && pb.y < tb.y + tb.height;
		this.trigger.triggerText.visible = inTrig;
		if (inTrig && Keyboard.shared.justReleased("KeyE") && !this.gameOverTriggered) {
			this.gameOverTriggered = true;

			// -- Limpiar cualquier timeout de spawnGhostLoop pendiente:
			if (this.ghostTimeout !== null) {
				clearTimeout(this.ghostTimeout);
				this.ghostTimeout = null;
			}

			Manager.changeScene(WinGameOverScene, { transitionClass: FadeColorTransition });
		}

		if (Keyboard.shared.justReleased("Enter")) {
			switch (this.phase) {
				case DialoguePhase.PLAYER_INTRO:
					// paso al grito de la Llorona
					this.overlay.visible = false;
					this.phase = DialoguePhase.LLORONA_SCREAM;
					SoundLib.playSound("possessed-laugh", {
						volume: 0.4,
						filters: [new filters.ReverbFilter(2, 1), new filters.StereoFilter(-1), new filters.DistortionFilter(1)],
					});
					this.lloronaOverlay = new OverlayScene("llorona");
					this.uiContainer.addChild(this.lloronaOverlay);
					this.lloronaOverlay.typeText("Aaaaahhhhahaha! mis hijos!", "Aaaaahhhhahaha", "red", 20);
					break;

				case DialoguePhase.LLORONA_SCREAM:
					this.lloronaOverlay.visible = false;
					this.phase = DialoguePhase.PLAYER_HURRY;

					this.lloronaOverlay.visible = false;
					this.lloronaOverlay.destroy();
					this.lloronaOverlay = null;
					this.uiContainer.removeChild(this.lloronaOverlay);
					this.overlay.visible = true;
					this.overlay.typeText(
						"Ok... Creeeeo que tendría que apurarme con lo del ritual! Voy a tener que usar esos espacios muertos para esconderme!",
						"ritual de perdón",
						"red",
						20
					);
					new Timer()
						.to(4000)
						.onComplete(() => {
							this.overlay.typeText(
								"O sea... es un fantasma... No se si servirá de algo pero no me queda otra. Si llega antes que yo al altar, estoy frito.",
								"ritual de perdón",
								"red",
								20
							);
						})
						.start();
					break;

				case DialoguePhase.PLAYER_HURRY:
					// ya se acabaron los diálogos
					this.overlay.visible = false;
					this.phase = DialoguePhase.DONE;
					this.enableTilesInteraction();
					this.setZoom(5);
					break;

				case DialoguePhase.DONE:
					break;

				default:
					break;
			}
		}

		// Zoom in con tecla '=' (sin Shift), Zoom out con '-'
		if (Keyboard.shared.justPressed("NumpadAdd")) {
			this.setZoom(this.zoom + 0.4);
		}
		if (Keyboard.shared.justPressed("NumpadSubtract")) {
			this.setZoom(this.zoom - 1);
		}
		this.checkUsedItem();
	}

	private createGrid(): number[][] {
		const rows = 51,
			cols = 34;
		const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

		// Marco exterior de 2 tiles
		this.drawV(grid, 0, cols, 0, 2);
		this.drawV(grid, 0, cols, rows - 2, 2);
		this.drawH(grid, 0, 0, rows, 2);
		this.drawH(grid, cols - 1, 0, rows, 1);

		// Pasillos interiores
		this.drawH(grid, 12, 1, 9, 2);
		this.drawH(grid, 12, 12, 24, 2);
		this.drawV(grid, 12, 19, 15, 3);

		this.drawV(grid, 14, 19, 15, 1);

		// desde el renglon/fila 17, hasta la 25, partiendo de la columna 4 con un ancho de 4
		this.drawV(grid, 17, 25, 4, 4);
		this.drawV(grid, 14, 19, 21, 3);
		this.drawV(grid, 22, 30, 10, 3);

		this.drawH(grid, 17, 8, 17, 2);
		// en el renglon/fila 28 desde la columna 2 a la 12, con un ancho de 2
		this.drawH(grid, 28, 2, 12, 2);
		this.drawH(grid, 22, 13, 24, 3);
		this.drawH(grid, 16, 24, 31, 3);

		this.drawV(grid, 2, 16, 27, 4);

		this.drawH(grid, 12, 33, 50, 3);
		this.drawH(grid, 17, 33, 46, 3);
		this.drawH(grid, 22, 27, 36, 3);
		this.drawH(grid, 27, 21, 30, 3);
		this.drawH(grid, 25, 21, 24, 2);
		this.drawH(grid, 25, 27, 30, 2);
		this.drawH(grid, 20, 33, 36, 2);
		this.drawH(grid, 2, 2, 27, 10);
		this.drawH(grid, 2, 31, 49, 10);

		// --- Zonas where ghost CAN'T go (grid = 2) ---
		// Por ejemplo, un pasillo interior naranja:
		this.drawZoneH(grid, 14, 18, 21, 5);
		this.drawZoneH(grid, 22, 24, 27, 5);

		return grid;
	}

	private drawH(grid: number[][], x: number, y0: number, y1: number, thickness = 1): void {
		for (let tx = 0; tx < thickness; tx++) {
			for (let y = y0; y < y1; y++) {
				grid[y][x + tx] = 1;
			}
		}
	}

	private drawV(grid: number[][], x0: number, x1: number, y: number, thickness = 1): void {
		for (let ty = 0; ty < thickness; ty++) {
			for (let x = x0; x < x1; x++) {
				grid[y + ty][x] = 1;
			}
		}
	}

	// Agregar debajo de drawV:
	public drawZoneH(grid: number[][], x: number, y0: number, y1: number, thickness = 1): void {
		// igual que drawH, pero grid[y][x] = 2
		for (let tx = 0; tx < thickness; tx++) {
			for (let y = y0; y < y1; y++) {
				grid[y][x + tx] = 2;
			}
		}
	}
	public drawZoneV(grid: number[][], x0: number, x1: number, y: number, thickness = 1): void {
		// igual que drawV, pero grid[y][x] = 2
		for (let ty = 0; ty < thickness; ty++) {
			for (let x = x0; x < x1; x++) {
				grid[y + ty][x] = 2;
			}
		}
	}

	private createBackground(): void {
		for (let i = 0; i < this.grid.length; i++) {
			for (let j = 0; j < this.grid[i].length; j++) {
				const tile = new Graphics();
				let alpha = 0.01;
				let color = 0x0000ff;

				if (this.grid[i][j] === 1) {
					color = 0xff0000;
					alpha = 0.01; // 1
				} else if (this.grid[i][j] === 2) {
					color = 0x44ffff;
					alpha = 0.01; // 0.5
				}

				tile.beginFill(color, alpha)
					.drawRect(i * this.tileSize, j * this.tileSize, this.tileSize, this.tileSize)
					.endFill();

				// no eventMode ni on() – todavía
				this.worldContainer.addChild(tile);

				// Guarda también i,j
				this.tiles.push({ tile, i, j });
			}
		}
	}

	private enableTilesInteraction(): void {
		if (this.tilesInteractive) {
			return;
		}
		this.tilesInteractive = true;
		for (const { tile, i, j } of this.tiles) {
			tile.eventMode = "static"; // o simplemente tile.interactive = true
			tile.on("pointerdown", () => this.onTileClick(i, j));
		}
	}

	// --- FUNCION QUE DISPARA EL OVERLAY ROJO ---
	private triggerRedFlash(): void {
		if (this.redActive) {
			return;
		}
		this.redActive = true;
		this.ui.updateHP();
		SoundLib.playSound("sound_hit", { volume: 0.3 });
		// Redibujo el rectángulo con el tamaño actual de la vista
		this.redOverlay.clear();
		this.redOverlay
			.beginFill(0xff0000, 1)
			.drawRect(-this.viewWidth, -this.viewWidth / 2, this.viewWidth * 2, this.viewHeight * 2)
			.endFill();
		this.redOverlay.alpha = 0;
		this.redOverlay.visible = true;

		new Tween<{ a: number }>({ a: 0 })
			.to({ a: 0.6 }, 50)
			.onUpdate((p) => {
				this.redOverlay.alpha = p.a;
			})
			.onComplete(() => {
				new Tween<{ a: number }>({ a: 0.6 })
					.to({ a: 0 }, 400)
					.onUpdate((p) => {
						this.redOverlay.alpha = p.a;
					})
					.onComplete(() => {
						this.redOverlay.visible = false;
						this.redActive = false;
					})
					.start();
			})
			.start();
	}

	private createPlayer(): void {
		this.player = new Graphics().beginFill(0x00ff00, 0.001).drawRect(0, 0, this.tileSize, this.tileSize).endFill();

		this.player.x = 10 * this.tileSize; // Posición inicial
		this.player.y = 11 * this.tileSize; // Posición inicial

		const applyBreathingTween = (creature: Sprite): void => {
			const baseScaleY = creature.scale.y;
			const targetScaleY = baseScaleY * 1.015;
			const duration = 1500 + (Math.random() * 100 - 50);

			new Tween(creature.scale).to({ y: targetScaleY }, duration).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start();
		};

		this.playerSprite = Sprite.from("AH_topdown_player");
		this.playerSprite.anchor.set(0.5, 0.82);
		this.playerSprite.scale.set(0.05);
		this.playerSprite.position.x = this.tileSize / 2;
		this.initOutline();
		applyBreathingTween(this.playerSprite);

		this.worldContainer.addChild(this.player);
		this.player.addChild(this.playerSprite);
	}

	private followPath(dt: number): void {
		if (!this.player) {
			return;
		}

		// iniciamos un nuevo paso si no hay uno en curso
		if (!this.stepEnd && this.pathQueue.length) {
			this.stepStart = new Point(this.player.x, this.player.y);
			this.stepEnd = this.pathQueue.shift()!;

			// 1) detecta dirección horizontal
			const dx = this.stepEnd.x - this.stepStart.x;
			if (dx < 0) {
				// va hacia la izquierda
				this.playerSprite.scale.x = -Math.abs(this.playerSprite.scale.x);
			} else if (dx > 0) {
				// va hacia la derecha
				this.playerSprite.scale.x = Math.abs(this.playerSprite.scale.x);
			}
			// (si dx === 0, no cambiamos)

			// 2) calcula duración normal
			const dy = this.stepEnd.y - this.stepStart.y;
			const dist = Math.hypot(dx, dy);
			this.stepDuration = dist / this.speed;
			this.stepElapsed = 0;
		}

		if (this.stepEnd && this.stepStart) {
			this.stepElapsed += dt / 1600;
			const t = Math.min(this.stepElapsed / this.stepDuration, 1);
			this.player.x = this.stepStart.x + (this.stepEnd.x - this.stepStart.x) * t;
			this.player.y = this.stepStart.y + (this.stepEnd.y - this.stepStart.y) * t;

			if (t >= 1) {
				// … dentro de if (t >= 1) …
				if (this.pathDebug) {
					const wX = this.stepEnd.x,
						wY = this.stepEnd.y;
					for (const child of [...this.pathDebug.children] as Graphics[]) {
						if ((child as any).worldX === wX && (child as any).worldY === wY) {
							// Tween de alpha a 0 y luego remuevo
							new Tween<Graphics>(child)
								.to({ alpha: 0 }, 300)
								.easing(Easing.Quadratic.Out)
								.onComplete(() => {
									this.pathDebug?.removeChild(child);
								})
								.start();
							break;
						}
					}
				}

				this.stepStart = null;
				this.stepEnd = null;

				// Si llegamos al final, ocultar y detener el pulso
				if (this.pathQueue.length === 0) {
					this.targetTileOutline.visible = false;
					if (this.outlineTween) {
						this.outlineTween.stop();
						this.outlineTween = undefined;
					}
				}
			}
		}
	}

	private updateCamera(_dt: number): void {
		if (!this.player) {
			return;
		}

		// Deseamos que el jugador aparezca en el centro de la pantalla
		const offsetX = this.viewWidth / 2;
		const offsetY = this.viewHeight / 2;

		// Escala actual del contenedor (aplicada por ScaleHelper)
		const scaleX = this.worldContainer.worldTransform.a;
		const scaleY = this.worldContainer.worldTransform.d;

		// Centro del jugador en mundo
		const playerCenterX = this.player.x + this.tileSize / 2;
		const playerCenterY = this.player.y + this.tileSize / 2;

		// Cálculo de destino compensando escala
		const targetX = offsetX - playerCenterX * scaleX;
		const targetY = offsetY - playerCenterY * scaleY;

		// Lerp exponencial
		const smoothingRate = 1;
		const lerp = 1 - Math.exp(-smoothingRate * _dt);

		// Aplico suavizado entre la posición actual y la deseada
		this.worldContainer.x += (targetX - this.worldContainer.x) * lerp;
		this.worldContainer.y += (targetY - this.worldContainer.y) * lerp;
	}

	private onTileClick(x: number, y: number): void {
		if (!this.player) {
			return;
		}

		const px = Math.floor(this.player.x / this.tileSize);
		const py = Math.floor(this.player.y / this.tileSize);
		const path = this.aStar(new Node(px, py), new Node(x, y));
		if (path) {
			// convertir a posiciones absolutas
			this.pathQueue = path.map((n) => new Point(n.x * this.tileSize, n.y * this.tileSize));
			this.stepStart = this.stepEnd = null; // reiniciar paso actual
			this.updateOutline(x, y);
		}

		// -- DEBUG: borro pathDebug si existía --
		if (this.pathDebug) {
			this.worldContainer.removeChild(this.pathDebug);
		}

		// -- DEBUG: Dibujo el camino --
		const pathDebug = new Container();
		pathDebug.name = "pathDebug";
		this.pathQueue.forEach((pt, _i) => {
			const dot = new Graphics()
				.beginFill(0xff0000)
				.drawCircle(pt.x + this.tileSize / 2, pt.y + this.tileSize / 2, 3)
				.endFill();
			// Le asigno las coords de mundo para luego comparar:
			(dot as any).worldX = pt.x;
			(dot as any).worldY = pt.y;
			dot.alpha = 0.35;
			pathDebug.addChild(dot);
		});
		this.worldContainer.addChild(pathDebug);
		this.pathDebug = pathDebug; // <<<

		this.updateOutline(x, y);
	}

	private aStar(start: Node, goal: Node): Node[] | null {
		const open: Node[] = [start],
			closed: Node[] = [];
		while (open.length) {
			const curr = open.reduce((a, b) => (a.f < b.f ? a : b));
			if (curr.x === goal.x && curr.y === goal.y) {
				const path: Node[] = [];
				for (let c: Node | null = curr; c; c = c.parent) {
					path.push(c);
				}
				return path.reverse();
			}
			open.splice(open.indexOf(curr), 1);
			closed.push(curr);
			for (const nb of this.getNeighbors(curr)) {
				if (closed.some((c) => c.x === nb.x && c.y === nb.y)) {
					continue;
				}
				const tg = curr.g + 1;
				const existing = open.find((c) => c.x === nb.x && c.y === nb.y);
				if (!existing) {
					nb.g = tg;
					nb.h = this.manhattanDistance(nb, goal);
					nb.f = nb.g + nb.h;
					nb.parent = curr;
					open.push(nb);
				} else if (tg < existing.g) {
					existing.g = tg;
					existing.f = tg + existing.h;
					existing.parent = curr;
				}
			}
		}
		return null;
	}

	private getNeighbors(node: Node): Node[] {
		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		];
		const res: Node[] = [];
		for (const [dx, dy] of dirs) {
			const nx = node.x + dx,
				ny = node.y + dy;
			if (
				nx >= 0 &&
				nx < this.grid.length &&
				ny >= 0 &&
				ny < this.grid[0].length &&
				this.grid[nx][ny] !== 1 // 0 o 2 permitido
			) {
				res.push(new Node(nx, ny));
			}
		}
		return res;
	}

	private manhattanDistance(a: Node, b: Node): number {
		return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
	}

	private initOutline(): void {
		// Crea el sprite en lugar de un Graphics
		this.targetTileOutline = Sprite.from("move_sign");
		// Centra el anchor en medio del sprite
		this.targetTileOutline.anchor.set(0.5, 0.5);
		// Ajusta el tamaño para cubrir 1.4 x 1 tiles
		this.targetTileOutline.width = this.tileSize * 1.4;
		this.targetTileOutline.height = this.tileSize;
		this.targetTileOutline.visible = false;
		this.worldContainer.addChild(this.targetTileOutline);
	}

	private updateOutline(x: number, y: number): void {
		// Detener tween anterior si existe
		if (this.outlineTween) {
			this.outlineTween.stop();
			this.outlineTween = undefined;
		}

		// Coloca el sprite centrado sobre la celda destino
		const worldX = x * this.tileSize + this.tileSize / 2;
		const worldY = y * this.tileSize + this.tileSize / 2;
		this.targetTileOutline.position.set(worldX, worldY);
		this.targetTileOutline.visible = true;
	}

	/**
	 * Suaviza el zoom usando un tween en worldContainer.scale.
	 * @param factor Nuevo factor de zoom objetivo.
	 */
	public setZoom(factor: number): void {
		// Clampeamos dentro de un rango razonable
		const newZoom = Math.max(0.2, Math.min(6, factor));
		const oldZoom = this.zoom;
		this.zoom = newZoom;

		// Creamos un objeto proxy para tween
		const proxy = { z: oldZoom };

		new Tween(proxy)
			.to({ z: newZoom }, 500) // duración 500ms
			.easing(Easing.Quadratic.Out) // easing opcional
			.onUpdate(() => {
				this.worldContainer.scale.set(proxy.z, proxy.z);
			})
			.start();
	}

	public override onResize(w: number, h: number): void {
		// Guardamos el tamaño real de la vista
		this.viewWidth = w;
		this.viewHeight = h;

		// 1) Escalamos el contenedor
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 1536, 1024, ScaleHelper.FIT);

		// 2) Calculamos el tamaño en pixeles de nuestro mundo
		// const worldPixelWidth = this.grid[0].length * this.tileSize;
		// const worldPixelHeight = this.grid.length * this.tileSize;

		// 3) Centramos el pivot en el medio del mundo
		// this.worldContainer.pivot.set(worldPixelWidth / 2, worldPixelHeight / 2);

		// 4) Posicionamos el contenedor en el centro de la pantalla
		this.worldContainer.x = w / 2;
		this.worldContainer.y = h / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, w, h, 1536, 1024, ScaleHelper.FIT);

		this.uiContainer.x = w / 2;
		this.uiContainer.y = h / 2;

		// 4) Aplica tu zoom (escala extra)
		this.worldContainer.scale.set(this.zoom, this.zoom);

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiRightContainer.x = w;
		this.uiRightContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiCenterContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiCenterContainer.x = w * 0.5;
		this.uiCenterContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.pauseContainer, w, h, 1536, 1200, ScaleHelper.FIT);
		this.pauseContainer.x = w / 2;
		this.pauseContainer.y = h / 2;
	}
}
