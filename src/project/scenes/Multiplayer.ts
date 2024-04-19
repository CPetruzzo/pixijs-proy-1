// import { Graphics, Sprite, Loader, Rectangle } from "pixi.js";
// import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
// import { Player } from "./NewGame/Player";

// export class Multiplayer extends PixiScene {
// 	private interactionData: any;

// 	private collisionSprites: Sprite[] = [];

// 	constructor() {
// 		super();

// 		// Player sprites
// 		const playerSprite = new Graphics();
// 		playerSprite.beginFill(0xFF0000);
// 		playerSprite.drawRect(0, 0, 50, 50);
// 		playerSprite.endFill();

// 		function onPointerDown(event: { data: { x: any; y: any; }; }) {
// 			const x = event.data.x;

// 			const y = event.data.y;

// 			// Create a new player sprite
// 			const newPlayerSprite = new Graphics();
// 			newPlayerSprite.beginFill(0x00FF00);
// 			newPlayerSprite.drawRect(0, 0, 50, 50);
// 			newPlayerSprite.endFill();

// 			// Add the new player sprite to the this
// 			this.addChild(newPlayerSprite);

// 			// Set position of the new player sprite
// 			newPlayerSprite.position.set(x, y);
// 		}

// 		// Event listeners
// 		this.on('pointerdown', onPointerDown);
// 		this.interactionData.x = 0;

// 		this.interactionData.y = 0;

// 		// Update the game loop
// 		requestAnimationFrame(animate);
// 		function animate() {
// 			requestAnimationFrame(animate);
// 			this.update();
// 		}

// 		// Fighting rules and logic
// 		const players: any[] = [];

// 		// Update players position
// 		function updatePlayersPosition(): void {
// 			players.forEach((player) => (player.position.y += player.speed));
// 		}

// 		// Check for collisions between players
// 		function checkCollisions(): void {
// 			for (let i = 0; i < players.length; i++) {
// 				for (let j = i + 1; j < players.length; j++) {
// 					if (PlayersRectIntersects(players[i], players[j])) {
// 						this.collisionSprites.push(players[i], players[j]);
// 					}

// 				}
// 			}
// 		}

// 		function PlayersRectIntersects(p1: Sprite, p2: Sprite): boolean {
// 			const bbox1 = p1.getBounds();
// 			const bbox2 = p2.getBounds();
// 			return (
// 				bbox1.left < bbox2.right &&
// 				bbox1.right > bbox2.left &&
// 				bbox1.top < bbox2.bottom &&
// 				bbox1.bottom > bbox2.top
// 			);
// 		}

// 		// Handle collisions
// 		function handleCollisions() {
// 			this.collisionSprites.forEach(sprite: {
// 				alpha: {
// 					// Backend code using Express and Socket.io for multiplayer functionality
// 					const: any; let: any; gameState: { players: any[]; socketIds: any[]; };
// 					// Handle player connections
// 					io: any; "": any; if(: any, foundPlayer: any): void;
// 				};
// 			}) => (sprite.alpha =
// 			{
// 				// Backend code using Express and Socket.io for multiplayer functionality
// 				const express = require('express');
// 				const app = express();
// 				const http = require('http').Server(app);
// 				const io = require('socket.io')(http);

// 				let gameState = {
// 					players: [],
// 					socketIds: [],
// 				};

// 				// Handle player connections
// 				io.on('connection', (socket: { id: any; emit: (arg0: string, arg1: { socketIds: any[]; players: any[]; }) => void; on: (arg0: string, arg1: (data: any) => void) => void; }) => {
// 					gameState.socketIds.push(socket.id);
// 					socket.emit('gameState', gameState);

// 					// Player input handling
// 					socket.on('playerInput', (data: { speed: any; }) => {
// 						let foundPlayer = false;
// 						gameState.players.forEach((player) => {
// 							if (player.socketId === socket.id) {
// 								player.speed = data.speed;
// 								foundPlayer = true;
// 							}
// 						});

// 						if (!foundPlayer) {
// 							const player = {
// 								id: Date.now(),
// 								x: 0,
// 								y: 0,
// 								speed: data.speed,
// 								sprite: new Sprite(Loader.cache['player']),
// 								socketId: socket.id,
// 							};

