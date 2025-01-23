import { Graphics } from "pixi.js";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { Keyboard } from "../../../engine/input/Keyboard";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";

export class CarGameScene extends PixiScene {
	private socket: Socket;
	private players: Record<string, Graphics> = {};

	constructor() {
		super();

		// Conexión con el servidor
		this.socket = io("http://192.168.1.5:1234/", {
			transports: ["websocket", "polling"], // Try using both WebSocket and polling.
		});

		// Manejo de conexión
		this.socket.on("connect", () => {
			console.log("Connected to server as:", this.socket.id);
		});

		this.socket.on("connect_error", (err) => {
			console.error("Connection error:", err.message);
		});

		// Recibir la lista inicial de jugadores
		this.socket.on("init", (serverPlayers: Record<string, { x: number; y: number }>) => {
			console.log("Players received:", serverPlayers);
			for (const [id, player] of Object.entries(serverPlayers)) {
				this.createPlayer(id, player.x, player.y);
			}
		});

		// Añadir un nuevo jugador
		this.socket.on("newPlayer", ({ id, x, y }) => {
			console.log("New player added:", id);
			this.createPlayer(id, x, y);
		});

		// Eliminar jugador desconectado
		this.socket.on("playerDisconnected", (id: string) => {
			console.log("Player disconnected:", id);
			this.removePlayer(id);
		});

		this.socket.on("update", (serverPlayers: Record<string, { x: number; y: number }>) => {
			console.log("Players updated:", serverPlayers);
			for (const [id, player] of Object.entries(serverPlayers)) {
				if (this.players[id]) {
					this.players[id].x = player.x;
					this.players[id].y = player.y;
				}
			}
		});
	}

	// Crear jugador
	private createPlayer(id: string, x: number, y: number): void {
		console.log(`Creating player ${id} at (${x}, ${y})`);
		const car = new Graphics();
		car.beginFill(0xff0000);
		car.drawRect(-10, -20, 20, 40);
		car.endFill();
		car.x = x;
		car.y = y;
		this.players[id] = car;
		this.addChild(car);
	}

	// Eliminar jugador
	private removePlayer(id: string): void {
		const player = this.players[id];
		if (player) {
			this.removeChild(player);
			delete this.players[id];
		}
	}

	// Escuchar inputs del jugador local
	private handleInput(): void {
		let speed = 0;
		let direction = 0;

		if (Keyboard.shared.isDown("ArrowUp")) {
			speed = 1;
		}
		if (Keyboard.shared.isDown("ArrowDown")) {
			speed = -1;
		}
		if (Keyboard.shared.isDown("ArrowLeft")) {
			direction = -Math.PI / 4;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			direction = Math.PI / 4;
		}

		// Only emit if there's input
		if (speed !== 0 || direction !== 0) {
			console.log(`Emitting: Speed: ${speed}, Direction: ${direction}`);
			this.socket.emit("input", { speed, direction });
		}
	}

	// Lógica de actualización de la escena
	public override update(_dt: number): void {
		this.handleInput(); // Process local player input

		// Log the players' current positions
		console.log("Current players' positions:", this.players);
	}

	// Responder a cambios en el tamaño de la ventana
	public override onResize(_newW: number, _newH: number): void {
		// Redimensiona elementos si es necesario
	}
}
