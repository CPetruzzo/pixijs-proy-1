/* eslint-disable @typescript-eslint/naming-convention */
import { ColorMatrixFilter, Container, Graphics, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Keyboard } from "../../../engine/input/Keyboard";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";

/**
 * Mejoras realizadas:
 * - Refactor del render en funciones separadas (playfield, pieza activa, preview, clear overlay)
 * - Reuso del ColorMatrixFilter en vez de recrearlo cada frame
 * - Creación del retryButton una sola vez (reutilizable)
 * - Generador de secuencia tetromino usando Fisher-Yates (bag)
 * - Tipado más explícito (Cell, Tetromino)
 * - Mejora en spawnTetromino: comprobación de colisión inmediata -> GAME_OVER
 * - Render de "ghost" (sombra) de la pieza activa
 * - Comentarios y constantes agrupadas
 * - Partículas/efectos distintos según 1/2/3/4 líneas (añadido ahora)
 */

type Cell = string | 0;

interface Tetromino {
	name: string;
	matrix: number[][];
	row: number;
	col: number;
}

enum GameState {
	WAITING_TO_START,
	PLAYING,
	GAME_OVER,
}

export class TetrisScene extends PixiScene {
	/* ----------------------------- Configurables ----------------------------- */
	private readonly CELL_SIZE = 32;
	private readonly CELL_PADDING = 1;
	private readonly ROWS = 20;
	private readonly COLS = 10;

	private readonly INITIAL_DROP_INTERVAL = 500; // ms
	private readonly MIN_DROP_INTERVAL = 50; // ms
	private readonly LINES_PER_LEVEL = 10;
	private readonly SPEED_INCREASE_FACTOR = 0.9;

	private readonly DROP_HITSTOP_DURATION = 100;
	private readonly CLEAR_HITSTOP_DURATION = 1000;

	/* ----------------------------- Containers & layers ----------------------------- */
	private gameContainer: Container = new Container();
	private bgLayer: Graphics = new Graphics();
	private clearLayer: Container = new Container();
	private previewLayer: Graphics = new Graphics();
	private clearPool: Graphics[] = [];
	private clearFilter: ColorMatrixFilter = new ColorMatrixFilter();

	// Particle system
	private particleContainer: Container = new Container();
	private particlePool: Graphics[] = [];
	private readonly MAX_PARTICLES = 300;

	/* ----------------------------- Game model ----------------------------- */
	private playfield: Cell[][] = [];
	private tetrominoSequence: string[] = [];
	private tetrominos: Record<string, number[][]> = {};
	private colors: Record<string, number> = {};

	private active: Tetromino | null = null;
	private next: string | null = null;

	private dropCounter = 0; // ms accumulator
	private dropInterval = this.INITIAL_DROP_INTERVAL;

	private gameState = GameState.WAITING_TO_START;

	/* ----------------------------- Score & progression ----------------------------- */
	private score = 0;
	private linesCleared = 0;
	private level = 1;
	private scoreText: Text;

	/* ----------------------------- HitStop, clears ----------------------------- */
	private hitStopActive = false;
	private hitStopElapsed = 0;
	private hitStopDuration = 0;
	private isClearPhase = false;
	private clearingRows: number[] = [];

	/* ----------------------------- UI / Buttons ----------------------------- */
	private startContainer = new Container();
	private startButton!: Graphics;
	private gameOverContainer = new Container();
	private retryButton!: Graphics;
	private hasLaunchedGameOverAnim = false;

	private buttonContainer = new Container();
	private leftButton!: Graphics;
	private rightButton!: Graphics;
	private rotateButton!: Graphics;
	private dropButton!: Graphics;
	private buttonSize = 60;
	private buttonPressed: Record<string, boolean> = {};

	public static readonly BUNDLES = ["tetris"];

