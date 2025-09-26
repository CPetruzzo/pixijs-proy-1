/* eslint-disable prettier/prettier */
import { AnimatedSprite, Text, TextStyle, Texture } from "pixi.js";
import { Container, Graphics, Point, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { GlowFilter } from "@pixi/filter-glow";
import Random from "../../../engine/random/Random";

class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}
// Ahora:
interface Animal {
	sprite: Sprite;
	originalTexture: Texture;
	originalX: number;
	originalY: number;
	name: string;
	skill: string; // e.g. "fly", "stealth", "climb"
}

export class MyFriendGameScene extends PixiScene {
	private grid: number[][] = [];
	private tileSize = 16;
	private player: Graphics | null = null;
	private worldContainer = new Container();
	private targetTileOutline!: AnimatedSprite;
	public static readonly BUNDLES = ["myfriend", "abandonedhouse"];

	// Movimiento suave por paso
	private pathQueue: Point[] = [];
	private stepStart: Point | null = null;
	private stepEnd: Point | null = null;
	private stepElapsed = 0;
	private stepDuration = 0;
	private speed = 100; // px/segundo
	// … otras propiedades …
	private zoom = 6;

	private viewWidth = 0;
	private viewHeight = 0;
	private uiContainer = new Container();
	private uiRightContainer = new Container();
	private uiCenterContainer = new Container();
	private uiLeftContainer = new Container();
	private pauseContainer = new Container();

	private pathDebug: Container | null = null; // <<<
	private debugText!: Text; // <<<
	private outlineTween?: Tween<{ x: number; y: number }>;

	private walkableZones: Point[] = [];
	private tilesInteractive = false;

	private tiles: Array<{ tile: Graphics; i: number; j: number }> = [];
	private playerSprite!: Sprite;

	// --- NUEVO: overlay rojo para el “flash” al chocar ---
	private minimapGfx!: Graphics;
	private minimapScale = 0.3;
	private minimapOffset = { x: 55, y: 55 }; // padding dentro del frame

	private minimapMaskSize = 160; // ¡ajústalo a mano hasta que encaje en tu recuadro!
	private cubaSprite!: Sprite;
	private cubaFollowSpeed = 0.05; // entre 0 (muy lento) y 1 (instantáneo)
	private cubaFollowDistance = 32; // distancia en píxeles que siempre mantendrá

	private particleContainer!: Container;
	private particlePool: Graphics[] = [];
	private particleTimer = 0;
	private glow: GlowFilter;
	private glowSpark: GlowFilter;

	private animals: Animal[] = [];
	private interactButton!: Text;

	// añade después de `private interactButton!: Text;`
	private currentPossession: { animal: Animal; timer: number } | null = null;
	private possessionDuration = 15000; // ms
	private timerBarBg!: Graphics;
	private timerBarFg!: Graphics;

	private controlButton!: Text;
	private controlledAnimal: Animal | null = null;
	private exitControlButton: Text;

	constructor() {
		super();
		this.grid = this.createGrid();
		this.addChild(this.worldContainer, this.uiContainer);
		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiCenterContainer);
		this.addChild(this.uiRightContainer);
		this.addChild(this.pauseContainer);

		this.createBackground();

		SoundLib.stopAllMusic();
		SoundLib.playMusic("bgm", { volume: 0.08, loop: true });

		const spr = Sprite.from("forest");
		spr.scale.set(0.532);

		this.worldContainer.addChild(spr);

		// crear la mascota “cuba” y añadirla al mundo
		this.cubaSprite = Sprite.from("cuba");
		this.cubaSprite.anchor.set(0.5, 1); // centra base en el jugador
		this.cubaSprite.scale.set(0.1); // ajústalo a tu gusto
		this.worldContainer.addChild(this.cubaSprite);

		this.glow = new GlowFilter({
			distance: 15, // radio del glow
			outerStrength: 0.5, // fuerza inicial
			color: 0xffffff, // color del resplandor
		});

		this.glowSpark = new GlowFilter({
			distance: 25, // radio del glow
			outerStrength: 1, // fuerza inicial
			color: 0xffffff, // color del resplandor
		});
		this.createAnimals();

		this.cubaSprite.filters = [this.glow];
		new Tween(this.glow)
			.to({ outerStrength: 0.8, distance: 25 }, 1000) // sube a 3 en 1s
			.yoyo(true) // vuelve a 0.5
			.repeat(Infinity) // repite siempre
			.easing(Easing.Quadratic.InOut)
			.start();

