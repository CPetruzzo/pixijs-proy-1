import type { Point } from "pixi.js";
import { AnimatedSprite, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Enemy } from "../models/Enemy";
import { Tower } from "../models/Tower";
import { Grid } from "../utils/Grid";
import { ScaleHelper } from "../../../../engine/utils/ScaleHelper";
import { GameConfig } from "../game/GameConfig";
import { GameStats } from "../utils/GameStats";
import { UIContainer } from "../ui/UIContainer";
import { ProjectileManager } from "../utils/ProjectileManager";
import { Manager } from "../../../..";
import { TowerDefenseNameInputPopUp } from "./TowerDefenseNameInputPopUp";
import { RestartButton } from "../ui/RestartButton";
import { addGoToMenuButton } from "../../../../utils/GoToMenuButton";
import { DEBUG } from "../../../../flags";
import { TowerDefenseGameOverScene } from "./TowerDefenseGameOverScene";

enum GameState {
	WAITING_TO_START,
	PLAYING,
	PAUSED,
	GAME_OVER,
	RESTARTING,
}

export class TowerDefenseScene extends PixiScene {
	public static readonly BUNDLES = ["towerdefense"];
	private grid: number[][];
	private tileSize: number = GameConfig.tileSize;
	private towerCost: number = GameConfig.towerCost;
	private gameStats: GameStats = new GameStats(GameConfig.initialPoints);
	private enemies: Enemy[] = [];
	private towers: Tower[] = [];

	private lastSpawnTime: number = 0;

	private gameContainer: Container = new Container();
	private gridContainer: Container = new Container(); // ← NUEVO: Container para el grid y todo lo del juego
	private uiLeftContainer: UIContainer = new UIContainer();
	private uiRightContainer: Container = new Container();

	private gameState: GameState = GameState.WAITING_TO_START;

	public static instance: TowerDefenseScene;
	private startWaveButton: Container = new Container(); // ← Nuevo contenedor para el botón

	constructor() {
		super();

		// ✅ Agregar gridContainer al gameContainer
		this.gameContainer.name = "GAMECONTAINER";
		this.gridContainer.name = "GRIDCONTAINER";

		this.grid = Grid.createGridWithObstacles(GameConfig.gridWidth, GameConfig.gridHeight);
		this.addChild(this.gameContainer);
		this.gameContainer.addChild(this.gridContainer);
		this.addChild(this.uiLeftContainer, this.uiRightContainer);

		this.createBackground();

		Grid.initializeWalkableCells();
		Grid.initializeOccupiedCells();
		Grid.initializeWoodTiles(this.grid);

		this.setupClickListener();

		RestartButton.createRestartButton(this.uiRightContainer, () => this.cleanupBeforeRestart());

		if (DEBUG) {
			addGoToMenuButton(this);
		}

		this.centerGridContainer();
		this.createStartWaveButton();
	}

	private createStartWaveButton(): void {
		// Crear sprite del botón (puedes reemplazar con tu sprite)
		const buttonBg = new Graphics();
		buttonBg.beginFill(0x00ff00);
		buttonBg.drawRoundedRect(0, 0, 200, 60, 10);
		buttonBg.endFill();
		buttonBg.beginFill(0x00cc00);
		buttonBg.drawRoundedRect(0, 55, 200, 5, 2);
		buttonBg.endFill();

		// Texto del botón
		const buttonText = new Text("START WAVE", {
			fontFamily: "Arial",
			fontSize: 24,
			fontWeight: "bold",
			fill: 0xffffff,
		});
		buttonText.anchor.set(0.5);
		buttonText.x = 100;
		buttonText.y = 30;

		// Agregar al contenedor del botón
		this.startWaveButton.addChild(buttonBg, buttonText);
		this.startWaveButton.pivot.set(100, 30);

		this.startWaveButton.x = 25;
		this.startWaveButton.y = 445;
		// Hacer el botón interactivo
		this.startWaveButton.eventMode = "static";
		this.startWaveButton.cursor = "pointer";

		// Efectos hover
		this.startWaveButton.on("pointerover", () => {
			this.startWaveButton.scale.set(1.05);
		});

		this.startWaveButton.on("pointerout", () => {
			this.startWaveButton.scale.set(1.0);
		});

		// Click handler
		this.startWaveButton.on("pointertap", () => {
			this.startGame();
		});

		// Agregar a la escena (encima de todo)
		this.gameContainer.addChild(this.startWaveButton);
	}

