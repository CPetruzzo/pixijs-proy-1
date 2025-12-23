// LevelSelectionManager.ts
import { Container, Graphics, Point } from "pixi.js";
import type { LevelConfig, LevelSaveData } from "./LevelModels";
import { LevelNodeView } from "./LevelNodeView";
import { DialogueOverlayManager } from "../../engine/dialog/DialogueOverlayManager"; // Integración con tu sistema

export enum LayoutType {
	GRID,
	LINEAR_H,
	LINEAR_V,
	SCATTERED,
}

export enum WorldTypes {
	BRANCH,
	GRID,
}

export class LevelSelectionManager extends Container {
	private nodes: Map<string, LevelNodeView> = new Map();
	private connectionsLayer: Graphics;
	private nodesLayer: Container;

	// Callbacks
	public onLevelSelected?: (config: LevelConfig, data: LevelSaveData) => void;

	constructor() {
		super();
		this.connectionsLayer = new Graphics();
		this.addChild(this.connectionsLayer);

		this.nodesLayer = new Container();
		this.addChild(this.nodesLayer);
	}

	/**
	 * Genera niveles automáticamente en una grilla o lista.
	 */
	public buildLevels(
		configs: LevelConfig[],
		userData: Record<string, LevelSaveData>, // Tu "Base de Datos" actual
		layout: LayoutType,
		columns: number = 5, // Para Grid
		spacing: Point = new Point(100, 100)
	): void {
		this.clear();

		// 1. Crear Vistas
		configs.forEach((cfg, index) => {
			// Si no hay data guardada, crear data por defecto
			const data = userData[cfg.id] || {
				stars: 0,
				score: 0,
				completed: false,
				unlocked: index === 0,
			};

			const node = new LevelNodeView(cfg, data);

			// Lógica de Posicionamiento
			const pos = this.calculatePosition(index, layout, columns, spacing, cfg);
			node.x = pos.x;
			node.y = pos.y;

			// Interacción
			node.on("pointertap", () => this.handleNodeClick(node));

			this.nodes.set(cfg.id, node);
			this.nodesLayer.addChild(node);
		});

		// 2. Dibujar Conexiones (Líneas entre niveles desbloqueados/vecinos)
		this.drawConnections(configs);
	}

	private calculatePosition(index: number, layout: LayoutType, cols: number, spacing: Point, cfg: LevelConfig): Point {
		const p = new Point(0, 0);

		switch (layout) {
			case LayoutType.GRID:
				p.x = (index % cols) * spacing.x;
				p.y = Math.floor(index / cols) * spacing.y;
				break;
			case LayoutType.LINEAR_H:
				p.x = index * spacing.x;
				p.y = 0;
				break;
			case LayoutType.LINEAR_V:
				p.x = 0;
				p.y = index * spacing.y;
				break;
			case LayoutType.SCATTERED:
				// Usa coordenadas manuales de la config
				p.x = (cfg.gridX || 0) * spacing.x;
				p.y = (cfg.gridY || 0) * spacing.y;
				break;
		}
		return p;
	}

	private drawConnections(configs: LevelConfig[]): void {
		this.connectionsLayer.clear();
		this.connectionsLayer.lineStyle(4, 0x555555, 0.5);

		configs.forEach((cfg) => {
			const startNode = this.nodes.get(cfg.id);
			if (!startNode) {
				return;
			}

			// Dibujar línea hacia los hijos (unlocks)
			cfg.unlocks.forEach((childId) => {
				const endNode = this.nodes.get(childId);
				if (endNode) {
					// Si el destino está desbloqueado, la línea brilla
					const isActive = endNode.data.unlocked;
					this.connectionsLayer.lineStyle(4, isActive ? 0xffffff : 0x444444, isActive ? 0.8 : 0.3);

					this.connectionsLayer.moveTo(startNode.x, startNode.y);
					this.connectionsLayer.lineTo(endNode.x, endNode.y);
				}
			});
		});
	}

	private handleNodeClick(node: LevelNodeView): void {
		if (!node.data.unlocked) {
			// Feedback visual de bloqueado (shake)
			DialogueOverlayManager.talk("Nivel bloqueado. Completa el anterior.");
			return;
		}

		// Efecto de selección
		if (this.onLevelSelected) {
			this.onLevelSelected(node.config, node.data);
		}
	}

	public clear(): void {
		this.nodesLayer.removeChildren();
		this.nodes.clear();
		this.connectionsLayer.clear();
	}
}
