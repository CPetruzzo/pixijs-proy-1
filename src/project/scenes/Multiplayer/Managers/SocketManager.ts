import { Socket, io } from "socket.io-client";

export class SocketManager {
	private socket: Socket;
	private room: string;

	constructor(serverUrl: string = 'http://localhost:1234', room: string = 'gameRoom1') {
		this.socket = io(serverUrl, { transports: ['websocket'] });
		this.room = room;
		this.setupSocketListeners();
	}

	private setupSocketListeners() {
		this.socket.on('connect', () => {
			console.log('Connected to server');
			this.joinRoom();
		});
	}

	public joinRoom() {
		this.socket.emit('joinRoom', this.room);
	}

	public onRoomJoined(callback: (data: any) => void) {
		this.socket.on('roomJoined', (initialState) => callback(initialState));
	}

	public onUpdateGame(callback: (data: any) => void) {
		this.socket.on('updateGame', (data) => callback(data));
	}

	public playerTurn(data: { action: string, playerId: string, x: number, y: number }) {
		this.socket.emit('turnPlayed', {
			room: this.room,
			playerData: data
		});
	}
}
