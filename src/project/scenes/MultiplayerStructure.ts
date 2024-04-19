import { Sprite, Texture, Graphics } from "pixi.js";
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { Player } from "./PlayerSocket";
import express from "express"; // Usamos el nuevo estilo de importación de Express
import { createServer } from "http";
import { Server } from "socket.io";

export class MultiplayerScene extends PixiScene {
	private collisionSprites: Sprite[] = [];
	private players: Player[] = [];
	private playerSprites: Sprite[] = [];
	private server: Server;

	constructor() {
		super();

		// Configurar Express y el servidor HTTP
		const app = express();
		const httpServer = createServer(app);

		// Configurar el servidor de Socket.IO
		this.server = new Server(httpServer, {
			cors: {
				origin: "*", // Permitir todas las conexiones por ahora, puedes ajustarlo según tus necesidades
				methods: ["GET", "POST"],
			},
		});

		// Configurar el servidor HTTP para escuchar en el puerto 3000
		httpServer.listen(3000, () => {
			console.log("Server is running on port 3000");
		});

		// Player sprites
		const playerSprite = new Graphics();
		playerSprite.beginFill(0xff0000);
		playerSprite.drawRect(0, 0, 50, 50);
		playerSprite.endFill();

		// Event listeners
		this.on("pointerdown", this.onPointerDown.bind(this));

		// Handle player connections
		this.server.on(
			"connection",
			(socket: {
				id: string;
				emit: (arg0: string, arg1: { players: Player[]; socketIds: string[] }) => void;
				on: (arg0: string, arg1: { (): void; (data: any): void }) => void;
			}) => {
				// Add player to the game
				const player = new Player(socket.id);
				this.players.push(player);
				const playerSprite = Sprite.from(Texture.WHITE);
				playerSprite.tint = 0x00fff;
				this.playerSprites.push(playerSprite);

				// Emit game state to the new player
				socket.emit("gameState", {
					players: this.players,
					socketIds: this.players.map((player) => player.socketId),
				});

				// Update game state for all players
				this.server.emit("gameState", {
					players: this.players,
					socketIds: this.players.map((player) => player.socketId),
				});

				// Handle player disconnection
				socket.on("disconnect", () => {
					const index = this.players.findIndex((player) => player.socketId === socket.id);
					if (index !== -1) {
						this.players.splice(index, 1);
						this.server.emit("playerDisconnected", { socketId: socket.id });
					}
				});

				// Handle player input
				// @ts-expect-error
				socket.on("playerInput", (data) => {
					const player = this.players.find((player) => player.socketId === socket.id);
					if (player) {
						player.speed = data.speed;
						player.angleVelocity = data.angleVelocity;
					}
				});
			}
		);

		const gameState: { players: Player[]; socketIds: string[] } = {
			players: [],
			socketIds: [],
		};

		console.log("gameState", gameState);
	}

	// Fighting rules and logic

	// Update players position
	public updatePlayersPosition(): void {
		this.players.forEach((player) => (player.position.y += player.speed));
	}

	// Check for collisions between player sprites
	public checkCollisions(): void {
		for (let i = 0; i < this.playerSprites.length; i++) {
			for (let j = i + 1; j < this.playerSprites.length; j++) {
				if (this.playersRectIntersects(this.playerSprites[i], this.playerSprites[j])) {
					this.collisionSprites.push(this.playerSprites[i], this.playerSprites[j]);
				}
			}
		}
	}

	private playersRectIntersects(p1: Sprite, p2: Sprite): boolean {
		const bbox1 = p1.getBounds();
		const bbox2 = p2.getBounds();
		return bbox1.left < bbox2.right && bbox1.right > bbox2.left && bbox1.top < bbox2.bottom && bbox1.bottom > bbox2.top;
	}

	// Handle collisions
	public handleCollisions(): void {
		this.collisionSprites.forEach((sprite: { alpha: number }) => {
			sprite.alpha = 0.5;
		});
	}

	private onPointerDown(event: { data: { x: any; y: any } }): void {
		const x = event.data.x;
		const y = event.data.y;

		// Create a new player sprite
		const newPlayerSprite = new Graphics();
		newPlayerSprite.beginFill(0x00ff00);
		newPlayerSprite.drawRect(0, 0, 50, 50);
		newPlayerSprite.endFill();

		// Add the new player sprite to the stage
		this.addChild(newPlayerSprite);

		// Set position of the new player sprite
		newPlayerSprite.position.set(x, y);
	}
}
