import { ref, set, onValue, onDisconnect } from "firebase/database";
import { db } from "../../../..";
import { Keyboard } from "../../../../engine/input/Keyboard";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Container } from "pixi.js";
import { CachoWorldPlayer } from "../CachoWorldPlayer";
import { NewWorldMap } from "../NewWorldMap";
import { JoystickMultiplayerCachoWorld } from "../JoystickMultiplayerCachoWorld";
import { Portal } from "../Classes/Portal";
import { MultiplayerCachoWorldGameScene } from "../Scenes/MultiplayerCachoWorldGameScene";
import { ChatManager } from "../Managers/ChatManager";
import { UsernameManager } from "../Managers/UsernameManager";

export class RoomScene extends PixiScene {
	private players: Record<string, CachoWorldPlayer> = {};
	private playerId: string;
	private roomId: string;
	private worldContainer: Container = new Container();
	private newWorldMap: NewWorldMap;
	public static readonly BUNDLES = ["joystick", "cachoworld"];
	private joystick: JoystickMultiplayerCachoWorld;
	private portalToLobby: Portal;
	private localPlayerCreated: boolean = false;
	private firebaseUnsubscribe: (() => void) | null = null;
	private isDestroyed: boolean = false;
	private chatManager: ChatManager | null = null;
	private usernameManager: UsernameManager;

