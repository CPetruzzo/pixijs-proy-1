/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Container, Graphics, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { Manager } from "../../..";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { MultiplayerScene } from "./MultiplayerScene";
import { SERVER_PORT } from "../../../utils/constants";

export class LobbyScene extends PixiScene {
	private socket: Socket;
	private createRoomButton: Graphics;
	private joinRoomButton: Graphics;
	private roomNameInput: HTMLInputElement; // Cuadro de texto HTML para ingresar el nombre de la sala
	private backgroundContainer: Container = new Container(); // Contenedor para todos los gráficos

	constructor() {
		super();
		this.socket = io(`http://localhost:${SERVER_PORT}`, {
			transports: ["websocket"],
		});

		// Escuchar eventos del socket solo una vez
		this.socket.on("roomCreated", (roomData) => {
			console.log(`Sala creada: ${roomData.roomName}`);
			this.startGame(roomData.roomName);
		});

		this.socket.on("roomJoined", (roomData) => {
			console.log(`Unido a la sala: ${roomData.roomName}`);
			this.startGame(roomData.roomName); // Iniciar el juego con el nombre de la sala
		});

		// Agregar backgroundContainer a la escena
		this.addChild(this.backgroundContainer);

		// Llamamos a la función para crear los botones y el cuadro de texto
		this.createLobbyUI();
	}

	private createLobbyUI(): void {
		const buttonWidth = 200;
		const buttonSpacing = 100;

		// Crear cuadro de texto HTML para ingresar el nombre de la sala
		this.roomNameInput = document.createElement("input");
		this.roomNameInput.type = "text";
		this.roomNameInput.placeholder = "Nombre de la sala";
		this.roomNameInput.style.position = "absolute";
		this.roomNameInput.style.left = `${window.innerWidth / 2 - buttonWidth / 2}px`;
		this.roomNameInput.style.top = `${window.innerHeight / 2 + buttonSpacing}px`;
		this.roomNameInput.style.fontSize = "24px";
		this.roomNameInput.style.padding = "12px";
		this.roomNameInput.style.borderRadius = "12px";
		this.roomNameInput.style.border = "2px solid #CBCEE0";
		document.body.appendChild(this.roomNameInput); // Agregar el input al DOM

		// Crear botón para crear sala
		this.createRoomButton = this.createButton("Crear Sala", window.innerWidth / 2 - buttonWidth / 2, window.innerHeight / 2 - buttonSpacing);
		this.createRoomButton.on("pointertap", () => {
			this.createRoom(); // Llama a la función de crear sala
		});

		// Crear botón para unirse a una sala
		this.joinRoomButton = this.createButton("Unirse a Sala", window.innerWidth / 2 - buttonWidth / 2, window.innerHeight / 2);
		this.joinRoomButton.on("click", () => {
			const roomName = this.roomNameInput.value; // Obtiene el nombre de la sala ingresado
			if (roomName) {
				this.joinRoom(roomName); // Llama a la función de unirse a sala
			} else {
				alert("Por favor ingresa un nombre de sala.");
			}
		});

		// Agregar los botones al contenedor
		this.backgroundContainer.addChild(this.createRoomButton, this.joinRoomButton);
	}

	private createButton(text: string, x: number, y: number): Graphics {
		const button = new Graphics();
		button.beginFill(0x3498db); // Color azul para el botón
		button.drawRect(0, 0, 200, 50);
		button.endFill();
		button.interactive = true;

		const buttonText = new Text(text, { fontSize: 24, fill: 0xffffff });
		buttonText.anchor.set(0.5);
		buttonText.x = 100; // Centro del botón
		buttonText.y = 25; // Centro del botón
		button.addChild(buttonText);

		button.x = x;
		button.y = y;

		return button;
	}

	private createRoom(): void {
		console.log("Intentando crear una sala...");
		const roomName = this.roomNameInput.value || "NuevaSala"; // Obtiene el nombre de la sala desde el input o usa uno por defecto
		this.socket.emit("createRoom", { roomName }); // Emitir el nombre de la sala

		// No necesitamos volver a escuchar el evento aquí
	}

	private joinRoom(room: string): void {
		// Emitir evento para unirse a la sala ingresada
		this.socket.emit("joinRoom", { roomName: room });

		// No es necesario volver a escuchar el evento aquí
	}

	private startGame(roomName: string): void {
		// Cambiar de escena al juego (por ejemplo, cambiar a MultiplayerScene)
		Manager.changeScene(MultiplayerScene, { sceneParams: [roomName], transitionClass: FadeColorTransition }); // Pasa el nombre de la sala
	}

	// Asegúrate de limpiar el input al cambiar de escena
	public cleanup(): void {
		if (this.roomNameInput) {
			document.body.removeChild(this.roomNameInput); // Eliminar el input del DOM
		}
	}
}
