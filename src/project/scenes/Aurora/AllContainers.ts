import type { Point } from "pixi.js";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Easing, Tween } from "tweedle.js";
import { Keyboard } from "../../../engine/input/Keyboard";

export class AllContainers extends Container {
	public worldContainer = new Container();
	public uiContainer = new Container();
	public uiRightContainer = new Container();
	public uiCenterContainer = new Container();
	public uiLeftContainer = new Container();
	public pauseContainer = new Container();
	public attackHighlightContainer = new Container();
	public highlightContainer = new Container();
	public pathPreviewContainer: Container | null = null;
	public zoom = 2;
	public viewWidth = 0;
	public viewHeight = 0;

	constructor() {
		super();
		this.worldContainer.name = "worldContainer";
		this.uiContainer.name = "uiContainer";
		this.uiRightContainer.name = "uiRightContainer";
		this.uiLeftContainer.name = "uiLeftContainer";
		this.addChild(this.worldContainer, this.uiContainer, this.highlightContainer, this.uiLeftContainer, this.uiRightContainer);
		this.worldContainer.pivot.set(this.worldContainer.width / 2, this.worldContainer.height / 2);

		this.worldContainer.addChild(this.highlightContainer);
		this.worldContainer.addChild(this.attackHighlightContainer);
	}

	/** Limpia previsualización de ruta */
	public clearPathPreview(): void {
		if (this.pathPreviewContainer) {
			this.worldContainer.removeChild(this.pathPreviewContainer);
			this.pathPreviewContainer = null;
		}
	}

	public clearMovementHighlights(): void {
		this.highlightContainer.removeChildren();
	}

	/**
	 * Muestra un texto flotante (por ejemplo, daño) sobre cierta posición en pantalla.
	 * Esto es opcional, sirve para feedback visual.
	 */
	public showFloatingText(text: string, worldX: number, worldY: number, color: number): void {
		const style = new TextStyle({ fill: color.toString(16), fontSize: 16, fontWeight: "bold" });
		const txt = new Text(text, style);
		txt.anchor.set(0.5);
		txt.x = worldX;
		txt.y = worldY;
		this.worldContainer.addChild(txt);
		// Animar hacia arriba y fade out:
		const duration = 800; // ms
		const targetY = worldY - 20;
		const tween = new Tween(txt).to({ y: targetY, alpha: 0 }, duration).easing(Easing.Quadratic.Out);
		tween.onComplete(() => {
			this.worldContainer.removeChild(txt);
		});
		tween.start();
	}

	/** Cámara centrada: por defecto centrar en selector o en unidad seleccionada */
	public updateCamera(_dt: number, selectorPos: Point, tileSize: number): void {
		// Centrar la vista en el selector
		const targetGridX = selectorPos.x,
			targetGridY = selectorPos.y;
		const worldX = targetGridX * tileSize + tileSize / 2;
		const worldY = targetGridY * tileSize + tileSize / 2;
		const offsetX = this.viewWidth / 2;
		const offsetY = this.viewHeight / 2;
		const scaleX = this.worldContainer.worldTransform.a;
		const scaleY = this.worldContainer.worldTransform.d;
		const desiredX = offsetX - worldX * scaleX + (tileSize * scaleX) / 2;
		const desiredY = offsetY - worldY * scaleY + (tileSize * scaleY) / 2;
		// Ajuste directo (puedes interpolar si quieres suavizar)
		this.worldContainer.scale.set(this.zoom, this.zoom);
		this.worldContainer.x = desiredX;
		this.worldContainer.y = desiredY;
	}

	/** Zoom suave */
	public setZoom(factor: number): void {
		const newZoom = Math.max(0.2, Math.min(6, factor));
		const oldZoom = this.zoom;
		this.zoom = newZoom;
		const proxy = { z: oldZoom };
		new Tween(proxy)
			.to({ z: newZoom }, 500)
			.easing(Easing.Quadratic.Out)
			.onUpdate(() => {
				this.worldContainer.scale.set(proxy.z, proxy.z);
			})
			.start();
	}

	/** Dibuja background de grilla usando Graphics. Adaptar según tu mapa real. */
	public createBackground(grid: number[][], tileSize: any, tiles: Array<{ tile: Graphics; i: number; j: number }>): void {
		for (let i = 0; i < grid.length; i++) {
			for (let j = 0; j < grid[i].length; j++) {
				const tile = new Graphics();
				const alpha = 0.01;
				let color = 0x0000ff;
				if (grid[i][j] === 1) {
					color = 0xff0000;
				} else if (grid[i][j] === 2) {
					color = 0x44ffff;
				}
				tile.beginFill(color, alpha)
					.drawRect(i * tileSize, j * tileSize, tileSize, tileSize)
					.endFill();
				this.worldContainer.addChild(tile);
				tiles.push({ tile, i, j });
			}
		}
	}

	public handleZoom(): void {
		// Zoom con Numpad (opcional)
		if (Keyboard.shared.justPressed("NumpadAdd")) {
			this.setZoom(this.zoom + 0.4);
		}
		if (Keyboard.shared.justPressed("NumpadSubtract")) {
			this.setZoom(this.zoom - 0.4);
		}
	}
}
