import { PlayerFactory } from "./PlayerFactory";
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Text, TextStyle } from "pixi.js";
import { Container, Graphics, Point, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import type { PlayerUnit } from "./IUnit";
import { GamePhase, PhaseManager } from "./PhaseManager";
import { Grid } from "./Grid";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { AllContainers } from "./AllContainers";
import { Animations } from "./Animations";
import { PlayerData } from "./UnitData";
import { PathFinder } from "./PathFinder";
import { AttackRangeCalculator } from "./AttackRangeCalculator";
import { TurnManager, TurnSide } from "./TurnManager";
import { EnemyAI } from "./EnemyAI";
import { InputHandler } from "./InputHandler";
import { getTerrainColor, Terrain } from "./Terrain";

export class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}

export class AuroraBaseGameScene extends PixiScene {
	private grid: number[][] = [];
	private tileSize = 64;

	public static readonly BUNDLES = ["aurora-latest", "abandonedhouse", "sfx"];

	// Fases de A* pathing (no confundir con GamePhase)
	private pathQueue: Point[] = [];
	private stepStart: Point | null = null;
	private stepEnd: Point | null = null;
	private stepElapsed = 0;
	private stepDuration = 0;
	private speed = 200; // px/segundo para animar movimiento

	private allContainers = new AllContainers();

	private attackRangeCells: Set<string> = new Set();

	// Debug
	private debugText!: Text;

	// Para el grid interactivo
	private tiles: Array<{ tile: Graphics; i: number; j: number }> = [];

	// Selector de grilla
	private selector: Graphics;
	private selectorPos: Point; // coordenadas en grilla del selector

	private selectedUnit: PlayerUnit | null = null;
	private allyUnits: PlayerUnit[] = [];
	private enemyUnits: PlayerUnit[] = [];

	// Movimiento: almacenamiento del área de alcance
	private movementRange: Set<string> = new Set(); // claves "x,y"

	private walkableZones: Point[] = [];

	private animations: Animations;
	private phaseManager: PhaseManager;
	private playerFactory: PlayerFactory;

	private pathFinder: PathFinder;
	private attackCalc: AttackRangeCalculator;
	private turnManager: TurnManager;
	private enemyAI: EnemyAI;
	private inputHandler: InputHandler;
	private lastDebugSelectorPos: Point | null = null;

	private terrainInfoText!: Text;
	private unitPreviewSprite: Sprite | null = null;
	private unitInfoText!: Text;
	private unitHealthBarPreview!: Graphics;

	// Tamaños y offsets relativos dentro de uiLeftContainer / uiRightContainer:
	private previewSpriteSize = 128; // ejemplo: 48px de ancho/alto de la miniatura
	private healthBarPreviewWidth = 64;
	private healthBarPreviewHeight = 6;
	private uiInnerMargin = 8; // margen interno en containers

	private preMovePos: Point | null = null;
	private unitPreviewBG: Sprite;

