import { Container, Text, TextStyle } from "pixi.js";
import type { CachoWorldPlayer } from "./CachoWorldPlayer";
import { onValue, ref, remove, set } from "firebase/database";
import { MAX_MESSAGES } from "../../../utils/constants";

export type ChatMessage = {
	playerId: string;
	username: string;
	message: string;
};

export enum Routes {
	CHAT = "chat",
	PLAYERS = "players",
}

export class Chat extends Container {
	public firebaseDatabase: any;
	private playerId: string;
	private container: Container;
	public username: string;
	private chatContainer: Container;
	public chatInput: HTMLInputElement;
	private players: Record<string, CachoWorldPlayer> = {};
	private usernameInput: HTMLInputElement; // Nuevo input para username

	constructor(firebaseDatabase: any, playerId: string, players: Record<string, CachoWorldPlayer>) {
		super();
		this.firebaseDatabase = firebaseDatabase;
		this.playerId = playerId;
		this.players = players;

		this.container = new Container();
		this.addChild(this.container);

		this.createChatUI();
		this.listenForChatUpdates();
	}

	public createChatUI(): void {
		// Contenedor para mensajes
		this.chatContainer = new Container();
		this.chatContainer.x = 10;
		this.chatContainer.y = window.innerHeight - 150; // Posición al fondo
		this.addChild(this.chatContainer);

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
	public listenForChatUpdates(): void {
		const chatRef = ref(this.firebaseDatabase, Routes.CHAT);
		onValue(chatRef, (snapshot) => {
			if (snapshot.exists()) {
				const messages: Record<string, ChatMessage & { x: number; y: number }> = snapshot.val() as Record<string, ChatMessage & { x: number; y: number }>;

				// Actualiza los mensajes en el chat del HUD
				this.updateChat(messages);

				// Actualiza los mensajes flotantes sobre los jugadores
				Object.values(messages).forEach((message) => {
					const player = this.getPlayerById(); // Busca el jugador por su ID
					if (player) {
						console.log("player", player.name);
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

	private getPlayerById(): CachoWorldPlayer | undefined {
		return this.players[this.playerId]; // Direct access by key
	}

	// Enviar mensaje al chat
	private async sendMessage(message: string): Promise<void> {
		if (message.trim() === "") {
			return;
		}

		const timestamp = Date.now(); // Usar un timestamp único para identificar el mensaje
		const chatRef = ref(this.firebaseDatabase, `${Routes.CHAT}/${timestamp}`); // Indexar por timestamp
		const player = this.players[this.playerId];
		await set(chatRef, {
			playerId: this.playerId,
			username: this.username,
			message: message,
			x: player.x, // Posición X del jugador
			y: player.y, // Posición Y del jugador
		});

		// Mostrar el mensaje sobre el jugador local solo si no hay un mensaje previo
		if (player) {
			player.showMessageAbove(message); // Asegúrate de que este método maneja la eliminación de mensajes anteriores
		}

		// Limitar a 5 mensajes: eliminar los más viejos si hay más de 5
		const chatRefAll = ref(this.firebaseDatabase, Routes.CHAT);
		onValue(chatRefAll, (snapshot) => {
			if (snapshot.exists()) {
				const messages = snapshot.val();
				const messageKeys = Object.keys(messages);

				// Si hay más de 5 mensajes, eliminar el más viejo
				if (messageKeys.length > MAX_MESSAGES) {
					const oldestKey = messageKeys[0]; // El más antiguo es el primero en la lista
					const oldestMessageRef = ref(this.firebaseDatabase, `${Routes.CHAT}/${oldestKey}`);
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

	public createUsernameForm(): void {
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
			const playerRef = ref(this.firebaseDatabase, `${Routes.PLAYERS}/${this.playerId}/username`);
			await set(playerRef, username);
			console.log("Username saved to Firebase.");
		} catch (error) {
			console.error("Error saving username to Firebase:", error);
		}
	}
}
