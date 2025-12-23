import { Graphics, Container, Point } from "pixi.js";
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { PathWalker } from "../../engine/utils/PathWalker";
import { PathfindingManager } from "../../engine/utils/PathFindingManager";
import { ScaleHelper } from "../../engine/utils/ScaleHelper"; // Asegúrate de importar esto

export class AStarScene extends PixiScene {
	private pathWalker: PathWalker | null = null;
	private grid: number[][] = [];
	private tileSize: number = 50;

	// CAMBIO 1: Usamos Point en lugar de Node, o simplemente null si no necesitas guardar el estado
	private startPoint: Point | null = null;
	private goalPoint: Point | null = null;

	private player: Graphics | null = null;
	private gameContainer: Container = new Container();
	private targetTileOutline: Graphics;

	constructor() {
		super();
		this.grid = this.createGrid();
		this.addChild(this.gameContainer);

		this.createBackground();
		// CAMBIO 2: Inicializar el gráfico del outline aquí para evitar errores
		this.targetTileOutline = new Graphics();
		this.gameContainer.addChild(this.targetTileOutline);
		this.createPlayer();
	}

	private createGrid(): number[][] {
		const rows = 10;
		const cols = 10;
		const grid = new Array(rows).fill(0).map(() => new Array(cols).fill(0));

		// Obstáculos
		grid[3][3] = 1;
		grid[4][3] = 1;
		grid[5][3] = 1;
		grid[6][6] = 1;
		grid[6][7] = 1;
		grid[7][6] = 1;
		grid[7][8] = 1;
		grid[8][6] = 1;
		grid[9][7] = 1;
		return grid;
	}

	private createBackground(): void {
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				const tile = new Graphics();
				if (this.grid[x][y] === 1) {
					tile.beginFill(0xff0000);
				} else {
					tile.beginFill(0x0000ff);
				}
				tile.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
				tile.endFill();
				this.gameContainer.addChild(tile);

				tile.eventMode = "static";
				tile.on("pointerdown", () => {
					this.onTileClick(x, y);
				});
			}
		}
	}

	private createPlayer(): void {
		this.player = new Graphics();
		this.player.beginFill(0x00ff00);
		this.player.drawRect(0, 0, this.tileSize, this.tileSize);
		this.player.endFill();
		this.player.x = 0;
		this.player.y = 0;
		this.gameContainer.addChild(this.player);

		// Inicializar el Walker. Velocidad 5 pixeles por frame (ajustar según necesidad)
		this.pathWalker = new PathWalker(this.player, { smoothUpdates: false, tileSize: this.tileSize, speed: 5 });

		// Inicializamos outline en la posición del jugador
		this.updateOutline(0, 0);
	}

	private onTileClick(x: number, y: number): void {
		if (!this.player) {
			return;
		}

		// Calcular inicio basado en posición actual del player (convertido a coordenadas de grilla)
		const startX = Math.floor(this.player.x / this.tileSize);
		const startY = Math.floor(this.player.y / this.tileSize);

		this.startPoint = new Point(startX, startY);
		this.goalPoint = new Point(x, y);

		// 1. SOLICITAR EL PATH AL MANAGER
		const path = PathfindingManager.getInstance().findPath(this.grid, this.startPoint, this.goalPoint);

		if (path) {
			this.updateOutline(x, y);

			// 2. DARLE EL PATH AL WALKER
			this.pathWalker?.setPath(path, () => {
				console.log("Player llegó al destino!");
			});
		} else {
			console.log("Camino bloqueado o inválido");
		}
	}

	private updateOutline(x: number, y: number): void {
		// Como ya la instanciamos en el constructor, solo limpiamos y dibujamos
		this.targetTileOutline.clear();
		this.targetTileOutline.lineStyle(3, 0x00ff00);
		this.targetTileOutline.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
	}

	public override update(dt: number): void {
		if (this.pathWalker) {
			this.pathWalker.update(dt);
		}
	}

	// CAMBIO 3: Es importante mantener el resize para que no se rompa la visualización al cambiar tamaño de ventana
	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 720, 720, ScaleHelper.FIT);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;
		const containerBounds = this.gameContainer.getLocalBounds();
		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);
	}
}
