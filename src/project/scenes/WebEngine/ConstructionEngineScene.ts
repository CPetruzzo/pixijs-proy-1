// Agregamos estas declaraciones para que TypeScript reconozca las APIs de File System Access
declare global {
	interface Window {
		showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
	}
}

import { Container, Graphics, Sprite, Text } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager, pixiRenderer } from "../../..";
import { GameScene } from "./GameScene";

// Interfaz para describir cada entidad colocada.
interface PlacedEntity {
	type: string;
	texture: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CustomSprite extends Sprite {
	entityIndex?: number;
}

export class ConstructionEngineScene extends PixiScene {
	// Contenedores principales
	private backgroundContainer: Container;
	private toolPaletteContainer: Container;
	private blackboard: Container;

	// Panel para cargar proyectos guardados
	private loadPanel: Container | null = null;
	private loadPanelVisible: boolean = false;

	// Elementos para el grid e interacción
	private grid: Graphics;
	private gridSize: number = 50;
	private currentTool: string | null = null;
	private preview: Graphics | null = null;
	public static readonly BUNDLES = ["construction"];

	// Registro de entidades colocadas para persistencia
	private placedEntities: PlacedEntity[] = [];

	// Handle para la carpeta "savedProyects"
	private savedProjectsDirHandle: FileSystemDirectoryHandle | null = null;
	// Dentro de tu clase ConstructionEngineScene
	private selectedPlayer: Sprite | null = null;

	constructor() {
		super();

		// Contenedor de fondo y área principal (blackboard)
		this.backgroundContainer = new Container();
		this.backgroundContainer.name = "background";
		this.addChild(this.backgroundContainer);

		this.blackboard = new Container();
		this.blackboard.name = "blackboard";
		this.backgroundContainer.addChild(this.blackboard);

		// Dibujar fondo y grid
		this.drawBackground();
		this.grid = new Graphics();
		this.blackboard.addChild(this.grid);
		this.drawGrid();

		// Crear panel de herramientas
		this.toolPaletteContainer = new Container();
		this.toolPaletteContainer.name = "toolPalette";
		this.addChild(this.toolPaletteContainer);
		this.createToolPalette();

		// Configurar interacciones en el área de construcción
		this.setupInteractions();
	}

	private cleanBlackboard(): void {
		this.blackboard.removeChildren();
		// Dibujar fondo y grid
		this.drawBackground();
		this.grid = new Graphics();
		this.blackboard.addChild(this.grid);
		this.drawGrid();
	}

	/**
	 * Dibuja un fondo sólido en el área de construcción.
	 */
	private drawBackground(): void {
		const bg = new Graphics();
		bg.beginFill(0x222222);
		// Área de 1920x1080 centrada en (0,0)
		bg.drawRect(-960, -540, 1920, 1080);
		bg.endFill();
		this.blackboard.addChildAt(bg, 0);
	}

	/**
	 * Dibuja el grid para alinear objetos.
	 */
	private drawGrid(): void {
		const width = 1920;
		const height = 1080;
		this.grid.clear();
		this.grid.lineStyle(1, 0x666666, 0.5);

		for (let x = -width / 2; x <= width / 2; x += this.gridSize) {
			this.grid.moveTo(x, -height / 2);
			this.grid.lineTo(x, height / 2);
		}
		for (let y = -height / 2; y <= height / 2; y += this.gridSize) {
			this.grid.moveTo(-width / 2, y);
			this.grid.lineTo(width / 2, y);
		}
	}

	/**
	 * Crea la paleta de herramientas: botones para colocar, exportar y cargar.
	 */
	private createToolPalette(): void {
		this.createToolButton("Borrador", -360, 0, () => this.setTool("eraser"));
		this.createToolButton("Edificio", -240, 0, () => this.setTool("building"));
		this.createToolButton("Suelo", -120, 0, () => this.setTool("floor"));
		this.createToolButton("Exportar", 120, 0, () => {
			this.exportStateToFile().catch(console.error);
		});
		this.createToolButton("Cargar", 240, 0, () => {
			this.toggleLoadPanel().catch(console.error);
		});
		this.createToolButton("Limpiar", 0, 0, () => this.cleanBlackboard());
		this.createToolButton("Export PNG", 360, 0, () => this.exportToPNG());

		// Botón para crear un player
		this.createToolButton("Player", -480, 0, () => this.setTool("player"));
		// Botón para mover/seleccionar al player
		this.createToolButton("Move Player", -480, 50, () => this.setTool("playerSelect"));
		this.createToolButton("TestScenario", 480, 0, () => {
			Manager.changeScene(GameScene);
		});
	}