	constructor() {
		super();

		SoundLib.playMusic("zamba", { volume: 0.2, loop: true });
		this.grid = new Grid().createGrid();

		this.addChild(this.allContainers);

		this.allContainers.createBackground(this.grid, this.tileSize, this.tiles);

		this.animations = new Animations();

		const spr = Sprite.from("map2");
		spr.alpha = 0.7;
		spr.scale.set(0.5);
		// Centrar pivot si deseas rotar/scale
		this.allContainers.worldContainer.addChild(spr);
		this.allContainers.worldContainer.pivot.set(this.allContainers.worldContainer.width / 2, this.allContainers.worldContainer.height * 0.335);

		this.playerFactory = new PlayerFactory(this.allContainers.worldContainer, this.tileSize);

		this.createPlayerUnits();

		// Crear selector inicial en la posición de la primera unidad aliada, si existe
		if (this.allyUnits.length > 0) {
			const firstAlly = this.allyUnits[0];
			this.selectorPos = new Point(firstAlly.gridX, firstAlly.gridY);
		} else {
			// Si no hay unidades aliadas, inicializa en (0,0) o alguna posición por defecto
			this.selectorPos = new Point(0, 0);
		}
		this.selector = new Graphics();
		// Rectángulo con línea amarilla
		this.selector.lineStyle(2, 0xffff00).drawRect(0, 0, this.tileSize, this.tileSize);
		this.allContainers.worldContainer.addChild(this.selector);
		this.updateSelectorPosition();

		this.allContainers.worldContainer.addChild(this.allContainers.highlightContainer);

		// Debug text
		this.debugText = new Text("0,0", new TextStyle({ fill: "#ffffff", fontSize: 14 }));
		this.debugText.position.set(10, 50);
		this.allContainers.uiContainer.addChild(this.debugText);

		this.phaseManager = new PhaseManager();
		this.phaseManager.initPhaseText(this.allContainers);
		this.allContainers.worldContainer.addChild(this.allContainers.attackHighlightContainer);

		// Configurar PathFinder con Terrain:
		const gridImpl = {
			width: this.grid[0].length, // columnas
			height: this.grid.length, // filas
			isWalkable: (x: number, y: number) => {
				if (y < 0 || y >= this.grid.length || x < 0 || x >= this.grid[0].length) {
					return false;
				}
				const code = this.grid[y][x];
				const terrain = Terrain.fromCode(code);
				return terrain.moveCost < Infinity;
			},
			terrainCost: (x: number, y: number) => {
				if (y < 0 || y >= this.grid.length || x < 0 || x >= this.grid[0].length) {
					return Infinity;
				}
				const code = this.grid[y][x];
				const terrain = Terrain.fromCode(code);
				return terrain.moveCost;
			},
		};
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const isOccupied = (x: number, y: number) => this.allyUnits.some((u) => u.gridX === x && u.gridY === y) || this.enemyUnits.some((u) => u.gridX === x && u.gridY === y);
		this.pathFinder = new PathFinder(gridImpl, isOccupied);

		this.attackCalc = new AttackRangeCalculator(
			gridImpl,
			(x, y) => this.allyUnits.find((u) => u.gridX === x && u.gridY === y),
			(x, y) => this.enemyUnits.find((u) => u.gridX === x && u.gridY === y)
		);
		this.turnManager = new TurnManager(this.allyUnits, this.enemyUnits, {
			onAllySelectNext: (unit) => {
				if (unit) {
					this.selectedUnit = null;
					this.selectorPos.set(unit.gridX, unit.gridY);
					this.updateSelectorPosition();
					this.phaseManager.gamePhase = GamePhase.SELECT;
				}
			},
			onStartEnemyTurn: () => this.startEnemySequence(),
			onStartAllyTurn: () => this.startAllyTurn(),
		});

		this.enemyAI = new EnemyAI(
			this.pathFinder,
			this.attackCalc,
			async (unit, pathGrid: { x: number; y: number }[], destX: number, destY: number) => {
				const pathPts = pathGrid.map((n) => new Point(n.x * this.tileSize + this.tileSize / 2, n.y * this.tileSize + this.tileSize / 2));
				await this.animateMovePromise(unit, pathPts, destX, destY);
			},
			(att, tgt) => this.animateAttackAndApplyDamagePromise(att, tgt)
		);

		this.inputHandler = new InputHandler({
			onMoveSelector: (dx, dy) => this.onMoveSelector(dx, dy),
			onSelect: () => this.trySelectUnit(),
			onConfirmMove: () => this.confirmMove(),
			onSkipAttack: () => this.skipAttack(),
			onAttack: () => this.doAttack(),
			onProceedAfterAction: () => this.proceedAfterAction(),
			onCancel: () => this.onCancelPhase(), // new
		});

		this.turnManager.startAllyTurn();

		// Info terreno:
		const terrainBG = Sprite.from("frameOrange");
		terrainBG.anchor.set(0.5);
		terrainBG.scale.set(0.3);
		terrainBG.alpha = 0.6;
		terrainBG.x = this.allContainers.worldContainer.width - terrainBG.width * 0.5;
		terrainBG.y = this.allContainers.worldContainer.height - terrainBG.height - 200;
		this.allContainers.worldContainer.addChild(terrainBG);
		this.terrainInfoText = new Text("", new TextStyle({ fill: "#ffffff", fontSize: 44, wordWrap: true, wordWrapWidth: 280 }));
		this.terrainInfoText.anchor.set(0.5);
		terrainBG.addChild(this.terrainInfoText);
		this.terrainInfoText.x = 0;
		this.terrainInfoText.y = 0;

		this.unitPreviewBG = Sprite.from("frameBlue");
		// Mantén aquí la escala y la posición que ya tenías:
		this.unitPreviewBG.scale.set(0.4, 0.3);
		this.unitPreviewBG.alpha = 0.6;
		// Posición fija como antes:
		this.unitPreviewBG.x = 0;
		this.unitPreviewBG.y = this.allContainers.worldContainer.height - this.unitPreviewBG.height - 255;
		this.allContainers.worldContainer.addChild(this.unitPreviewBG);

		// Preview unidad:
		this.unitInfoText = new Text("", new TextStyle({ fill: "#ffffff", fontSize: 14 }));
		this.unitInfoText.x = 0;
		this.unitInfoText.y = 0;
		this.allContainers.worldContainer.addChild(this.unitInfoText);

		this.unitHealthBarPreview = new Graphics();
		this.allContainers.worldContainer.addChild(this.unitHealthBarPreview);
		this.unitHealthBarPreview.x = 0;
		this.unitHealthBarPreview.y = this.unitInfoText.y + this.unitInfoText.height + this.uiInnerMargin;

		for (let y = 0; y < this.grid.length; y++) {
			for (let x = 0; x < this.grid[0].length; x++) {
				const terrain = Terrain.fromCode(this.grid[y][x]);
				if (terrain.moveCost < Infinity) {
					this.walkableZones.push(new Point(x, y));
				}
			}
		}
		// Llama inicialmente:
		this.updateDebugCellInfo();

		const alphaValue = 0;
		for (let y = 0; y < this.grid.length; y++) {
			for (let x = 0; x < this.grid[0].length; x++) {
				const code = this.grid[y][x];
				const terrain = Terrain.fromCode(code);
				const color = getTerrainColor(terrain);

				const g = new Graphics();
				g.beginFill(color, alphaValue).drawRect(0, 0, this.tileSize, this.tileSize).endFill();
				g.x = x * this.tileSize;
				g.y = y * this.tileSize;

				this.allContainers.worldContainer.addChild(g);
				// Optionally store reference:
				this.tiles.push({ tile: g, i: x, j: y });
			}
		}
	}

