// #region IMPORTS
import { Text, TextStyle } from "pixi.js";
import { Container, Graphics, Point, Sprite } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { GamePhase, PhaseManager } from "../Managers/PhaseManager";
import { TurnManager, TurnSide } from "../Managers/TurnManager";
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { PlayerFactory } from "../Utils/PlayerFactory";
import type { PlayerUnit } from "../Data/IUnit";
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AllContainers } from "../Utils/AllContainers";
import { PlayerData } from "../Data/UnitData";
import { PathFinder } from "../Utils/PathFinder";
import { AttackRangeCalculator } from "../Utils/AttackRangeCalculator";
import { Animations } from "../Utils/Animations";
import { EnemyAI } from "../Utils/EnemyAI";
import { InputHandler } from "../Utils/InputHandler";
import { ChoiceMenu } from "../Utils/ChoiceMenu";
import { TurnDisplay } from "../Utils/TurnDisplay";
import { getTerrainColor, Terrain } from "../Utils/Terrain";

import { GridKilme } from "../Grids/GridKilme";
import { BattleOverlay } from "./BattleOverlay";
import { PreviewUnit } from "../PreviewUnit";
import { PhaseOverlay } from "./PhaseOverlay";
// #endregion IMPORTS
export class AuroraQuilmesMapScene extends PixiScene {
	// #region VARIABLES
	private grid: number[][] = [];
	private tileSize = 64;

	public static readonly BUNDLES = ["aurora-latest", "sfx"];

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

	// #region CONSTRUCTOR
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
		this.allContainers.worldContainer.addChild(this.selector);
		this.updateSelectorPosition();

		this.allContainers.worldContainer.addChild(this.allContainers.highlightContainer);

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
		const isOccupied = (x: number, y: number) => this.allyUnits.some((u) => u.gridX === x && u.gridY === y) || this.enemyUnits.some((u) => u.gridX === x && u.gridY === y);
		this.pathFinder = new PathFinder(gridImpl, isOccupied);

		this.attackCalc = new AttackRangeCalculator(
			gridImpl,
			(x, y) => this.allyUnits.find((u) => u.gridX === x && u.gridY === y),
			(x, y) => this.enemyUnits.find((u) => u.gridX === x && u.gridY === y)
		);

		this.turnDisplay = new TurnDisplay();
		this.turnDisplay.x = 10;
		this.turnDisplay.y = 40;
		this.allContainers.uiContainer.addChild(this.turnDisplay);

