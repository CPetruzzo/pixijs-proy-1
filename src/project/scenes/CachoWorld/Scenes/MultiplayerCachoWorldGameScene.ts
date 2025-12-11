import { ref, set, onValue, onDisconnect, remove, update } from "firebase/database";
import { db } from "../../../..";
import { Keyboard } from "../../../../engine/input/Keyboard";
import { JoystickMultiplayerCachoWorld } from "../JoystickMultiplayerCachoWorld";
import { CachoWorldPlayer } from "../CachoWorldPlayer";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { MAX_MESSAGES } from "../../../../utils/constants";
import { WorldMap } from "../WorldMap";
import type { ChatMessage } from "../Chat";
import { Routes } from "../Chat";
import { Portal } from "../Classes/Portal";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { RoomScene } from "./RoomScene";
import { RoomScene2 } from "./RoomScene2";
import { RoomScene3 } from "./RoomScene3";
import { UsernameManager } from "../Managers/UsernameManager";
import { CombatSystem } from "../Classes/CombatSystem";
import { DamageNumber } from "../Classes/DamageNumber";
import { AttackButton } from "../Utils/AttackButton";

export class MultiplayerCachoWorldGameScene extends PixiScene {
	public static readonly BUNDLES = ["joystick", "cachoworld"];

	private localPlayerId: string;
	private roomId: string = "lobby";

	private playersInRoom: Record<string, CachoWorldPlayer> = {};
	private worldContainer: Container = new Container();
	private chatContainer: Container;
	private damageContainer: Container = new Container(); // NEW: Container for damage numbers

	private usernameInput: HTMLInputElement;
	private chatInput: HTMLInputElement;
	private username: string = "";

	private joystick: JoystickMultiplayerCachoWorld;
	private worldMap: WorldMap;
	private debugGraphics: Graphics;

	private portalToRoom1: Portal;
	private portalToRoom2: Portal;
	private portalToRoom3: Portal;

	private firebaseUnsubscribe: (() => void) | null = null;
	private chatUnsubscribe: (() => void) | null = null;
	private isDestroyed: boolean = false;
	private usernameManager: UsernameManager;
	private combatSystem: CombatSystem; // NEW: Combat system
	private attackButton: AttackButton;
	constructor(playerId?: string) {
		super();

		this.localPlayerId = playerId || UsernameManager.getOrCreatePlayerId();

		console.log(`Lobby created for player ${this.localPlayerId}`);

		this.worldContainer.name = "WorldContainer";
		this.addChild(this.worldContainer);

		// Add damage container on top of everything
		this.damageContainer.name = "DamageContainer";

		// Initialize combat system with roomId
		this.combatSystem = new CombatSystem(this.damageContainer, this.roomId);

		this.createMap();
		this.debugGraphics = new Graphics();

		// Portal 1: Room1 (house)
		this.portalToRoom1 = new Portal(-370, -800, 50, 100, RoomScene, "room1", 150, 150);
		this.worldContainer.addChild(this.portalToRoom1);

		// Portal 2: Room2 (pokecenter)
		this.portalToRoom2 = new Portal(370, -800, 50, 100, RoomScene2, "room2", 150, 150);
		this.worldContainer.addChild(this.portalToRoom2);

		// Portal 3: Room3 (office)
		this.portalToRoom3 = new Portal(0, 800, 100, 50, RoomScene3, "room3", 150, 150);
		this.worldContainer.addChild(this.portalToRoom3);

		this.listenForPlayersUpdates();
		this.addPlayerToDatabase();
		this.initializeUsernameAndChat();

		this.createAttackButton();

		this.worldContainer.addChild(this.damageContainer);
	}

	private async initializeUsernameAndChat(): Promise<void> {
		this.usernameManager = UsernameManager.getInstance(this.localPlayerId);
		this.username = await this.usernameManager.initialize();
		console.log("Username initialized in lobby:", this.username);

		this.createChatUI();

		if (this.chatInput) {
			this.chatInput.disabled = false;
		}

		this.listenForChatUpdates();
	}