	private proceedAfterAction(): void {
		this.allContainers.clearPathPreview();
		this.allContainers.highlightContainer.removeChildren();
		this.allContainers.attackHighlightContainer.removeChildren();
		this.turnManager.endCurrentAction();
	}

	private onCancelPhase(): void {
		const phase = this.phaseManager.gamePhase;
		switch (phase) {
			case GamePhase.ATTACK:
				if (this.selectedUnit) {
					// Clear attack highlights:
					this.clearAttackRange();

					if (this.preMovePos) {
						// Hubo movimiento previo: revertir posición
						const orig = this.preMovePos;
						// Actualizar coordenadas de grid:
						this.selectedUnit.gridX = orig.x;
						this.selectedUnit.gridY = orig.y;
						// Mover sprite instantáneamente al centro de la casilla original:
						// Suponiendo que tu sprite se posiciona con x = gridX*tileSize + tileSize/2:
						this.selectedUnit.sprite.x = orig.x * this.tileSize + this.tileSize / 2;
						this.selectedUnit.sprite.y = orig.y * this.tileSize + this.tileSize / 2;
						// Limpiar preMovePos para no reusar:
						this.preMovePos = null;

						// Revertir fase a MOVE:
						this.phaseManager.gamePhase = GamePhase.MOVE;
						// Recalcular y mostrar highlights de movimiento desde la posición original:
						this.movementRange = this.pathFinder.computeMovementRange(this.selectedUnit);
						this.showMovementHighlights();

						// Reposicionar selector sobre la unidad:
						this.selectorPos.set(orig.x, orig.y);
						this.updateSelectorPosition();
						this.updateDebugCellInfo();
					} else {
						// No hubo movimiento previo: simplemente volver a MOVE
						this.phaseManager.gamePhase = GamePhase.MOVE;
						if (this.selectedUnit) {
							// Recalcular highlights:
							this.movementRange = this.pathFinder.computeMovementRange(this.selectedUnit);
							this.showMovementHighlights();
							// Reposicionar selector:
							this.selectorPos.set(this.selectedUnit.gridX, this.selectedUnit.gridY);
							this.updateSelectorPosition();
							this.updateDebugCellInfo();
						}
					}
				} else {
					// Sin selectedUnit: ir a SELECT
					this.phaseManager.gamePhase = GamePhase.SELECT;
				}
				break;

			case GamePhase.MOVE:
				if (this.selectedUnit) {
					// Si el jugador había movido selector o previsualizado un path, y presiona Escape en MOVE:
					// Deseleccionamos la unidad y limpiamos highlights. No revertemos sprite porque confirmMove no se llamó aún.
					this.allContainers.clearPathPreview();
					this.allContainers.highlightContainer.removeChildren();
					// Reposicionar selector sobre la unidad:
					this.selectorPos.set(this.selectedUnit.gridX, this.selectedUnit.gridY);
					this.updateSelectorPosition();
					// Deseleccionar:
					this.selectedUnit = null;
				}
				this.phaseManager.gamePhase = GamePhase.SELECT;
				this.updateDebugCellInfo();
				break;

			case GamePhase.SELECT:
				console.log("Ya estás en SELECT; no hay atrás.");
				break;

			case GamePhase.END:
				console.log("Acción ya finalizada; no se puede deshacer aquí.");
				break;

			default:
				console.log("Fase no manejada en onCancelPhase:", phase);
				break;
		}
	}

