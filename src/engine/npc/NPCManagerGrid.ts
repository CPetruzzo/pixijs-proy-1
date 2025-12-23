import type { Container, Graphics } from "pixi.js";
import { NavigationGrid } from "../utils/NavigationGrid";
import type { BaseNPC } from "./NPCClassesGrid";
import { FriendlyNPC, AggressiveNPC } from "./NPCClassesGrid";
import type { InteractableManager } from "../utils/InteractableManager"; // Ajusta ruta
import { DialogueOverlayManager } from "../dialog/DialogueOverlayManager"; // Ajusta ruta
import { OverlayMode } from "../dialog/DialogOverlay";

export class NPCManager {
	private npcs: BaseNPC[] = [];
	private navGrid: NavigationGrid;
	private worldContainer: Container;
	private interactManager: InteractableManager;

	constructor(
		worldContainer: Container,
		interactManager: InteractableManager,
		walls: Graphics[], // Obstáculos visuales
		worldWidth: number,
		worldHeight: number
	) {
		this.worldContainer = worldContainer;
		this.interactManager = interactManager;

		// 1. Inicializar sistema de navegación
		// TileSize 40 suele ser un buen balance entre precisión y rendimiento
		this.navGrid = new NavigationGrid(worldWidth, worldHeight, 40);
		this.navGrid.registerObstacles(walls);
	}

	/**
	 * Crea un NPC amistoso estático que solo habla.
	 */
	public spawnStaticFriendly(x: number, y: number, dialogs: string[]): void {
		const npc = new FriendlyNPC(this.navGrid); // Usamos Friendly pero no activamos follow
		npc.x = x;
		npc.y = y;
		this.worldContainer.addChild(npc);
		this.npcs.push(npc);

		// Agregamos interacción
		this.interactManager.add(x, y, () => {
			const screenPos = { x: npc.x + this.worldContainer.x, y: npc.y - 40 + this.worldContainer.y };

			dialogs.forEach((text) => {
				DialogueOverlayManager.talk(text, {
					mode: OverlayMode.BUBBLE,
					target: screenPos,
				});
			});
		});
	}

	/**
	 * Crea un NPC amistoso que te sigue después de hablar.
	 */
	public spawnFollowerFriendly(x: number, y: number, dialogs: string[]): void {
		const npc = new FriendlyNPC(this.navGrid);
		npc.x = x;
		npc.y = y;
		this.worldContainer.addChild(npc);
		this.npcs.push(npc);

		// Interacción para activar el seguimiento
		const interaction = this.interactManager.add(x, y, () => {
			console.log("interaction", interaction);
			const screenPos = { x: npc.x + this.worldContainer.x, y: npc.y - 40 + this.worldContainer.y };

			dialogs.forEach((text) => {
				DialogueOverlayManager.talk(text, {
					mode: OverlayMode.BUBBLE,
					target: screenPos,
				});
			});

			DialogueOverlayManager.talk("¡Te seguiré!", {
				mode: OverlayMode.BUBBLE,
				target: screenPos,
			});

			DialogueOverlayManager.chainEvent(() => {
				npc.startFollowing();
				// Opcional: Eliminar la interacción si ya te sigue para siempre
				// this.interactManager.remove(interaction);
			});
		});
	}

	/**
	 * Crea un enemigo que persigue automáticamente.
	 */
	public spawnAggressive(x: number, y: number, detectionRange: number): void {
		const npc = new AggressiveNPC(this.navGrid, detectionRange);
		npc.x = x;
		npc.y = y;
		this.worldContainer.addChild(npc);
		this.npcs.push(npc);
	}

	public update(dt: number, player: Container): void {
		this.npcs.forEach((npc) => npc.update(dt, player));
	}
}