	constructor(playerId: string, roomId: string) {
		super();
		this.playerId = playerId;
		this.roomId = roomId;

		console.log(`RoomScene created for player ${playerId} in room ${roomId}`);

		this.worldContainer.name = "WorldContainer";
		this.addChild(this.worldContainer);

		// Crear mapa
		this.createMap();

		// Portal de vuelta al lobby
		this.portalToLobby = new Portal(
			250, // x
			250, // y
			80, // width
			100, // height
			MultiplayerCachoWorldGameScene, // Clase de escena destino
			"lobby", // ID de sala destino
			150, // spawn x en lobby
			150 // spawn y en lobby
		);
		this.worldContainer.addChild(this.portalToLobby);

		// IMPORTANT: Create local player IMMEDIATELY before Firebase listeners
		this.createLocalPlayer();

		// Then setup Firebase listeners
		this.listenForPlayersUpdates();

		// Setup disconnect handler
		const playerOnDisconnectRef = ref(db, `rooms/${this.roomId}/players/${this.playerId}`);
		onDisconnect(playerOnDisconnectRef).remove();

		// Initialize chat
		this.initializeChat();

		console.log("RoomScene setup complete");
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	// Reemplaza el método initializeChat en RoomScene.ts

	private async initializeChat(): Promise<void> {
		// Get or create username manager instance
		this.usernameManager = UsernameManager.getInstance(this.playerId);

		// IMPORTANT: Wait for username to be initialized
		const username = await this.usernameManager.initialize();
		console.log("Username initialized:", username);

		// Initialize chat manager for this room with the loaded username
		this.chatManager = new ChatManager(this.roomId, this.playerId, username, (playerId: string) => this.getPlayerById(playerId));
		this.addChild(this.chatManager.getChatContainer());
	}

	private createMap(): void {
		this.newWorldMap = new NewWorldMap();
		this.worldContainer.addChildAt(this.newWorldMap, 0);
	}

	private createLocalPlayer(): void {
		console.log(`Creating local player ${this.playerId} in room ${this.roomId}`);

		// Create player at spawn position
		const localPlayer = new CachoWorldPlayer(this.playerId, 150, 150);
		localPlayer.visible = true; // Ensure player is visible
		this.players[this.playerId] = localPlayer;
		this.worldContainer.addChild(localPlayer);

		// Create joystick
		this.joystick = new JoystickMultiplayerCachoWorld(localPlayer);
		this.worldContainer.addChild(this.joystick);

		this.localPlayerCreated = true;
		console.log(`Local player ${this.playerId} created successfully`);
	}

	private createRemotePlayer(id: string, x: number, y: number): void {
		console.log(`Creating remote player ${id} at (${x}, ${y})`);
		const newPlayer = new CachoWorldPlayer(id, x, y);
		newPlayer.visible = true; // Ensure remote player is visible
		this.players[id] = newPlayer;
		this.worldContainer.addChild(newPlayer);
	}

	private getPlayerById(playerId: string): CachoWorldPlayer | undefined {
		return this.players[playerId];
	}

	private listenForPlayersUpdates(): void {
		// Listen to this specific room's players
		const playersRef = ref(db, `rooms/${this.roomId}/players`);

		// Store the unsubscribe function
		this.firebaseUnsubscribe = onValue(
			playersRef,
			(snap) => {
				// Don't process updates if scene is destroyed
				if (this.isDestroyed) {
					console.log("Scene destroyed, ignoring Firebase update");
					return;
				}

				const serverPlayers = snap.exists() ? (snap.val() as Record<string, { x: number; y: number } | null>) : {};

				console.log(`Firebase update for room ${this.roomId}:`, Object.keys(serverPlayers));

				// Remove disconnected players (but NEVER remove local player this way)
				Object.keys(this.players)
					.filter((id) => id !== this.playerId) // Never remove local player
					.filter((id) => !(id in serverPlayers) || serverPlayers[id] === null)
					.forEach((id) => {
						const p = this.players[id];
						if (p && !this.isDestroyed) {
							console.log(`Removing remote player ${id}`);
							this.worldContainer.removeChild(p);
							delete this.players[id];
						}
					});

				// Update or create REMOTE players only
				for (const [id, data] of Object.entries(serverPlayers)) {
					if (!data || this.isDestroyed) {
						continue;
					}

					// Skip local player - it's already created
					if (id === this.playerId) {
						// Just update position if it changed in Firebase
						const localPlayer = this.players[this.playerId];
						if (localPlayer && localPlayer.position && this.localPlayerCreated) {
							// Only update if the position in Firebase is significantly different
							const distanceSquared = Math.pow(localPlayer.x - data.x, 2) + Math.pow(localPlayer.y - data.y, 2);

							// Only update if player moved more than 50 pixels (to avoid sync issues)
							if (distanceSquared > 2500) {
								console.log(`Syncing local player position from Firebase`);
								localPlayer.x = data.x;
								localPlayer.y = data.y;
							}
						}
						continue;
					}

					const existing = this.players[id];
					if (existing && existing.position) {
						existing.x = data.x;
						existing.y = data.y;
					} else if (!existing) {
						this.createRemotePlayer(id, data.x, data.y);
					}
				}
			},
			(err) => {
				if (!this.isDestroyed) {
					console.error("Firebase onValue error:", err);
				}
			}
		);
	}

	// This method handles keyboard input - called from update()
	private handleInput(): void {
		const player = this.players[this.playerId];
		if (!player) {
			return;
		}

		let speed = 0;
		let direction = 0;
		let moving = false;

		// Check keyboard input
		if (Keyboard.shared.isDown("ArrowUp")) {
			speed = 5;
			direction = -Math.PI / 2;
			moving = true;
		} else if (Keyboard.shared.isDown("ArrowDown")) {
			speed = 5;
			direction = Math.PI / 2;
			moving = true;
		} else if (Keyboard.shared.isDown("ArrowLeft")) {
			speed = 5;
			direction = Math.PI;
			moving = true;
		} else if (Keyboard.shared.isDown("ArrowRight")) {
			speed = 5;
			direction = 0;
			moving = true;
		}

		// Update animation based on movement
		if (!moving) {
			if (player.animator.currentStateName !== "idle") {
				player.animator.playState("idle");
			}
		} else {
			if (player.animator.currentStateName !== "bouncing") {
				player.animator.playState("bouncing");
			}
			// Move the player
			player.move(speed, direction);
		}
	}

	private async updatePlayerPositionInFirebase(): Promise<void> {
		// Don't update if scene is destroyed
		if (this.isDestroyed) {
			return;
		}

		try {
			const player = this.players[this.playerId];
			if (player && player.position) {
				const playerRef = ref(db, `rooms/${this.roomId}/players/${this.playerId}`);
				// Only update x and y, nothing else
				await set(playerRef, { x: player.x, y: player.y });
			}
		} catch (error) {
			if (!this.isDestroyed) {
				console.error("Error updating player position in Firebase:", error);
			}
		}
	}

	public override update(_dt: number): void {
		// Don't update if scene is destroyed
		if (this.isDestroyed) {
			return;
		}

		const local = this.players[this.playerId];

		if (!local || !local.position) {
			return;
		}

		// Handle keyboard input
		this.handleInput();

		// Update joystick and sync to Firebase
		if (this.joystick) {
			this.joystick.updateJoystick();
			this.updatePlayerPositionInFirebase();
		}

		// Check portal collision
		if (this.portalToLobby) {
			this.portalToLobby.checkCollision(local, this.roomId);
		}

		// Update all players
		for (const id in this.players) {
			const player = this.players[id];
			if (!player || !player.position) {
				continue;
			}

			// Center camera on local player
			if (id === this.playerId) {
				const scale = this.worldTransform.a;
				const targetX = -player.x * scale + window.innerWidth * 0.5;
				const targetY = -player.y * scale + window.innerHeight * 0.5;
				this.worldContainer.x += (targetX - this.worldContainer.x) * 0.1;
				this.worldContainer.y += (targetY - this.worldContainer.y) * 0.1;
			}

			player.update(_dt);
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		// Handle resize if needed
	}

	public override destroy(_options?: any): void {
		console.log(`Destroying RoomScene for room ${this.roomId}`);

		// Mark as destroyed to stop all updates
		this.isDestroyed = true;

		// Unsubscribe from Firebase listener
		if (this.firebaseUnsubscribe) {
			this.firebaseUnsubscribe();
			this.firebaseUnsubscribe = null;
			console.log("Firebase listener unsubscribed");
		}

		// Clean up chat manager
		if (this.chatManager) {
			this.chatManager.destroy();
			this.chatManager = null;
		}

		// Clean up all players
		for (const id in this.players) {
			const player = this.players[id];
			if (player) {
				this.worldContainer.removeChild(player);
				player.destroy();
			}
		}
		this.players = {};

		// Clean up joystick
		if (this.joystick) {
			this.worldContainer.removeChild(this.joystick);
			this.joystick.destroy();
			this.joystick = null;
		}

		// Call parent destroy
		super.destroy();

		console.log(`RoomScene ${this.roomId} destroyed successfully`);
	}
}
