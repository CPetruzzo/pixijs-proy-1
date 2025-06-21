import { PlayerFactory } from "../Utils/PlayerFactory";
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Text, TextStyle } from "pixi.js";
import { Container, Graphics, Point, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import type { PlayerUnit } from "../Data/IUnit";
import { GamePhase, PhaseManager } from "../Managers/PhaseManager";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { AllContainers } from "../Utils/AllContainers";
import { Animations } from "../Utils/Animations";
import { PlayerData } from "../Data/UnitData";
import { PathFinder } from "../Utils/PathFinder";
import { AttackRangeCalculator } from "../Utils/AttackRangeCalculator";
import { TurnManager, TurnSide } from "../Managers/TurnManager";
import { EnemyAI } from "../Utils/EnemyAI";
import { InputHandler } from "../Utils/InputHandler";
import { getTerrainColor, Terrain } from "../Utils/Terrain";
import { GridKilme } from "../Grids/GridKilme";
import { BattleOverlay } from "./BattleOverlay";
import { PreviewUnit } from "../PreviewUnit";
import { ChoiceMenu } from "../Utils/ChoiceMenu";
import { TurnDisplay } from "../Utils/TurnDisplay";

export class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}

export class AuroraQuilmesMapScene extends PixiScene {
	// #region VARIABLES
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
	private selector: Sprite;
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
	private unitInfoText!: Text;
	private unitHealthBarPreview!: Graphics;

	private uiInnerMargin = 8; // margen interno en containers

	private preMovePos: Point | null = null;

	private menuOptions: string[] = ["Atacar", "Mover", "Ítem", "Info", "Esperar"];
	private inBattle: boolean = false;
	private battleOverlay: BattleOverlay | null = null;

	private prevUnit: PreviewUnit;
	private choiceMenu: ChoiceMenu;
	private turnDisplay: TurnDisplay;

	// #endregion VARIABLES