	/**
	 * Actualiza this.debugText con info de la celda bajo el selector:
	 * - Coordenadas
	 * - Tipo de terreno
	 * - Si hay unidad aliada o enemiga: id y stats
	 */
	private updateDebugCellInfo(): void {
		const x = this.selectorPos.x,
			y = this.selectorPos.y;
		// Terreno:
		this.debugText.text = `Sel: ${x},${y}`;

		const code = this.grid[y]?.[x];
		const terrain = Terrain.fromCode(code);
		this.terrainInfoText.text = `${terrain.name}\n\nDEF: ${terrain.defBonus}\nAVO: ${terrain.avoBonus}`;
		this.terrainInfoText.x = 0;
		this.terrainInfoText.y = 0;

		// Unidad bajo selector?
		const ally = this.allyUnits.find((u) => u.gridX === x && u.gridY === y);
		const enemy = this.enemyUnits.find((u) => u.gridX === x && u.gridY === y);
		const unit = ally ?? enemy ?? null;

		// Manejo de unitPreviewBG (frameBlue)
		if (unit) {
			// Crear solo la primera vez
			if (!this.unitPreviewBG) {
				this.unitPreviewBG.visible = true;
			}
			// Solo hacer visible
			this.unitPreviewBG.visible = true;
		} else {
			// No hay unidad: solo ocultar
			if (this.unitPreviewBG) {
				this.unitPreviewBG.visible = false;
			}
		}

		// Preview de sprite lateral, health bar, etc.
		if (!unit) {
			if (this.unitPreviewSprite) {
				this.allContainers.uiLeftContainer.removeChild(this.unitPreviewSprite);
				this.unitPreviewSprite.destroy();
				this.unitPreviewSprite = null;
			}
			this.unitInfoText.text = "";
			this.unitHealthBarPreview.clear();
		} else {
			// Lógica existente para preview lateral...
			if (this.unitPreviewSprite) {
				if (this.unitPreviewSprite.texture !== unit.sprite.texture) {
					this.unitPreviewSprite.texture = unit.sprite.texture;
				}
			} else {
				this.unitPreviewSprite = Sprite.from(unit.sprite.texture);
				this.unitPreviewSprite.scale.set(0.5);
				this.unitPreviewSprite.y = this.unitPreviewBG.y + 16;
				this.allContainers.worldContainer.addChild(this.unitPreviewSprite);
			}
			this.unitPreviewSprite.x = 16;

			this.unitInfoText.text = `${unit.id}`;
			this.unitInfoText.x = this.unitPreviewSprite.x + this.previewSpriteSize + this.uiInnerMargin - 60;
			this.unitInfoText.y = this.unitPreviewBG.y + 20;

			const pct = unit.healthPoints / unit.maxHealthPoints;
			this.unitHealthBarPreview.clear();
			this.unitHealthBarPreview.beginFill(0x333333);
			this.unitHealthBarPreview.drawRect(0, 0, this.healthBarPreviewWidth, this.healthBarPreviewHeight);
			this.unitHealthBarPreview.endFill();
			let color = 0x00ff00;
			if (pct < 0.3) {
				color = 0xff0000;
			} else if (pct < 0.6) {
				color = 0xffff00;
			}
			this.unitHealthBarPreview.beginFill(color);
			this.unitHealthBarPreview.drawRect(1, 1, Math.max(0, (this.healthBarPreviewWidth - 2) * pct), this.healthBarPreviewHeight - 2);
			this.unitHealthBarPreview.endFill();
			this.unitHealthBarPreview.lineStyle(1, 0x000000);
			this.unitHealthBarPreview.drawRect(0, 0, this.healthBarPreviewWidth, this.healthBarPreviewHeight);
			this.unitHealthBarPreview.lineStyle(0);

			this.unitHealthBarPreview.x = this.unitInfoText.x;
			this.unitHealthBarPreview.y = this.unitInfoText.y + this.unitInfoText.height + this.uiInnerMargin;
		}
	}

	private onMoveSelector(dx: number, dy: number): void {
		const oldPos = this.selectorPos.clone();
		this.allContainers.clearPathPreview();
		const maxCols = this.grid[0].length - 1;
		const maxRows = this.grid.length - 1;
		this.selectorPos.x = Math.max(0, Math.min(maxCols, this.selectorPos.x + dx));
		this.selectorPos.y = Math.max(0, Math.min(maxRows, this.selectorPos.y + dy));
		if (this.phaseManager.gamePhase === GamePhase.ATTACK && this.selectedUnit) {
			this.allContainers.highlightContainer.removeChildren();
			const key = `${this.selectorPos.x},${this.selectorPos.y}`;
			const isOrigin = this.selectorPos.x === this.selectedUnit.gridX && this.selectorPos.y === this.selectedUnit.gridY;
			// attackRangeCells ya calculado antes de entrar en ATTACK
			if (!isOrigin && !this.attackRangeCells.has(key)) {
				// Fuera de rango: revertir
				this.selectorPos = oldPos;
			}
		}
		this.updateSelectorPosition();
		// Finalmente, actualizar debug:
		this.updateDebugCellInfo();
		if (this.phaseManager.gamePhase === GamePhase.MOVE && this.selectedUnit) {
			// actualizar previsualización de ruta usando pathFinder si la casilla está en movementRange
			this.allContainers.attackHighlightContainer.removeChildren();
			const key2 = `${this.selectorPos.x},${this.selectorPos.y}`;
			if (this.movementRange.has(key2) || (this.selectorPos.x === this.selectedUnit.gridX && this.selectorPos.y === this.selectedUnit.gridY)) {
				// obtener pathGrid de pathFinder y dibujar preview
				const pathGrid = this.pathFinder.findPath(this.selectedUnit, this.selectorPos.x, this.selectorPos.y);
				if (pathGrid) {
					// dibujar previsualización
					this.allContainers.clearPathPreview();
					const container = new Container();
					for (const node of pathGrid) {
						if (node.x === this.selectedUnit.gridX && node.y === this.selectedUnit.gridY) {
							continue;
						}
						const dot = new Graphics()
							.beginFill(0xff0000, 0.5)
							.drawCircle(node.x * this.tileSize + this.tileSize / 2, node.y * this.tileSize + this.tileSize / 2, 3)
							.endFill();
						container.addChild(dot);
					}
					this.allContainers.worldContainer.addChild(container);
					this.allContainers.pathPreviewContainer = container;
				}
			} else {
				this.allContainers.clearPathPreview();
			}
		}
	}

