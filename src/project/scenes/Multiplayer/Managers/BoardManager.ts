import type { Container } from "pixi.js";
import { Graphics, Text } from "pixi.js";

export class BoardManager {
	private board: string[][];
	private cells: Graphics[][];
	private backgroundContainer: Container;
	public isGameActive: boolean;

	constructor(container: Container) {
		this.board = [
			["", "", ""],
			["", "", ""],
			["", "", ""],
		];
		this.cells = [];
		this.backgroundContainer = container;
		this.isGameActive = true;
	}

	public drawBoard(onCellClick: (row: number, col: number) => void): void {
		const cellSize = 100;
		for (let row = 0; row < 3; row++) {
			this.cells[row] = [];
			for (let col = 0; col < 3; col++) {
				const cell = new Graphics();
				cell.lineStyle(2, 0x000000, 1);
				cell.beginFill(0xffffff);
				cell.drawRect(col * cellSize, row * cellSize, cellSize, cellSize);
				cell.endFill();
				cell.interactive = true;
				cell.on("click", () => onCellClick(row, col));

				this.cells[row][col] = cell;
				this.backgroundContainer.addChild(cell);

				if (this.board[row][col]) {
					this.drawSymbol(cell, this.board[row][col]);
				}
			}
		}
	}

	public updateBoard(row: number, col: number, symbol: string): void {
		this.board[row][col] = symbol;
		this.drawSymbol(this.cells[row][col], symbol);
	}

	private drawSymbol(cell: Graphics, player: string): void {
		const symbol = new Text(player, { fontSize: 64, fill: player === "X" ? 0xff0000 : 0x0000ff });
		symbol.anchor.set(0.5);
		const bounds = cell.getBounds();
		symbol.x = bounds.x + bounds.width / 2;
		symbol.y = bounds.y + bounds.height / 2;
		this.backgroundContainer.addChild(symbol);
	}

	public checkWinner(): string | null {
		const winningCombinations = [
			[
				[0, 0],
				[0, 1],
				[0, 2],
			],
			[
				[1, 0],
				[1, 1],
				[1, 2],
			],
			[
				[2, 0],
				[2, 1],
				[2, 2],
			], // Rows
			[
				[0, 0],
				[1, 0],
				[2, 0],
			],
			[
				[0, 1],
				[1, 1],
				[2, 1],
			],
			[
				[0, 2],
				[1, 2],
				[2, 2],
			], // Columns
			[
				[0, 0],
				[1, 1],
				[2, 2],
			],
			[
				[0, 2],
				[1, 1],
				[2, 0],
			], // Diagonals
		];

		for (const combination of winningCombinations) {
			const [a, b, c] = combination;
			if (this.board[a[0]][a[1]] && this.board[a[0]][a[1]] === this.board[b[0]][b[1]] && this.board[a[0]][a[1]] === this.board[c[0]][c[1]]) {
				this.isGameActive = false;
				return this.board[a[0]][a[1]];
			}
		}
		return null;
	}

	public resetBoard(): void {
		this.board = [
			["", "", ""],
			["", "", ""],
			["", "", ""],
		];
		this.isGameActive = true;
		// eslint-disable-next-line prettier/prettier
		this.drawBoard(() => { }); // Clear the board
	}
}