	constructor() {
		super();

		this.addChild(this.gameContainer);

		// Init playfield
		this.playfield = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));

		// Tetromino shapes
		this.tetrominos = {
			I: [
				[0, 0, 0, 0],
				[1, 1, 1, 1],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
			],
			J: [
				[1, 0, 0],
				[1, 1, 1],
				[0, 0, 0],
			],
			L: [
				[0, 0, 1],
				[1, 1, 1],
				[0, 0, 0],
			],
			O: [
				[1, 1],
				[1, 1],
			],
			S: [
				[0, 1, 1],
				[1, 1, 0],
				[0, 0, 0],
			],
			Z: [
				[1, 1, 0],
				[0, 1, 1],
				[0, 0, 0],
			],
			T: [
				[0, 1, 0],
				[1, 1, 1],
				[0, 0, 0],
			],
		};

		this.colors = {
			I: 0x00ffff,
			O: 0xffff00,
			T: 0x800080,
			S: 0x00ff00,
			Z: 0xff0000,
			J: 0x0000ff,
			L: 0xffa500,
		};

		// Precreate clear pool
		for (let i = 0; i < this.ROWS * this.COLS; i++) {
			this.clearPool.push(new Graphics());
		}

		// Precreate particle pool
		for (let i = 0; i < this.MAX_PARTICLES; i++) {
			this.particlePool.push(new Graphics());
		}

		// Add layers to container (z-order)
		this.gameContainer.addChild(this.bgLayer);
		this.gameContainer.addChild(this.clearLayer);
		this.gameContainer.addChild(this.particleContainer); // particles above clear
		this.addChild(this.previewLayer);

		// Score text
		this.scoreText = new Text("", new TextStyle({ fill: "white", fontFamily: "Arial", fontSize: 20, fontWeight: "bold" }));
		this.addChild(this.scoreText);

		// Game Over container hidden by default
		this.gameOverContainer.visible = false;
		this.gameContainer.addChild(this.gameOverContainer);

		// Create reusable UI
		this.createStartScreen();
		this.createRetryButton();
		this.addChild(this.startContainer);

		// Buttons táctiles
		this.createTouchButtons();
		this.addChild(this.buttonContainer);
		this.buttonContainer.visible = false;

		// Filter setup (reused)
		this.clearFilter = new ColorMatrixFilter();

		// Center pivot
		this.gameContainer.pivot.set((this.COLS * this.CELL_SIZE) / 2, (this.ROWS * this.CELL_SIZE) / 2);

		this.setupInputListeners();
	}

	/* ----------------------------- UI creation ----------------------------- */
	private createStartScreen(): void {
		this.startButton = new Graphics();
		this.startButton.beginFill(0x4caf50, 0.9).lineStyle(3, 0x2e7d32).drawRoundedRect(0, 0, 200, 80, 10).endFill();

		const startText = new Text("START GAME", new TextStyle({ fill: "white", fontSize: 24, fontWeight: "bold" }));
		startText.anchor.set(0.5);
		startText.x = 100;
		startText.y = 40;
		this.startButton.addChild(startText);

		this.startButton.interactive = true;
		this.startButton.on("pointerdown", () => this.startGame());

		this.startContainer.addChild(this.startButton);
	}

	private createRetryButton(): void {
		this.retryButton = new Graphics();
		this.retryButton.beginFill(0x2196f3, 0.9).lineStyle(3, 0x1976d2).drawRoundedRect(0, 0, 180, 60, 10).endFill();

		const retryText = new Text("RETRY", new TextStyle({ fill: "white", fontSize: 20, fontWeight: "bold" }));
		retryText.anchor.set(0.5);
		retryText.x = 90;
		retryText.y = 30;
		this.retryButton.addChild(retryText);

		this.retryButton.interactive = true;
		this.retryButton.on("pointerdown", () => this.resetGame());
	}

	private createTouchButtons(): void {
		this.leftButton = new Graphics();
		this.createButton(this.leftButton, "◀", () => this.moveLeft());

		this.rightButton = new Graphics();
		this.createButton(this.rightButton, "▶", () => this.moveRight());

		this.rotateButton = new Graphics();
		this.createButton(this.rotateButton, "↻", () => this.rotatePiece());

		this.dropButton = new Graphics();
		this.createButton(this.dropButton, "▼", () => this.softDrop());

		this.buttonContainer.addChild(this.leftButton, this.rightButton, this.rotateButton, this.dropButton);
	}

	private createButton(button: Graphics, symbol: string, callback: () => void): void {
		const size = this.buttonSize;
		button.clear();
		button.beginFill(0x333333, 0.85).lineStyle(2, 0x666666).drawRoundedRect(0, 0, size, size, 8).endFill();

		const text = new Text(symbol, new TextStyle({ fill: "white", fontSize: 28, fontWeight: "bold" }));
		text.anchor.set(0.5);
		text.x = size / 2;
		text.y = size / 2;
		button.addChild(text);

		button.interactive = true;

		button.on("pointerdown", () => {
			this.buttonPressed[symbol] = true;
			this.animateButtonPress(button, true);
			callback();
		});

		button.on("pointerup", () => {
			this.buttonPressed[symbol] = false;
			this.animateButtonPress(button, false);
		});

		button.on("pointerupoutside", () => {
			this.buttonPressed[symbol] = false;
			this.animateButtonPress(button, false);
		});
	}

	private animateButtonPress(button: Graphics, pressed: boolean): void {
		const scale = pressed ? 0.9 : 1.0;
		const alpha = pressed ? 0.7 : 1.0;

		new Tween(button.scale).to({ x: scale, y: scale }, 100).easing(Easing.Quadratic.Out).start();
		new Tween(button).to({ alpha }, 100).easing(Easing.Quadratic.Out).start();
	}

	/* ----------------------------- Game lifecycle ----------------------------- */
	private startGame(): void {
		this.gameState = GameState.PLAYING;
		this.startContainer.visible = false;
		this.buttonContainer.visible = true;
		SoundLib.playMusic("tetrisBGM");
		this.spawnTetromino();
	}

	private resetGame(): void {
		this.playfield = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
		this.active = null;
		this.next = null;
		this.dropCounter = 0;
		this.dropInterval = this.INITIAL_DROP_INTERVAL;
		this.score = 0;
		this.linesCleared = 0;
		this.level = 1;
		this.tetrominoSequence = [];
		this.hitStopActive = false;
		this.hitStopElapsed = 0;
		this.isClearPhase = false;
		this.clearingRows = [];
		this.hasLaunchedGameOverAnim = false;

		this.gameOverContainer.visible = false;
		this.gameOverContainer.removeChildren();

		this.startGame();
	}

	/* ----------------------------- Scoring & progression ----------------------------- */
	private updateScore(lines: number): void {
		const linePoints = [0, 100, 300, 500, 800];
		this.score += (linePoints[lines] || 0) * this.level;
		this.linesCleared += lines;

		const newLevel = Math.floor(this.linesCleared / this.LINES_PER_LEVEL) + 1;
		if (newLevel > this.level) {
			this.level = newLevel;
			this.dropInterval = Math.max(this.MIN_DROP_INTERVAL, this.INITIAL_DROP_INTERVAL * Math.pow(this.SPEED_INCREASE_FACTOR, this.level - 1));
		}
		this.updateScoreDisplay();
	}

	private updateScoreDisplay(): void {
		this.scoreText.text = `Score: ${this.score}
Level: ${this.level}
Lines: ${this.linesCleared}`;
	}

	/* ----------------------------- Tetromino sequence (bag) ----------------------------- */
	private shuffleBag(): string[] {
		const bag = ["I", "J", "L", "O", "S", "T", "Z"];
		// Fisher-Yates
		for (let i = bag.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = bag[i];
			bag[i] = bag[j];
			bag[j] = tmp;
		}
		return bag;
	}

	private nextTetromino(): string {
		if (this.tetrominoSequence.length === 0) {
			this.tetrominoSequence = this.shuffleBag();
		}
		return this.tetrominoSequence.pop()!;
	}

	private spawnTetromino(): void {
		if (!this.next) {
			this.next = this.nextTetromino();
		}
		const name = this.next;
		const matrix = this.cloneMatrix(this.tetrominos[name]);
		const col = Math.floor(this.COLS / 2) - Math.ceil(matrix[0].length / 2);
		const row = -matrix.length;
		this.active = { name, matrix, row, col };
		this.next = this.nextTetromino();

		// Si al spawn ya colisiona -> Game Over
		if (!this.isValidMove(this.active.matrix, this.active.row, this.active.col)) {
			this.gameState = GameState.GAME_OVER;
			return;
		}
	}

	private cloneMatrix(mat: number[][]): number[][] {
		return mat.map((r) => r.slice());
	}

	private rotate(matrix: number[][]): number[][] {
		const N = matrix.length - 1;
		return matrix.map((row, i) => row.map((_v, j) => matrix[N - j][i]));
	}

	private isValidMove(matrix: number[][], row: number, col: number): boolean {
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				if (!matrix[r][c]) {
					continue;
				}
				const x = col + c;
				const y = row + r;
				if (x < 0 || x >= this.COLS || y >= this.ROWS) {
					return false;
				}
				if (y >= 0 && this.playfield[y][x]) {
					return false;
				}
			}
		}
		return true;
	}

	/* ----------------------------- Piece placement & clearing ----------------------------- */
	private placeTetromino(): void {
		if (!this.active) {
			return;
		}
		const { matrix, row, col, name } = this.active;

		// Fix piece into playfield
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				if (matrix[r][c] && row + r >= 0) {
					this.playfield[row + r][col + c] = name;
				}
			}
		}

		// Game over if part of piece is above top
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				if (matrix[r][c] && row + r < 0) {
					this.gameState = GameState.GAME_OVER;
					return;
				}
			}
		}

		// Detect full rows
		const rowsToClear: number[] = [];
		for (let r = 0; r < this.ROWS; r++) {
			if (this.playfield[r].every((cell) => cell !== 0)) {
				rowsToClear.push(r);
			}
		}

		if (rowsToClear.length) {
			SoundLib.playSound("sound_big_award", {});
			this.updateScore(rowsToClear.length);
			this.clearingRows = rowsToClear;
			this.startHitStop(true);
			return;
		}

		// Soft drop behaviour
		this.spawnTetromino();
	}

	private startHitStop(isClear: boolean): void {
		this.hitStopActive = true;
		this.hitStopElapsed = 0;
		this.isClearPhase = isClear;
		this.hitStopDuration = isClear ? this.CLEAR_HITSTOP_DURATION : this.DROP_HITSTOP_DURATION;

		// Si es clear, emitimos partículas según la cantidad de líneas
		if (isClear && this.clearingRows.length) {
			this.emitClearEffect(this.clearingRows.length, this.clearingRows);
		}
	}

	/* ----------------------------- Particle effects ----------------------------- */
	private getParticle(): Graphics {
		return this.particlePool.length ? this.particlePool.pop()! : new Graphics();
	}

	private emitClearEffect(lines: number, rows: number[]): void {
		// Configuración por cantidad de líneas
		let countPerRow = 8;
		let sizeRange: [number, number] = [4, 8];
		let distance = 60;
		let duration = 700;
		let palette: number[] = [0xffffff];

		switch (lines) {
			case 1:
				countPerRow = 10;
				sizeRange = [3, 6];
				distance = 40;
				duration = 600;
				palette = [0xffffff, 0xfff59d]; // small sparkle (white-yellow)
				SoundLib.playSound("sound_big_award", {});
				break;
			case 2:
				countPerRow = 14;
				sizeRange = [3, 7];
				distance = 80;
				duration = 750;
				palette = [0x66ffcc, 0x00bfa5]; // greenish
				SoundLib.playSound("sound_big_award", {});
				break;
			case 3:
				countPerRow = 18;
				sizeRange = [4, 9];
				distance = 110;
				duration = 900;
				palette = [0x9c27b0, 0xff9800]; // purple/orange
				SoundLib.playSound("sound_big_award", {});
				break;
			default:
				// 4 lines - big fireworks
				countPerRow = 26;
				sizeRange = [5, 12];
				distance = 160;
				duration = 1100;
				palette = [0xff5252, 0xffc107, 0x448aff, 0x66ff66];
				SoundLib.playSound("sound_big_award", {});
				break;
		}

		// Emitir partículas por cada fila que se está limpiando
		for (const r of rows) {
			const y = r * this.CELL_SIZE + this.CELL_SIZE / 2;
			// Emitir a lo largo del ancho del tablero para que se vea mejor
			const rowCenterX = (this.COLS * this.CELL_SIZE) / 2;

			for (let i = 0; i < countPerRow; i++) {
				const p = this.getParticle();
				p.clear();
				const size = this.randomRange(sizeRange[0], sizeRange[1]);
				const color = palette[Math.floor(Math.random() * palette.length)];
				p.beginFill(color).drawCircle(0, 0, size).endFill();

				// Start position: spread across row
				const startX = rowCenterX + this.randomRange(-this.COLS * 0.15 * this.CELL_SIZE, this.COLS * 0.15 * this.CELL_SIZE);
				p.x = startX;
				p.y = y;
				p.alpha = 1;
				p.scale.set(1);
				this.particleContainer.addChild(p);

				// Compute random direction
				const angle = Math.random() * Math.PI * 2;
				const dist = this.randomRange(distance * 0.5, distance);
				const vx = Math.cos(angle) * dist;
				const vy = Math.sin(angle) * dist - Math.abs((r - this.ROWS / 2) * 0.1); // slight bias

				// Animate particle
				new Tween(p)
					.to({ x: p.x + vx, y: p.y + vy, alpha: 0, scale: 0.3 }, duration)
					.easing(Easing.Quintic.Out)
					.start();

				// Recycle after animation
				setTimeout(() => {
					if (p.parent) {
						p.parent.removeChild(p);
					}
					this.particlePool.push(p);
				}, duration + 50);
			}
		}
	}

	private randomRange(min: number, max: number): number {
		return Math.random() * (max - min) + min;
	}

	/* ----------------------------- Input handling ----------------------------- */
	// eslint-disable-next-line prettier/prettier
	private setupInputListeners(): void { }

	private setupInput(): void {
		if (this.gameState !== GameState.PLAYING) {
			return;
		}
		// Left/right justPressed handled by listeners if available
		if (Keyboard.shared.justPressed && Keyboard.shared.isDown("ArrowDown")) {
			this.softDrop();
		}
		if (Keyboard.shared.justPressed && Keyboard.shared.justPressed("ArrowLeft")) {
			this.moveLeft();
		}
		if (Keyboard.shared.justPressed && Keyboard.shared.justPressed("ArrowRight")) {
			this.moveRight();
		}
		if (Keyboard.shared.justPressed && Keyboard.shared.justPressed("ArrowUp")) {
			this.rotatePiece();
		}
		if (Keyboard.shared.justPressed && Keyboard.shared.justPressed("Space")) {
			this.hardDrop();
		}
	}

	private moveLeft(): void {
		if (this.gameState !== GameState.PLAYING) {
			return;
		}
		if (this.active && this.isValidMove(this.active.matrix, this.active.row, this.active.col - 1)) {
			this.active.col--;
		}
	}

	private moveRight(): void {
		if (this.gameState !== GameState.PLAYING) {
			return;
		}
		if (this.active && this.isValidMove(this.active.matrix, this.active.row, this.active.col + 1)) {
			this.active.col++;
		}
	}

	private rotatePiece(): void {
		if (this.gameState !== GameState.PLAYING) {
			return;
		}
		if (!this.active) {
			return;
		}
		const rotated = this.rotate(this.cloneMatrix(this.active.matrix));
		if (this.isValidMove(rotated, this.active.row, this.active.col)) {
			this.active.matrix = rotated;
		}
	}

	private softDrop(): void {
		if (this.gameState !== GameState.PLAYING) {
			return;
		}
		if (this.active && this.isValidMove(this.active.matrix, this.active.row + 1, this.active.col)) {
			this.active.row++;
		} else {
			this.placeTetromino();
		}
	}

	private hardDrop(): void {
		if (this.gameState !== GameState.PLAYING || !this.active) {
			return;
		}
		while (this.isValidMove(this.active.matrix, this.active.row + 1, this.active.col)) {
			this.active.row++;
		}
		this.placeTetromino();
	}

	/* ----------------------------- Rendering ----------------------------- */
	private drawPlayfield(): void {
		this.bgLayer.clear();
		this.bgLayer.lineStyle(1, 0xffffff).drawRect(0, 0, this.COLS * this.CELL_SIZE, this.ROWS * this.CELL_SIZE);

		for (let r = 0; r < this.ROWS; r++) {
			for (let c = 0; c < this.COLS; c++) {
				const cell = this.playfield[r][c];
				if (cell) {
					this.bgLayer
						.beginFill(this.colors[cell])
						.drawRect(c * this.CELL_SIZE, r * this.CELL_SIZE, this.CELL_SIZE - this.CELL_PADDING, this.CELL_SIZE - this.CELL_PADDING)
						.endFill();
				}
			}
		}
	}

	private drawActiveAndGhost(): void {
		if (!this.active) {
			return;
		}
		const { matrix, row, col, name } = this.active;
		// Draw ghost (sombra) below
		let ghostRow = row;
		while (this.isValidMove(matrix, ghostRow + 1, col)) {
			ghostRow++;
		}
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				if (!matrix[r][c]) {
					continue;
				}
				const gx = (col + c) * this.CELL_SIZE;
				const gy = (ghostRow + r) * this.CELL_SIZE;
				// ghost with lower alpha
				this.bgLayer
					.beginFill(this.colors[name], 0.25)
					.drawRect(gx, gy, this.CELL_SIZE - this.CELL_PADDING, this.CELL_SIZE - this.CELL_PADDING)
					.endFill();
			}
		}

		// Draw active piece normally
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				if (!matrix[r][c]) {
					continue;
				}
				const x = (col + c) * this.CELL_SIZE;
				const y = (row + r) * this.CELL_SIZE;
				this.bgLayer
					.beginFill(this.colors[name])
					.drawRect(x, y, this.CELL_SIZE - this.CELL_PADDING, this.CELL_SIZE - this.CELL_PADDING)
					.endFill();
			}
		}
	}

	private drawClearOverlay(): void {
		this.clearLayer.removeChildren();
		if (!this.hitStopActive || !this.isClearPhase || !this.clearingRows.length) {
			this.clearLayer.filters = [];
			return;
		}

		const t = Math.min(this.hitStopElapsed / this.hitStopDuration, 1);
		const blink = Math.sin(t * Math.PI * 2);
		const brightness = 1 + blink * 0.5;
		this.clearFilter.brightness(brightness, false);
		this.clearLayer.filters = [this.clearFilter];

		let poolIdx = 0;
		for (const r of this.clearingRows) {
			for (let c = 0; c < this.COLS; c++) {
				const gCell = this.clearPool[poolIdx++];
				gCell
					.clear()
					.beginFill(this.colors[this.playfield[r][c] as string])
					.drawRect(c * this.CELL_SIZE, r * this.CELL_SIZE, this.CELL_SIZE - this.CELL_PADDING, this.CELL_SIZE - this.CELL_PADDING)
					.endFill();
				this.clearLayer.addChild(gCell);
			}
		}
	}

	private drawPreview(): void {
		this.previewLayer.clear();
		if (!this.next || this.gameState !== GameState.PLAYING) {
			return;
		}
		const mat = this.tetrominos[this.next];
		const color = this.colors[this.next];
		const ps = this.CELL_SIZE - 4;
		const ox = this.COLS * this.CELL_SIZE + 20;
		const oy = 40;
		for (let r = 0; r < mat.length; r++) {
			for (let c = 0; c < mat[r].length; c++) {
				if (mat[r][c]) {
					this.previewLayer
						.beginFill(color)
						.drawRect(ox + c * ps, oy + r * ps, ps, ps)
						.endFill();
				}
			}
		}
	}

	private draw(): void {
		this.drawPlayfield();
		this.drawActiveAndGhost();
		this.drawClearOverlay();
		this.drawPreview();

		if (this.gameState === GameState.GAME_OVER && !this.hasLaunchedGameOverAnim) {
			this.launchGameOverAnim();
		}
	}

	private launchGameOverAnim(): void {
		this.hasLaunchedGameOverAnim = true;
		this.gameOverContainer.removeChildren();

		const text = "GAME OVER";
		const style = new TextStyle({
			fill: "white",
			fontFamily: "Pixelate-Regular",
			fontSize: 48,
			dropShadow: true,
			dropShadowColor: "#000000",
			dropShadowBlur: 4,
			dropShadowDistance: 3,
		});

		const offsetX = (this.COLS * this.CELL_SIZE) / 2 - (text.length * 28) / 2;
		const baseY = (this.ROWS * this.CELL_SIZE) / 2 - 24;

		for (let i = 0; i < text.length; i++) {
			const ch = new Text(text[i], style);
			ch.x = offsetX + i * 28;
			ch.y = baseY + 150;
			ch.alpha = 0;
			this.gameOverContainer.addChild(ch);

			new Tween(ch)
				.to({ y: baseY, alpha: 1 }, 300)
				.delay(i * 100)
				.easing(Easing.Back.Out)
				.start();
		}

		// retry button (already created) - posicionarlo y añadir
		this.retryButton.x = offsetX + (text.length * 28) / 2 - 90;
		this.retryButton.y = baseY + 80;
		this.gameOverContainer.addChild(this.retryButton);

		this.gameOverContainer.visible = true;
	}

	/* ----------------------------- Main update loop ----------------------------- */
	public override update(dt: number): void {
		if (this.gameState === GameState.WAITING_TO_START) {
			return;
		}

		if (this.hitStopActive) {
			this.hitStopElapsed += dt;
			if (this.hitStopElapsed >= this.hitStopDuration) {
				this.hitStopActive = false;
				if (this.isClearPhase) {
					// remove rows + gravity
					const newField = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
					let wr = this.ROWS - 1;
					for (let r = this.ROWS - 1; r >= 0; r--) {
						if (!this.clearingRows.includes(r)) {
							newField[wr--] = this.playfield[r];
						}
					}
					this.playfield = newField;
					this.clearingRows = [];
				}
				this.spawnTetromino();
			}
			this.draw();
			return;
		}

		if (this.gameState === GameState.GAME_OVER) {
			this.draw();
			return;
		}

		this.dropCounter += dt;
		if (this.dropCounter > this.dropInterval) {
			this.dropCounter = 0;
			if (this.active && this.isValidMove(this.active.matrix, this.active.row + 1, this.active.col)) {
				this.active.row++;
			} else {
				this.placeTetromino();
			}
		}

		this.setupInput();
		this.draw();
	}

	/* ----------------------------- Resize ----------------------------- */
	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW * 0.75, newH * 0.75, this.COLS * this.CELL_SIZE, this.ROWS * this.CELL_SIZE, ScaleHelper.FIT);
		this.gameContainer.x = newW / 2;
		this.gameContainer.y = newH / 2 - 20;

		if (this.startButton) {
			this.startButton.x = newW / 2 - 100;
			this.startButton.y = newH / 2 - 40;
		}

		this.scoreText.x = 20;
		this.scoreText.y = 40;

		const margin = 20;
		this.leftButton.x = margin;
		this.leftButton.y = newH - this.buttonSize - margin;

		this.rightButton.x = newW - this.rightButton.width - margin;
		this.rightButton.y = newH - this.buttonSize - margin;

		this.rotateButton.x = newW * 0.5 + margin;
		this.rotateButton.y = newH - this.buttonSize - margin;

		this.dropButton.x = newW * 0.5 - this.buttonSize - margin;
		this.dropButton.y = newH - this.buttonSize - margin;

		ScaleHelper.setScaleRelativeToIdeal(this.previewLayer, newW * 0.5, newH * 0.5, this.COLS * this.CELL_SIZE, this.ROWS * this.CELL_SIZE, ScaleHelper.FIT);
		this.previewLayer.x = 100;
		this.previewLayer.y = 0;
	}
}