	/**
	 * Crea un botón genérico en la paleta.
	 */
	private createToolButton(label: string, x: number, y: number, onClick: () => void): void {
		const btn = new Graphics();
		btn.beginFill(0x333333);
		btn.drawRoundedRect(-50, -20, 100, 40, 10);
		btn.endFill();
		btn.x = x;
		btn.y = y;

		const text = new Text(label, {
			fontFamily: "Arial",
			fontSize: 18,
			fill: 0xffffff,
		});
		text.anchor.set(0.5);
		btn.addChild(text);

		btn.interactive = true;
		btn.on("pointerup", () => onClick());
		btn.on("rightdown", () => {
			this.currentTool = null;
			document.body.style.cursor = "default";
		});
		this.toolPaletteContainer.addChild(btn);
	}

	/**
	 * Selecciona una herramienta y cambia el cursor.
	 */
	private setTool(tool: string): void {
		this.currentTool = tool;
		document.body.style.cursor = "crosshair";
	}

	/**
	 * Configura las interacciones en el área de construcción.
	 */
	private setupInteractions(): void {
		this.blackboard.interactive = true;

		this.blackboard.on("pointermove", (event) => {
			const localPos = this.blackboard.toLocal(event.data.global);
			const snapped = this.getSnappedPosition(localPos.x, localPos.y);

			if (this.currentTool === "playerSelect" && this.selectedPlayer) {
				this.selectedPlayer.x = snapped.x;
				this.selectedPlayer.y = snapped.y;
			} else if (this.currentTool) {
				if (!this.preview) {
					this.preview = this.createPreview(this.currentTool);
					this.blackboard.addChild(this.preview);
				} else {
					this.preview.clear();
					this.preview = this.createPreview(this.currentTool);
					this.blackboard.addChild(this.preview);
				}
				this.preview.position.set(snapped.x, snapped.y);
			}
		});

		this.blackboard.on("pointerdown", (event) => {
			const localPos = this.blackboard.toLocal(event.data.global);
			const snapped = this.getSnappedPosition(localPos.x, localPos.y);

			if (this.currentTool === "eraser") {
				this.eraseEntityAt(snapped.x, snapped.y);
			} else if (this.currentTool === "playerSelect") {
				this.selectPlayerAt(snapped.x, snapped.y);
			}
		});

		this.blackboard.on("pointerup", (event) => {
			const localPos = this.blackboard.toLocal(event.data.global);
			const snapped = this.getSnappedPosition(localPos.x, localPos.y);

			if (this.currentTool === "eraser") {
				this.eraseEntityAt(snapped.x, snapped.y);
			} else if (this.currentTool === "player") {
				this.placeEntity("player", snapped.x, snapped.y);
			} else if (this.currentTool === "playerSelect") {
				if (this.selectedPlayer) {
					const customSprite = this.selectedPlayer as CustomSprite;
					const index = customSprite.entityIndex;
					if (index !== undefined) {
						this.placedEntities[index].x = snapped.x;
						this.placedEntities[index].y = snapped.y;
					}
					// Quitar el tinte de selección y deseleccionar el sprite
					customSprite.tint = 0xffffff;
					this.selectedPlayer = null;
				}
			} else if (this.currentTool) {
				this.placeEntity(this.currentTool, snapped.x, snapped.y);
			}
		});
	}

	private eraseEntityAt(x: number, y: number): void {
		// Recorremos los hijos de la pizarra de atrás hacia adelante para eliminar el Sprite que coincida
		for (let i = this.blackboard.children.length - 1; i >= 0; i--) {
			const child = this.blackboard.children[i];
			// Asegurarnos de borrar solo Sprites (las entidades colocadas)
			if (child instanceof Sprite && child.x === x && child.y === y) {
				this.blackboard.removeChild(child);
			}
		}
		// Actualizamos el registro eliminando la entidad que estuviera en esa celda
		this.placedEntities = this.placedEntities.filter((entity) => entity.x !== x || entity.y !== y);
	}

	/**
	 * Redondea la posición al grid.
	 */
	private getSnappedPosition(x: number, y: number): { x: number; y: number } {
		return {
			x: Math.round(x / this.gridSize) * this.gridSize,
			y: Math.round(y / this.gridSize) * this.gridSize,
		};
	}

	/**
	 * Crea una vista previa semitransparente del objeto a colocar.
	 */
	private createPreview(tool: string): Graphics {
		const preview = new Graphics();
		if (tool === "building") {
			preview.beginFill(0x00ff00, 0.5);
			preview.drawRect(-25, -25, 50, 50);
			preview.endFill();
		} else if (tool === "floor") {
			preview.beginFill(0x0000ff, 0.5);
			preview.drawRect(-25, -25, 50, 50);
			preview.endFill();
		} else if (tool === "eraser") {
			preview.beginFill(0xff0000, 0.5);
			preview.drawRect(-25, -25, 50, 50);
			preview.endFill();
		} else if (tool === "player") {
			// Por ejemplo, un recuadro semitransparente para indicar la posición del player
			preview.beginFill(0xffffff, 0.5);
			preview.drawRect(-25, -25, 50, 50);
			preview.endFill();
		}
		return preview;
	}