	private startGame(): void {
		// Cambiar el estado a PLAYING
		this.gameState = GameState.PLAYING;

		// Inicializar el tiempo de spawn
		this.lastSpawnTime = Date.now();

		// Ocultar el botón con una pequeña animación
		this.startWaveButton.eventMode = "none";

		// Opcional: animar la salida del botón
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const fadeOut = () => {
			this.startWaveButton.alpha -= 0.1;
			if (this.startWaveButton.alpha <= 0) {
				this.removeChild(this.startWaveButton);
			} else {
				requestAnimationFrame(fadeOut);
			}
		};
		fadeOut();
	}

	private centerGridContainer(): void {
		// ✅ Calcular bounds reales del contenido
		const bounds = this.gridContainer.getLocalBounds();

		// Centrar usando pivot basado en el contenido real
		this.gridContainer.pivot.set(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);

		this.gridContainer.x = 20;
		this.gridContainer.y = 0;
	}

	public cleanupBeforeRestart(): void {
		// Limpiar enemigos
		this.enemies.forEach((enemy) => {
			enemy.sprite.destroy();
		});
		this.enemies = [];

		// Limpiar torres
		this.towers.forEach((tower) => {
			tower.animatedSprite.destroy();
		});
		this.towers = [];

		// Limpiar proyectiles
		ProjectileManager.reset();

		// Elimina hijos del GRID container (no del game container)
		this.gridContainer.removeChildren();
		this.uiLeftContainer.removeChildren();
		this.uiRightContainer.removeChildren();

		// Elimina todos los listeners
		this.gameContainer.removeAllListeners();
		this.uiLeftContainer.removeAllListeners();
		this.uiRightContainer.removeAllListeners();

		this.towerCost = 50;
		this.gameStats = new GameStats(GameConfig.initialPoints);
	}

	private addFlagAtEndPoint(x: number, y: number): void {
		const animatedSprite = new AnimatedSprite([Texture.from("1"), Texture.from("2"), Texture.from("3"), Texture.from("4"), Texture.from("5"), Texture.from("6")], true);

		// ✅ Agregar al gridContainer
		this.gridContainer.addChild(animatedSprite);

		animatedSprite.anchor.set(0.5);
		animatedSprite.x = x * this.tileSize + this.tileSize / 2; // Sin offset!
		animatedSprite.y = y * this.tileSize + this.tileSize / 2; // Sin offset!
		animatedSprite.animationSpeed = 0.1;
		animatedSprite.play();
	}

	private createBackground(): void {
		const rows = GameConfig.gridHeight - 1;
		const cols = GameConfig.gridWidth - 1;
		const start: [number, number] = [0, 0];
		const end: [number, number] = [cols - 1, rows - 1];

		const bg = Sprite.from("mainBG2");
		bg.anchor.set(0.5);
		bg.x = 0;
		bg.y = 0;
		this.gameContainer.addChildAt(bg, 0); // El BG va en gameContainer, no en gridContainer

		this.grid = Grid.createMaze(rows, cols, start, end);
		// ✅ Pasar gridContainer en lugar de gameContainer
		Grid.drawGrid(this.grid, this.tileSize, this.gridContainer);

		this.addFlagAtEndPoint(end[0], end[1]);
	}

	private setupClickListener(): void {
		this.gameContainer.eventMode = "static";

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const handleClick = (event: { data: { getLocalPosition: (arg0: any) => Point } }) => {
			// ✅ Obtener posición relativa al gridContainer
			const position = event.data.getLocalPosition(this.gridContainer);
			const tileX = Math.floor(position.x / this.tileSize);
			const tileY = Math.floor(position.y / this.tileSize);

			const clickedTower = this.towers.find((t) => t.x === tileX && t.y === tileY);
			if (clickedTower) {
				this.tryUpgradeTower(clickedTower);
			} else if (Grid.isTileEmpty(tileX, tileY)) {
				Tower.addTower(
					tileX,
					tileY,
					this.towers,
					this.gridContainer, // ✅ Pasar gridContainer
					this.gameStats,
					this.towerCost,
					this.tileSize,
					(newCost) => {
						this.towerCost = newCost;
					}
				);
			} else {
				console.log("Ocupado.");
			}
		};

		this.gameContainer.on("rightclick", handleClick);
		this.gameContainer.on("pointerdown", handleClick);
	}

