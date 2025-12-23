// src/engine/scenes/ConstructionEngineScene/ConstructionEngineScene.ts
import type { Graphics } from "pixi.js";
import { Container, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager, pixiRenderer } from "../../..";
import { BlackboardManager } from "./blackboard/BlackboardManager";
import { EntityManager } from "./entities/EntityManager";
import { FileSystemManager } from "./files/FileSystemManager";
import { ToolPalette } from "./tools/ToolPalette";
import type { CustomSprite } from "../WebEngine/ConstructionEngineScene";
import { ConstructionGameScene } from "./ConstructionGameScene";

export class ConstructionEngineScene extends PixiScene {
	private backgroundContainer: Container;
	private toolPaletteContainer: Container;
	private blackboard: Container;

	private blackboardManager: BlackboardManager;
	private entityManager: EntityManager;
	private fileSystemManager: FileSystemManager;
	private toolPalette: ToolPalette;

	public currentTool: string | null = null;
	public preview: Graphics | null = null;

	public static readonly BUNDLES = ["construction"];
	private selectedPlayer: Sprite;
	private selectedFlag: Sprite | null = null;

	// Panel para cargar proyectos guardados
	private loadPanel: Container | null = null;
	private loadPanelVisible: boolean = false;

	private isPanning: boolean = false;
	private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
	constructor() {
		super();
		this.backgroundContainer = new Container();
		this.backgroundContainer.name = "background";
		this.addChild(this.backgroundContainer);

		this.blackboard = new Container();
		this.blackboard.name = "blackboard";
		this.backgroundContainer.addChild(this.blackboard);

		this.toolPaletteContainer = new Container();
		this.toolPaletteContainer.name = "toolPalette";
		this.addChild(this.toolPaletteContainer);

		// Instanciar gestores
		this.blackboardManager = new BlackboardManager(this.blackboard);
		this.blackboardManager.drawBackground();
		this.blackboardManager.drawGrid();

		this.entityManager = new EntityManager(this.blackboard);
		this.fileSystemManager = new FileSystemManager();

		this.toolPalette = new ToolPalette(this.toolPaletteContainer, (tool: string) => this.onToolSelected(tool));
		this.toolPalette.createToolPalette();

		this.setupInteractions();
	}

	private async onToolSelected(tool: string): Promise<void> {
		if (tool === "play") {
			const levelData = [...this.entityManager.placedEntities];
			ConstructionGameScene.currentLevelData = levelData;
			Manager.changeScene(ConstructionGameScene);
		} else if (tool === "export") {
			this.fileSystemManager.exportStateToFile(this.entityManager.saveState()).catch(console.error);
		} else if (tool === "load") {
			// --- NUEVA LÓGICA DE CARGA ---
			// Usamos el método directo loadFile en lugar del panel complejo
			const data = await this.fileSystemManager.loadFile();
			if (data) {
				// 1. Limpiar visualmente
				this.blackboardManager.cleanBlackboard();
				// 2. Cargar datos y crear sprites
				this.entityManager.loadState(data);
				// (Opcional) Si tenías un panel abierto, ciérralo
				if (this.loadPanelVisible) {
					this.toggleLoadPanel();
				}
			}
		} else if (tool === "clean") {
			// --- CORRECCIÓN CRÍTICA ---
			this.blackboardManager.cleanBlackboard(); // Limpia Sprites/Grid
			this.entityManager.clear(); // Limpia el Array de datos
		} else if (tool === "exportPNG") {
			this.exportToPNG();
		} else if (tool === "saveDirect") {
			this.fileSystemManager.saveStateDirectly(this.entityManager.saveState()).catch(console.error);
		} else {
			this.currentTool = tool;
			document.body.style.cursor = "crosshair";
		}
	}

	private selectPlayerAt(x: number, y: number): void {
		for (const child of this.blackboard.children) {
			if (child instanceof Sprite && child.x === x && child.y === y && child.name === "player") {
				this.selectedPlayer = child;
				// Agregamos un tinte para indicar selección
				child.tint = 0xffff00;
				break;
			}
		}
	}

