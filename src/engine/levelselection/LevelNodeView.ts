// LevelNodeView.ts
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import type { LevelConfig, LevelSaveData } from "./LevelModels";

export class LevelNodeView extends Container {
	private bg: Graphics;
	private label: Text;
	// private lockIcon: Graphics;
	private starsContainer: Container;

	public config: LevelConfig;
	public data: LevelSaveData;

	// Colores basados en tu estilo
	private readonly C_LOCKED = 0x7f8c8d;
	private readonly C_UNLOCKED = 0x3498db; // Azul
	private readonly C_COMPLETED = 0x2ecc71; // Verde
	// private readonly C_CURRENT = 0xf1c40f; // Amarillo

	constructor(config: LevelConfig, data: LevelSaveData) {
		super();
		this.config = config;
		this.data = data;

		this.interactive = true;
		this.cursor = "pointer";

		this.bg = new Graphics();
		this.addChild(this.bg);

		const style = new TextStyle({
			fontFamily: "Pixelate-Regular", // Tu fuente
			fontSize: 16,
			fill: 0xffffff,
			fontWeight: "bold",
		});

		this.label = new Text(config.label, style);
		this.label.anchor.set(0.5);
		this.addChild(this.label);

		this.starsContainer = new Container();
		this.starsContainer.y = 25;
		this.addChild(this.starsContainer);

		this.draw();

		// Efectos de hover
		this.on("pointerover", () => this.onHover(true));
		this.on("pointerout", () => this.onHover(false));
	}

	public refresh(newData: LevelSaveData): void {
		this.data = newData;
		this.draw();
	}

	private draw(): void {
		this.bg.clear();
		this.starsContainer.removeChildren();

		let color = this.C_LOCKED;
		let alpha = 0.6;

		if (this.data.unlocked) {
			color = this.data.completed ? this.C_COMPLETED : this.C_UNLOCKED;
			alpha = 1;
		}

		// Forma geométrica (Círculo para niveles normales, Cuadrado para especiales?)
		this.bg.beginFill(color, alpha);
		// Borde si está seleccionado o activo
		if (this.data.unlocked) {
			this.bg.lineStyle(4, 0xffffff);
		}

		// Dibujo
		this.bg.drawRoundedRect(-30, -30, 60, 60, 10);
		this.bg.endFill();

		this.label.visible = this.data.unlocked;

		// Dibujar estrellas si está completado
		if (this.data.completed) {
			this.drawStars(this.data.stars);
		}
	}

	private drawStars(count: number): void {
		const total = 3;
		const spacing = 15;
		const startX = -((total - 1) * spacing) / 2;

		for (let i = 0; i < total; i++) {
			const star = new Graphics();
			const color = i < count ? 0xffff00 : 0x555555;
			star.beginFill(color);
			star.drawCircle(0, 0, 4);
			star.endFill();
			star.x = startX + i * spacing;
			this.starsContainer.addChild(star);
		}
	}

	private onHover(over: boolean): void {
		if (!this.data.unlocked) {
			return;
		}

		const scale = over ? 1.2 : 1.0;
		new Tween(this.scale).to({ x: scale, y: scale }, 200).easing(Easing.Quadratic.Out).start();
	}
}
