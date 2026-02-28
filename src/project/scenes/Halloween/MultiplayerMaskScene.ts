import { ref, onValue, update, runTransaction, off } from "firebase/database";
import { db } from "../../..";
import { MaskScene } from "../ggj2026/MaskScene";
import { PlayerAvatar } from "../../../engine/utils/PlayerAvatar";
import { Item, ItemType } from "../../../engine/storagemanager/Item";
import { Keyboard } from "../../../engine/input/Keyboard";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { EquipmentManager } from "../../../engine/storagemanager/EquipmentManager";

export class MultiplayerMaskScene extends MaskScene {
	private localPlayerId: string;
	private roomId: string;
	private remotePlayers: Record<string, PlayerAvatar> = {};
	private hasReceivedFirstSync: boolean = false; // Flag nuevo
	// IMPORTANTE: Referencia para limpiar el listener
	private playersRef: any;

	constructor(playerId: string, roomId: string) {
		super();
		this.localPlayerId = playerId;
		this.roomId = roomId;
		this.playersRef = ref(db, `rooms/${this.roomId}/players`);

		this.setupMultiplayerSync();
	}

	// En MultiplayerMaskScene.ts

	private setupMultiplayerSync(): void {
		onValue(this.playersRef, (snap) => {
			const serverPlayers = snap.val() || {};
			if (this.destroyed) {
				return;
			}

			for (const [id, data] of Object.entries(serverPlayers)) {
				if (!data) {
					continue;
				}

				if (id === this.localPlayerId) {
					const serverX = (data as any).x;
					const serverY = (data as any).y;

					// Si recibimos una posición distinta a la inicial,
					// marcamos que ya estamos sincronizados
					if (serverX !== 1100 || serverY !== -50) {
						this.hasReceivedFirstSync = true;
					}

					// Ignorar el 1100/-50 de Firebase si ya nos movimos
					if (serverX === 1100 && serverY === -50) {
						continue;
					}

					const distSq = Math.pow(this.player.x - serverX, 2) + Math.pow(this.player.y - serverY, 2);
					if (distSq > 2500) {
						this.player.x = serverX;
						this.player.y = serverY;
					}
					continue;
				}
				this.updateRemotePlayer(id, data);
			}
		});
	}
	public override destroy(): void {
		// Cerramos cualquier diálogo activo para que no intente acceder a posiciones de objetos muertos
		DialogueOverlayManager.dispose();

		// IMPORTANTE: Detenemos el listener de Firebase inmediatamente
		if (this.playersRef) {
			off(this.playersRef);
		}

		Object.values(this.remotePlayers).forEach((rp) => {
			if (!rp.destroyed) {
				rp.destroy();
			}
		});
		this.remotePlayers = {};

		super.destroy();
	}

	private updateRemotePlayer(id: string, data: any): void {
		if (!data) {
			return;
		}

		// 1. Creación defensiva
		if (!this.remotePlayers[id]) {
			const remoteEquip = new EquipmentManager(`remote_storage_${id}`);
			const remote = new PlayerAvatar(remoteEquip, 0xffffff, "kid");

			// IMPORTANTE: Asegurarnos de que el objeto esté en el mundo antes de registrarlo
			this.world.addChild(remote);
			this.remotePlayers[id] = remote;
		}

		const rp = this.remotePlayers[id];

		// 2. FILTRO DE FOCUS/INICIALIZACIÓN:
		// Solo permitimos el movimiento si el sprite existe, no está destruido,
		// tiene el objeto position activo y YA está dentro del world (parent != null)
		if (rp && !rp.destroyed && rp.position && rp.parent) {
			rp.x = data.x;
			rp.y = data.y;

			if (data.image) {
				this.syncRemoteMask(rp, data.image);
			}
		}
	}

	private syncRemoteMask(remotePlayer: PlayerAvatar, maskName: string): void {
		const currentEquipped = remotePlayer.equipmentManager.getEquippedItem(ItemType.HELMET);
		if (!currentEquipped || currentEquipped.itemName !== maskName) {
			const tempMask = new Item(maskName, 0, 1, "Rival Mask", maskName, ItemType.HELMET);
			remotePlayer.equipmentManager.equipItem(tempMask);
		}
	}

	// NUEVA MECÁNICA: Sabotaje (Susto)
	private handleSabotage(): void {
		if (Keyboard.shared.justPressed("KeyQ")) {
			// Buscar jugador más cercano
			for (const id in this.remotePlayers) {
				const rp = this.remotePlayers[id];
				const dist = Math.hypot(this.player.x - rp.x, this.player.y - rp.y);

				if (dist < 100) {
					this.sendBoo(id);
					break;
				}
			}
		}
	}

	private sendBoo(targetId: string): void {
		const targetRef = ref(db, `rooms/${this.roomId}/players/${targetId}/suspicion`);
		runTransaction(targetRef, (currentSuspicion) => {
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			return (currentSuspicion || 0) + 15;
		});
		DialogueOverlayManager.talk("¡BOO! Le diste un susto al rival.");
	}

	public override update(dt: number): void {
		super.update(dt);
		if (this.isGameOver) {
			return;
		}

		// --- SOLUCIÓN AL RESET ---
		// Si no hemos recibido una posición real del servidor O
		// seguimos en la posición default, NO enviamos nada a Firebase.
		// Esto evita que las pestañas en segundo plano sobreescriban la posición real.
		if (!this.hasReceivedFirstSync && this.player.x === 1100 && this.player.y === -50) {
			return;
		}

		const myRef = ref(db, `rooms/${this.roomId}/players/${this.localPlayerId}`);
		update(myRef, {
			x: this.player.x,
			y: this.player.y,
			currentMask: this.equipmentManager.getEquippedItem(ItemType.HELMET)?.itemName || null,
			candies: this.candies,
			suspicion: this.suspicion,
		});

		this.handleSabotage();
	}
}