	private async startEnemySequence(): Promise<void> {
		console.log("----- Turno Enemigo (IA) -----");
		this.allContainers.highlightContainer.removeChildren();
		this.allContainers.attackHighlightContainer.removeChildren();
		// Asegúrate de que enemyUnits tengan hasActed=false (TurnManager ya hace reset)
		for (const enemy of this.enemyUnits) {
			if (enemy.hasActed) {
				continue;
			}
			// animar IA para esta unidad:
			await this.enemyAI.processEnemyAction(enemy, this.allyUnits);
			enemy.hasActed = true;
			// opcional: podrías esperar un pequeño delay entre acciones
		}
		// Al terminar IA de todos:
		this.turnManager.startAllyTurn();
	}

	/** Dibuja highlights de ataque en attackRangeCells, ocupando 90% del tile centrado */
	private showAttackRange(): void {
		this.allContainers.attackHighlightContainer.removeChildren();
		const pad = this.tileSize * 0.05;
		const size = this.tileSize * 0.9;
		for (const key of this.attackRangeCells) {
			const [xs, ys] = key.split(",").map((s) => parseInt(s, 10));
			const g = new Graphics();
			g.beginFill(0x800000, 0.3)
				.drawRect(xs * this.tileSize + pad, ys * this.tileSize + pad, size, size)
				.endFill();
			this.allContainers.attackHighlightContainer.addChild(g);
		}
	}

	/** Limpia highlights de ataque */
	private clearAttackRange(): void {
		this.allContainers.attackHighlightContainer.removeChildren();
		this.attackRangeCells.clear();
	}

	private createPlayerUnits(): void {
		for (const cfg of PlayerData) {
			if (cfg.isEnemy) {
				const u = this.playerFactory.createEnemy(cfg);
				this.enemyUnits.push(u);
				this.playerFactory.drawHealthBar(u);
			} else {
				const u = this.playerFactory.createAlly(cfg);
				this.allyUnits.push(u);
				this.playerFactory.drawHealthBar(u);
			}
		}
	}

	/** Transición a fase ATTACK para la unidad dada: calcula rango y dibuja highlights */
	private enterAttackPhase(unit: PlayerUnit): void {
		this.allContainers.clearPathPreview();
		this.allContainers.highlightContainer.removeChildren();
		SoundLib.stopMusic("run");

		this.selectedUnit = unit;
		this.phaseManager.gamePhase = GamePhase.ATTACK;
		this.attackRangeCells = this.attackCalc.computeAttackRange(unit);
		this.showAttackRange();
		console.log("Fase ATTACK: presiona Q para atacar o Enter para saltar");
	}

	public override update(dt: number): void {
		// Animar movimiento si hay pathQueue en curso
		this.followPath(dt);

		// Input solo si es turno aliado
		if (this.turnManager.getCurrentSide() === TurnSide.ALLY) {
			this.inputHandler.update(this.phaseManager.gamePhase);
		}

		// Actualizar texto de fase si turno aliado:
		if (this.turnManager.getCurrentSide() === TurnSide.ALLY) {
			this.phaseManager.updatePhaseText();
		} else {
			this.phaseManager.phaseText.text = `Turno Enemigo`;
		}

		// Si la posición del selector cambió desde el último frame (o desde la última vez que actualizamos debug):
		if (!this.lastDebugSelectorPos || this.lastDebugSelectorPos.x !== this.selectorPos.x || this.lastDebugSelectorPos.y !== this.selectorPos.y) {
			this.updateDebugCellInfo();
			// Actualiza el registro de la última posición
			if (!this.lastDebugSelectorPos) {
				this.lastDebugSelectorPos = new Point(this.selectorPos.x, this.selectorPos.y);
			} else {
				this.lastDebugSelectorPos.set(this.selectorPos.x, this.selectorPos.y);
			}
		}

		// Actualizar health bars:
		for (const u of [...this.allyUnits, ...this.enemyUnits]) {
			this.playerFactory.drawHealthBar(u);
		}

		this.allContainers.handleZoom();
	}

	/** Actualiza la posición visual del selector en el mundo según selectorPos */
	private updateSelectorPosition(): void {
		this.selector.x = this.selectorPos.x * this.tileSize;
		this.selector.y = this.selectorPos.y * this.tileSize;
	}

