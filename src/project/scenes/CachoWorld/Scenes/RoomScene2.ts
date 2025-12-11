import { ref, set, onValue, onDisconnect } from "firebase/database";
import { db } from "../../../..";
import { Keyboard } from "../../../../engine/input/Keyboard";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite } from "pixi.js";
import { CachoWorldPlayer } from "../CachoWorldPlayer";
import { JoystickMultiplayerCachoWorld } from "../JoystickMultiplayerCachoWorld";
import { Portal } from "../Classes/Portal";
import { MultiplayerCachoWorldGameScene } from "../Scenes/MultiplayerCachoWorldGameScene";

export class RoomScene2 extends PixiScene {
	private players: Record<string, CachoWorldPlayer> = {};
	private playerId: string;
	private roomId: string;
	private worldContainer: Container = new Container();
	private worldMap: Container;
	public static readonly BUNDLES = ["joystick", "cachoworld"];
	private joystick: JoystickMultiplayerCachoWorld;
	private portalToLobby: Portal;
	private localPlayerCreated: boolean = false;
	private firebaseUnsubscribe: (() => void) | null = null;
	private isDestroyed: boolean = false;

	constructor(playerId: string, roomId: string) {
		super();
		this.playerId = playerId;
		this.roomId = roomId;

		console.log(`Room2Scene (Pokecenter) created for player ${playerId} in room ${roomId}`);

		this.worldContainer.name = "WorldContainer";
		this.addChild(this.worldContainer);

		// Crear mapa con textura pokecenter
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

		console.log("Room2Scene setup complete");
	}

	private createMap(): void {
		this.worldMap = new Container();
		const backgroundSprite = Sprite.from("pokecenter");
		backgroundSprite.anchor.set(0.5);
		backgroundSprite.cullable = false;
		this.worldMap.addChild(backgroundSprite);
		this.worldContainer.addChildAt(this.worldMap, 0);
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

	// En el método createRemotePlayer():
	private createRemotePlayer(id: string, x: number, y: number): void {
		console.log(`Creating remote player ${id} at (${x}, ${y})`);
		const newPlayer = new CachoWorldPlayer(id, x, y);
		newPlayer.visible = true; // Ensure remote player is visible
		this.players[id] = newPlayer;
		this.worldContainer.addChild(newPlayer);
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
						const localPlayer = this.players[this.playerId];
						if (localPlayer && localPlayer.position && this.localPlayerCreated) {
							const distanceSquared = Math.pow(localPlayer.x - data.x, 2) + Math.pow(localPlayer.y - data.y, 2);

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

	private handleInput(): void {
		const player = this.players[this.playerId];
		if (!player) {
			return;
		}

		let speed = 0;
		let direction = 0;
		let moving = false;

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

		if (!moving) {
			if (player.animator.currentStateName !== "idle") {
				player.animator.playState("idle");
			}
		} else {
			if (player.animator.currentStateName !== "bouncing") {
				player.animator.playState("bouncing");
			}
			player.move(speed, direction);
		}
	}

	private async updatePlayerPositionInFirebase(): Promise<void> {
		if (this.isDestroyed) {
			return;
		}

		try {
			const player = this.players[this.playerId];
			if (player && player.position) {
				const playerRef = ref(db, `rooms/${this.roomId}/players/${this.playerId}`);
				await set(playerRef, { x: player.x, y: player.y });
			}
		} catch (error) {
			if (!this.isDestroyed) {
				console.error("Error updating player position in Firebase:", error);
			}
		}
	}

	public override update(_dt: number): void {
		if (this.isDestroyed) {
			return;
		}

		const local = this.players[this.playerId];

		if (!local || !local.position) {
			return;
		}

		this.handleInput();

		if (this.joystick) {
			this.joystick.updateJoystick();
			this.updatePlayerPositionInFirebase();
		}

		if (this.portalToLobby) {
			this.portalToLobby.checkCollision(local, this.roomId);
		}

		for (const id in this.players) {
			const player = this.players[id];
			if (!player || !player.position) {
				continue;
			}

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
		console.log(`Destroying Room2Scene for room ${this.roomId}`);

		this.isDestroyed = true;

		if (this.firebaseUnsubscribe) {
			this.firebaseUnsubscribe();
			this.firebaseUnsubscribe = null;
			console.log("Firebase listener unsubscribed");
		}

		for (const id in this.players) {
			const player = this.players[id];
			if (player) {
				this.worldContainer.removeChild(player);
				player.destroy();
			}
		}
		this.players = {};

		if (this.joystick) {
			this.worldContainer.removeChild(this.joystick);
			this.joystick.destroy();
			this.joystick = null;
		}

		super.destroy();

		console.log(`Room2Scene ${this.roomId} destroyed successfully`);
	}
}