		this.turnManager = new TurnManager(this.allyUnits, this.enemyUnits, {
			onAllySelectNext: (unit) => {
				// Igual que antes: posicionar selector al siguiente aliado
				if (unit) {
					this.selectorPos.set(unit.gridX, unit.gridY);
					this.updateSelectorPosition();
					this.phaseManager.gamePhase = GamePhase.SELECT;
				}
			},
			onStartEnemyTurn: () => {
				// Primero restaurar apariencia si es necesario
				for (const e of this.enemyUnits) {
					this.playerFactory.restoreUnitAppearance(e);
				}
				for (const u of this.allyUnits) {
					this.playerFactory.restoreUnitAppearance(u);
				}
				// Crear overlay de fase enemigo
				const overlay = new PhaseOverlay(TurnSide.ENEMY);
				// Añadir a tu contenedor de UI central (o donde desees)
				this.allContainers.worldContainer.addChild(overlay);
				// Llamar la animación y, al terminarla, iniciar IA
				overlay.onChangePhase(() => {
					this.startEnemySequence();
				});
			},
			onStartAllyTurn: () => {
				// Primero restaurar apariencia de aliados/enemigos si es necesario
				for (const u of this.allyUnits) {
					this.playerFactory.restoreUnitAppearance(u);
				}
				for (const e of this.enemyUnits) {
					this.playerFactory.restoreUnitAppearance(e);
				}
				// Crear overlay de fase aliado
				const overlay = new PhaseOverlay(TurnSide.ALLY);
				this.allContainers.worldContainer.addChild(overlay);
				overlay.onChangePhase(() => {
					// Al acabar animación, habilitar input aliado
					const first = this.allyUnits.find((u) => !u.hasActed) || null;
					if (first) {
						this.selectorPos.set(first.gridX, first.gridY);
						this.updateSelectorPosition();
						this.updateDebugCellInfo();
					}
					this.phaseManager.gamePhase = GamePhase.SELECT;
				});
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
				await this.enemyPerformAttack(attacker, target);
			}
		);

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
		terrainBG.x = 708;
		terrainBG.y = 460;

		this.unitInfoText = new Text("", new TextStyle({ fill: "#ffffff", dropShadow: true, dropShadowDistance: 2, fontFamily: "Pixelate-Regular", fontSize: 18 }));
		this.unitInfoText.x = 0;
		this.unitInfoText.y = 0;
		this.allContainers.worldContainer.addChild(this.unitInfoText);

		this.unitHealthBarPreview = new Graphics();
		this.allContainers.worldContainer.addChild(this.unitHealthBarPreview);
		this.unitHealthBarPreview.x = 0;
		this.unitHealthBarPreview.y = this.unitInfoText.y + this.unitInfoText.height + this.uiInnerMargin;

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
	// #endregion CONSTRUCTOR
	// #region CHOICES
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
					unit.hasActed = true;
					this.playerFactory.grayOutUnit(unit);

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
				console.log("Ítem: (aún no implementado)");
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
	// #endregion CHOICES

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

	private updateDebugCellInfo(): void {
		const x = this.selectorPos.x,
			y = this.selectorPos.y;
		// Terreno:
		if (this.debugText) {
			this.debugText.text = `Sel: ${x},${y}`;
		}
		if (this.terrainInfoText) {
			const code = this.grid[y]?.[x];
			const terrain = Terrain.fromCode(code);
			this.terrainInfoText.text = `${terrain.name}\n\nDEF: ${terrain.defBonus}\nAVO: ${terrain.avoBonus}`;
			this.terrainInfoText.x = -95;
			this.terrainInfoText.y = 0;
		}
		// Unidad bajo selector?
		const ally = this.allyUnits.find((u) => u.gridX === x && u.gridY === y);
		const enemy = this.enemyUnits.find((u) => u.gridX === x && u.gridY === y);
		const unit = ally ?? enemy ?? null;
		if (this.prevUnit) {
			this.prevUnit.update(unit, this.selector);
		}
	}

	// #region SELECTOR
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
					this.allContainers.clearPathPreview();
					const container = new Container();
					// Índices:
					for (let i = 0; i < pathGrid.length; i++) {
						const node = pathGrid[i];
						if (i === 0) {
							// Omitir origen, o dibujar un indicador de origen si deseas.
							continue;
						}
						const prev = pathGrid[i - 1];
						const px = node.x * this.tileSize + this.tileSize / 2;
						const py = node.y * this.tileSize + this.tileSize / 2;
						if (i === pathGrid.length - 1) {
							// Punta final
							const dx = node.x - prev.x;
							const dy = node.y - prev.y;
							const tip = Sprite.from("tipTexture");
							tip.anchor.set(0.5);
							tip.x = px;
							tip.y = py;
							tip.rotation = Math.atan2(dy, dx) + Math.PI / 2;

							// Después de crear seg:
							const debugCross = new Graphics();
							debugCross.lineStyle(1, 0xff0000);
							debugCross.drawCircle(0, 0, 4);
							tip.addChild(debugCross);
							// Luego verás un círculo rojo en el punto de anclaje del sprite.

							// ajustar escala si es necesario:
							const scaleTip = (this.tileSize * 0.8) / tip.width;
							tip.scale.set(scaleTip);
							container.addChild(tip);
						} else {
							// Intermedio: determinar recto o curva
							const next = pathGrid[i + 1];
							const dx1 = node.x - prev.x;
							const dy1 = node.y - prev.y;
							const dx2 = next.x - node.x;
							const dy2 = next.y - node.y;

							// Si misma dirección (o ambas horizontales o ambas verticales): tramo recto
							if ((dx1 === dx2 && dy1 === dy2) || (dx1 === -dx2 && dy1 === -dy2)) {
								// Recto
								// Posición: medio entre prev y node:
								const seg = Sprite.from("straightTexture");
								seg.anchor.set(0.5);
								seg.x = px;
								seg.y = py;
								seg.rotation = Math.atan2(dy1, dx1) + Math.PI / 2;
								const scaleSeg = (this.tileSize * 0.8) / seg.width;
								seg.scale.set(scaleSeg);
								container.addChild(seg);

								// Después de crear seg:
								const debugCross = new Graphics();
								debugCross.lineStyle(1, 0xff0000);
								debugCross.drawCircle(0, 0, 4);
								seg.addChild(debugCross);
								// Luego verás un círculo rojo en el punto de anclaje del sprite.
							} else {
								// Después de haber calculado dx1,dy1 y dx2,dy2:
								const midX = node.x * this.tileSize + this.tileSize / 2;
								const midY = node.y * this.tileSize + this.tileSize / 2;
								const curve = Sprite.from("curveTexture");

								// Centrar pivot en la parte visible, por si la textura no tiene anchor perfectamente centrado:
								{
									const b = curve.getLocalBounds();
									curve.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
								}

								curve.x = midX;
								curve.y = midY;

								// Suponiendo que ‘curveTexture’ base conecta up (0,-1) → right (1,0):
								let rotation = 0;
								if (dx1 === 0 && dy1 === -1 && dx2 === 1 && dy2 === 0) {
									// up → right: caso base, no rotar
									rotation = -Math.PI / 2; // DONE
								} else if (dx1 === 1 && dy1 === 0 && dx2 === 0 && dy2 === 1) {
									// right → down: rota +90° (π/2) si la textura base es up→right
									rotation = 0;
								} else if (dx1 === 0 && dy1 === 1 && dx2 === -1 && dy2 === 0) {
									// down → left: rota π (180°)
									rotation = Math.PI / 2;
								} else if (dx1 === -1 && dy1 === 0 && dx2 === 0 && dy2 === -1) {
									// left → up: rota -π/2 (o +3π/2)
									rotation = -Math.PI; // DONE
								} else if (dx1 === 0 && dy1 === -1 && dx2 === -1 && dy2 === 0) {
									// up → left: curva “espejo” de base: rotar -90° desde base up→right
									rotation = 0; // DONE
								} else if (dx1 === -1 && dy1 === 0 && dx2 === 0 && dy2 === 1) {
									// left → down: rotar +90° desde up→right? Depende de base;
									// de up→right a left→down es una curva simétrica: sería +Math.PI/2 desde base?
									// Pero más consistente es cubrir con las cuatro combos “canónicas”:
									// Ya tratamos left→up; up→right; right→down; down→left.
									// Si ves left→down u otro orden, revisa si tu pathfinder puede generar ese caso
									// (puede ser parte de un U-turn). Si aparece, trátalo según tu asset.
									rotation = -Math.PI / 2; // DONE
								} else if (dx1 === 1 && dy1 === 0 && dx2 === 0 && dy2 === -1) {
									// right → up: curva inversa de base up→right: rotar π (o 180°)?
									rotation = Math.PI / 2; // ajustar tras probar
								} else if (dx1 === 0 && dy1 === 1 && dx2 === 1 && dy2 === 0) {
									// down → right: esto a veces no aparece en path normal sin retroceder,
									// pero si aparece, rota ???
									rotation = -Math.PI; // o según sea necesario
								} else {
									// Caso no contemplado explícitamente: como fallback, no dibujar o dibujar straight o log
									console.warn(`Curva no contemplada dx1,dy1 = ${dx1},${dy1}, dx2,dy2 = ${dx2},${dy2}`);
									// Podrías omitir: continue;
								}

								curve.rotation = rotation;

								// Escala para ajustar al tile:
								const scaleCurve = (this.tileSize * 0.8) / curve.width; // o /curve.height según orientación base
								curve.scale.set(scaleCurve);

								container.addChild(curve);
							}
						}
					}
					this.allContainers.worldContainer.addChild(container);
					this.allContainers.pathPreviewContainer = container;
				}
			} else {
				this.allContainers.clearPathPreview();
			}
		}
	}

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

	private clearAttackRange(): void {
		this.allContainers.attackHighlightContainer.removeChildren();
		this.attackRangeCells.clear();
	}

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

	// #endregion SELECTOR

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
	 * Muestra el BattleOverlay para attacker vs defender y retorna una Promise que se resuelve cuando termine el overlay.
	 * Calcula didMiss e isCrit, y en onHit aplica el daño (con tu applyDamageWithTerrain).
	 */
	private startBattleSequenceAsync(attacker: PlayerUnit, defender: PlayerUnit): Promise<void> {
		return new Promise((resolve) => {
			if (this.battleOverlay) {
				resolve();
				return;
			}
			// Calcular hit/miss/crit como ya hacías...
			const tx = defender.gridX,
				ty = defender.gridY;
			let terrain = Terrain.PLAIN;
			if (ty >= 0 && ty < this.grid.length && tx >= 0 && tx < this.grid[0].length) {
				terrain = Terrain.fromCode(this.grid[ty][tx]);
			}
			const avoidChance = defender.avoid + terrain.avoBonus;
			const didMiss = Math.random() < avoidChance;
			const isCrit = !didMiss && Math.random() < attacker.criticalChance;

			const onHit = (): void => {
				this.applyDamageWithTerrain(attacker, defender, terrain, isCrit);
				attacker.hasActed = true;
				this.playerFactory.grayOutUnit(attacker);
			};
			const onBattleComplete = (): void => {
				if (this.battleOverlay) {
					this.battleOverlay.parent?.removeChild(this.battleOverlay);
					this.battleOverlay = null;
				}
				resolve();
			};
			const attackerOnLeft = !attacker.isEnemy;
			const attackDuration = attackerOnLeft ? 1.5 : 0.5;
			const overlay = new BattleOverlay({
				attackerAnimator: attacker.battleAnimator,
				defenderAnimator: defender.battleAnimator,
				attackerUnit: attacker,
				defenderUnit: defender,
				isCrit,
				didMiss,
				attackerOnLeft,
				attackDuration,
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
			this.playerFactory.grayOutUnit(enemy);

			// opcional: podrías esperar un pequeño delay entre acciones
		}
		// Al terminar IA de todos:
		this.turnManager.startAllyTurn();
	}

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
			this.playerFactory.grayOutUnit(unit);

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
				this.playerFactory.grayOutUnit(attacker);

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
				this.playerFactory.grayOutUnit(attacker);

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
			this.playerFactory.grayOutUnit(attacker);
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
			this.playerFactory.grayOutUnit(attacker);
		}

		// 2) Mostrar overlay y esperar:
		await this.startBattleSequenceAsync(attacker, target);

		// 3) (opcional) si target muere, handleUnitDefeat ya se encarga de remover de listas, etc.
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

	private skipAttack(): void {
		console.log("Salto fase de ataque");
		this.endAction();
	}

	private endAction(): void {
		if (this.selectedUnit) {
			this.selectedUnit.hasActed = true;
			this.playerFactory.grayOutUnit(this.selectedUnit);
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

	public override update(dt: number): void {
		if (this.battleOverlay) {
			this.battleOverlay.update(dt);
		}
		if (this.inBattle) {
			return;
		}

		this.followPath(dt);

		if (this.turnManager.getCurrentSide() === TurnSide.ALLY) {
			this.inputHandler.update(this.phaseManager.gamePhase);
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

	// #region RESIZE
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
	// #endregion RESIZE
}
