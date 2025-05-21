/* eslint-disable @typescript-eslint/naming-convention */
import { ColorMatrixFilter, Container, Graphics, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Keyboard } from "../../../engine/input/Keyboard";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// import type { GlitchFilter } from "@pixi/filter-glitch";
// import type { CRTFilter } from "@pixi/filter-crt";
import { Easing, Tween } from "tweedle.js";

interface Tetromino {
	name: string;
	matrix: number[][];
	row: number;
	col: number;
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

	private cellSize = 32;
	private rows = 20;
	private cols = 10;
	private gameOver = false;

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

	// nuevo contenedor para el Game Over
	private gameOverContainer = new Container();
	private gameOverTextChars: Text[] = [];
	private hasLaunchedGameOverAnim = false;

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

		// 5) agregamos las capas a gameContainer (órden de dibujo)
		this.gameContainer.addChild(this.bgLayer);
		this.gameContainer.addChild(this.clearLayer);
		this.gameContainer.addChild(this.previewLayer);
		// y el contenedor de game over (invisible al inicio)
		this.gameOverContainer.visible = false;
		this.gameContainer.addChild(this.gameOverContainer);

		// center
		this.gameContainer.pivot.set((this.cols * this.cellSize) / 2, (this.rows * this.cellSize) / 2);

		// start
		this.spawnTetromino();
		this.setupInput();
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
					this.gameOver = true;
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
		this.softDropTriggered = false;

		if (Keyboard.shared.justPressed("ArrowLeft")) {
			if (this.active && this.isValidMove(this.active.matrix, this.active.row, this.active.col - 1)) {
				this.active.col--;
			}
		}

		if (Keyboard.shared.justPressed("ArrowRight")) {
			if (this.active && this.isValidMove(this.active.matrix, this.active.row, this.active.col + 1)) {
				this.active.col++;
			}
		}

		if (Keyboard.shared.isDown("ArrowDown")) {
			if (this.active && this.isValidMove(this.active.matrix, this.active.row + 1, this.active.col)) {
				this.active.row++;
			} else {
				this.softDropTriggered = true;
				this.placeTetromino();
			}
		}

		if (Keyboard.shared.justPressed("ArrowUp")) {
			if (this.active) {
				const rotated = this.rotate(this.active.matrix);
				if (this.isValidMove(rotated, this.active.row, this.active.col)) {
					this.active.matrix = rotated;
				}
			}
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
		if (this.next) {
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
		if (this.gameOver) {
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

		this.gameOverContainer.visible = true;
	}

	public override update(dt: number): void {
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

		if (this.gameOver) {
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
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW * 0.85, newH * 0.85, this.cols * this.cellSize, this.rows * this.cellSize, ScaleHelper.FIT);
		this.gameContainer.x = newW / 2;
		this.gameContainer.y = newH / 2;
	}
}
