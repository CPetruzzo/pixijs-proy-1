import { ref, set, onValue, onDisconnect, remove } from "firebase/database";
import { db } from "../../..";
import { Keyboard } from "../../../engine/input/Keyboard";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { JoystickMultiplayerCachoWorld } from "./JoystickMultiplayerCachoWorld";
import { CachoWorldPlayer } from "./CachoWorldPlayer";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { MAX_MESSAGES } from "../../../utils/constants";

import { WorldMap } from "./WorldMap";
import {
	ChatMessage,
	// Chat, 
	Routes
} from "./Chat";

export class MultiplayerCachoWorldGameScene extends PixiScene {
	//#region VARIABLES
	private players: Record<string, CachoWorldPlayer> = {};
	private playerId: string;
	private joystick: JoystickMultiplayerCachoWorld;
	public static readonly BUNDLES = ["joystick", "cachoworld"];
	private worldContainer: Container = new Container();
	private chatContainer: Container;
	private chatInput: HTMLInputElement;

	private usernameInput: HTMLInputElement; // Nuevo input para username
	private username: string = ""; // Almacenar el username localmente


	private localPlayerId: string;
	private worldMap: WorldMap;
	private debugGraphics: Graphics;
	// private chat: Chat;
	//#endregion VARIABLES
	constructor() {
		super();
		this.worldContainer.name = "WorldContainer";
		this.addChild(this.worldContainer);

		this.playerId = Date.now().toString();

		this.createMap();
		this.debugGraphics = new Graphics();

		this.listenForPlayersUpdates();
		this.addPlayerToDatabase();
		this.createChatUI();


		// this.chat = new Chat(db, this.playerId, this.players);
		// this.addChild(this.chat);
		this.createUsernameForm();
		this.listenForChatUpdates();

	}

	private createMap(debug: boolean = false): void {
		this.worldMap = new WorldMap();
		// this.worldMap.pivot.set(this.worldMap.width * 0.5, this.worldMap.height * 0.5);
		this.worldContainer.addChildAt(this.worldMap, 0);

		if (debug) {
			this.worldMap.addChild(this.debugGraphics);
		}
	}

	//#region USERFORM
	private createUsernameForm(): void {
		this.usernameInput = document.createElement("input");
		this.usernameInput.type = "text";
		this.usernameInput.placeholder = "Enter your username";
		this.usernameInput.style.position = "absolute";
		this.usernameInput.style.top = "10px";
		this.usernameInput.style.left = "10px";
		this.usernameInput.style.width = "200px";
		document.body.appendChild(this.usernameInput);

		const saveButton = document.createElement("button");
		saveButton.innerHTML = "Save Username";
		saveButton.style.position = "absolute";
		saveButton.style.top = "40px";
		saveButton.style.left = "10px";
		document.body.appendChild(saveButton);

		saveButton.addEventListener("click", () => {
			const inputValue = this.usernameInput.value.trim();
			if (inputValue !== "") {
				this.username = inputValue;
				this.saveUsernameToDatabase(inputValue); // Guardar en Firebase
				this.usernameInput.disabled = true; // Deshabilitar el campo después de guardarlo
				saveButton.disabled = true; // Deshabilitar el botón después de guardar
				this.chatInput.disabled = false; // Habilitar el chat después de guardar el username
			} else {
				alert("Please enter a valid username.");
			}
		});
	}

	private async saveUsernameToDatabase(username: string): Promise<void> {
		try {
			const playerRef = ref(db, `${Routes.PLAYERS}/${this.playerId}/username`);
			await set(playerRef, username);
			console.log("Username saved to Firebase.");
		} catch (error) {
			console.error("Error saving username to Firebase:", error);
		}
	}
	//#endregion USERFORM

