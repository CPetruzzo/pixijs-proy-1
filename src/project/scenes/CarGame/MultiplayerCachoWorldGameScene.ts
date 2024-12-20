import { ref, set, onValue, onDisconnect, remove } from "firebase/database";
import { db } from "../../.."; // Asegúrate de que db esté correctamente exportado desde tu configuración de Firebase
import { Keyboard } from "../../../engine/input/Keyboard";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { JoystickMultiplayerCachoWorld } from "./JoystickMultiplayerCachoWorld";
import { CachoWorldPlayer } from "./CachoWorldPlayer";
import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

// Define the type for chat messages
type ChatMessage = {
	playerId: string;
	username: string;
	message: string;
};

export class MultiplayerCachoWorldGameScene extends PixiScene {
	private players: Record<string, CachoWorldPlayer> = {};
	private playerId: string;
	private joystick: JoystickMultiplayerCachoWorld;
	public static readonly BUNDLES = ["joystick", "cachoworld"];
	private worldContainer: Container = new Container();
	private backgroundContainer: Container = new Container();

	private chatContainer: Container;
	private chatInput: HTMLInputElement;

	private usernameInput: HTMLInputElement; // Nuevo input para username
	private username: string = ""; // Almacenar el username localmente
	// private hasSentMessage: boolean = false; // Flag para evitar el reenvío

	constructor() {
		super();

		this.addChild(this.backgroundContainer, this.worldContainer);
		// Crear un ID único para este jugador
		this.playerId = Date.now().toString(); // Usamos un timestamp único para el ID

		// Escuchar las actualizaciones de la base de datos
		this.listenForPlayersUpdates();
		// Añadir este jugador a Firebase
		this.addPlayerToDatabase();

		this.createChatUI();
		this.createUsernameForm();
		this.listenForChatUpdates();
	}

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

	// Guardar el username en Firebase
	private async saveUsernameToDatabase(username: string): Promise<void> {
		try {
			const playerRef = ref(db, `players/${this.playerId}/username`);
			await set(playerRef, username);
			console.log("Username saved to Firebase.");
		} catch (error) {
			console.error("Error saving username to Firebase:", error);
		}
	}

	// Escuchar cambios en la base de datos y actualizar jugadores en tiempo real
	// eslint-disable-next-line @typescript-eslint/require-await
	private async listenForPlayersUpdates(): Promise<void> {
		try {
			const playersRef = ref(db, "players");

			// Usar onValue para escuchar actualizaciones en tiempo real
			onValue(playersRef, (snapshot) => {
				if (snapshot.exists()) {
					const serverPlayers = snapshot.val() as Record<string, { x: number; y: number }>;
					console.log("Players received:", serverPlayers);

					for (const [id, playerData] of Object.entries(serverPlayers)) {
						// Si ya existe el jugador en el local, solo actualiza la posición
						if (this.players[id]) {
							this.players[id].x = playerData.x;
							this.players[id].y = playerData.y;
						} else if (id !== this.playerId) {
							// Crear sprites solo para jugadores remotos
							this.createPlayer(id, playerData.x, playerData.y);
						}
					}
				} else {
					console.log("No players in the database.");
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
			this.players[id] = player;
			this.worldContainer.addChild(player);
		}
	}

	private async addPlayerToDatabase(): Promise<void> {
		try {
			const playerRef = ref(db, `players/${this.playerId}`);
			await set(playerRef, { x: 0, y: 0 });

			// Establecer desconexión
			const playerOnDisconnectRef = ref(db, `players/${this.playerId}`);
			onDisconnect(playerOnDisconnectRef).remove();

			console.log("Player added to Firebase.");

			// Crear al jugador local después de añadirlo a Firebase
			this.createLocalPlayer();
		} catch (error) {
			console.error("Error adding player to Firebase:", error);
		}
	}

	private createLocalPlayer(): void {
		// Crear el jugador local en la escena
		const myPlayer = new CachoWorldPlayer(this.playerId, 0, 0);
		myPlayer.name = `Player${this.playerId}`;
		this.players[this.playerId] = myPlayer;
		this.worldContainer.addChild(myPlayer);

		// Crear el joystick
		this.joystick = new JoystickMultiplayerCachoWorld(myPlayer);
		this.worldContainer.addChild(this.joystick);
	}

	// Actualizar la posición del jugador en Firebase
	private async updatePlayerPositionInFirebase(): Promise<void> {
		try {
			const player = this.players[this.playerId];
			// console.log('player', player)
			if (player) {
				const playerRef = ref(db, `players/${this.playerId}`);
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

	// Lógica de actualización de la escena
	public override update(_dt: number): void {
		if (this.joystick) {
			this.joystick.updateJoystick();
			this.updatePlayerPositionInFirebase();
		}

		if (this.players[this.playerId]) {
			this.handleInput(); // Procesar la entrada del jugador local
		}

		// Actualizar todos los jugadores en la escena
		for (const playerId in this.players) {
			const player = this.players[playerId];
			if (player instanceof CachoWorldPlayer) {
				player.update(_dt); // Llama al método `update` de cada jugador
			}
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, _newW, _newH, 1600, 720, ScaleHelper.FIT);
		const worldContainerBounds = this.worldContainer.getLocalBounds();
		this.worldContainer.pivot.set(worldContainerBounds.width * 0.5, worldContainerBounds.height * 0.5);

		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, _newW, _newH, 720, 720, ScaleHelper.FILL);
		this.backgroundContainer.x = _newW * 0.5;
		this.backgroundContainer.y = _newH * 0.5;
		const backgroundContainerBounds = this.backgroundContainer.getLocalBounds();
		this.backgroundContainer.pivot.set(backgroundContainerBounds.width * 0.5, backgroundContainerBounds.height * 0.5);

		// ScaleHelper.setScaleRelativeToIdeal(this.chatContainer, _newW, _newH, 1600, 720, ScaleHelper.FIT);
		// const chatContainerBounds = this.chatContainer.getLocalBounds();
		// this.chatContainer.pivot.set(0, chatContainerBounds.height * 0.5);
		// this.chatContainer.y = _newH - this.chatContainer.height * 0.5;
	}

	// Crear la UI del chat
	private createChatUI(): void {
		// Contenedor para mensajes
		this.chatContainer = new Container();
		this.chatContainer.x = 10;
		this.chatContainer.y = window.innerHeight - 150; // Posición al fondo
		this.addChild(this.chatContainer);

		// Fondo del chat (opcional, para visibilidad)
		// Crear y añadir el Sprite de fondo
		const backgroundSprite = Sprite.from("background"); // Reemplaza "backgroundImage" con el nombre o ruta de tu recurso
		backgroundSprite.width = window.innerWidth;
		backgroundSprite.height = window.innerHeight;
		backgroundSprite.anchor.set(0.5); // Centrar el anclaje
		backgroundSprite.x = window.innerWidth / 2;
		backgroundSprite.y = window.innerHeight / 2;
		this.backgroundContainer.addChildAt(backgroundSprite, 0); // Asegúrate de añadirlo como el primer hijo

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
	// Update the chat listener
	private listenForChatUpdates(): void {
		const chatRef = ref(db, "chat");
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

	// Enviar mensaje al chat
	private async sendMessage(message: string): Promise<void> {
		if (message.trim() === "") {
			return;
		}

		const timestamp = Date.now(); // Usar un timestamp único para identificar el mensaje
		const chatRef = ref(db, `chat/${timestamp}`); // Indexar por timestamp
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
				if (messageKeys.length > 5) {
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
}