	private createMap(debug: boolean = false): void {
		this.worldMap = new WorldMap();
		this.worldContainer.addChildAt(this.worldMap, 0);

		if (debug) {
			this.worldMap.addChild(this.debugGraphics);
		}
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async listenForPlayersUpdates(): Promise<void> {
		try {
			const playersRef = ref(db, `rooms/${this.roomId}/players`);

			this.firebaseUnsubscribe = onValue(playersRef, (snapshot) => {
				if (this.isDestroyed) {
					console.log("Scene destroyed, ignoring Firebase update");
					return;
				}

				const serverPlayers = snapshot.exists() ? (snapshot.val() as Record<string, { x: number; y: number; hp?: number }>) : {};

				const disconnectedPlayers = Object.keys(this.playersInRoom).filter((id) => !serverPlayers[id]);

				disconnectedPlayers.forEach((id) => {
					console.log(`Player ${id} disconnected, removing from scene.`);
					const player = this.playersInRoom[id];
					if (player) {
						this.worldContainer.removeChild(player);
						delete this.playersInRoom[id];
					}
				});

				for (const [id, playerData] of Object.entries(serverPlayers)) {
					// IMPORTANT: Also sync local player's HP from server
					// This ensures we receive damage from other players
					if (id === this.localPlayerId) {
						const localPlayer = this.playersInRoom[this.localPlayerId];
						if (localPlayer && playerData.hp !== undefined) {
							const currentHp = localPlayer.stats.getCurrentHp();
							if (currentHp !== playerData.hp && playerData.hp < currentHp) {
								// Only sync if server HP is LOWER (we took damage)
								console.log(`Local player took damage! HP: ${currentHp} -> ${playerData.hp}`);
								const damage = currentHp - playerData.hp;
								localPlayer.stats.takeDamage(damage);

								// Show damage number on local player
								const damageNum = new DamageNumber(damage, localPlayer.x, localPlayer.y - 30);
								this.damageContainer.addChild(damageNum);
							}

							// Update alpha for dead players
							if (playerData.hp <= 0) {
								localPlayer.alpha = 0.5;
							} else if (localPlayer.alpha !== 1) {
								localPlayer.alpha = 1;
							}
						}
						continue;
					}

					if (this.playersInRoom[id]) {
						// Update position
						this.playersInRoom[id].x = playerData.x;
						this.playersInRoom[id].y = playerData.y;

						// Update HP from server
						if (playerData.hp !== undefined) {
							const currentHp = this.playersInRoom[id].stats.getCurrentHp();
							if (currentHp !== playerData.hp) {
								// Set HP directly
								const player = this.playersInRoom[id];
								const diff = currentHp - playerData.hp;
								if (diff > 0) {
									// Player took damage
									player.stats.takeDamage(diff);
								} else if (diff < 0) {
									// Player healed
									player.stats.heal(Math.abs(diff));
								}

								// Update alpha for dead players
								if (playerData.hp <= 0) {
									player.alpha = 0.5;
								} else {
									player.alpha = 1;
								}
							}
						}
					} else {
						this.createPlayer(id, playerData.x, playerData.y);
						// Set initial HP if provided
						if (playerData.hp !== undefined && this.playersInRoom[id]) {
							const maxHp = this.playersInRoom[id].stats.getMaxHp();
							const damage = maxHp - playerData.hp;
							if (damage > 0) {
								this.playersInRoom[id].stats.takeDamage(damage);
							}
							// Set alpha for dead players
							if (playerData.hp <= 0) {
								this.playersInRoom[id].alpha = 0.5;
							}
						}
					}
				}
			});
		} catch (error) {
			console.error("Error fetching players from Firebase:", error);
		}
	}

	private createPlayer(id: string, x: number, y: number): void {
		console.log(`Creating player ${id} at (${x}, ${y})`);
		const player = new CachoWorldPlayer(id, x, y);
		player.name = `Player_${id}`;
		player.visible = true;
		this.playersInRoom[id] = player;
		this.worldContainer.addChild(player);
	}

	private createAttackButton(): void {
		this.attackButton = new AttackButton();
		this.attackButton.setOnAttackCallback(() => {
			this.handleAttack();
		});
		this.addChild(this.attackButton); // Se agrega a la escena principal
	}

	private createLocalPlayer(): void {
		const myPlayer = new CachoWorldPlayer(this.localPlayerId, 150, 150);
		myPlayer.name = `Player_${this.localPlayerId}`;
		myPlayer.visible = true;
		this.playersInRoom[this.localPlayerId] = myPlayer;
		console.log("Local player created:", this.localPlayerId);
		this.worldContainer.addChild(myPlayer);

		this.joystick = new JoystickMultiplayerCachoWorld(myPlayer);
		this.joystick.name = `Joystick_Player_${this.localPlayerId}`;
		this.worldContainer.addChild(this.joystick);
	}

	private async addPlayerToDatabase(): Promise<void> {
		try {
			const playerRef = ref(db, `rooms/${this.roomId}/players/${this.localPlayerId}`);
			await set(playerRef, { x: 150, y: 150, hp: 10 }); // Add HP to database

			const playerOnDisconnectRef = ref(db, `rooms/${this.roomId}/players/${this.localPlayerId}`);
			onDisconnect(playerOnDisconnectRef).remove();

			console.log("Player added to Firebase.");

			if (!this.playersInRoom[this.localPlayerId]) {
				this.createLocalPlayer();
			}
		} catch (error) {
			console.error("Error adding player to Firebase:", error);
		}
	}

	private async updatePlayerPositionInFirebase(): Promise<void> {
		try {
			const player = this.playersInRoom[this.localPlayerId];
			if (player) {
				const playerRef = ref(db, `rooms/${this.roomId}/players/${this.localPlayerId}`);

				// Only update position, keep HP from server
				await update(playerRef, {
					x: player.x,
					y: player.y,
					// DON'T update HP here - only CombatSystem updates HP
				});
			}
		} catch (error) {
			console.error("Error updating player position in Firebase:", error);
		}
	}

	private handleInput(): void {
		let speed = 0;
		let direction = 0;

		if (Keyboard.shared.isDown("ArrowUp")) {
			speed = 5;
			direction = -Math.PI / 2;
		}
		if (Keyboard.shared.isDown("ArrowDown")) {
			speed = 5;
			direction = Math.PI / 2;
		}
		if (Keyboard.shared.isDown("ArrowLeft")) {
			speed = 5;
			direction = Math.PI;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			speed = 5;
			direction = 0;
		}

		// NEW: Handle attack input (E key)
		if (Keyboard.shared.justPressed("KeyE")) {
			this.handleAttack();
		}

		const player = this.playersInRoom[this.localPlayerId];
		if (!player) {
			console.warn("No local player found with ID:", this.localPlayerId);
			return;
		}

		if (speed === 0) {
			if (player.animator.currentStateName !== "idle") {
				player.animator.playState("idle");
			}
		} else {
			if (player.animator.currentStateName !== "bouncing") {
				player.animator.playState("bouncing");
			}
		}

		if (speed !== 0 || direction !== 0) {
			player.move(speed, direction);
			this.updatePlayerPositionInFirebase();
		}
	}

	// NEW: Handle attack logic
	private async handleAttack(): Promise<void> {
		const attacker = this.playersInRoom[this.localPlayerId];
		if (!attacker) {
			return;
		}

		// Get all players in attack range
		const playersInRange = this.combatSystem.getPlayersInRange(attacker, this.playersInRoom);

		if (playersInRange.length === 0) {
			console.log("No players in attack range");
			return;
		}

		// Attack the first player in range
		const target = playersInRange[0];
		const attackSuccessful = await this.combatSystem.attack(this.localPlayerId, attacker, target);

		if (attackSuccessful) {
			console.log(`Successfully attacked player ${target.id}`);
		} else {
			console.log("Attack failed (cooldown or target dead)");
		}
	}

	private createChatUI(): void {
		this.chatContainer = new Container();
		this.chatContainer.x = 10;
		this.chatContainer.y = window.innerHeight - 150;
		this.addChild(this.chatContainer);

		this.chatInput = document.createElement("input");
		this.chatInput.type = "text";
		this.chatInput.placeholder = "Type your message...";
		this.chatInput.style.position = "absolute";
		this.chatInput.style.bottom = "10px";
		this.chatInput.style.left = "10px";
		this.chatInput.style.width = "200px";
		this.chatInput.style.zIndex = "1000";
		document.body.appendChild(this.chatInput);

		this.chatInput.disabled = true;

		this.chatInput.addEventListener("keydown", (e) => {
			if (e.key === " ") {
				e.stopPropagation();
			}

			if (e.key === "Enter") {
				this.sendMessage(this.chatInput.value);
				this.chatInput.value = "";
			}
		});

		this.chatInput.addEventListener("keydown", (e) => {
			if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
				e.stopPropagation();
			}
		});
	}