	//#region PLAYER
	// Escuchar cambios en la base de datos y actualizar jugadores en tiempo real
	// eslint-disable-next-line @typescript-eslint/require-await
	private async listenForPlayersUpdates(): Promise<void> {
		try {
			const playersRef = ref(db, `${Routes.PLAYERS}`);

			// Usar onValue para escuchar actualizaciones en tiempo real
			onValue(playersRef, (snapshot) => {
				const serverPlayers = snapshot.exists() ? (snapshot.val() as Record<string, { x: number; y: number }>) : {};

				// Detectar jugadores eliminados
				const disconnectedPlayers = Object.keys(this.players).filter((id) => !serverPlayers[id]);

				// Eliminar los jugadores desconectados de la escena
				disconnectedPlayers.forEach((id) => {
					console.log(`Player ${id} disconnected, removing from scene.`);
					const player = this.players[id];
					if (player) {
						this.worldContainer.removeChild(player); // Eliminar del contenedor
						delete this.players[id]; // Eliminar del registro local
					}
				});

				// Actualizar o añadir jugadores activos
				for (const [id, playerData] of Object.entries(serverPlayers)) {
					// Ignorar al jugador local
					if (id === this.localPlayerId) {
						continue;
					}

					if (this.players[id]) {
						// Actualizar posición
						this.players[id].x = playerData.x;
						this.players[id].y = playerData.y;
					} else {
						// Crear sprites para nuevos jugadores
						this.createPlayer(id, playerData.x, playerData.y);
						console.log("id", id);
					}
				}
			});
		} catch (error) {
			console.error("Error fetching players from Firebase:", error);
		}
	}

	private createPlayer(id: string, x: number, y: number): void {
		if (id !== this.playerId) {
			console.log(`Creating player ${id} at (${x}, ${y})`);
			const player = new CachoWorldPlayer(id, x, y);
			player.name = `Player_${id}`; // Asignar nombre único al jugador
			this.players[id] = player;
			this.worldContainer.addChild(player);
		}
	}

	private createLocalPlayer(): void {
		// Crear el jugador local en la escena
		const myPlayer = new CachoWorldPlayer(this.playerId, 0, 0);
		myPlayer.name = `Player_${this.playerId}`; // Asignar nombre único al jugador local
		this.localPlayerId = this.playerId;
		this.players[this.playerId] = myPlayer;
		console.log("this.playerId", this.playerId);
		this.worldContainer.addChild(myPlayer);

		// Crear el joystick
		this.joystick = new JoystickMultiplayerCachoWorld(myPlayer);
		this.joystick.name = `Joystick_Player_${this.playerId}`; // Nombre para el joystick
		this.worldContainer.addChild(this.joystick);
	}

	private async addPlayerToDatabase(): Promise<void> {
		try {
			const playerRef = ref(db, `${Routes.PLAYERS}/${this.playerId}`);
			await set(playerRef, { x: 150, y: 150 });

			// Establecer desconexión
			const playerOnDisconnectRef = ref(db, `${Routes.PLAYERS}/${this.playerId}`);
			onDisconnect(playerOnDisconnectRef).remove();

			console.log("Player added to Firebase.");

			// Crear al jugador local después de añadirlo a Firebase
			this.createLocalPlayer();
		} catch (error) {
			console.error("Error adding player to Firebase:", error);
		}
	}

	// Actualizar la posición del jugador en Firebase
	private async updatePlayerPositionInFirebase(): Promise<void> {
		try {
			const player = this.players[this.playerId];
			// console.log('player', player)
			if (player) {
				const playerRef = ref(db, `${Routes.PLAYERS}/${this.playerId}`);
				await set(playerRef, { x: player.x, y: player.y });
				// console.log("Player position updated in Firebase.");
			}
		} catch (error) {
			console.error("Error updating player position in Firebase:", error);
		}
	}

	private handleInput(): void {
		let speed = 0;
		let direction = 0;

		// Procesar entrada del teclado para el jugador local
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

		// Obtener el jugador local
		const player = this.players[this.playerId];
		if (!player) {
			console.warn("No local player found with ID:", this.playerId);
			return;
		}

		// Actualizar animación solo para el jugador local
		if (speed === 0) {
			if (player.animator.currentStateName !== "idle") {
				player.animator.playState("idle");
			}
		} else {
			if (player.animator.currentStateName !== "bouncing") {
				player.animator.playState("bouncing");
			}
		}

		// Mover al jugador local si hay velocidad
		if (speed !== 0 || direction !== 0) {
			player.move(speed, direction);
			this.updatePlayerPositionInFirebase(); // Actualizar en Firebase solo para el jugador local
		}
	}
	//#endregion PLAYER