	/**
	 * Coloca el objeto definitivo y registra la entidad para persistencia.
	 */
	private placeEntity(tool: string, x: number, y: number): void {
		let sprite: Sprite;
		let entity: PlacedEntity;

		if (tool === "building") {
			sprite = Sprite.from("wood");
			sprite.anchor.set(0.5);
			sprite.width = 50;
			sprite.height = 50;
			sprite.x = x;
			sprite.y = y;
			this.blackboard.addChild(sprite);
			entity = { type: "building", texture: "wood", x, y, width: 50, height: 50 };
		} else if (tool === "floor") {
			sprite = Sprite.from("grass");
			sprite.anchor.set(0.5);
			sprite.width = 50;
			sprite.height = 50;
			sprite.x = x;
			sprite.y = y;
			this.blackboard.addChild(sprite);
			entity = { type: "floor", texture: "grass", x, y, width: 50, height: 50 };
		} else if (tool === "player") {
			const sprite = Sprite.from("player") as CustomSprite;
			sprite.anchor.set(0.5);
			sprite.width = 50;
			sprite.height = 50;
			sprite.x = x;
			sprite.y = y;
			sprite.name = "player";
			// Asignamos el índice para relacionarlo con placedEntities
			sprite.entityIndex = this.placedEntities.length;
			this.blackboard.addChild(sprite);
			entity = { type: "player", texture: "player", x, y, width: 50, height: 50 };
		} else {
			return;
		}
		this.placedEntities.push(entity);
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

	/**
	 * Serializa el estado actual de la escena.
	 */
	public saveState(): string {
		return JSON.stringify(this.placedEntities, null, 2);
	}

	/**
	 * Carga el estado desde un JSON y recrea las entidades.
	 */
	public loadState(state: string): void {
		const entities = JSON.parse(state) as PlacedEntity[];
		// (Opcional) Limpiar la escena actual:
		this.placedEntities = [];
		// Recrear cada entidad
		entities.forEach((entity) => {
			const sprite = Sprite.from(entity.texture);
			sprite.anchor.set(0.5);
			sprite.width = entity.width;
			sprite.height = entity.height;
			sprite.x = entity.x;
			sprite.y = entity.y;
			this.blackboard.addChild(sprite);
			this.placedEntities.push(entity);
		});
	}

	/**
	 * Obtiene (o crea) la carpeta "savedProyects" usando la File System Access API.
	 */
	private async getOrCreateSavedProjectsFolder(): Promise<FileSystemDirectoryHandle> {
		if (!this.savedProjectsDirHandle) {
			if (!window.showDirectoryPicker) {
				throw new Error("La API File System Access no está soportada en este navegador.");
			}
			// Pide al usuario que seleccione una carpeta padre
			const parentHandle = await window.showDirectoryPicker();
			// Obtiene (o crea) la subcarpeta "savedProyects"
			this.savedProjectsDirHandle = await parentHandle.getDirectoryHandle("savedProyects", { create: true });
		}
		return this.savedProjectsDirHandle;
	}

	/**
	 * Exporta el estado actual a un archivo JSON dentro de "savedProyects".
	 */
	public async exportStateToFile(filename: string = "state.json"): Promise<void> {
		try {
			const folderHandle = await this.getOrCreateSavedProjectsFolder();
			const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
			// Hacemos cast a 'any' para acceder a createWritable
			const writable = await (fileHandle as any).createWritable();
			await writable.write(this.saveState());
			await writable.close();
			console.log("Estado exportado a:", filename);
		} catch (error) {
			console.error("Error al exportar el estado:", error);
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
			const folderHandle = await this.getOrCreateSavedProjectsFolder();
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
							this.cleanBlackboard();
							this.loadState(data);
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
		// Accedemos a la instancia de PIXI.Renderer desde pixiRendererInstance
		const renderer = pixiRenderer.pixiRenderer;

		// Verificamos que el plugin extract esté disponible
		if (!renderer.plugins || !renderer.plugins.extract) {
			console.error("El plugin extract no está disponible en el renderer.");
			return;
		}

		this.blackboard.removeChild(this.grid);

		// Extraemos el contenido del contenedor 'blackboard' a un canvas
		const canvas = renderer.plugins.extract.canvas(this.blackboard);

		// Convertimos el canvas a una data URL en formato PNG
		const dataURL = canvas.toDataURL("image/png");

		// Creamos un enlace y simulamos un clic para descargar la imagen
		const link = document.createElement("a");
		link.href = dataURL;
		link.download = "level.png";
		link.click();
	}

	/**
	 * Maneja el redimensionamiento de la escena.
	 */
	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW, newH, 1920, 1080, ScaleHelper.FILL);
		this.backgroundContainer.x = newW / 2;
		this.backgroundContainer.y = newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.toolPaletteContainer, newW, newH, 1920, 1080, ScaleHelper.FILL);
		this.toolPaletteContainer.x = newW / 2;
		this.toolPaletteContainer.y = newH - 100;
	}
}
