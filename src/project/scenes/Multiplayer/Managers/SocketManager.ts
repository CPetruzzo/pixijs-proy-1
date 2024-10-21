import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { SERVER_PORT } from "../../../../utils/constants";

export class SocketManager {
	private socket: Socket;
	private room: string;

	constructor(serverUrl: string = `http://localhost:${SERVER_PORT}`, room: string = "gameRoom1") {
		this.socket = io(serverUrl, { transports: ["websocket"] });
		this.room = room;
		this.setupSocketListeners();
	}

	private setupSocketListeners(): void {
		this.socket.on("connect", () => {
			console.log("Connected to server");
			this.joinRoom();
		});
	}

	public joinRoom(): void {
		this.socket.emit("joinRoom", this.room);
	}

	public onRoomJoined(callback: (data: any) => void): void {
		this.socket.on("roomJoined", (initialState: any) => callback(initialState));
	}

	public onUpdateGame(callback: (data: any) => void): void {
		this.socket.on("updateGame", (data: any) => callback(data));
	}

	public playerTurn(data: { action: string; playerId: string; x: number; y: number }): void {
		this.socket.emit("turnPlayed", {
			room: this.room,
			playerData: data,
		});
	}
}