	constructor() {
		super();

		SoundLib.playMusic("zamba", { volume: 0.2, loop: true });
		this.grid = new GridKilme().createGrid();

		this.addChild(this.allContainers);

		this.allContainers.createBackground(this.grid, this.tileSize, this.tiles);

		this.animations = new Animations();

		const spr = Sprite.from("map2");
		spr.alpha = 0.7;
		spr.scale.set(0.5);

		this.allContainers.worldContainer.addChildAt(spr, 0);
		this.allContainers.worldContainer.pivot.set(this.allContainers.worldContainer.width / 2, this.allContainers.worldContainer.height * 0.335);

		this.playerFactory = new PlayerFactory(this.allContainers.worldContainer, this.tileSize);

		this.createPlayerUnits();

		this.selector = Sprite.from("selector");
		this.selector.anchor.set(0.5);
		this.selector.scale.set(0.08);

		if (this.allyUnits.length > 0) {
			const firstAlly = this.allyUnits[0];
			this.selectorPos = new Point(firstAlly.gridX, firstAlly.gridY);
		} else {
			this.selectorPos = new Point(0, 0);
		}
		// Rectángulo con línea amarilla
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

		// Dentro de tu escena, en constructor o en init UI:
		this.turnDisplay = new TurnDisplay();
		// Colócalo donde quieras en la UI, por ejemplo esquina superior derecha:
		this.turnDisplay.x = 10; // o según tu layout
		this.turnDisplay.y = 40; // debajo de phaseText si lo deseas
		this.allContainers.uiContainer.addChild(this.turnDisplay);

		this.turnManager = new TurnManager(this.allyUnits, this.enemyUnits, {
			onAllySelectNext: (unit) => {
				if (unit) {
					this.selectedUnit = null;
					this.selectorPos.set(unit.gridX, unit.gridY);
					this.updateSelectorPosition();
					this.phaseManager.gamePhase = GamePhase.SELECT;

					const tx = unit.gridX,
						ty = unit.gridY;
					if (ty >= 0 && ty < this.grid.length && tx >= 0 && tx < this.grid[0].length) {
						const terrain = Terrain.fromCode(this.grid[ty][tx]);
						if (terrain === Terrain.FORTRESS) {
							if (unit.healthPoints < unit.maxHealthPoints) {
								const fixed = 3;
								const actualHeal = Math.min(fixed, unit.maxHealthPoints - unit.healthPoints);
								unit.healthPoints += actualHeal;
								unit.hasHealedFortress = true;
								this.allContainers.showFloatingText(actualHeal.toString(), unit.sprite.x, unit.sprite.y - this.tileSize * 0.3, 0xff0000);
								console.error(`${unit.id} se cura ${actualHeal} en Fortress.`);
							}
						}
					}
				}
			},
			onStartEnemyTurn: () => {
				this.startEnemySequence();
			},
			onStartAllyTurn: () => {
				this.startAllyTurn();
			},
			onTurnChange: (side) => {
				this.turnDisplay.update(side);
			},
		});

		this.enemyAI = new EnemyAI(
			this.pathFinder,
			this.attackCalc,
			async (unit, pathGrid: { x: number; y: number }[], destX: number, destY: number) => {
				const pathPts = pathGrid.map((n) => new Point(n.x * this.tileSize + this.tileSize / 2, n.y * this.tileSize + this.tileSize / 2));
				await this.animateMovePromise(unit, pathPts, destX, destY);
			},
			// callback de ataque de IA:
			async (attacker: PlayerUnit, target: PlayerUnit) => {
				// 1) lógica de ataque: aplicar daño, marcar hasActed
				// Podemos reutilizar performAttack, pero adaptarlo para retorno Promise:
				await this.enemyPerformAttack(attacker, target);
			}
		);

		// Instanciar ChoiceMenu una sola vez:
		this.choiceMenu = new ChoiceMenu({
			options: this.menuOptions,
			frameKey: "frameBlue",
			x: 656, // posición por defecto, puedes reubicar
			y: 7,
			soundOnNavigate: { name: "menumove", volume: 0.3 },
			highlightColor: "#8b4915",
			normalColor: "#ffffff",
			// textStyle: {...} // si deseas personalizar
		});
		// Añadir al contenedor apropiado:
		this.allContainers.worldContainer.addChild(this.choiceMenu);

		this.inputHandler = new InputHandler({
			onMoveSelector: (dx, dy) => this.onMoveSelector(dx, dy),
			onSelect: () => this.trySelectUnit(), // si aún la necesitas
			onChoice: () => this.onChoice(),
			onNavigateMenu: (delta) => this.onNavigateMenu(delta),
			onConfirmMenu: () => this.confirmChoice(),
			onConfirmMove: () => this.confirmMove(),
			onSkipAttack: () => this.skipAttack(),
			onAttack: () => this.doAttack(),
			onProceedAfterAction: () => this.proceedAfterAction(),
			onCancel: () => this.onCancelPhase(),
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
		this.terrainInfoText = new Text("", new TextStyle({ fill: "#ffffff", fontSize: 64, dropShadow: true, fontFamily: "Pixelate-Regular", wordWrap: true, wordWrapWidth: 280 }));
		this.terrainInfoText.anchor.set(0, 0.5);
		terrainBG.addChild(this.terrainInfoText);
		this.terrainInfoText.x = 0;
		this.terrainInfoText.y = 0;

		// Preview unidad:
		this.unitInfoText = new Text("", new TextStyle({ fill: "#ffffff", dropShadow: true, dropShadowDistance: 2, fontFamily: "Pixelate-Regular", fontSize: 18 }));
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

		const alphaValue = 0;
		for (let y = 0; y < this.grid.length; y++) {
			for (let x = 0; x < this.grid[0].length; x++) {
				const code = this.grid[y][x];
				const terrain = Terrain.fromCode(code);
				const color = getTerrainColor(terrain);

				if (terrain === Terrain.FORTRESS) {
					const houseSprite = Sprite.from("casa");
					houseSprite.scale.set(0.7);
					houseSprite.anchor.set(0.5, 1);
					houseSprite.x = x * this.tileSize + this.tileSize / 2;
					houseSprite.y = y * this.tileSize + this.tileSize / 2;

					this.allContainers.worldContainer.addChildAt(houseSprite, 1);
				}
				const g = new Graphics();
				g.beginFill(color, alphaValue).drawRect(0, 0, this.tileSize, this.tileSize).endFill();
				g.x = x * this.tileSize;
				g.y = y * this.tileSize;

				this.allContainers.worldContainer.addChild(g);
				// Optionally store reference:
				this.tiles.push({ tile: g, i: x, j: y });
			}
		}

		this.prevUnit = new PreviewUnit(this.tileSize, "frameBlue");

		const x0 = 0;
		const y0 = this.allContainers.worldContainer.height - /* offset */ 360;
		this.prevUnit.position.set(x0, y0);
		this.allContainers.worldContainer.addChild(this.prevUnit);

		const x = this.selectorPos.x,
			y = this.selectorPos.y;
		const ally = this.allyUnits.find((u) => u.gridX === x && u.gridY === y);
		const enemy = this.enemyUnits.find((u) => u.gridX === x && u.gridY === y);
		const unit = ally ?? enemy ?? null;

		this.prevUnit.update(unit, this.selector);
	}

	private confirmChoice(): void {
		if (this.phaseManager.gamePhase !== GamePhase.CHOICE) {
			return;
		}
		const choice = this.choiceMenu.getSelectedOption();
		this.choiceMenu.close();

		SoundLib.playSound("menuconfirm", { volume: 0.3 });

		const unit = this.selectedUnit;
		switch (choice) {
			case "Mover":
				if (unit) {
					// Pasar a fase MOVE: calculamos movimiento como en trySelectUnit
					this.phaseManager.gamePhase = GamePhase.MOVE;
					this.movementRange = this.pathFinder.computeMovementRange(unit);
					this.showMovementHighlights();
					// Mantener selector sobre la unidad:
					this.selectorPos.set(unit.gridX, unit.gridY);
					this.updateSelectorPosition();
					this.updateDebugCellInfo();
				}
				break;
			case "Atacar":
				if (unit) {
					// Pasar a fase ATTACK sin moverse
					this.phaseManager.gamePhase = GamePhase.ATTACK;
					this.attackRangeCells = this.attackCalc.computeAttackRange(unit);
					this.showAttackRange();
					console.log("Fase ATTACK: presiona Q para atacar o Enter para saltar");
				}
				break;
			case "Esperar":
				if (unit) {
					// Marcar como actuado y pasar a END/next
					unit.hasActed = true;
					this.phaseManager.gamePhase = GamePhase.END;
					console.log(`${unit.id} espera y termina su acción.`);
					this.turnManager.endCurrentAction();
				}
				break;
			case "Info":
				console.log("Info: (aún no implementado)");
				this.phaseManager.gamePhase = GamePhase.SELECT;
				this.selectedUnit = null;

				break;
			case "Ítem":
				// Aquí puedes abrir un submenú de ítems. Por ahora, puedes hacer un console o stub:
				console.log("Ítem: (aún no implementado)");
				// Quedamos de nuevo en SELECT o en CHOICE? Por ejemplo, volvemos a CHOICE o SELECT:
				this.phaseManager.gamePhase = GamePhase.SELECT;
				this.selectedUnit = null;
				break;
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
						const orig = this.preMovePos;
						this.selectedUnit.gridX = orig.x;
						this.selectedUnit.gridY = orig.y;
						this.selectedUnit.sprite.x = orig.x * this.tileSize + this.tileSize / 2;
						this.selectedUnit.sprite.y = orig.y * this.tileSize + this.tileSize / 2;
						this.preMovePos = null;
						this.phaseManager.gamePhase = GamePhase.MOVE;
						this.movementRange = this.pathFinder.computeMovementRange(this.selectedUnit);
						this.showMovementHighlights();

						this.selectorPos.set(orig.x, orig.y);
						this.updateSelectorPosition();
						this.updateDebugCellInfo();
					} else {
						this.phaseManager.gamePhase = GamePhase.MOVE;
						if (this.selectedUnit) {
							this.movementRange = this.pathFinder.computeMovementRange(this.selectedUnit);
							this.showMovementHighlights();
							this.selectorPos.set(this.selectedUnit.gridX, this.selectedUnit.gridY);
							this.updateSelectorPosition();
							this.updateDebugCellInfo();
						}
					}
				} else {
					this.phaseManager.gamePhase = GamePhase.SELECT;
				}
				break;

			case GamePhase.CHOICE:
				// Cerrar menú y volver a SELECT sin seleccionar unidad
				this.choiceMenu.close();
				this.selectedUnit = null;
				this.phaseManager.gamePhase = GamePhase.SELECT;
				this.updateDebugCellInfo();
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

	private onChoice(): void {
		// Solo si estamos en SELECT y hay unidad bajo selector:
		if (this.phaseManager.gamePhase !== GamePhase.SELECT) {
			return;
		}
		const unit = this.getSelectableUnitAt(this.selectorPos.x, this.selectorPos.y);
		if (!unit) {
			console.log("No hay unidad aliada seleccionable para mostrar el menú.");
			return;
		}
		this.selectedUnit = unit;
		this.choiceMenu.open();
		this.phaseManager.gamePhase = GamePhase.CHOICE;
	}

	private onNavigateMenu(delta: number): void {
		if (this.phaseManager.gamePhase !== GamePhase.CHOICE) {
			return;
		}
		this.choiceMenu.navigate(delta);
	}

	private updateDebugCellInfo(): void {
		const x = this.selectorPos.x,
			y = this.selectorPos.y;
		// Terreno:
		this.debugText.text = `Sel: ${x},${y}`;

		const code = this.grid[y]?.[x];
		const terrain = Terrain.fromCode(code);
		this.terrainInfoText.text = `${terrain.name}\n\nDEF: ${terrain.defBonus}\nAVO: ${terrain.avoBonus}`;
		this.terrainInfoText.x = -95;
		this.terrainInfoText.y = 0;

		// Unidad bajo selector?
		const ally = this.allyUnits.find((u) => u.gridX === x && u.gridY === y);
		const enemy = this.enemyUnits.find((u) => u.gridX === x && u.gridY === y);
		const unit = ally ?? enemy ?? null;

		this.prevUnit.update(unit, this.selector);
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

		// RESET flags de sanación: solo si quieres resetear de nuevo antes de sanar enemigos
		for (const u of [...this.enemyUnits]) {
			(u as any).hasHealedFortress = false;
		}
		// Sanar enemigos en fortress
		for (const enemy of this.enemyUnits) {
			const tx = enemy.gridX,
				ty = enemy.gridY;
			if (ty >= 0 && ty < this.grid.length && tx >= 0 && tx < this.grid[0].length) {
				const terrain = Terrain.fromCode(this.grid[ty][tx]);
				if (terrain === Terrain.FORTRESS) {
					if (enemy.healthPoints < enemy.maxHealthPoints) {
						const fixed = 3;
						const actualHeal = Math.min(fixed, enemy.maxHealthPoints - enemy.healthPoints);
						enemy.healthPoints += actualHeal;
						(enemy as any).hasHealedFortress = true;
						this.allContainers.showFloatingText(actualHeal.toString(), enemy.sprite.x, enemy.sprite.y - this.tileSize * 0.3, 0xff0000);
						console.error(`${enemy.id} se cura ${actualHeal} en Fortress.`);
					}
				}
			}
		}

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
				if (cfg.isBoss) {
					const bossIcon = Sprite.from("bossIcon");
					bossIcon.scale.set(0.05);
					bossIcon.x = u.sprite.width * 0.5;
					bossIcon.y = 0;
					u.sprite.addChild(bossIcon);
				}
				this.enemyUnits.push(u);
			} else {
				const u = this.playerFactory.createAlly(cfg);
				this.allyUnits.push(u);
			}
		}
	}

