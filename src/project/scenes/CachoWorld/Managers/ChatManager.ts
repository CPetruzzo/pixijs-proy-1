import { ref, set, onValue, remove } from "firebase/database";
import { db } from "../../../..";
import { Container, Text, TextStyle } from "pixi.js";
import { MAX_MESSAGES } from "../../../../utils/constants";
import type { CachoWorldPlayer } from "../CachoWorldPlayer";

export interface ChatMessage {
	playerId: string;
	username: string;
	message: string;
	timestamp: number;
}

export class ChatManager {
	private chatContainer: Container;
	private chatInput: HTMLInputElement;
	private chatUnsubscribe: (() => void) | null = null;
	private roomId: string;
	private localPlayerId: string;
	private username: string;
	private getPlayerById: (playerId: string) => CachoWorldPlayer | undefined;

	constructor(roomId: string, localPlayerId: string, username: string, getPlayerById: (playerId: string) => CachoWorldPlayer | undefined) {
		this.roomId = roomId;
		this.localPlayerId = localPlayerId;
		this.username = username;
		this.getPlayerById = getPlayerById;

		this.chatContainer = new Container();
		this.chatContainer.x = 10;
		this.chatContainer.y = window.innerHeight - 150;

		this.createChatInput();
		this.listenForChatUpdates();
	}

	public getChatContainer(): Container {
		return this.chatContainer;
	}

	private createChatInput(): void {
		this.chatInput = document.createElement("input");
		this.chatInput.type = "text";
		this.chatInput.placeholder = "Type your message...";
		this.chatInput.style.position = "absolute";
		this.chatInput.style.bottom = "10px";
		this.chatInput.style.left = "10px";
		this.chatInput.style.width = "200px";
		this.chatInput.style.zIndex = "1000";
		document.body.appendChild(this.chatInput);

		// Prevent Space and Arrow keys from being captured by game controls
		this.chatInput.addEventListener("keydown", (e) => {
			if (e.key === " " || ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
				e.stopPropagation();
			}

			if (e.key === "Enter") {
				this.sendMessage(this.chatInput.value);
				this.chatInput.value = "";
			}
		});
	}

	private listenForChatUpdates(): void {
		const chatRef = ref(db, `chat/${this.roomId}`);

		this.chatUnsubscribe = onValue(chatRef, (snapshot) => {
			if (snapshot.exists()) {
				const messages: Record<string, ChatMessage> = snapshot.val() as Record<string, ChatMessage>;

				this.updateChatDisplay(messages);

				// Show messages above players
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

	private async sendMessage(message: string): Promise<void> {
		if (message.trim() === "") {
			return;
		}

		const timestamp = Date.now();
		const chatRef = ref(db, `chat/${this.roomId}/${timestamp}`);

		await set(chatRef, {
			playerId: this.localPlayerId,
			username: this.username,
			message: message,
			timestamp: timestamp,
		});

		// Show message above local player
		const player = this.getPlayerById(this.localPlayerId);
		if (player) {
			player.showMessageAbove(message);
		}

		// Limit messages in this room
		this.limitMessages();

		// <-- Desenfocar el input para volver a controlar el juego con el teclado
		this.chatInput.blur();
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async limitMessages(): Promise<void> {
		const chatRef = ref(db, `chat/${this.roomId}`);
		onValue(
			chatRef,
			(snapshot) => {
				if (snapshot.exists()) {
					const messages = snapshot.val();
					const messageKeys = Object.keys(messages);

					if (messageKeys.length > MAX_MESSAGES) {
						const oldestKey = messageKeys[0];
						const oldestMessageRef = ref(db, `chat/${this.roomId}/${oldestKey}`);
						remove(oldestMessageRef);
					}
				}
			},
			{ onlyOnce: true }
		);
	}

	private updateChatDisplay(messages: Record<string, ChatMessage>): void {
		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 14,
			fill: "white",
			wordWrap: true,
			wordWrapWidth: 300,
		});

		// Sort messages by timestamp
		const sortedMessages = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);
		this.chatContainer.removeChildren();

		let positionY = 0;

		sortedMessages.forEach((messageData) => {
			const messageText = new Text(`${messageData.username}: ${messageData.message}`, textStyle);
			messageText.x = 0;
			messageText.y = positionY;

			this.chatContainer.addChild(messageText);
			positionY += messageText.height + 5;
		});
	}

	public destroy(): void {
		// Unsubscribe from chat listener
		if (this.chatUnsubscribe) {
			this.chatUnsubscribe();
			this.chatUnsubscribe = null;
		}

		// Remove chat input from DOM
		if (this.chatInput && this.chatInput.parentNode) {
			this.chatInput.parentNode.removeChild(this.chatInput);
		}

		// Destroy chat container
		this.chatContainer.destroy();
	}
}