	private getSelectableUnitAt(x: number, y: number): PlayerUnit | null {
		return this.allyUnits.find((u) => !u.hasActed && u.gridX === x && u.gridY === y) ?? null;
	}

	private trySelectUnit(): void {
		this.allContainers.clearPathPreview();
		this.allContainers.attackHighlightContainer.removeChildren();
		const unit = this.getSelectableUnitAt(this.selectorPos.x, this.selectorPos.y);
		if (unit) {
			this.selectedUnit = unit;
			this.phaseManager.gamePhase = GamePhase.MOVE;
			this.movementRange = this.pathFinder.computeMovementRange(unit);
			this.showMovementHighlights();
		} else {
			console.log("No hay unidad aliada seleccionable en esa casilla");
		}
	}

	/** Dibuja highlights semitransparentes en movementRange, ocupando 90% del tile centrado */
	private showMovementHighlights(): void {
		this.allContainers.highlightContainer.removeChildren();
		const pad = this.tileSize * 0.05; // 5% de tileSize
		const size = this.tileSize * 0.9; // 90% de tileSize
		for (const key of this.movementRange) {
			const [xs, ys] = key.split(",").map((s) => parseInt(s, 10));
			const g = new Graphics();
			g.beginFill(0x00ff00, 0.3)
				// desplazamos el rect centrado: xs*tileSize + pad, ys*tileSize + pad
				.drawRect(xs * this.tileSize + pad, ys * this.tileSize + pad, size, size)
				.endFill();
			this.allContainers.highlightContainer.addChild(g);
		}
	}

	private confirmMove(): void {
		if (!this.selectedUnit) {
			return;
		}
		const key = `${this.selectorPos.x},${this.selectorPos.y}`;
		// Si no se mueve (selector en la misma posición), entramos a ATTACK sin animar:
		if (this.selectorPos.x === this.selectedUnit.gridX && this.selectorPos.y === this.selectedUnit.gridY) {
			// No hay movimiento; no necesitamos almacenar preMovePos
			this.preMovePos = null;
			this.enterAttackPhase(this.selectedUnit);
			return;
		}
		if (this.movementRange.has(key)) {
			const pathGrid = this.pathFinder.findPath(this.selectedUnit, this.selectorPos.x, this.selectorPos.y);
			if (pathGrid) {
				// **Guardar posición previa antes de animar movimiento**
				this.preMovePos = new Point(this.selectedUnit.gridX, this.selectedUnit.gridY);

				// Convertir a puntos de píxel para animar:
				this.pathQueue = pathGrid.map((n) => new Point(n.x * this.tileSize + this.tileSize / 2, n.y * this.tileSize + this.tileSize / 2));
				this.stepStart = this.stepEnd = null;
				this.phaseManager.gamePhase = GamePhase.MOVING;
				console.log("Animando movimiento, fase MOVING...");
				this.allContainers.clearMovementHighlights();
				this.allContainers.clearPathPreview();
				return;
			}
		}
		console.log("Destino fuera de rango de movimiento");
	}

	/** Cuando followPath termina (pathQueue vacía), actualizar gridX, gridY de la unidad */
	private followPath(dt: number): void {
		if (!this.selectedUnit) {
			return;
		}
		const sprite = this.selectedUnit.sprite;

		if (!this.stepEnd && this.pathQueue.length) {
			// Inicia nuevo paso de animación
			this.stepStart = new Point(sprite.x, sprite.y);
			this.stepEnd = this.pathQueue.shift()!;
			// Ajustar orientación, etc.
			const dx = this.stepEnd.x - this.stepStart.x;
			if (dx < 0) {
				sprite.scale.x = -Math.abs(sprite.scale.x);
			} else if (dx > 0) {
				sprite.scale.x = Math.abs(sprite.scale.x);
			}
			const dy = this.stepEnd.y - this.stepStart.y;
			const dist = Math.hypot(dx, dy);
			this.stepDuration = dist / this.speed;
			this.stepElapsed = 0;
		}

		if (this.stepEnd && this.stepStart) {
			this.stepElapsed += dt / 1000;
			const t = Math.min(this.stepElapsed / this.stepDuration, 1);
			sprite.x = this.stepStart.x + (this.stepEnd.x - this.stepStart.x) * t;
			sprite.y = this.stepStart.y + (this.stepEnd.y - this.stepStart.y) * t;

			if (t >= 1) {
				// Snap final de este paso
				sprite.x = this.stepEnd.x;
				sprite.y = this.stepEnd.y;

				if (this.pathQueue.length === 0) {
					// Último paso completado
					// Actualizar gridX/gridY en la unidad
					const gridX = Math.floor(sprite.x / this.tileSize);
					const gridY = Math.floor(sprite.y / this.tileSize);
					this.selectedUnit.gridX = gridX;
					this.selectedUnit.gridY = gridY;

					// Limpiar step para no reentrar
					this.stepStart = null;
					this.stepEnd = null;

					// Si estábamos en MOVING, terminamos movimiento y pasamos a ATTACK
					if (this.phaseManager.gamePhase === GamePhase.MOVING) {
						this.enterAttackPhase(this.selectedUnit);
					}
				} else {
					// Todavía quedan pasos: avanzar al siguiente
					this.stepStart = null;
					this.stepEnd = null;
				}
			}
		}
	}

