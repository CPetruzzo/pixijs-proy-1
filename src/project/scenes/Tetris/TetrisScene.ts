/* eslint-disable @typescript-eslint/naming-convention */
import { ColorMatrixFilter, Container, Graphics, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Keyboard } from "../../../engine/input/Keyboard";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// import type { GlitchFilter } from "@pixi/filter-glitch";
// import type { CRTFilter } from "@pixi/filter-crt";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";

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
	private gameContainer: Container;
	private playfield: (string | 0)[][];
	private tetrominoSequence: string[] = [];
	private tetrominos: Record<string, number[][]>;
	private colors: Record<string, number>;

	private active: Tetromino | null = null;
	private next: string | null = null;
	private dropCounter = 0;
	private dropInterval = 500; // ms
	private initialDropInterval = 500; // valor inicial para reset

	private cellSize = 32;
	private rows = 20;
	private cols = 10;
	private gameState = GameState.WAITING_TO_START;

	// Score system
	private score = 0;
	private linesCleared = 0;
	private level = 1;
	private readonly LINES_PER_LEVEL = 10; // Modificable: líneas necesarias para subir de nivel
	private readonly SPEED_INCREASE_FACTOR = 0.9; // Modificable: factor de aceleración (0.9 = 10% más rápido)
	private scoreText: Text;

	// HitStop
	private hitStopActive = false;
	private hitStopElapsed = 0;
	private hitStopDuration = 0;
	private readonly DROP_HITSTOP_DURATION = 100;
	private readonly CLEAR_HITSTOP_DURATION = 1000;
	private softDropTriggered = false;
	private clearingRows: number[] = [];
	private isClearPhase = false;

	// rendering layers & pool
	private bgLayer = new Graphics();
	private previewLayer = new Graphics();
	private clearLayer = new Container();
	private clearPool: Graphics[] = [];
	// private glitchFilter: GlitchFilter | null = null;

	// private readonly startLineWidth = 5;
	// private readonly startLineContrast = 0.8;
	// private crt: CRTFilter | null = null;

	// Game state containers
	private gameOverContainer = new Container();
	private gameOverTextChars: Text[] = [];
	private hasLaunchedGameOverAnim = false;
	private retryButton: Graphics;

	private startContainer = new Container();
	private startButton: Graphics;

	// Botones táctiles
	private buttonContainer = new Container();
	private leftButton: Graphics;
	private rightButton: Graphics;
	private rotateButton: Graphics;
	private dropButton: Graphics;
	private buttonSize = 60;
	private buttonPressed: Record<string, boolean> = {};
	public static readonly BUNDLES = ["tetris"];

	constructor() {
		super();

		// main container
		this.gameContainer = new Container();
		this.addChild(this.gameContainer);

		// initialize playfield
		this.playfield = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));

		// tetromino shapes
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

		// colors
		this.colors = {
			I: 0x00ffff,
			O: 0xffff00,
			T: 0x800080,
			S: 0x00ff00,
			Z: 0xff0000,
			J: 0x0000ff,
			L: 0xffa500,
		};

		// pre-create 200 Graphics for clear-pool
		for (let i = 0; i < this.rows * this.cols; i++) {
			this.clearPool.push(new Graphics());
		}

		// agregamos las capas a gameContainer (órden de dibujo)
		this.gameContainer.addChild(this.bgLayer);
		this.gameContainer.addChild(this.clearLayer);
		this.addChild(this.previewLayer);

		// Score text
		this.scoreText = new Text(
			"",
			new TextStyle({
				fill: "white",
				fontFamily: "Arial",
				fontSize: 20,
				fontWeight: "bold",
			})
		);
		this.addChild(this.scoreText);

		// Game over container
		this.gameOverContainer.visible = false;
		this.gameContainer.addChild(this.gameOverContainer);

		// Start container
		this.createStartScreen();
		this.addChild(this.startContainer);

		// center
		this.gameContainer.pivot.set((this.cols * this.cellSize) / 2, (this.rows * this.cellSize) / 2);

		// Crear botones táctiles
		this.createTouchButtons();
		this.addChild(this.buttonContainer);

		// Ocultar botones táctiles al inicio
		this.buttonContainer.visible = false;

		this.setupInput();
	}

	private createStartScreen(): void {
		this.startButton = new Graphics();
		this.startButton.beginFill(0x4caf50, 0.8).lineStyle(3, 0x2e7d32).drawRoundedRect(0, 0, 200, 80, 10).endFill();

		const startText = new Text(
			"START GAME",
			new TextStyle({
				fill: "white",
				fontSize: 24,
				fontWeight: "bold",
			})
		);
		startText.anchor.set(0.5);
		startText.x = 100;
		startText.y = 40;
		this.startButton.addChild(startText);

		this.startButton.interactive = true;
		this.startButton.on("pointerdown", () => {
			this.startGame();
		});

		this.startContainer.addChild(this.startButton);
	}

	private createRetryButton(): void {
		this.retryButton = new Graphics();
		this.retryButton.beginFill(0x2196f3, 0.8).lineStyle(3, 0x1976d2).drawRoundedRect(0, 0, 180, 60, 10).endFill();

		const retryText = new Text(
			"RETRY",
			new TextStyle({
				fill: "white",
				fontSize: 20,
				fontWeight: "bold",
			})
		);
		retryText.anchor.set(0.5);
		retryText.x = 90;
		retryText.y = 30;
		this.retryButton.addChild(retryText);

		this.retryButton.interactive = true;
		this.retryButton.on("pointerdown", () => {
			this.resetGame();
		});
	}

	private startGame(): void {
		this.gameState = GameState.PLAYING;
		this.startContainer.visible = false;
		this.buttonContainer.visible = true;

		// Iniciar música
		SoundLib.playMusic("tetrisBGM");

		// Spawn first tetromino
		this.spawnTetromino();
	}

	private resetGame(): void {
		// Reset all game variables
		this.playfield = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
		this.active = null;
		this.next = null;
		this.dropCounter = 0;
		this.dropInterval = this.initialDropInterval;
		this.score = 0;
		this.linesCleared = 0;
		this.level = 1;
		this.tetrominoSequence = [];

		// Reset flags
		this.hitStopActive = false;
		this.hitStopElapsed = 0;
		this.softDropTriggered = false;
		this.clearingRows = [];
		this.isClearPhase = false;
		this.hasLaunchedGameOverAnim = false;

		// Hide game over screen
		this.gameOverContainer.visible = false;
		this.gameOverContainer.removeChildren();

		// Start game
		this.startGame();
	}

	private updateScore(linesCleared: number): void {
		// Puntos por líneas eliminadas
		const linePoints = [0, 100, 300, 500, 800]; // 0, 1, 2, 3, 4 líneas
		this.score += linePoints[linesCleared] * this.level;
		this.linesCleared += linesCleared;

		// Calcular nuevo nivel
		const newLevel = Math.floor(this.linesCleared / this.LINES_PER_LEVEL) + 1;
		if (newLevel > this.level) {
			this.level = newLevel;
			// Acelerar el juego
			this.dropInterval = Math.max(50, this.initialDropInterval * Math.pow(this.SPEED_INCREASE_FACTOR, this.level - 1));
			// Acelerar música (esto puede variar según tu implementación de SoundLib)
			// SoundLib.setMusicSpeed(1 + (this.level - 1) * 0.1);
		}

		this.updateScoreDisplay();
	}

	private updateScoreDisplay(): void {
		this.scoreText.text = `Score: ${this.score}\nLevel: ${this.level}\nLines: ${this.linesCleared}`;
	}

	private createTouchButtons(): void {
		// Botón izquierda
		this.leftButton = new Graphics();
		this.createButton(this.leftButton, "◀", () => this.moveLeft());

		// Botón derecha
		this.rightButton = new Graphics();
		this.createButton(this.rightButton, "▶", () => this.moveRight());

		// Botón rotar
		this.rotateButton = new Graphics();
		this.createButton(this.rotateButton, "↻", () => this.rotatePiece());

		// Botón bajar rápido
		this.dropButton = new Graphics();
		this.createButton(this.dropButton, "▼", () => this.softDrop());

		this.buttonContainer.addChild(this.leftButton);
		this.buttonContainer.addChild(this.rightButton);
		this.buttonContainer.addChild(this.rotateButton);
		this.buttonContainer.addChild(this.dropButton);
	}

	private createButton(button: Graphics, symbol: string, callback: () => void): void {
		const size = this.buttonSize;

		// Dibujar el botón
		button.beginFill(0x333333, 0.8).lineStyle(2, 0x666666).drawRoundedRect(0, 0, size, size, 8).endFill();

		// Agregar texto/símbolo
		const text = new Text(
			symbol,
			new TextStyle({
				fill: "white",
				fontSize: 28,
				fontWeight: "bold",
			})
		);
		text.anchor.set(0.5);
		text.x = size / 2;
		text.y = size / 2;
		button.addChild(text);

		// Hacer interactivo
		button.interactive = true;

		// Eventos táctiles
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
		if (this.active) {
			const rotated = this.rotate(this.active.matrix);
			if (this.isValidMove(rotated, this.active.row, this.active.col)) {
				this.active.matrix = rotated;
			}
		}
	}

	private softDrop(): void {
		if (this.gameState !== GameState.PLAYING) {
			return;
		}
		if (this.active && this.isValidMove(this.active.matrix, this.active.row + 1, this.active.col)) {
			this.active.row++;
		} else {
			this.softDropTriggered = true;
			this.placeTetromino();
		}
	}

	private getRandomInt(min: number, max: number): number {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private generateSequence(): void {
		const seq = ["I", "J", "L", "O", "S", "T", "Z"];
		while (seq.length) {
			const idx = this.getRandomInt(0, seq.length - 1);
			this.tetrominoSequence.push(seq.splice(idx, 1)[0]);
		}
	}

	private nextTetromino(): string {
		if (!this.tetrominoSequence.length) {
			this.generateSequence();
		}
		return this.tetrominoSequence.pop()!;
	}

	private spawnTetromino(): void {
		if (!this.next) {
			this.next = this.nextTetromino();
		}
		const name = this.next;
		const matrix = this.tetrominos[name];
		const col = Math.floor(this.cols / 2) - Math.ceil(matrix[0].length / 2);
		const row = -matrix.length;
		this.active = { name, matrix, row, col };
		this.next = this.nextTetromino();
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
				if (x < 0 || x >= this.cols || y >= this.rows) {
					return false;
				}
				if (y >= 0 && this.playfield[y][x]) {
					return false;
				}
			}
		}
		return true;
	}

	private placeTetromino(): void {
		if (!this.active) {
			return;
		}
		const { matrix, row, col, name } = this.active;

		// fix piece
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				if (matrix[r][c] && row + r >= 0) {
					this.playfield[row + r][col + c] = name;
				}
			}
		}

		// game over check
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				if (matrix[r][c] && row + r < 0) {
					this.gameState = GameState.GAME_OVER;
					return;
				}
			}
		}

		// detect full rows
		const rowsToClear: number[] = [];
		for (let r = 0; r < this.rows; r++) {
			if (this.playfield[r].every((cell) => cell !== 0)) {
				rowsToClear.push(r);
			}
		}
		if (rowsToClear.length) {
			// Reproducir sonido de líneas eliminadas
			SoundLib.playSound("sound_big_award", {});

			// Actualizar puntaje
			this.updateScore(rowsToClear.length);

			this.clearingRows = rowsToClear;
			this.startHitStop(true);
			return;
		}

		// soft drop hitstop
		if (this.softDropTriggered) {
			this.startHitStop(false);
			this.softDropTriggered = false;
			return;
		}

		this.spawnTetromino();
	}

	private startHitStop(isClear: boolean): void {
		this.hitStopActive = true;
		this.hitStopElapsed = 0;
		this.isClearPhase = isClear;
		this.hitStopDuration = isClear ? this.CLEAR_HITSTOP_DURATION : this.DROP_HITSTOP_DURATION;
	}

	private setupInput(): void {
		if (this.gameState !== GameState.PLAYING) {
			return;
		}

		this.softDropTriggered = false;

		// Mantener el input de teclado existente
		if (Keyboard.shared.justPressed("ArrowLeft")) {
			this.moveLeft();
		}

		if (Keyboard.shared.justPressed("ArrowRight")) {
			this.moveRight();
		}

		if (Keyboard.shared.isDown("ArrowDown")) {
			this.softDrop();
		}

		if (Keyboard.shared.justPressed("ArrowUp")) {
			this.rotatePiece();
		}
	}

	private draw(): void {
		// 1) BG + active piece
		this.bgLayer
			.clear()
			.lineStyle(1, 0xffffff)
			.drawRect(0, 0, this.cols * this.cellSize, this.rows * this.cellSize);

		for (let r = 0; r < this.rows; r++) {
			for (let c = 0; c < this.cols; c++) {
				const cell = this.playfield[r][c];
				if (cell) {
					this.bgLayer
						.beginFill(this.colors[cell])
						.drawRect(c * this.cellSize, r * this.cellSize, this.cellSize - 1, this.cellSize - 1)
						.endFill();
				}
			}
		}

		if (this.active) {
			const { matrix, row, col, name } = this.active;
			for (let r = 0; r < matrix.length; r++) {
				for (let c = 0; c < matrix[r].length; c++) {
					if (matrix[r][c]) {
						this.bgLayer
							.beginFill(this.colors[name])
							.drawRect((col + c) * this.cellSize, (row + r) * this.cellSize, this.cellSize - 1, this.cellSize - 1)
							.endFill();
					}
				}
			}
		}

		// 2) Clear-phase overlay
		this.clearLayer.removeChildren();
		if (this.hitStopActive && this.isClearPhase && this.clearingRows.length) {
			const t = Math.min(this.hitStopElapsed / this.hitStopDuration, 1);
			const blink = Math.sin(t * Math.PI * 2);
			const brightness = 1 + blink * 0.5;
			const cm = new ColorMatrixFilter();
			cm.brightness(brightness, false);

			this.clearLayer.filters = [cm];

			let poolIdx = 0;
			for (const r of this.clearingRows) {
				for (let c = 0; c < this.cols; c++) {
					const gCell = this.clearPool[poolIdx++];
					gCell
						.clear()
						.beginFill(this.colors[this.playfield[r][c] as string])
						.drawRect(c * this.cellSize, r * this.cellSize, this.cellSize - 1, this.cellSize - 1)
						.endFill();
					this.clearLayer.addChild(gCell);
				}
			}
		} else {
			this.clearLayer.filters = [];
		}

		// 3) Preview next
		this.previewLayer.clear();
		if (this.next && this.gameState === GameState.PLAYING) {
			const mat = this.tetrominos[this.next];
			const color = this.colors[this.next];
			const ps = this.cellSize - 4;
			const ox = this.cols * this.cellSize + 20;
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

		// 4) Game Over
		if (this.gameState === GameState.GAME_OVER) {
			// si no lo visibilizamos aún, lo hacemos y lanzamos anim
			if (!this.hasLaunchedGameOverAnim) {
				this.launchGameOverAnim();
			}
		}
	}

	private launchGameOverAnim(): void {
		this.hasLaunchedGameOverAnim = true;
		this.gameOverContainer.removeChildren();
		this.gameOverTextChars = [];

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

		// creamos una Text por letra
		const offsetX = (this.cols * this.cellSize) / 2 - (text.length * 28) / 2;
		const baseY = (this.rows * this.cellSize) / 2 - 24;

		for (let i = 0; i < text.length; i++) {
			const ch = new Text(text[i], style);
			// posición inicial baja
			ch.x = offsetX + i * 28;
			ch.y = baseY + 150;
			ch.alpha = 0;
			this.gameOverContainer.addChild(ch);
			this.gameOverTextChars.push(ch);

			// creamos tween: retraso según índice
			new Tween(ch)
				.to({ y: baseY, alpha: 1 }, 300)
				.delay(i * 100) // 100ms entre letras
				.easing(Easing.Back.Out)
				.start();
		}

		// Crear y agregar botón de retry debajo del texto
		this.createRetryButton();
		this.retryButton.x = offsetX + (text.length * 28) / 2 - 90; // Centrar el botón
		this.retryButton.y = baseY + 80; // Debajo del texto
		this.gameOverContainer.addChild(this.retryButton);

		this.gameOverContainer.visible = true;
	}

	public override update(dt: number): void {
		if (this.gameState === GameState.WAITING_TO_START) {
			return;
		}

		if (this.hitStopActive) {
			this.hitStopElapsed += dt;
			if (this.hitStopElapsed >= this.hitStopDuration) {
				this.hitStopActive = false;

				if (this.isClearPhase) {
					// actuallyClear + gravity
					const newField = Array(this.rows)
						.fill(0)
						.map(() => Array(this.cols).fill(0));
					let wr = this.rows - 1;
					for (let r = this.rows - 1; r >= 0; r--) {
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
				this.softDropTriggered = false;
				this.placeTetromino();
			}
		}

		this.setupInput();
		this.draw();
	}

	public override onResize(newW: number, newH: number): void {
		// Reposicionar el juego
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW * 0.75, newH * 0.75, this.cols * this.cellSize, this.rows * this.cellSize, ScaleHelper.FIT);
		this.gameContainer.x = newW / 2;
		this.gameContainer.y = newH / 2 - 20;

		// Posicionar botón de start
		this.startButton.x = newW / 2 - 100;
		this.startButton.y = newH / 2 - 40;

		// Posicionar score text (a la izquierda, misma altura que preview)
		this.scoreText.x = 20;
		this.scoreText.y = 40;

		// Posicionar botones táctiles
		const margin = 20;
		const buttonSpacing = this.buttonSize;

		// Botones de movimiento (izquierda y derecha) en la parte inferior izquierda
		this.leftButton.x = margin;
		this.leftButton.y = newH - this.buttonSize - margin;

		this.rightButton.x = newW - this.rightButton.width - margin;
		this.rightButton.y = newH - this.buttonSize - margin;

		// Botones de acción (rotar y bajar) en la parte inferior derecha
		this.rotateButton.x = newW * 0.5 + margin;
		this.rotateButton.y = newH - this.buttonSize - margin;

		this.dropButton.x = newW * 0.5 - buttonSpacing - margin;
		this.dropButton.y = newH - this.buttonSize - margin;

		ScaleHelper.setScaleRelativeToIdeal(this.previewLayer, newW * 0.5, newH * 0.5, this.cols * this.cellSize, this.rows * this.cellSize, ScaleHelper.FIT);
		this.previewLayer.x = 100;
		this.previewLayer.y = 0;
	}
}
