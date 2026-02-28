import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Text } from "pixi.js";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { InteractableManager } from "../../../engine/utils/InteractableManager";
import { Manager } from "../../..";
import { TopDownMovementController } from "../../../engine/topdownmovement/TopDownMovementController";
import { PlayerAvatar } from "../../../engine/utils/PlayerAvatar";
import { EquipmentManager } from "../../../engine/storagemanager/EquipmentManager";
import { OverlayMode } from "../../../engine/dialog/DialogOverlay";
import { GeminiService } from "./GeminiService";

export class GeminiScene extends PixiScene {
	private readonly C_PLAYER = 0x3498db;
	private readonly C_NPC_AI = 0xff69b4;
	private readonly C_WALL = 0xe74c3c;
	private readonly C_FLOOR = 0x2ecc71;

	private player: PlayerAvatar;
	private equipmentManager: EquipmentManager;
	private world: Container;
	private walls: Graphics[] = [];
	private interactManager: InteractableManager;
	private movementController: TopDownMovementController;

	private inputElement: HTMLInputElement | null = null;
	private isChattingWithAI: boolean = false;

	constructor() {
		super();
		this.world = new Container();
		this.addChild(this.world);
		DialogueOverlayManager.init(this);

		this.interactManager = new InteractableManager(this.world);
		this.equipmentManager = new EquipmentManager();

		this.createLevel();
		this.createPlayer();
		this.createGeminiNPC();

		this.movementController = new TopDownMovementController(this.player as any, this.walls);

		DialogueOverlayManager.talk("Acércate al cuadro ROSA y presiona 'E' para charlar con la IA.");
	}

	private createGeminiNPC(): void {
		const x = 600;
		const y = 300;

		const npc = new Graphics();
		npc.beginFill(this.C_NPC_AI);
		npc.drawRect(-20, -40, 40, 40);
		npc.endFill();
		npc.x = x;
		npc.y = y;
		this.world.addChild(npc);

		const nameTag = new Text("Don Gemini", { fontSize: 14, fill: 0xffffff });
		nameTag.anchor.set(0.5, 1);
		nameTag.position.set(0, -45);
		npc.addChild(nameTag);

		this.interactManager.add(x, y, () => {
			if (this.isChattingWithAI) {
				return;
			}
			this.startAiConversation(npc);
		});
	}

	private startAiConversation(npcDisplayObject: Graphics): void {
		this.isChattingWithAI = true;
		const screenX = npcDisplayObject.x + this.world.x;
		const screenY = npcDisplayObject.y - 40 + this.world.y;
		const bubbleTarget = { x: screenX, y: screenY };

		DialogueOverlayManager.talk("¿Qué se te ofrece, paisano?", {
			mode: OverlayMode.CINEMATIC,
			target: bubbleTarget,
		});

		DialogueOverlayManager.chainEvent(() => {
			this.showHtmlInput(npcDisplayObject);
		});
	}

	private showHtmlInput(npcRef: Graphics): void {
		if (this.inputElement) {
			return;
		}

		this.inputElement = document.createElement("input");
		this.inputElement.type = "text";
		this.inputElement.placeholder = "Escribe tu respuesta aquí...";

		Object.assign(this.inputElement.style, {
			position: "absolute",
			bottom: "20%",
			left: "50%",
			transform: "translateX(-50%)",
			width: "300px",
			padding: "10px",
			fontSize: "16px",
			border: "2px solid white",
			borderRadius: "8px",
			background: "rgba(0, 0, 0, 0.8)",
			color: "white",
			zIndex: "1000",
			fontFamily: "Arial, sans-serif",
		});

		document.body.appendChild(this.inputElement);
		this.inputElement.focus();

		// --- AQUÍ ESTÁ EL ARREGLO ---
		this.inputElement.onkeydown = async (e) => {
			// 1. Evitamos que la tecla suba al juego (arregla el Espacio y el WASD)
			e.stopPropagation();

			if (e.key === "Enter" && this.inputElement) {
				const text = this.inputElement.value;
				if (!text.trim()) {
					return;
				}

				this.removeHtmlInput();

				const screenX = npcRef.x + this.world.x;
				const screenY = npcRef.y - 40 + this.world.y;

				DialogueOverlayManager.talk("Mmm...", {
					mode: OverlayMode.CINEMATIC,
					target: { x: screenX, y: screenY },
					speed: 20,
				});

				const response = await GeminiService.sendMessage(text);

				DialogueOverlayManager.talk(response, {
					mode: OverlayMode.CINEMATIC,
					target: { x: screenX, y: screenY },
				});

				DialogueOverlayManager.chainEvent(() => {
					this.showHtmlInput(npcRef);
				});
			}

			if (e.key === "Escape") {
				this.endConversation();
			}
		};
	}

	private removeHtmlInput(): void {
		if (this.inputElement && document.body.contains(this.inputElement)) {
			document.body.removeChild(this.inputElement);
			this.inputElement = null;
		}
	}

	private endConversation(): void {
		this.removeHtmlInput();
		this.isChattingWithAI = false;
		DialogueOverlayManager.talk("¡Nos vemos, compadre!");
		GeminiService.resetConversation();
	}

	private createLevel(): void {
		const floor = new Graphics();
		floor.beginFill(this.C_FLOOR);
		floor.drawRect(0, 0, 1200, 800);
		floor.endFill();
		this.world.addChild(floor);

		this.createWall(200, 200, 100, 300);
		this.createWall(800, 400, 100, 100);
	}

	private createWall(x: number, y: number, w: number, h: number): void {
		const wall = new Graphics();
		wall.beginFill(this.C_WALL);
		wall.drawRect(0, 0, w, h);
		wall.endFill();
		wall.x = x;
		wall.y = y;
		(wall as any).widthRect = w;
		(wall as any).heightRect = h;
		this.world.addChild(wall);
		this.walls.push(wall);
	}

	private createPlayer(): void {
		this.player = new PlayerAvatar(this.equipmentManager, this.C_PLAYER);
		this.player.x = 100;
		this.player.y = 100;
		this.world.addChild(this.player);
	}

	public override update(dt: number): void {
		this.interactManager.update(dt, this.player.x, this.player.y);

		const targetX = Manager.width / 2 - this.player.x;
		const targetY = Manager.height / 2 - this.player.y;
		this.world.x += (targetX - this.world.x) * 0.1;
		this.world.y += (targetY - this.world.y) * 0.1;

		if (DialogueOverlayManager.isOpen || this.isChattingWithAI) {
			return;
		}

		this.movementController.update(dt);
	}

	public override destroy(): void {
		this.removeHtmlInput();
		super.destroy();
	}
}