		new Tween(this.glowSpark)
			.to({ outerStrength: 3, distance: 35 }, 1000) // sube a 3 en 1s
			.yoyo(true) // vuelve a 0.5
			.repeat(Infinity) // repite siempre
			.easing(Easing.Quadratic.InOut)
			.start();
		this.createPlayer();

		// Creamos el Text de debug (sin variables extras)
		this.debugText = new Text("0,0", new TextStyle({ fill: "#ffffff", fontSize: 14 }));
		this.debugText.position.set(10, 10);
		// this.uiContainer.addChild(this.debugText);

		// Vi que el camino tiene zonas de visión reducida, seguro me sirven para esconderme... aunque... es un fantasma, esperemos que funcione.
		// 1) Recolectar zonas caminables
		for (let i = 0; i < this.grid.length; i++) {
			for (let j = 0; j < this.grid[0].length; j++) {
				if (this.grid[i][j] === 0) {
					this.walkableZones.push(new Point(i, j));
				}
			}
		}

		this.enableTilesInteraction();
		this.uiContainer.sortableChildren = true;

		// En constructor o método init:
		this.createInteractButton();

		// Crear botón para cambiar al animal
		this.controlButton = new Text("Controlar", new TextStyle({
			fill: "#00ff00", fontSize: 16, fontWeight: "bold"
		}));
		this.controlButton.anchor.set(0.5, 1);
		this.controlButton.visible = false;
		this.controlButton.interactive = true;
		this.controlButton.eventMode = "static";
		this.controlButton.on("pointerdown", () => this.onControlAnimal());
		this.uiContainer.addChild(this.controlButton);

		// Botón para salir del control
		this.exitControlButton = new Text("Regresar", new TextStyle({
			fill: "#ff0000", fontSize: 16, fontWeight: "bold"
		}));
		this.exitControlButton.anchor.set(0.5, 1);
		this.exitControlButton.visible = false;
		this.exitControlButton.interactive = true;
		this.exitControlButton.on("pointerdown", () => this.exitControl());
		this.uiContainer.addChild(this.exitControlButton);


		// Barra de 200×16 en la parte superior
		this.timerBarBg = new Graphics().beginFill(0x000000, 0.5).drawRect(-100, 0, 200, 16).endFill();
		this.timerBarFg = new Graphics().beginFill(0xffaa00, 1).drawRect(-100, 0, 200, 16).endFill();
		[this.timerBarBg, this.timerBarFg].forEach((g) => {
			g.position.set(this.viewWidth / 2, 20);
			g.visible = false;
			this.uiContainer.addChild(g);
		});

		// 2) Creamos máscara y minimapa como hijos directos de uiContainer
		this.minimapGfx = new Graphics();
		this.minimapGfx.x = this.minimapOffset.x;
		this.minimapGfx.y = this.minimapOffset.y;

		// máscara cuadrada para recorte
		const mask = new Graphics().beginFill(0xffffff).drawRect(0, 0, this.minimapMaskSize, this.minimapMaskSize).endFill();
		mask.x = this.minimapGfx.x;
		mask.y = this.minimapGfx.y;

		// asigno la máscara
		this.minimapGfx.mask = mask;

		// 3) Los añado al uiContainer en orden: primero mask y minimap, luego el frame
		mask.zIndex = 0;
		this.minimapGfx.zIndex = 1;
		this.uiContainer.addChild(mask, this.minimapGfx);
		this.uiContainer.alpha = 0.7;

		// 4) Ahora creo y añado el frame *por encima*
		const mapFrame = Sprite.from("mapframe-myfriend");
		mapFrame.scale.set(0.8);
		// si usas zIndex:
		mapFrame.zIndex = 2;
		// posiciónalo igual que antes (ejemplo en 10,10)
		mapFrame.x = this.minimapOffset.x - 15;
		mapFrame.y = this.minimapOffset.y - 15;
		this.uiContainer.addChild(mapFrame);

		const forestFront = Sprite.from("forestFront");
		forestFront.scale.set(0.532);
		forestFront.alpha = 0.7;
		this.worldContainer.addChild(forestFront);

