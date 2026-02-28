import { ref, onValue, set, onDisconnect } from "firebase/database";
import { db } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { UsernameManager } from "../CachoWorld/Managers/UsernameManager";
import { MultiplayerMaskScene } from "./MultiplayerMaskScene";
import { Manager } from "../../..";

export class MaskLobbyScene extends PixiScene {
	private playersRef: any;
	private localPlayerId: string;
	private roomId: string = "halloween_heist_1";
	private playersCountText: Text;
	private playersInLobby: Record<string, Sprite> = {};
	private worldContainer: Container = new Container();
	public static readonly BUNDLES = ["ggj2026", "donotdelete"];

	constructor() {
		super();
		this.localPlayerId = UsernameManager.getOrCreatePlayerId();
		this.playersRef = ref(db, `rooms/${this.roomId}/players`);

		// Fondo de la habitación (house.jpg)
		const bg = Sprite.from("house");
		bg.anchor.set(0.5);
		this.worldContainer.addChild(bg);
		this.addChild(this.worldContainer);

		this.setupUI();
		this.joinLobby();
		this.listenForPlayers();
	}

	private setupUI(): void {
		const style = new TextStyle({ fill: "#ffffff", fontSize: 24, fontWeight: "bold", stroke: "#000000", strokeThickness: 4 });
		this.playersCountText = new Text("Esperando jugadores (1/5)...", style);
		this.playersCountText.anchor.set(0.5);
		this.playersCountText.y = -300;
		this.addChild(this.playersCountText);
	}

	private async joinLobby(): Promise<void> {
		const myRef = ref(db, `rooms/${this.roomId}/players/${this.localPlayerId}`);
		await set(myRef, {
			id: this.localPlayerId,
			ready: true,
			loading: true, // Flag para evitar que otros intenten movernos antes de tiempo
			mask: "pumpkin_mask",
			x: 1100,
			y: -50,
		});
		onDisconnect(myRef).remove();
	}

	private listenForPlayers(): void {
		onValue(this.playersRef, (snapshot) => {
			const players = snapshot.val() || {};
			const count = Object.keys(players).length;
			this.playersCountText.text = `Jugadores listos: ${count}/5`;

			// Renderizar avatares simples en el lobby
			this.updatePlayerVisuals(players);

			if (count >= 5) {
				// Pequeño delay antes de empezar
				setTimeout(() => {
					Manager.changeScene(MultiplayerMaskScene, { sceneParams: [this.localPlayerId, this.roomId] });
				}, 2000);
			}
		});
	}

	private updatePlayerVisuals(players: any): void {
		// 1. Limpieza de desconectados
		Object.keys(this.playersInLobby).forEach((id) => {
			if (!players[id]) {
				const sprite = this.playersInLobby[id];
				if (sprite && !sprite.destroyed) {
					this.worldContainer.removeChild(sprite);
					sprite.destroy();
				}
				delete this.playersInLobby[id];
			}
		});

		// 2. Posicionamiento seguro
		Object.keys(players).forEach((id, index) => {
			// Solo creamos si no existe y tiene máscara válida
			if (!this.playersInLobby[id] && players[id]?.mask) {
				try {
					const pSprite = Sprite.from(players[id].mask);
					pSprite.anchor.set(0.5);
					this.worldContainer.addChild(pSprite);
					this.playersInLobby[id] = pSprite;
				} catch (e) {
					console.error("No se pudo crear sprite para:", id);
				}
			}

			// --- SOLUCIÓN AL CRASH ---
			// Verificamos que el sprite EXISTA y NO ESTÉ DESTRUIDO antes de moverlo
			const sprite = this.playersInLobby[id];
			if (sprite && !sprite.destroyed && sprite.position) {
				sprite.x = -200 + index * 100;
				sprite.y = 150;
			}
		});
	}

	public override onResize(w: number, h: number): void {
		this.worldContainer.x = w / 2;
		this.worldContainer.y = h / 2;
	}
}