	private setupInteractions(): void {
		this.blackboard.interactive = true;

		this.blackboard.on("pointermove", (event) => {
			// Detectar botón central (rueda) o tal vez una tecla modificadora
			if (event.data.button === 1 || this.currentTool === "hand") {
				this.isPanning = true;
				this.lastMousePos = { x: event.data.global.x, y: event.data.global.y };
				// Evitar que propague eventos de colocar bloques
				event.stopPropagation();
				return;
			}

			const localPos = this.blackboard.toLocal(event.data.global);
			const snapped = this.blackboardManager.getSnappedPosition(localPos.x, localPos.y);

			if (this.currentTool === "playerSelect" && this.selectedPlayer) {
				this.selectedPlayer.x = snapped.x;
				this.selectedPlayer.y = snapped.y;
			} else if (this.currentTool === "flagSelect" && this.selectedFlag) {
				this.selectedFlag.x = snapped.x;
				this.selectedFlag.y = snapped.y;
			} else if (this.currentTool) {
				if (!this.preview) {
					this.preview = this.blackboardManager.createPreview(this.currentTool);
					this.blackboard.addChild(this.preview);
				} else {
					this.preview.clear();
					this.preview = this.blackboardManager.createPreview(this.currentTool);
					this.blackboard.addChild(this.preview);
				}
				this.preview.position.set(snapped.x, snapped.y);
			}
		});

		this.blackboard.on("pointerdown", (event) => {
			if (this.isPanning) {
				const currentX = event.data.global.x;
				const currentY = event.data.global.y;

				const diffX = currentX - this.lastMousePos.x;
				const diffY = currentY - this.lastMousePos.y;

				this.blackboard.x += diffX;
				this.blackboard.y += diffY;

				this.lastMousePos = { x: currentX, y: currentY };
				return; // No hacemos snap ni preview si estamos moviendo la cámara
			}

			const localPos = this.blackboard.toLocal(event.data.global);
			const snapped = this.blackboardManager.getSnappedPosition(localPos.x, localPos.y);

			if (this.currentTool === "eraser") {
				this.entityManager.eraseEntityAt(snapped.x, snapped.y);
			} else if (this.currentTool === "playerSelect") {
				this.selectPlayerAt(snapped.x, snapped.y);
			} else if (this.currentTool === "flagSelect") {
				this.selectFlagAt(snapped.x, snapped.y);
			}
		});

		this.blackboard.on("pointerup", (event) => {
			if (this.isPanning) {
				this.isPanning = false;
				// IMPORTANTE: Return aquí para no colocar bloque al soltar la cámara
				return;
			}
			const localPos = this.blackboard.toLocal(event.data.global);
			const snapped = this.blackboardManager.getSnappedPosition(localPos.x, localPos.y);

			if (this.currentTool === "eraser") {
				this.entityManager.eraseEntityAt(snapped.x, snapped.y);
			} else if (this.currentTool === "player") {
				this.entityManager.placeEntity("player", snapped.x, snapped.y);
			} else if (this.currentTool === "flag") {
				// Colocar bandera
				this.entityManager.placeEntity("flag", snapped.x, snapped.y);
			} else if (this.currentTool === "playerSelect") {
				if (this.selectedPlayer) {
					const customSprite = this.selectedPlayer as CustomSprite;
					const index = customSprite.entityIndex;
					if (index !== undefined) {
						this.entityManager.placedEntities[index].x = snapped.x;
						this.entityManager.placedEntities[index].y = snapped.y;
					}
					customSprite.tint = 0xffffff;
					this.selectedPlayer = null;
				}
			} else if (this.currentTool === "flagSelect") {
				if (this.selectedFlag) {
					// Actualizar datos de la bandera en el registro
					const customSprite = this.selectedFlag as CustomSprite;
					const index = customSprite.entityIndex;
					if (index !== undefined) {
						this.entityManager.placedEntities[index].x = snapped.x;
						this.entityManager.placedEntities[index].y = snapped.y;
					}
					customSprite.tint = 0xffffff;
					this.selectedFlag = null;
				}
			} else if (this.currentTool) {
				this.entityManager.placeEntity(this.currentTool, snapped.x, snapped.y);
			}
		});
		this.blackboard.on("pointerupoutside", () => {
			this.isPanning = false;
		});
	}