	private tryUpgradeTower(clickedTower: Tower): void {
		const adjacentOffsets = [
			{ dx: 1, dy: 0 },
			{ dx: -1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: 0, dy: -1 },
		];

		for (const offset of adjacentOffsets) {
			const adjacentTower = this.towers.find((t) => t.x === clickedTower.x + offset.dx && t.y === clickedTower.y + offset.dy && t.level === clickedTower.level);

			if (adjacentTower) {
				if (clickedTower.level < GameConfig.towerConfig.maxLevel) {
					this.upgradeTower(clickedTower, adjacentTower);
					return;
				} else {
					console.log("no more lvls to upgrade");
				}
			}
		}

		console.log("No hay torres contiguas del mismo nivel para mejorar.");
	}

	private upgradeTower(baseTower: Tower, mergedTower: Tower): void {
		baseTower.upgrade();
		this.towers = this.towers.filter((t) => t !== mergedTower);
		this.gridContainer.removeChild(mergedTower.animatedSprite); // ✅ Remover del gridContainer
		console.log(`Torre en (${baseTower.x}, ${baseTower.y}) mejorada a nivel ${baseTower.level}`);
		Grid.occupiedCells[mergedTower.y][mergedTower.x] = false;
	}

	public override update(delta: number): void {
		// ✅ No hacer nada si no estamos jugando
		if (this.gameState !== GameState.PLAYING) {
			return;
		}

		const now = Date.now();

		if (now - this.lastSpawnTime > GameConfig.spawnInterval) {
			// ✅ Pasar gridContainer
			Enemy.spawnEnemy(this.grid, this.enemies, this.gridContainer, this.gameStats, GameConfig.tileSize);
			this.lastSpawnTime = now;
		}

		// ✅ Pasar gridContainer
		ProjectileManager.updateProjectiles(this.gridContainer, delta);

		this.enemies.forEach((enemy, index) => {
			enemy.update();

			const rows = GameConfig.gridHeight - 1;
			const cols = GameConfig.gridWidth - 1;

			if (enemy.isDefeated()) {
				this.enemies.splice(index, 1);
				this.gridContainer.removeChild(enemy.sprite); // ✅ Remover del gridContainer

				this.gameStats.addPoints(GameConfig.pointsPerKill[enemy.getEnemyIndex()]);
				this.gameStats.addScore(GameConfig.pointsPerKill[enemy.getEnemyIndex()]);
				console.log(`Enemigo derrotado. Puntos actuales: ${this.gameStats.getPoints()}`);
			}

			if (!enemy.isDefeated()) {
				if (enemy.getCurrentPosition().x === cols - 1 && enemy.getCurrentPosition().y === rows - 1) {
					this.gameState = GameState.GAME_OVER;
					console.log("Game Over!");
					Manager.changeScene(TowerDefenseGameOverScene);
					return;
				}
			}
		});

		// ✅ Pasar gridContainer
		this.towers.forEach((tower) => tower.update(delta, this.enemies, this.gridContainer));

		this.uiLeftContainer.updateUI(this.gameStats, this.towerCost, UIContainer.calculateTotalDamage(this.towers));
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, GameConfig.idealWidth * 1.37, GameConfig.idealHeight * 1.37, ScaleHelper.FIT);
		this.gameContainer.x = newW * 0.5;
		this.gameContainer.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiRightContainer.x = newW;
		this.uiRightContainer.y = 0;
	}

	public async openTowerDefenseInputPopup(): Promise<void> {
		try {
			const popupInstance = await Manager.openPopup(TowerDefenseNameInputPopUp);
			if (popupInstance instanceof TowerDefenseNameInputPopUp) {
				popupInstance.showButtons();
				popupInstance.on("HIGHSCORE_NAME_READY", () => {
					console.log("cerrate loco");
				});
			}
		} catch (error) {
			console.error("Error opening settings popup:", error);
		}
	}
}