	private listenForChatUpdates(): void {
		const chatRef = ref(db, Routes.CHAT);

		this.chatUnsubscribe = onValue(chatRef, (snapshot) => {
			if (this.isDestroyed) {
				return;
			}

			if (snapshot.exists()) {
				const messages: Record<string, ChatMessage & { x: number; y: number }> = snapshot.val() as Record<string, ChatMessage & { x: number; y: number }>;

				this.updateChat(messages);

				Object.values(messages).forEach((message) => {
					const player = this.getPlayerById(message.playerId);
					if (player) {
						const messageKey = `${message.playerId}:${message.message}`;
						if (!player.seenMessages.has(messageKey)) {
							player.removeMessage();
							player.showMessageAbove(message.message);
							player.seenMessages.add(messageKey);
						}
					}
				});
			}
		});
	}

	private getPlayerById(playerId: string): CachoWorldPlayer | undefined {
		return this.playersInRoom[playerId];
	}

	private async sendMessage(message: string): Promise<void> {
		if (message.trim() === "") {
			return;
		}

		const timestamp = Date.now();
		const chatRef = ref(db, `${Routes.CHAT}/${timestamp}`);
		await set(chatRef, {
			playerId: this.localPlayerId,
			username: this.username,
			message: message,
			x: this.x,
			y: this.y,
		});

		const player = this.playersInRoom[this.localPlayerId];
		if (player) {
			player.showMessageAbove(message);
		}

		const chatRefAll = ref(db, "chat");
		onValue(chatRefAll, (snapshot) => {
			if (snapshot.exists()) {
				const messages = snapshot.val();
				const messageKeys = Object.keys(messages);

				if (messageKeys.length > MAX_MESSAGES) {
					const oldestKey = messageKeys[0];
					const oldestMessageRef = ref(db, `chat/${oldestKey}`);
					remove(oldestMessageRef);
				}
			}
		});

		this.chatInput.blur();
	}