// 							gameState.players.push(player);
// 							gameState.socketIds.push(socket.id);
// 							socket.emit('gameState', gameState);
// 						}

// 						// Broadcast game state updates
// 						setInterval(() => {
// 							io.sockets.emit('gameState', gameState);
// 						}, 1000 / 30);

// 						// Update players positions
// 						function updatePlayers() {
// 							gameState.players.forEach((player) => {
// 								player.x += player.speed * Math.cos(player.angle);
// 								player.y -= player.speed * Math.sin(player.angle);
// 								player.angle += player.angleVelocity;
// 							});
// 						}

// 						// Render the game
// 						function render() {
// 							// Clear the canvas
// 							display.clear();

// 							// Render each player
// 							gameState.players.forEach((player) => {
// 								const angle = Math.atan2(player.y - 0, player.x - 0);
// 								const sin = Math.sin(angle);
// 								const cos = Math.cos(angle);

// 								const x = (canvas.width / 2) + (player.sprite.width / 2) * cos;
// 								const y = (canvas.height / 2) - (player.sprite.height / 2) * sin;

// 								player.sprite.position.x = x;
// 								player.sprite.position.y = y;
// 								display.addChild(player.sprite);
// 							});

// 							requestAnimationFrame(render);

// 							// Handle disconnections
// 							io.on('disconnect', (socket: { id: any; broadcast: { emit: (arg0: string, arg1: { socketIds: any[]; players: any[]; }) => void; }; }) => {
// 								const index = gameState.socketIds.indexOf(socket.id);
// 								if (index !== -1) {
// 									gameState.socketIds.splice(index, 1);
// 									gameState.players = gameState.players.filter(
// 										(player) => player.socketId !== socket.id
// 									);
// 								}

// 								socket.broadcast.emit('gameState', gameState);
// 							});

// 							app.listen(3000, () => {
// 								console.log('Server is running on port 3000');
// 							});
// 						});

// 					{
// 						if (player.socketId === socket.id) {
// 							player.angleVelocity = data.angleVelocity;
// 							foundPlayer = true;
// 						}
// 					});

// 				if(: any!foundPlayer: any) {
// 					const player = new Player(socket.id);
// 					connect(player, socket);
// 				}
// 			});

// 			socket.on('disconnect', () => {
// 				console.log('Client disconnected');
// 				const playerIndex = gameState.players.findIndex(
// 					(player) => player.socketId === socket.id
// 				);
// 				if (playerIndex !== -1) {
// 					disconnect(gameState.players[playerIndex], socket);
// 					gameState.players.splice(playerIndex, 1);
// 				}
// 			});
// 		});

// 		// The main game state object
// 		const gameState = {
// 			socketIds: [],
// 			players: [],
// 		};

// 		// Update the game state and emit it to all clients
// 		function updateGameState() {
// 			gameState.socketIds = io.sockets.sockets.keys();
// 			gameState.players = [];

// 			gameState.socketIds.forEach((id) => {
// 				const player = players.find(
// 					(player) => player.socketId === id
// 				);
// 				if (player) {
// 					gameState.players.push(player);
// 				}
// 			});

// 			io.emit('gameState', gameState);
// 		});

// 		// Initialize the game when a new client connects or updates the game state
// 		io.on('connection', (socket: { on: (arg0: string, arg1: { (data: any): void; (): void; }) => void; id: any; }) => {
// 			socket.on('newClient', (data: any) => {
// 				const player = new Player(socket.id);
// 				connect(player, socket);
// 			});

// 			socket.on('updateGameState', () => {
// 				updateGameState();
// 			});
// 		});

// 		// Send the initial game state to all connected clients
// 		setInterval(() => {
// 			updateGameState();
// 		}, 1000 / 60);

// 		app.listen(3000, () => {
// 			console.log('Server is running on port 3000');
// 		});
// 	} catch(error: any) {
// 		console.error('Error starting server:', error);
// 	}

// // Connect a player to a socket and add it to the list of players
// function connect(player: { socket: any; }, socket: { broadcast: { emit: (arg0: string, arg1: any) => void; }; }) {
// 	player.socket = socket;
// 	players.push(player);
// 	socket.broadcast.emit('newClient', player);
// }