		// contenedor sobre Cuba
		this.particleContainer = new Container();
		this.worldContainer.addChild(this.particleContainer);
	}

	private createInteractButton(): void {
		this.interactButton = new Text(
			"¡Poseer!",
			new TextStyle({
				fill: "#ffff00",
				fontSize: 18,
				fontWeight: "bold",
			})
		);
		this.interactButton.anchor.set(0.5, 1);
		this.interactButton.visible = true;
		this.interactButton.eventMode = "static";
		this.interactButton.interactive = true;
		this.interactButton.on("pointerdown", () => this.onPossess());
		this.uiContainer.addChild(this.interactButton);
	}

	private createAnimals(): void {
		const animalsData: Array<{
			x: number;
			y: number;
			texture: string;
			name: string;
			skill: string;
		}> = [
				// eslint-disable-next-line prettier/prettier
				{ x: 5, y: 8, texture: "pidgeon", name: "Pidgeon", skill: "fly" },
				{ x: 12, y: 15, texture: "blackcat", name: "Black Cat", skill: "stealth" },
			];

		for (const data of animalsData) {
			const ani = Sprite.from(data.texture);
			ani.anchor.set(0.5, 1);
			ani.scale.set(0.07);
			ani.x = data.x * this.tileSize + this.tileSize / 2;
			ani.y = data.y * this.tileSize + this.tileSize;
			this.worldContainer.addChild(ani);
			this.animals.push({
				sprite: ani,
				originalTexture: ani.texture,
				originalX: ani.x,
				originalY: ani.y,
				name: data.name,
				skill: data.skill,
			});
		}
	}

	private spawnParticle(): void {
		// reutiliza o crea
		let p = this.particlePool.find((g) => !g.visible);
		if (!p) {
			p = new Graphics();
			const randomInt = Random.shared.randomInt(1, 3);
			const randomSize = 0.3 * randomInt;
			p.beginFill(0xffffaa, 1).drawCircle(0, 0, randomSize).endFill();
			this.particlePool.push(p);
			this.particleContainer.addChild(p);
		}
		// posición inicial aleatoria junto a Cuba
		const offsetX = (Math.random() - 1.5) * 10;
		p.x = this.cubaSprite.x + offsetX;
		p.y = this.cubaSprite.y - 16;

		p.alpha = 1;
		p.visible = true;

		p.filters = [this.glowSpark];

		// animación: sube y se desvanece
		const riseDuration = 2000 + Math.random() * 4000;
		new Tween(p)
			.to({ y: p.y - 20, alpha: 0 }, riseDuration)
			.easing(Easing.Quadratic.Out)
			.onComplete(() => {
				p.visible = false;
				// parar el drift lateral al desaparecer
				driftTween.stop();
			})
			.start();

		// drift lateral infinito (burbujas flotando)
		const rightOrLeft = Random.shared.pickOne([-1, 1]);
		const rightOrLeft2 = Random.shared.pickOne([-1, 1]);

		const driftAmount = rightOrLeft * 5 + rightOrLeft2 * Math.random() * 3; // amplitud aleatoria
		const driftTween = new Tween(p)
			.to({ x: p.x + driftAmount }, riseDuration / 2)
			.yoyo(true)
			.repeat(Infinity)
			.easing(Easing.Sinusoidal.InOut)
			.start();
	}

	public override update(dt: number): void {
		// detecto Escape para salir del control
		if (this.controlledAnimal && Keyboard.shared.justPressed("Escape")) {
			this.exitControl();
		}
		// 2) movimiento: O CONTROL o PATHFOLLOW, nunca ambos
		if (this.controlledAnimal) {
			// estoy controlando al animal
			this.handleAnimalMovement(dt, this.controlledAnimal);
		} else if (this.currentPossession) {
			// estoy poseyendo, pero no he entrado a “control”
			// aquí puedes querer bloquear input para que sólo se agote el timer
		} else {
			// soy fantasma libre, sigo el path
			this.followPath(dt);
		}
		this.updateCamera(dt);

		// Actualizo el texto con row,col
		if (this.player) {
			const col = Math.floor(this.player.x / this.tileSize);
			const row = Math.floor(this.player.y / this.tileSize);
			if (this.debugText) {
				this.debugText.text = `${col}, ${row}`;
			}
		}

		// … dentro de update(dt) …
		if (this.player) {
			const px = this.player.x + this.tileSize / 2;
			const py = this.player.y + this.tileSize / 2;

			// vector actual
			const dx = this.cubaSprite.x - px;
			const dy = this.cubaSprite.y - py;
			const dist = Math.hypot(dx, dy) || 1;
			const ux = dx / dist,
				uy = dy / dist;

			const targetX = px + ux * this.cubaFollowDistance;
			const targetY = py + uy * this.cubaFollowDistance;

			// interpola posición
			this.cubaSprite.x += (targetX - this.cubaSprite.x) * this.cubaFollowSpeed;
			this.cubaSprite.y += (targetY - this.cubaSprite.y) * this.cubaFollowSpeed;

			// ---- aquí giramos según velocidad en X ----
			const velaX = targetX - this.cubaSprite.x;
			if (velaX < 0) {
				this.cubaSprite.scale.x = -Math.abs(this.cubaSprite.scale.x);
			} else if (velaX > 0) {
				this.cubaSprite.scale.x = Math.abs(this.cubaSprite.scale.x);
			}
		}

		// generar ~1 partícula cada 0.2s
		this.particleTimer += dt;
		if (this.particleTimer > 500) {
			this.particleTimer -= 500;
			this.spawnParticle();
		}

		// repintar minimapa con jugador siempre en el centro
		this.minimapGfx.clear();
		const ts = this.tileSize * this.minimapScale * 2;
		const playerTileX = (this.player?.x ?? 0) / this.tileSize;
		const playerTileY = (this.player?.y ?? 0) / this.tileSize;
		const center = this.minimapMaskSize / 2;

		for (let i = 0; i < this.grid.length; i++) {
			for (let j = 0; j < this.grid[0].length; j++) {
				const v = this.grid[i][j];
				let color = 0x444444;
				if (v === 1) {
					color = 0xff0000;
				} else if (v === 2) {
					color = 0x44ffff;
				}

				const dx = center + (i - playerTileX) * ts;
				const dy = center + (j - playerTileY) * ts;

				this.minimapGfx.beginFill(color).drawRect(dx, dy, ts, ts).endFill();
			}
		}

		// cada frame, comprobamos proximidad
		let nearAnimal: { sprite: Sprite; originalTexture: Texture } | null = null;
		for (const a of this.animals) {
			const dx = a.sprite.x - this.player.x;
			const dy = a.sprite.y - this.player.y;
			const dist = Math.hypot(dx, dy);
			if (dist < this.tileSize * 1.5) {
				nearAnimal = a;
				break;
			}
		}

		// si hay posesión activa, actualizo timer y barra
		if (this.currentPossession) {
			const p = this.currentPossession;
			p.timer += dt;
			// ancho proporcional:
			const frac = 1 - Math.min(p.timer / this.possessionDuration, 1);
			this.timerBarFg.width = 200 * frac;
			// fin de posesión al agotarse:
			if (p.timer >= this.possessionDuration) {
				this.endPossession();
			}
		}


		// mostrar/ocultar botón
		this.interactButton.visible = Boolean(nearAnimal);

		(this.interactButton as any).targetAnimal = nearAnimal;

		// jugador en el centro
		this.minimapGfx
			.beginFill(0x00ff00)
			.drawCircle(center, center, ts / 2)
			.endFill();
		// Zoom in con tecla '=' (sin Shift), Zoom out con '-'
		if (Keyboard.shared.justPressed("NumpadAdd")) {
			this.setZoom(this.zoom + 0.4);
		}
		if (Keyboard.shared.justPressed("NumpadSubtract")) {
			this.setZoom(this.zoom - 1);
		}
	}

	private endPossession(): void {
		if (!this.currentPossession) { return; }
		const { animal } = this.currentPossession;
		// 1) restauro textura de Cuba (por ej. "cuba")
		this.cubaSprite.texture = Texture.from("cuba");
		// 2) devuelvo al animal su sprite y posición
		animal.sprite.visible = true;
		animal.sprite.x = animal.originalX;
		animal.sprite.y = animal.originalY;
		// 3) limpio timer y oculto barra
		this.currentPossession = null;
		this.timerBarBg.visible = this.timerBarFg.visible = false;
	}


	private onPossess(): void {
		const target = (this.interactButton as any).targetAnimal as Animal;
		if (!target) { return; }

		// 1) intercambio de textura
		this.cubaSprite.texture = target.originalTexture;


		// 2) Efecto partícula en el animal “dejado”
		const soul = new Graphics();
		soul.beginFill(0xffaa00, 1)
			.drawCircle(0, 0, this.tileSize * 0.6)
			.endFill();
		soul.x = target.sprite.x;
		soul.y = target.sprite.y - this.tileSize / 2;
		this.worldContainer.addChild(soul);

		new Tween(soul)
			.to({ y: soul.y - 30, alpha: 0 }, 1000)
			.easing(Easing.Quadratic.Out)
			.onComplete(() => this.worldContainer.removeChild(soul))
			.start();

		// 3) (Opcional) desactivar interacciones posteriores con ese animal
		// target.sprite.visible = false;
		// this.animals = this.animals.filter((a) => a !== target);
		this.interactButton.visible = false;

		// 4) empieza el timer de posesión
		this.currentPossession = { animal: target, timer: 0 };
		this.timerBarBg.visible = this.timerBarFg.visible = true;
		this.timerBarFg.width = 200; // ancho completo
		// … código existente …
		this.currentPossession = { animal: target, timer: 0 };
		// muestra los botones
		this.controlButton.visible = true;
		this.interactButton.visible = false;

	}

	private onControlAnimal(): void {
		if (!this.currentPossession) { return; }
		this.controlledAnimal = this.currentPossession.animal;
		// oculta barra y botón de control
		this.controlButton.visible = false;
		this.exitControlButton.visible = true;

		this.timerBarBg.visible = this.timerBarFg.visible = false;
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

		this.drawH(grid, 17, 8, 17, 2);
		// en el renglon/fila 28 desde la columna 2 a la 12, con un ancho de 2
		this.drawH(grid, 28, 2, 12, 2);
		this.drawH(grid, 22, 13, 24, 3);
		this.drawH(grid, 16, 24, 31, 3);

		this.drawH(grid, 25, 21, 24, 2);
		this.drawH(grid, 25, 27, 30, 2);
		this.drawH(grid, 20, 33, 36, 2);

		// --- Zonas where ghost CAN'T go (grid = 2) ---
		// Por ejemplo, un pasillo interior naranja:
		this.drawZoneH(grid, 14, 18, 21, 5);
		this.drawZoneH(grid, 22, 24, 27, 5);

		return grid;
	}

	public drawH(grid: number[][], x: number, y0: number, y1: number, thickness = 1): void {
		for (let tx = 0; tx < thickness; tx++) {
			for (let y = y0; y < y1; y++) {
				grid[y][x + tx] = 1;
			}
		}
	}

	public drawV(grid: number[][], x0: number, x1: number, y: number, thickness = 1): void {
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

	private createPlayer(): void {
		this.player = new Graphics().beginFill(0x00ff00, 0.001).drawRect(0, 0, this.tileSize, this.tileSize).endFill();

		this.player.x = 10 * this.tileSize; // Posición inicial
		this.player.y = 11 * this.tileSize; // Posición inicial

		const applyBreathingTween = (creature: Sprite): void => {
			const baseScaleY = creature.scale.y;
			const targetScaleY = baseScaleY * 1.05;
			const duration = 1000 + (Math.random() * 100 - 50);

			new Tween(creature.scale).to({ y: targetScaleY }, duration).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start();
		};

		this.playerSprite = Sprite.from("char");
		this.playerSprite.anchor.set(0.5, 1);
		this.playerSprite.scale.set(0.07);
		this.playerSprite.position.x = this.tileSize / 2;
		this.playerSprite.position.y = this.tileSize / 2;

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

	private handleAnimalMovement(dt: number, animal: Animal): void {
		const sprite = animal.sprite;
		const speed = 100; // px por segundo

		let dx = 0;
		let dy = 0;

		if (Keyboard.shared.isDown("ArrowUp") || Keyboard.shared.isDown("KeyW")) {
			dy -= 1;
		}
		if (Keyboard.shared.isDown("ArrowDown") || Keyboard.shared.isDown("KeyS")) {
			dy += 1;
		}
		if (Keyboard.shared.isDown("ArrowLeft") || Keyboard.shared.isDown("KeyA")) {
			dx -= 1;
			sprite.scale.x = -Math.abs(sprite.scale.x); // girar sprite
		}
		if (Keyboard.shared.isDown("ArrowRight") || Keyboard.shared.isDown("KeyD")) {
			dx += 1;
			sprite.scale.x = Math.abs(sprite.scale.x);
		}

		// Normalizar diagonal
		const len = Math.hypot(dx, dy) || 1;
		dx /= len;
		dy /= len;

		// Mover
		sprite.x += dx * speed * (dt / 1000);
		sprite.y += dy * speed * (dt / 1000);

		// Actualizar cualquier lógica extra (p.ej. colisiones) aquí...
	}


	private updateCamera(_dt: number): void {
		// Determino a quién sigo: o al animal controlado, o al player
		const focus = this.controlledAnimal?.sprite || this.player;
		if (!focus) { return; }

		// 1) Datos básicos
		const offsetX = this.viewWidth / 2;
		const offsetY = this.viewHeight / 2;
		const scaleX = this.worldContainer.worldTransform.a;
		const scaleY = this.worldContainer.worldTransform.d;
		const worldW = this.grid[0].length * this.tileSize * scaleX;
		const worldH = this.grid.length * this.tileSize * scaleY;

		// 2) Centro del focus en mundo
		const centerX = (focus.x + this.tileSize / 2) * scaleX;
		const centerY = (focus.y + this.tileSize / 2) * scaleY;

		// 3) Cámara ideal (sin clamping)
		let targetX = offsetX - centerX;
		let targetY = offsetY - centerY + (focus === this.player ? this.playerSprite.height : focus.height);

		// 4) Bordes (10 celdas horizontal, 5 vertical)
		const borderX = 10 * this.tileSize * scaleX;
		const borderY = 5 * this.tileSize * scaleY;

		// 5) Límites para targetX/Y
		const minX = offsetX - worldW + borderX;
		const maxX = offsetX - borderX;
		const minY = offsetY - worldH + borderY + (focus === this.player ? this.playerSprite.height : focus.height);
		const maxY = offsetY - borderY + (focus === this.player ? this.playerSprite.height : focus.height);

		// 6) Clamp
		targetX = Math.min(Math.max(targetX, minX), maxX);
		targetY = Math.min(Math.max(targetY, minY), maxY);

		// 7) Lerp suave
		const smoothingRate = 1;
		const lerp = 1 - Math.exp(-smoothingRate * _dt);
		this.worldContainer.x += (targetX - this.worldContainer.x) * lerp;
		this.worldContainer.y += (targetY - this.worldContainer.y) * lerp;
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
				.beginFill(0xffffff)
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
		this.targetTileOutline = new AnimatedSprite([
			Texture.from("arrows1"),
			Texture.from("arrows2"),
			Texture.from("arrows3"),
			Texture.from("arrows4"),
			Texture.from("arrows5"),
			Texture.from("arrows6"),
			Texture.from("arrows7"),
			Texture.from("arrows8"),
		]);
		// no reproducimos aquí todavía
		this.targetTileOutline.loop = false;
		this.targetTileOutline.animationSpeed = 0.2;
		this.targetTileOutline.anchor.set(0.5, 0.5);
		this.targetTileOutline.width = this.tileSize * 3;
		this.targetTileOutline.height = this.tileSize * 3;
		this.targetTileOutline.visible = false;
		this.worldContainer.addChild(this.targetTileOutline);
	}

	private updateOutline(x: number, y: number): void {
		// Posicionas el outline como antes...
		const worldX = x * this.tileSize + this.tileSize / 2;
		const worldY = y * this.tileSize + this.tileSize / 2;
		this.targetTileOutline.position.set(worldX, worldY);

		// Reiniciar la animación desde el primer frame:
		this.targetTileOutline.gotoAndStop(0);
		this.targetTileOutline.visible = true;

		// Iniciar la reproducción:
		this.targetTileOutline.play();

		this.targetTileOutline.onComplete = () => {
			this.targetTileOutline.visible = false;
		};
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

	private exitControl(): void {
		// simplemente desactiva el animal controlado
		this.controlledAnimal = null;

		// oculta botones
		this.exitControlButton.visible = false;

		// si quieres, volver a mostrar el botón de “Controlar” para la misma posesión
		if (this.currentPossession) {
			this.controlButton.visible = true;
		}
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

		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, w, h, 1536, 1024, ScaleHelper.FIT);

		this.uiContainer.x = 0;
		this.uiContainer.y = 0;

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

		this.interactButton.position.set(w / 2, h - 50);

		// reposiciona también la barra:
		this.timerBarBg.position.set(w / 2, 20);
		this.timerBarFg.position.set(w / 2, 20);

		this.controlButton.position.set(w / 2, h - 80);
		this.exitControlButton.position.set(w / 2, h - 110);

	}
}
