import type { Container, Graphics } from "pixi.js";
import type { BaseNPC } from "./NPCClasses";
import { FriendlyNPC, AggressiveNPC, CustomerState, CustomerNPC } from "./NPCClasses";
import type { InteractableItem, InteractableManager } from "../utils/InteractableManager";
import { DialogueOverlayManager } from "../dialog/DialogueOverlayManager";
import { OverlayMode } from "../dialog/DialogOverlay";

export class NPCManager {
	private npcs: BaseNPC[] = [];
	private worldContainer: Container;
	private interactManager: InteractableManager;
	private obstacles: Graphics[]; // Guardamos referencia a las paredes
	private customerPool: CustomerNPC[] = []; // El "Depósito" de NPCs inactivos
	constructor(
		worldContainer: Container,
		interactManager: InteractableManager,
		walls: Graphics[] // Solo guardamos walls, no creamos grid
	) {
		this.worldContainer = worldContainer;
		this.interactManager = interactManager;
		this.obstacles = walls;
	}

	public spawnStaticFriendly(x: number, y: number, dialogs: string[]): void {
		const npc = new FriendlyNPC(); // Sin argumentos de grid
		npc.x = x;
		npc.y = y;
		this.worldContainer.addChild(npc);
		this.npcs.push(npc);

		this.interactManager.add(x, y, () => {
			// ... (Lógica de dialogo igual)
			const screenPos = { x: npc.x + this.worldContainer.x, y: npc.y - 40 + this.worldContainer.y };
			dialogs.forEach((text) => DialogueOverlayManager.talk(text, { mode: OverlayMode.BUBBLE, target: screenPos }));
		});
	}

	public spawnFollowerFriendly(x: number, y: number, dialogs: string[]): void {
		const npc = new FriendlyNPC();
		npc.x = x;
		npc.y = y;
		this.worldContainer.addChild(npc);
		this.npcs.push(npc);

		const interaction = this.interactManager.add(x, y, () => {
			// ... (Lógica de dialogo igual)
			const screenPos = { x: npc.x + this.worldContainer.x, y: npc.y - 40 + this.worldContainer.y };
			dialogs.forEach((text) => DialogueOverlayManager.talk(text, { mode: OverlayMode.BUBBLE, target: screenPos }));

			DialogueOverlayManager.talk("¡Te seguiré!", { mode: OverlayMode.BUBBLE, target: screenPos });
			DialogueOverlayManager.chainEvent(() => {
				npc.startFollowing();
				this.interactManager.remove(interaction); // Opcional
			});
		});
	}

	public spawnAggressive(x: number, y: number, detectionRange: number): void {
		const npc = new AggressiveNPC(detectionRange);
		npc.x = x;
		npc.y = y;
		this.worldContainer.addChild(npc);
		this.npcs.push(npc);
	}

	public spawnCustomer(
		spawnX: number,
		spawnY: number,
		targetX: number,
		targetY: number,
		exitX: number,
		exitY: number,
		patienceMs: number,
		onSuccess: () => void,
		onTimeout: () => void
	): void {
		let npc: CustomerNPC;

		if (this.customerPool.length > 0) {
			npc = this.customerPool.pop()!;
			npc.reset(spawnX, spawnY, targetX, targetY, exitX, exitY, patienceMs);
			this.worldContainer.addChild(npc);
		} else {
			npc = new CustomerNPC(spawnX, spawnY, targetX, targetY, exitX, exitY, patienceMs);
			this.worldContainer.addChild(npc);
		}

		this.npcs.push(npc);

		const interactionId = this.interactManager.add(targetX, targetY, () => {
			if (npc.state === CustomerState.WAITING) {
				// Usamos la nueva función interna para centralizar la resolución
				this.resolveSingleNPC(npc, onSuccess, interactionId);
			} else {
				DialogueOverlayManager.talk("¡No te está prestando atención!", { mode: OverlayMode.BUBBLE });
			}
		});

		// Guardamos metadatos genéricos en el NPC para poder resolverlo externamente
		(npc as any)._onSuccess = onSuccess;
		(npc as any)._interactionId = interactionId;
		(npc as any)._onTimeoutCallback = () => {
			this.interactManager.remove(interactionId);
			onTimeout();
		};
	}

	/**
	 * Resuelve y limpia las interacciones de todos los NPCs en una ubicación específica.
	 * Útil para atender a todo un grupo de una mesa a la vez.
	 */
	public resolveNPCsAt(x: number, y: number, radius: number): void {
		this.npcs.forEach((npc) => {
			// Verificamos que sea un cliente esperando
			if (npc instanceof CustomerNPC && npc.state === CustomerState.WAITING) {
				const dx = npc.x - x;
				const dy = npc.y - y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				// Si está dentro del radio de la mesa
				if (distance <= radius) {
					const onSuccess = (npc as any)._onSuccess;
					const interactionId = (npc as any)._interactionId;

					// 1. Detener el timer y cambiar estado del NPC
					npc.serve();

					// 2. Ejecutar el callback de éxito (opcional)
					if (onSuccess) {
						onSuccess();
					}

					// 3. REMOVER EL INTERACTABLE: Esto quita el icono de "E" de este NPC
					this.interactManager.remove(interactionId);
				}
			}
		});
	}
	/**
	 * Limpia el estado del NPC, detiene su timer y quita su interacción.
	 */
	private resolveSingleNPC(npc: CustomerNPC, onSuccess: () => void, interactionId: InteractableItem): void {
		npc.serve(); // Esto debería detener el timer interno del NPC
		if (onSuccess) {
			onSuccess();
		}
		this.interactManager.remove(interactionId);
	}

	// Getter para saber cuántos hay activos
	public get activeCount(): number {
		// Contamos cuántos de la lista principal son Clientes
		return this.npcs.filter((n) => n instanceof CustomerNPC).length;
	}

	public update(dt: number, player: Container): void {
		for (let i = this.npcs.length - 1; i >= 0; i--) {
			const npc = this.npcs[i];

			// ... (logica de timeout igual) ...

			npc.update(dt, player, this.obstacles);

			// LOGICA DE RECICLAJE
			if (npc instanceof CustomerNPC && npc.state === CustomerState.FINISHED) {
				// En lugar de npc.destroy(), lo guardamos
				this.worldContainer.removeChild(npc); // Sacar visualmente
				this.npcs.splice(i, 1); // Sacar de la lista de update

				// Meter al pool para uso futuro
				this.customerPool.push(npc);
			}
			// Para otros NPCs que no sean Customer, si usamos destroy normal
			else if (/* Logica para otros NPCs */ false) {
				npc.destroy();
				this.npcs.splice(i, 1);
			}
		}
	}
}