	// //#region CHAT
	// Crear la UI del chat
	private createChatUI(): void {
		// Contenedor para mensajes
		this.chatContainer = new Container();
		this.chatContainer.x = 10;
		this.chatContainer.y = window.innerHeight - 150; // Posición al fondo
		this.addChild(this.chatContainer);

		this.worldMap = new WorldMap();
		this.worldMap.pivot.set(this.worldMap.width * 0.5, this.worldMap.height * 0.5);
		this.worldContainer.addChildAt(this.worldMap, 0);

		this.debugGraphics = new Graphics();
		this.worldMap.addChild(this.debugGraphics);

		// Campo de texto para mensajes
		this.chatInput = document.createElement("input");
		this.chatInput.type = "text";
		this.chatInput.placeholder = "Type your message...";
		this.chatInput.style.position = "absolute";
		this.chatInput.style.bottom = "10px";
		this.chatInput.style.left = "10px";
		this.chatInput.style.width = "200px";
		this.chatInput.style.zIndex = "1000";
		document.body.appendChild(this.chatInput);

		// Deshabilitar el chat input hasta que se ingrese el username
		this.chatInput.disabled = true;

		// Enviar mensaje al presionar Enter
		this.chatInput.addEventListener("keydown", (e) => {
			// Solo verificar cuando se presiona Enter
			if (e.key === "Enter") {
				// Verificar si ya se tiene un nombre de usuario
				if (this.username !== "") {
					this.sendMessage(this.chatInput.value);
					this.chatInput.value = ""; // Limpiar el campo de texto
				} else {
					alert("You must enter a username first!");
				}
			}
		});
	}

	// Escuchar actualizaciones del chat en Firebase
	private listenForChatUpdates(): void {
		const chatRef = ref(db, Routes.CHAT);
		onValue(chatRef, (snapshot) => {
			if (snapshot.exists()) {
				const messages: Record<string, ChatMessage & { x: number; y: number }> = snapshot.val() as Record<string, ChatMessage & { x: number; y: number }>;

				// Actualiza los mensajes en el chat del HUD
				this.updateChat(messages);

				// Actualiza los mensajes flotantes sobre los jugadores
				Object.values(messages).forEach((message) => {
					const player = this.getPlayerById(message.playerId); // Busca el jugador por su ID
					if (player) {
						// Verifica si el mensaje ya fue visto por el jugador
						const messageKey = `${message.playerId}:${message.message}`; // Combinamos el playerId y el mensaje para asegurar que sea único

						if (!player.seenMessages.has(messageKey)) {
							// Eliminar mensaje previo si existe
							player.removeMessage(); // Asegúrate de que tengas este método en el jugador

							// Mostrar el mensaje sobre el jugador
							player.showMessageAbove(message.message);

							// Marcar el mensaje como visto
							player.seenMessages.add(messageKey); // Agregamos el mensaje al conjunto de mensajes vistos
						}
					}
				});
			} else {
				console.log("No chat messages found in database.");
			}
		});
	}

	private getPlayerById(playerId: string): CachoWorldPlayer | undefined {
		return this.players[playerId]; // Direct access by key
	}