// // Disconnect a player from a socket and remove it from the list of players
// function disconnect(player: any, socket: { removeAllListeners: () => void; disconnect: () => void; broadcast: { emit: (arg0: string, arg1: any) => void; }; }) {
// 	const index = players.indexOf(player);
// 	players.splice(index, 1);
// 	socket.removeAllListeners();
// 	socket.disconnect();
// 	socket.broadcast.emit('playerDisconnected', player);
// }

// // List of all connected players
// const players: any[] = [];

// // Broadcast an event to all connected clients except the current socket
// function broadcast(event: any, data: any) {
// 	io.sockets.except(socket).emit(event, data);
// }

// // Send data to a specific player's socket
// function sendToPlayer(player: { socket: { emit: (arg0: any, arg1: any) => void; }; }, event: any, data: any) {
// 	if (player.socket) {
// 		player.socket.emit(event, data);
// 	}
// }

// // Create a new Player object with a unique ID and basic properties
// function createPlayer() {
// 	const player = new Player();
// 	return player;
// }

// // Update a player's position based on their movement data
// function updatePlayerPosition(player: { position: { x: any; y: any; }; }, movementData: { x: any; y: any; }) {
// 	player.position.x += movementData.x;
// 	player.position.y += movementData.y;

// 	const col = map.collide(player);
// 	if (col !== null) {
// 		player.position.x = col.x;
// 		player.position.y = col.y;
// 	}
// }

// // Collide a player with the game map and return the tile they collided with
// function collideWithMap(player: { position: any; }) {
// 	const tilesUnder = map.getTilesBeneath(player.position, true, true);
// 	let collided = null;
// 	for (let i = 0; i < tilesUnder.length; i++) {
// 		const tile = tilesUnder[i];
// 		if (tile && !tile.properties.collide) {
// 			collided = tile;
// 			break;
// 		}
// 	}

// 	return collided ? { x: collided.x(), y: collided.y() } : null;
// }

// // Check if two rectangles intersect
// function intersectRectangles(r1: { x: number; width: any; y: number; height: number; }, r2: { x: number; width: any; y: number; height: any; }) {
// 	return (
// 		r1.x < r2.x + r2.width &&
// 		r2.x < r1.x + r1.width &&
// 		r1.y < r2.y + r2.height &&
// 		r2.y < r1.height
// 	);
// }

// // Implement collision detection between two rectangles
// function collideRectangles(rect1: { x: number; y: number; width: any; height: any; }, rect2: { x: number; y: number; width: any; height: any; }) {
// 	const intersection = {
// 		x: Math.max(rect1.x, rect2.x),
// 		y: Math.max(rect1.y, rect2.y),
// 		width: Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - intersection.x,
// 		height: Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - intersection.y,
// 	};
// 	return intersection;
// }

// // Initialize game world and set up event listeners for key and player updates
// function initializeGame() {
// 	// Initialize game objects
// 	const player = new Entity(new Rectangle(10, 10, 32, 32));
// 	map.loadTileset("tilesets/example.json", "ground", null);
// 	map.parseMap("maps/map.json");

// 	// Set up event listeners
// 	window.addEventListener("keydown", handleKeyDown);

// 	// Update player position based on user input
// 	function handleKeyDown(event: { keyCode: any; }) {
// 		const movementData = { x: 0, y: 0 };
// 		switch (event.keyCode) {
// 			case 37: // Left arrow
// 				movementData.x
// 				break;
// 			case 38: // Up arrow
// 				movementData.y = -1;
// 				break;
// 			case 39: // Right arrow
// 				movementData.x = 1;
// 				break;
// 			case 40: // Down arrow
// 				movementData.y = 1;
// 				break;
// 		}
// 		updatePlayerPosition(player, movementData);
// 	}

// 	// Update the game world
// 	function updateGame() {
// 		requestAnimationFrame(updateGame);
// 		player.update();
// 		updatePlayerPosition(player, player.movementData);
// 		const collided = collideWithMap(player);
// 		if (collided) {
// 			player.position.x = collided.x;
// 			player.position.y = collided.y;
// 		}
// 	}

// 	// Main game loop
// 	updateGame();
// }
// }
// }