	private selectFlagAt(x: number, y: number): void {
		for (const child of this.blackboard.children) {
			if (child instanceof Sprite && child.x === x && child.y === y && child.name === "flag") {
				this.selectedFlag = child;
				child.tint = 0xffff00;
				break;
			}
		}
	}
	/**
	 * Crea y muestra un panel con los proyectos guardados en "savedProyects".
	 */
	private async createLoadPanel(): Promise<void> {
		// Si ya existe, lo removemos
		if (this.loadPanel) {
			if (this.toolPaletteContainer.children.includes(this.loadPanel)) {
				this.toolPaletteContainer.removeChild(this.loadPanel);
			}
			this.loadPanel = null;
		}
		this.loadPanel = new Container();
		// Posicionar el panel debajo de los botones
		this.loadPanel.x = -50;
		this.loadPanel.y = 50;
		this.toolPaletteContainer.addChild(this.loadPanel);

		try {
			const folderHandle = await this.fileSystemManager.getOrCreateSavedProjectsFolder();
			let yPos = 0;
			// Hacemos cast a 'any' para acceder a entries()
			for await (const [name, handle] of (folderHandle as any).entries()) {
				if (name.endsWith(".json") && handle.kind === "file") {
					// Convertir handle a FileSystemFileHandle para poder llamar a getFile()
					const fileHandle = handle as FileSystemFileHandle;
					const fileText = new Text(name, {
						fontFamily: "Arial",
						fontSize: 14,
						fill: 0xffffff,
					});
					fileText.x = 0;
					fileText.y = yPos;
					fileText.interactive = true;
					fileText.on("pointerup", async () => {
						try {
							const file = await fileHandle.getFile();
							const data = await file.text();
							this.blackboardManager.cleanBlackboard();
							this.entityManager.loadState(data);
						} catch (error) {
							console.error("Error al leer el archivo:", error);
						}
					});
					this.loadPanel.addChild(fileText);
					yPos += 20;
				}
			}
		} catch (error) {
			console.error("Error al acceder a la carpeta savedProyects:", error);
		}
	}

	/**
	 * Alterna la visibilidad del panel de carga.
	 */
	private async toggleLoadPanel(): Promise<void> {
		if (this.loadPanelVisible) {
			if (this.loadPanel && this.toolPaletteContainer.children.includes(this.loadPanel)) {
				this.toolPaletteContainer.removeChild(this.loadPanel);
				this.loadPanel = null;
			}
			this.loadPanelVisible = false;
		} else {
			await this.createLoadPanel();
			this.loadPanelVisible = true;
		}
	}

	private exportToPNG(): void {
		const renderer = pixiRenderer.pixiRenderer;
		if (!renderer.plugins || !renderer.plugins.extract) {
			console.error("El plugin extract no está disponible en el renderer.");
			return;
		}
		// Por ejemplo, removemos el grid para no incluirlo en la imagen:
		this.blackboard.removeChild(this.blackboardManager.getGrid());
		const canvas = renderer.plugins.extract.canvas(this.blackboard);
		const dataURL = canvas.toDataURL("image/png");
		const link = document.createElement("a");
		link.href = dataURL;
		link.download = "level.png";
		link.click();
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.backgroundContainer.x = newW / 2;
		this.backgroundContainer.y = newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.toolPaletteContainer, newW * 1.6, newH * 1.6, 1920, 1080, ScaleHelper.FIT);
		this.toolPaletteContainer.x = newW * 0.5;
		this.toolPaletteContainer.y = newH * 0.88;
	}
}
