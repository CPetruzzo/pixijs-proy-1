import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { BoardManager } from "./Managers/BoardManager";
import { SocketManager } from "./Managers/SocketManager";
import { UIManager } from "./Managers/UIManager";
// import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SERVER_PORT } from "../../../utils/constants";

export class MultiplayerScene extends PixiScene {
	private socketManager: SocketManager;
	private boardManager: BoardManager;
	private uiManager: UIManager;

	private playerSymbol: string;
	private opponentSymbol: string;

	constructor(serverUrl: string = `http://localhost:${SERVER_PORT}`) {
		super();

		this.socketManager = new SocketManager(serverUrl);
		this.boardManager = new BoardManager(this);
		this.uiManager = new UIManager(this);

		this.setupSocketListeners();
	}

	private setupSocketListeners(): void {
		this.socketManager.onRoomJoined((initialState) => {
			this.playerSymbol = initialState.playerSymbol;
			this.opponentSymbol = this.playerSymbol === "X" ? "O" : "X";
			this.uiManager.updatePlayerSymbols(this.playerSymbol, this.opponentSymbol);
			this.boardManager.drawBoard(this.handleCellClick.bind(this));
		});

		this.socketManager.onUpdateGame((data) => {
			this.boardManager.updateBoard(data.x, data.y, data.playerId);
			const winner = this.boardManager.checkWinner();
			if (winner) {
				alert(`Player ${winner} wins!`);
			}
		});
	}

	private handleCellClick(row: number, col: number): void {
		if (this.boardManager.isGameActive && this.playerSymbol) {
			this.socketManager.playerTurn({ action: "move", playerId: this.playerSymbol, x: row, y: col });
		}
	}

	// public override onResize(_newW: number, _newH: number): void {
	// 	ScaleHelper.setScaleRelativeToIdeal(this, _newW, _newH);
	// 	this.x = _newW * 0.5;
	// 	this.y = _newH * 0.5;
	// }
}