	/** Transición a fase ATTACK para la unidad dada: calcula rango y dibuja highlights */
	private enterAttackPhase(unit: PlayerUnit): void {
		this.allContainers.clearPathPreview();
		this.allContainers.highlightContainer.removeChildren();
		SoundLib.stopMusic("run");
		this.selectedUnit = unit;
		// Recalcular rango:
		this.attackRangeCells = this.attackCalc.computeAttackRange(unit);
		if (this.attackRangeCells.size === 0) {
			// No hay ataque posible: finalizar acción
			unit.hasActed = true;
			this.phaseManager.gamePhase = GamePhase.END;
			console.log("No hay enemigos en rango; acción terminada.");
			this.turnManager.endCurrentAction();
			return;
		}
		// Si hay ataque posible:
		this.phaseManager.gamePhase = GamePhase.ATTACK;
		this.showAttackRange();
		unit.hasActed = true;

		console.log("Fase ATTACK: presiona Q para atacar o Enter para saltar");
	}

	public override update(dt: number): void {
		if (this.battleOverlay) {
			this.battleOverlay.update(dt);
		}
		if (this.inBattle) {
			return;
		} // ya en batalla, ignorar

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

		this.allContainers.handleZoom();
	}

	/** Actualiza la posición visual del selector en el mundo según selectorPos */
	private updateSelectorPosition(): void {
		this.selector.x = this.selectorPos.x * this.tileSize + this.selector.width * 0.5;
		this.selector.y = this.selectorPos.y * this.tileSize + this.selector.height * 0.5;
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

	/**
	 * Muestra el BattleOverlay para attacker vs target, y retorna una Promise que se resuelve cuando termine el overlay.
	 */
	/**
	 * Muestra el BattleOverlay para attacker vs defender y retorna una Promise que se resuelve cuando termine el overlay.
	 * Calcula didMiss e isCrit, y en onHit aplica el daño (con tu applyDamageWithTerrain).
	 */
	private startBattleSequenceAsync(attacker: PlayerUnit, defender: PlayerUnit): Promise<void> {
		return new Promise((resolve) => {
			// Si ya hay overlay activo, resolvemos inmediatamente
			if (this.battleOverlay) {
				resolve();
				return;
			}

			// 1) Calcular terreno y probabilidad de hit/miss/crit
			const tx = defender.gridX,
				ty = defender.gridY;
			let terrain = Terrain.PLAIN;
			if (ty >= 0 && ty < this.grid.length && tx >= 0 && tx < this.grid[0].length) {
				terrain = Terrain.fromCode(this.grid[ty][tx]);
			}
			const avoidChance = defender.avoid + terrain.avoBonus;
			const didMiss = Math.random() < avoidChance;
			const isCrit = !didMiss && Math.random() < attacker.criticalChance;

			// 2) Preparar callback onHit: aplica daño en el momento intermedio del overlay
			const onHit = (): void => {
				// Usa tu función de aplicar daño: por ejemplo applyDamageWithTerrain(attacker, defender, terrain, isCrit)
				this.applyDamageWithTerrain(attacker, defender, terrain, isCrit);
				// Marcar que atacó:
				attacker.hasActed = true;
				// Si defender muere, handleUnitDefeat lo remueve de listas, etc.
				// handleUnitDefeat(defender) se invoca en applyDamageWithTerrain si hp <=0
			};

			// 3) Callback al terminar overlay: quita overlay y resuelve Promise
			const onBattleComplete = (): void => {
				if (this.battleOverlay) {
					this.battleOverlay.parent?.removeChild(this.battleOverlay);
					this.battleOverlay = null;
				}
				resolve();
			};

			// 4) Decidir posición: aliado a la izquierda, enemigo a la derecha
			const attackerOnLeft = !attacker.isEnemy;
			// Decide attackDuration antes de instanciar
			const attackDuration = attackerOnLeft ? 1.9 : 1.2;
			// 5) Crear overlay pasando todos los campos, incluyendo didMiss, onHit y SFX keys
			const overlay = new BattleOverlay({
				attackerAnimator: attacker.battleAnimator,
				defenderAnimator: defender.battleAnimator,
				isCrit,
				didMiss,
				attackerOnLeft,
				attackDuration, // aquí pasas el valor según el lado

				introDuration: 0.5,
				resultDuration: 0.7,
				onHit,
				onComplete: onBattleComplete,
				// SFX keys según tus assets:
				soundHitKey: "performAtk_SFX",
				soundCritKey: "crit_SFX",
				soundMissKey: "miss_SFX",
			});
			this.battleOverlay = overlay;
			this.allContainers.uiCenterContainer.addChild(overlay);
		});
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

	private async doAttack(): Promise<void> {
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
				console.log("No hay enemigo en la celda para atacar. Saltando ataque.");
				// Limpieza de highlights
				this.clearAttackRange();
				// Saltar ataque: marcar como actuado y avanzar turno
				this.skipAttack();
				return;
			}
		} else {
			// Turno enemigo (si alguna vez se usa aquí):
			const tx = this.selectorPos.x,
				ty = this.selectorPos.y;
			target = this.allyUnits.find((u) => u.gridX === tx && u.gridY === ty);
			if (!target) {
				console.log("No hay aliado en la celda para atacar. Saltando ataque.");
				this.clearAttackRange();
				this.skipAttack();
				return;
			}
		}

		// Si tenemos attacker y target válidos:
		// 1) Limpiamos highlights y pasamos fase END (visual), pero no avanzamos turno aun aquí
		this.clearAttackRange();
		this.phaseManager.gamePhase = GamePhase.END;
		console.log("Fase END: presiona Enter para continuar");

		// 2) Ejecutar la animación de ataque y aplicar daño:
		//    asumimos que performAttack marca attacker.hasActed = true y aplica daño,
		//    pero NO avanza turno dentro de su callback.
		this.performAttack(attacker, target, () => {
			// Limpieza visual tras animación (restaurar tint, etc.), si hace falta.
			// No llamamos aquí a endAction() ni a turnManager.endCurrentAction().
		});

		// 3) Mostrar overlay de batalla. Cuando el overlay termine, en su callback
		//    se invocará turnManager.endCurrentAction().
		await this.startBattleSequenceAsync(attacker, target);
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
			// Falló el ataque
			SoundLib.playSound("miss_SFX", {});
			console.log(`${target.id} esquivó el ataque de ${attacker.id}! (terreno ${terrain.name} AVO+${terrain.avoBonus})`);
			this.animations.animateMissEffect(attacker, target, this.allContainers, this.tileSize, () => {
				// Marcamos que el atacante actuó (aunque falló).
				attacker.hasActed = true;
				onComplete(); // limpieza local (por ej. quitar tint, etc.)
			});
		} else {
			// Hit:
			const isCrit = Math.random() < attacker.criticalChance;
			this.animations.animateAttackEffect(attacker, target, () => {
				// Aplica daño al target
				this.applyDamageWithTerrain(attacker, target, terrain, isCrit);
				// Marcamos que el atacante actuó
				attacker.hasActed = true;

				// Ya no hay contraataque: simplemente llamamos onComplete para limpieza local
				onComplete();
			});
		}
	}

	private applyDamageWithTerrain(attacker: PlayerUnit, target: PlayerUnit, terrain: Terrain, isCrit: boolean): void {
		const rawDamage = attacker.strength;
		const totalDefense = target.defense + terrain.defBonus;
		let damage = Math.max(0, rawDamage - totalDefense);

		if (isCrit) {
			damage *= 2; // o 1.5 si preferís un sistema más balanceado
		}

		target.healthPoints = Math.max(0, target.healthPoints - damage);
		console.log(`${attacker.id} hace ${damage} a ${target.id}. (DEF base ${target.defense} + DEF terreno ${terrain.defBonus})`);

		const yOffset = target.sprite.y - this.tileSize * 0.3;

		if (damage !== 0) {
			const color = isCrit ? 0xffcc00 : 0xff0000; // 💥 amarillo dorado para críticos
			this.allContainers.showFloatingText(`${damage}`, target.sprite.x, yOffset, color);
		} else {
			this.allContainers.showFloatingText(`NO DAMAGE`, target.sprite.x, yOffset, 0xff0000);
		}

		if (target.healthPoints <= 0) {
			console.log(`${target.id} ha sido derrotado.`);
			this.handleUnitDefeat(target);
		}
	}

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

		// Si es jefe enemigo, mostramos victoria
		if (unit.isBoss && unit.isEnemy) {
			console.log("¡Ganaste!");
			// Aquí podrías además disparar lógica adicional de fin de juego, transición, etc.
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
	 * Para IA: realiza el ataque de attacker a target, aplica daño, muestra overlay y marca hasActed,
	 * espera a que el overlay termine antes de resolver.
	 */
	private async enemyPerformAttack(attacker: PlayerUnit, target: PlayerUnit): Promise<void> {
		// Lógica de esquiva / hit / daño: muy similar a performAttack, pero devolviendo Promise en vez de callback.
		// Podrías factorizar: extraer la parte de cálculo de daño en una función asíncrona.

		// 1) Determinar terreno y esquiva
		const tx = target.gridX,
			ty = target.gridY;
		let terrain = Terrain.PLAIN;
		if (ty >= 0 && ty < this.grid.length && tx >= 0 && tx < this.grid[0].length) {
			terrain = Terrain.fromCode(this.grid[ty][tx]);
		}
		const avoidChance = target.avoid + terrain.avoBonus;
		const didMiss = Math.random() < avoidChance;
		if (didMiss) {
			SoundLib.playSound("miss_SFX", {});
			console.log(`${target.id} esquivó el ataque de ${attacker.id}!`);
			// animación de miss:
			await new Promise<void>((res) => {
				this.animations.animateMissEffect(attacker, target, this.allContainers, this.tileSize, () => res());
			});
			// marcar como actuado
			attacker.hasActed = true;
		} else {
			// Hit:
			const isCrit = Math.random() < attacker.criticalChance;
			// animación de ataque:
			await new Promise<void>((res) => {
				this.animations.animateAttackEffect(attacker, target, () => res());
			});
			// aplicar daño:
			this.applyDamageWithTerrain(attacker, target, terrain, isCrit);
			attacker.hasActed = true;
		}

		// 2) Mostrar overlay y esperar:
		await this.startBattleSequenceAsync(attacker, target);

		// 3) (opcional) si target muere, handleUnitDefeat ya se encarga de remover de listas, etc.
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

	public animateAttackAndApplyDamagePromise(attacker: PlayerUnit, target: PlayerUnit): Promise<void> {
		return new Promise((resolve) => {
			// Determinar si es golpe crítico
			const isCrit = Math.random() < attacker.criticalChance;

			this.animations.animateAttackEffect(attacker, target, () => {
				const terrain = Terrain.fromCode(this.grid[target.gridY][target.gridX]);
				this.applyDamageWithTerrain(attacker, target, terrain, isCrit); // 🟡 Pasamos isCrit
				resolve();
			});
		});
	}

	private startAllyTurn(): void {
		this.turnManager.startAllyTurn();

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
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.worldContainer, w, h, 770, 510, ScaleHelper.FIT);
		this.allContainers.worldContainer.x = w / 2;
		this.allContainers.worldContainer.y = h / 2;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiContainer.x = 0;
		this.allContainers.uiContainer.y = 0;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiRightContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiRightContainer.x = w;
		this.allContainers.uiRightContainer.y = h;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiCenterContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiCenterContainer.x = w * 0.5;
		this.allContainers.uiCenterContainer.y = h * 0.5;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.uiLeftContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.allContainers.uiLeftContainer.x = w * 0.1;
		this.allContainers.uiLeftContainer.y = h * 0.9;
		ScaleHelper.setScaleRelativeToIdeal(this.allContainers.pauseContainer, w, h, 1536, 1200, ScaleHelper.FIT);
		this.allContainers.pauseContainer.x = w / 2;
		this.allContainers.pauseContainer.y = h / 2;
	}
}
