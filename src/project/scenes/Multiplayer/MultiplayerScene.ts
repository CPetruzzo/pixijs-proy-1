import { Graphics, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { io, Socket } from "socket.io-client";

export class MultiplayerScene extends PixiScene {
	private socket: Socket;
	private board: string[][]; // Tablero del juego
	private currentPlayer: string; // ID del jugador actual
	private isGameActive: boolean; // Estado del juego
	private cells: Graphics[][]; // Para almacenar las celdas del tablero
	private playerSymbol: string;  // Declaramos playerSymbol como string

	constructor() {
		super();
		this.socket = io('http://localhost:1234', {
			transports: ['websocket'],
		});

		this.playerSymbol = '';  // Inicializar playerSymbol vacío
		this.board = [['', '', ''], ['', '', ''], ['', '', '']]; // Inicializa el tablero
		this.currentPlayer = 'X'; // Jugador inicial
		this.isGameActive = true; // Juego activo
		this.cells = []; // Almacena las celdas gráficas

		this.setupSocketListeners();
	}

	private setupSocketListeners() {
		this.socket.on('connect', () => {
			console.log('Connected to server');
			this.joinRoom('gameRoom1');
			console.log('gameRoom1')
		});

		this.socket.on('roomJoined', (initialState) => {
			console.log('roomJoined');
			this.board = initialState.board;
			this.currentPlayer = initialState.currentPlayer;  // Mantén el turno actual del juego
			this.playerSymbol = initialState.playerSymbol;    // Asigna el símbolo del jugador actual ('X' o 'O')
			this.create(); // Dibuja el tablero al unirse a la sala
		});


		this.socket.on('updateGame', (data) => {
			this.updateGame(data);
		});

		this.socket.on('testEvent', (data) => {
			console.log(data.message); // Deberías ver 'Hello from server!'
		});
	}

	public joinRoom(room: string) {
		this.socket.emit('joinRoom', room);
	}

	public playerTurn(data: { action: string; playerId: string; x: number; y: number }) {
		this.socket.emit('turnPlayed', {
			room: 'gameRoom1', // Cambia esto por la sala correspondiente
			playerData: data
		});
	}

	private updateGame(data: any) {
		this.board[data.x][data.y] = data.playerId; // Actualiza el tablero
		this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X'; // Cambia de jugador
		this.drawBoard(); // Redibuja el tablero
		this.checkWinner(); // Verifica si hay un ganador
	}

	public create() {
		this.drawBoard(); // Dibuja el tablero al iniciar
	}

	private drawBoard() {
		console.log("Dibujando el tablero..."); // Agrega este log
		// Limpia las celdas gráficas
		this.cells.forEach(row => row.forEach(cell => this.removeChild(cell)));
		this.cells = [];

		const cellSize = 100;
		for (let row = 0; row < 3; row++) {
			this.cells[row] = [];
			for (let col = 0; col < 3; col++) {
				const cell = new Graphics();
				cell.lineStyle(2, 0x000000, 1);
				cell.beginFill(0xFFFFFF);
				cell.drawRect(col * cellSize, row * cellSize, cellSize, cellSize);
				cell.endFill();
				cell.interactive = true;

				cell.on('click', () => {
					this.handleCellClick(row, col);
				});

				this.cells[row][col] = cell;
				this.addChild(cell);

				// Dibuja el símbolo si ya hay uno
				if (this.board[row][col]) {
					this.drawSymbol(cell, this.board[row][col]);
				}
			}
		}
	}

	private handleCellClick(row: number, col: number) {
		console.log(`Celda clickeada: ${row}, ${col}`);
		console.log('this.currentPlayer', this.currentPlayer);
		console.log('this.playerSymbol', this.playerSymbol);

		// Solo permite jugar si es el turno del jugador actual y la celda está vacía
		if (this.isGameActive && this.board[row][col] === '' && this.currentPlayer === this.playerSymbol) {
			this.board[row][col] = this.playerSymbol; // Actualiza el tablero con el símbolo del jugador actual
			this.drawSymbol(this.cells[row][col], this.playerSymbol); // Dibuja el símbolo
			this.playerTurn({ action: 'move', playerId: this.playerSymbol, x: row, y: col }); // Envía el turno al servidor
			this.checkWinner(); // Verifica si hay un ganador
		} else {
			console.log("No es tu turno o la celda ya está ocupada.");
		}
	}


	private drawSymbol(cell: Graphics, player: string) {
		const symbol = new Text(player, { fontSize: 64, fill: player === 'X' ? 0xFF0000 : 0x0000FF });
		symbol.anchor.set(0.5);

		// Usa las coordenadas locales de la celda en relación a su contenedor padre
		const bounds = cell.getBounds();  // Obtiene las coordenadas absolutas del rectángulo de la celda
		symbol.x = bounds.x + bounds.width / 2;
		symbol.y = bounds.y + bounds.height / 2;

		this.addChild(symbol);
	}


	private checkWinner() {
		const winningCombinations = [
			[[0, 0], [0, 1], [0, 2]], // Fila 1
			[[1, 0], [1, 1], [1, 2]], // Fila 2
			[[2, 0], [2, 1], [2, 2]], // Fila 3
			[[0, 0], [1, 0], [2, 0]], // Columna 1
			[[0, 1], [1, 1], [2, 1]], // Columna 2
			[[0, 2], [1, 2], [2, 2]], // Columna 3
			[[0, 0], [1, 1], [2, 2]], // Diagonal
			[[0, 2], [1, 1], [2, 0]]  // Diagonal inversa
		];

		for (const combination of winningCombinations) {
			const [a, b, c] = combination;
			if (this.board[a[0]][a[1]] && this.board[a[0]][a[1]] === this.board[b[0]][b[1]] && this.board[a[0]][a[1]] === this.board[c[0]][c[1]]) {
				console.log(`Player ${this.board[a[0]][a[1]]} wins!`);
				this.isGameActive = false; // Termina el juego
				alert(`Player ${this.board[a[0]][a[1]]} wins!`);
				break;
			}
		}
	}

	public override update(_delta: number) {
		// Aquí puedes implementar cualquier lógica de actualización
	}
}