	private updateChat(messages: Record<string, { playerId: string; username: string; message: string }>): void {
		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 14,
			fill: "white",
			wordWrap: true,
			wordWrapWidth: 300,
		});

		const sortedMessages = Object.values(messages);
		this.chatContainer.removeChildren();

		let positionY = 0;

		sortedMessages.forEach((messageData) => {
			const existingMessage = this.chatContainer.children.find((child) => {
				return child instanceof Text && child.text === `${messageData.username}: ${messageData.message}`;
			});

			if (!existingMessage) {
				const messageText = new Text(`${messageData.username}: ${messageData.message}`, textStyle);
				messageText.x = 0;
				messageText.y = positionY;

				this.chatContainer.addChild(messageText);
				positionY += messageText.height + 5;
			}
		});
	}

	public override onResize(newW: number, newH: number): void {
		this.worldContainer.x = newW * 0.5;
		this.worldContainer.y = newH * 0.5;

		const worldContainerBounds = this.worldContainer.getLocalBounds();
		this.debugGraphics.clear();
		this.debugGraphics.lineStyle(2, 0xff0000, 1);
		this.debugGraphics.drawRect(
			this.worldMap.x - this.worldMap.width * 0.5,
			this.worldMap.y - this.worldMap.height * 0.5,
			worldContainerBounds.width,
			worldContainerBounds.height
		);

		if (this.attackButton) {
			this.attackButton.updatePosition(newW, newH);
		}
	}

	public override update(_dt: number): void {
		if (this.joystick) {
			this.joystick.updateJoystick();
			this.updatePlayerPositionInFirebase();
		}

		if (this.playersInRoom[this.localPlayerId]) {
			this.handleInput();

			this.portalToRoom1.checkCollision(this.playersInRoom[this.localPlayerId], this.roomId);
			this.portalToRoom2.checkCollision(this.playersInRoom[this.localPlayerId], this.roomId);
			this.portalToRoom3.checkCollision(this.playersInRoom[this.localPlayerId], this.roomId);
		}

		// Note: Damage numbers update themselves via Tweedle.js tweens

		for (const playerId in this.playersInRoom) {
			const player = this.playersInRoom[playerId];
			if (player instanceof CachoWorldPlayer) {
				if (playerId === this.localPlayerId) {
					const scale = this.worldTransform.a;
					const targetX = -player.x * scale + window.innerWidth * 0.5;
					const targetY = -player.y * scale + window.innerHeight * 0.5;

					this.worldContainer.x += (targetX - this.worldContainer.x) * 0.1;
					this.worldContainer.y += (targetY - this.worldContainer.y) * 0.1;
				}
				player.update(_dt);
			}
		}
	}

	public override destroy(_options?: any): void {
		console.log(`Destroying MultiplayerCachoWorldGameScene (Lobby)`);

		this.isDestroyed = true;

		if (this.firebaseUnsubscribe) {
			this.firebaseUnsubscribe();
			this.firebaseUnsubscribe = null;
			console.log("Firebase listener unsubscribed");
		}

		if (this.chatUnsubscribe) {
			this.chatUnsubscribe();
			this.chatUnsubscribe = null;
			console.log("Chat listener unsubscribed");
		}

		// NEW: Cleanup combat system
		if (this.combatSystem) {
			this.combatSystem.cleanup();
		}

		if (this.attackButton) {
			this.removeChild(this.attackButton);
			this.attackButton.destroy();
			this.attackButton = null;
		}

		for (const id in this.playersInRoom) {
			const player = this.playersInRoom[id];
			if (player) {
				this.worldContainer.removeChild(player);
				player.destroy();
			}
		}
		this.playersInRoom = {};

		if (this.joystick) {
			this.worldContainer.removeChild(this.joystick);
			this.joystick.destroy();
			this.joystick = null;
		}

		if (this.usernameInput && this.usernameInput.parentNode) {
			this.usernameInput.parentNode.removeChild(this.usernameInput);
		}
		if (this.chatInput && this.chatInput.parentNode) {
			this.chatInput.parentNode.removeChild(this.chatInput);
		}

		if (this.portalToRoom1) {
			this.worldContainer.removeChild(this.portalToRoom1);
		}
		if (this.portalToRoom2) {
			this.worldContainer.removeChild(this.portalToRoom2);
		}
		if (this.portalToRoom3) {
			this.worldContainer.removeChild(this.portalToRoom3);
		}

		super.destroy();

		console.log(`MultiplayerCachoWorldGameScene (Lobby) destroyed successfully`);
	}
}