	/**
	 * Ejecuta el ataque de la unidad seleccionada (ally o enemy).
	 * En turno aliado: usa selectorPos para elegir target.
	 * En turno enemigo: puedes llamar directamente a performAttack(enemyUnit, chosenAlly).
	 */
	private doAttack(): void {
		if (!this.selectedUnit) {
			return;
		}

		const attacker = this.selectedUnit;
		let target: PlayerUnit | undefined;

		if (!attacker.isEnemy) {
			// Turno aliado: buscamos enemigo en selectorPos
			const tx = this.selectorPos.x,
				ty = this.selectorPos.y;
			target = this.enemyUnits.find((u) => u.gridX === tx && u.gridY === ty);
			if (!target) {
				console.log("No hay enemigo en la celda para atacar");
				this.clearAttackRange();
				this.endAction();
				return;
			}
		} else {
			// Turno enemigo: idealmente este método no se llama en AI sino la IA llama a performAttack directamente.
			// Pero si quisieras usar selectorPos en turno enemigo (raro), puedes hacer algo similar:
			const tx = this.selectorPos.x,
				ty = this.selectorPos.y;
			target = this.allyUnits.find((u) => u.gridX === tx && u.gridY === ty);
			if (!target) {
				console.log("No hay aliado en la celda para atacar");
				this.clearAttackRange();
				this.endAction();
				return;
			}
		}

		// Ahora tenemos attacker y target. Hacemos el ataque genérico:
		this.performAttack(attacker, target, () => {
			// callback al finalizar animaciones y aplicar daño:
			this.clearAttackRange();
			this.endAction();
		});
	}

	/**
	 * Realiza el ataque de `attacker` sobre `target`: maneja esquiva, animaciones y aplica daño.
	 * @param attacker Unidad atacante (ally o enemy).
	 * @param target Unidad objetivo (del bando contrario).
	 * @param onComplete Callback a llamar cuando la animación y lógica de daño finaliza.
	 */
	private performAttack(attacker: PlayerUnit, target: PlayerUnit, onComplete: () => void): void {
		// Obtener terreno:
		const tx = target.gridX,
			ty = target.gridY;
		let terrain = Terrain.PLAIN;
		if (ty >= 0 && ty < this.grid.length && tx >= 0 && tx < this.grid[0].length) {
			terrain = Terrain.fromCode(this.grid[ty][tx]);
		}
		// Chance de esquivar:
		const avoidChance = target.avoid + terrain.avoBonus;
		if (Math.random() < avoidChance) {
			SoundLib.playSound("miss_SFX", {});

			console.log(`${target.id} esquivó el ataque de ${attacker.id}! (terreno ${terrain.name} AVO+${terrain.avoBonus})`);
			this.animations.animateMissEffect(attacker, target, this.allContainers, this.tileSize, () => {
				onComplete();
			});
		} else {
			// Hit:
			SoundLib.playSound("performAtk_SFX", {});
			this.animations.animateAttackEffect(attacker, target, () => {
				this.applyDamageWithTerrain(attacker, target, terrain);
				onComplete();
			});
		}
	}

	private applyDamageWithTerrain(attacker: PlayerUnit, target: PlayerUnit, terrain: Terrain): void {
		const rawDamage = attacker.strength;
		const totalDefense = target.defense + terrain.defBonus;
		const damage = Math.max(0, rawDamage - totalDefense);
		target.healthPoints = Math.max(0, target.healthPoints - damage);
		console.log(`${attacker.id} hace ${damage} a ${target.id}. (DEF base ${target.defense} + DEF terreno ${terrain.defBonus})`);
		this.allContainers.showFloatingText(`${damage}`, target.sprite.x, target.sprite.y - this.tileSize * 0.3, 0xff0000);
		this.playerFactory.drawHealthBar(target);
		if (target.healthPoints <= 0) {
			console.log(`${target.id} ha sido derrotado.`);
			this.handleUnitDefeat(target);
		}
	}

	/**
	 * Maneja la muerte de una unidad: remover sprite, healthBar, quitarla de la lista correspondiente, etc.
	 */
	private handleUnitDefeat(unit: PlayerUnit): void {
		// Remover healthBar si existe
		if ((unit as any).healthBar) {
			const hb = (unit as any).healthBar;
			if (hb.parent) {
				hb.parent.removeChild(hb);
			}
		}
		// Remover sprite de la escena:
		if (unit.sprite.parent) {
			unit.sprite.parent.removeChild(unit.sprite);
		}

		// Quitar de la lista correspondiente:
		if (unit.isEnemy) {
			const idxE = this.enemyUnits.indexOf(unit);
			if (idxE >= 0) {
				this.enemyUnits.splice(idxE, 1);
			}
		} else {
			const idxA = this.allyUnits.indexOf(unit);
			if (idxA >= 0) {
				this.allyUnits.splice(idxA, 1);
			}
		}

		// Si el derrotado era la unidad seleccionada, limpiamos selectedUnit:
		if (this.selectedUnit === unit) {
			this.selectedUnit = null;
		}
		// Aquí podrías reproducir animación de muerte, SFX, etc.
	}