	// // Enviar mensaje al chat
	private async sendMessage(message: string): Promise<void> {
		if (message.trim() === "") {
			return;
		}

		const timestamp = Date.now(); // Usar un timestamp único para identificar el mensaje
		const chatRef = ref(db, `${Routes.CHAT}/${timestamp}`); // Indexar por timestamp
		await set(chatRef, {
			playerId: this.playerId,
			username: this.username,
			message: message,
			x: this.x, // Posición X del jugador
			y: this.y, // Posición Y del jugador
		});

		// Mostrar el mensaje sobre el jugador local solo si no hay un mensaje previo
		const player = this.players[this.playerId];
		if (player) {
			player.showMessageAbove(message); // Asegúrate de que este método maneja la eliminación de mensajes anteriores
		}

		// Limitar a 5 mensajes: eliminar los más viejos si hay más de 5
		const chatRefAll = ref(db, "chat");
		onValue(chatRefAll, (snapshot) => {
			if (snapshot.exists()) {
				const messages = snapshot.val();
				const messageKeys = Object.keys(messages);

				// Si hay más de 5 mensajes, eliminar el más viejo
				if (messageKeys.length > MAX_MESSAGES) {
					const oldestKey = messageKeys[0]; // El más antiguo es el primero en la lista
					const oldestMessageRef = ref(db, `chat/${oldestKey}`);
					// Eliminar el mensaje más antiguo
					remove(oldestMessageRef);
				}
			}
		});
	}

	private updateChat(messages: Record<string, { playerId: string; username: string; message: string }>): void {
		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 14,
			fill: "white",
			wordWrap: true,
			wordWrapWidth: 300,
		});

		// Crear un arreglo con los nuevos mensajes ordenados por su ID o cualquier otro criterio
		const sortedMessages = Object.values(messages);

		// Eliminar todos los mensajes anteriores
		this.chatContainer.removeChildren(); // Eliminar todos los mensajes previos, solo deja el fondo

		let positionY = 0; // Inicializamos la posición Y para los mensajes

		// Agregar los nuevos mensajes
		sortedMessages.forEach((messageData, _index) => {
			// Verifica si ya existe un mensaje con este contenido
			const existingMessage = this.chatContainer.children.find((child) => {
				return child instanceof Text && child.text === `${messageData.username}: ${messageData.message}`;
			});

			if (!existingMessage) {
				const messageText = new Text(`${messageData.username}: ${messageData.message}`, textStyle);
				messageText.x = 0;
				messageText.y = positionY; // Posicionamos el mensaje en la posición actual

				this.chatContainer.addChild(messageText);

				// Aumentamos la posición Y para el siguiente mensaje
				positionY += messageText.height + 5; // Añadimos un pequeño margen entre los mensajes
			}
		});
	}
	//#endregion CHAT
	public override onResize(_newW: number, _newH: number): void {
		this.worldContainer.x = _newW * 0.5;
		this.worldContainer.y = _newH * 0.5;

		const worldContainerBounds = this.worldContainer.getLocalBounds();
		// Dibujar los límites en el debugGraphics
		this.debugGraphics.clear();
		this.debugGraphics.lineStyle(2, 0xff0000, 1); // Líneas rojas para debug
		this.debugGraphics.drawRect(
			this.worldMap.x - this.worldMap.width * 0.5,
			this.worldMap.y - this.worldMap.height * 0.5,
			worldContainerBounds.width,
			worldContainerBounds.height
		);
	}

	// Lógica de actualización de la escena
	public override update(_dt: number): void {
		if (this.joystick) {
			this.joystick.updateJoystick();
			this.updatePlayerPositionInFirebase();
		}

		if (this.players[this.playerId]) {
			this.handleInput();
		}

		// Actualizar todos los jugadores en la escena
		for (const playerId in this.players) {
			const player = this.players[playerId];
			if (player instanceof CachoWorldPlayer) {
				// Centrar la cámara en el jugador local
				if (playerId === this.playerId) {
					const scale = this.worldTransform.a; // Factor de escala
					const targetX = -player.x * scale + window.innerWidth * 0.5;
					const targetY = -player.y * scale + window.innerHeight * 0.5;

					// Aplicar interpolación suave para evitar desfase
					this.worldContainer.x += (targetX - this.worldContainer.x) * 0.1; // Ajusta el factor para suavizar
					this.worldContainer.y += (targetY - this.worldContainer.y) * 0.1;
				}
				player.update(_dt); // Llama al método `update` de cada jugador
			}
		}

	}
}