	/** Saltar ataque */
	private skipAttack(): void {
		console.log("Salto fase de ataque");
		this.endAction();
	}

	/** Finaliza acción de la unidad: marca hasActed y pasa a END */
	private endAction(): void {
		if (this.selectedUnit) {
			this.selectedUnit.hasActed = true;
		}
		this.clearAttackRange();
		this.phaseManager.gamePhase = GamePhase.END;
		console.log("Fase END: presiona Enter para continuar");

		this.turnManager.endCurrentAction();
	}

	/**
	 * Devuelve una Promise que se resuelve cuando la unidad ha completado la animación de moverse siguiendo pathPts hasta la casilla (targetX, targetY).
	 * @param unit Unidad a mover.
	 * @param pathPts Array de Points en coordenadas de píxel para animar.
	 * @param targetGridX Posición destino en grid X.
	 * @param targetGridY Posición destino en grid Y.
	 */
	private animateMovePromise(unit: PlayerUnit, pathPts: Point[], targetGridX: number, targetGridY: number): Promise<void> {
		return new Promise((resolve) => {
			// Similar a tu confirmMove + followPath, pero sin input:
			// 1) Ajustar selectedUnit temporalmente para que followPath lo use:
			const prevSelected = this.selectedUnit;
			this.selectedUnit = unit;
			// 2) Poner pathQueue:
			this.pathQueue = [...pathPts];
			this.stepStart = this.stepEnd = null;
			SoundLib.playMusic("run", {});
			// 3) Forzar gamePhase a MOVING para que followPath lo procese:
			this.phaseManager.gamePhase = GamePhase.MOVING;
			// 4) Hook para detectar cuando termina: podemos observar en followPath: cuando pathQueue se vacía, detectarlo aquí.
			// Para no modificar followPath genérico, podemos sobreescribir temporalmente un callback:
			const checkInterval = setInterval(() => {
				if (this.pathQueue.length === 0 && this.stepEnd === null && this.stepStart === null) {
					// Movimiento completado: actualizar grid coords:
					unit.gridX = targetGridX;
					unit.gridY = targetGridY;
					// Restaurar selectedUnit y gamePhase:
					this.selectedUnit = prevSelected;
					this.phaseManager.gamePhase = TurnSide.ALLY === this.turnManager.getCurrentSide() ? GamePhase.SELECT : GamePhase.SELECT;
					clearInterval(checkInterval);
					resolve();
				}
			}, 50);
		});
	}

	private animateAttackAndApplyDamagePromise(attacker: PlayerUnit, target: PlayerUnit): Promise<void> {
		return new Promise((resolve) => {
			this.animations.animateAttackEffect(attacker, target, () => {
				SoundLib.playSound("performAtk_SFX", {});

				// OJO: aquí debe usar applyDamageWithTerrain, no el viejo applyDamage sin terreno
				const terrain = Terrain.fromCode(this.grid[target.gridY][target.gridX]);
				this.applyDamageWithTerrain(attacker, target, terrain);
				resolve();
			});
		});
	}

	private startAllyTurn(): void {
		this.turnManager.startAllyTurn();

		// Quizá reposicionar selector a la primer unidad aliada
		const firstAlly = this.allyUnits[0];
		if (firstAlly) {
			this.selectorPos.set(firstAlly.gridX, firstAlly.gridY);
			this.updateSelectorPosition();
			this.updateDebugCellInfo();
		}
		this.phaseManager.gamePhase = GamePhase.SELECT;
	}

	public override onResize(w: number, h: number): void {
		this.allContainers.viewWidth = w;
		this.allContainers.viewHeight = h;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.worldContainer, w, h, 700, 520, ScaleHelper.FIT);
		this.allContainers.worldContainer.x = w / 2;
		this.allContainers.worldContainer.y = h / 2;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiContainer.x = 0;
		this.allContainers.uiContainer.y = 0;
		// this.worldContainer.scale.set(this.zoom, this.zoom);
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiRightContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiRightContainer.x = w;
		this.allContainers.uiRightContainer.y = h;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiCenterContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiCenterContainer.x = w * 0.5;
		this.allContainers.uiCenterContainer.y = 0;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiLeftContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiLeftContainer.x = w * 0.1;
		this.allContainers.uiLeftContainer.y = h * 0.9;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.pauseContainer, w, h, 1536, 1200, ScaleHelper.FIT);
		this.allContainers.pauseContainer.x = w / 2;
		this.allContainers.pauseContainer.y = h / 2;
	}
}
