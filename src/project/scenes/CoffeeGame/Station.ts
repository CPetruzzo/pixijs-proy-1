import { Container, Sprite, Text, Graphics } from "pixi.js";
import { Tween, Easing } from "tweedle.js";

export class Station extends Container {
	public bg: Sprite;
	private cleanlinessLevel = 100; // 0-100
	private dirtOverlay: Graphics;
	private cleanlinessBar: Graphics;
	private cleanlinessBarBg: Graphics;
	private needsCleaning = false;
	public usageCount = 0;
	private lastCleanTime = Date.now();

	constructor(public type: string, x: number, y: number) {
		super();
		this.x = x;
		this.y = y;

		// Fondo de la estación
		this.bg = Sprite.from(`station-${type}`);
		this.bg.anchor.set(0.5);
		this.bg.scale.set(0.5);
		this.addChild(this.bg);

		// Overlay de suciedad (invisible al inicio)
		this.dirtOverlay = new Graphics();
		this.dirtOverlay.beginFill(0x8b4513, 0); // Marrón, transparente inicialmente
		this.dirtOverlay.drawRect(-this.bg.width / 2, -this.bg.height / 2, this.bg.width, this.bg.height);
		this.dirtOverlay.endFill();
		this.addChild(this.dirtOverlay);

		// Barra de limpieza (fondo)
		this.cleanlinessBarBg = new Graphics();
		this.cleanlinessBarBg.beginFill(0x333333);
		this.cleanlinessBarBg.drawRoundedRect(-50, -this.bg.height / 2 - 30, 100, 10, 5);
		this.cleanlinessBarBg.endFill();
		this.addChild(this.cleanlinessBarBg);

		// Barra de limpieza (progreso)
		this.cleanlinessBar = new Graphics();
		this.updateCleanlinessBar();
		this.addChild(this.cleanlinessBar);

		// Etiqueta
		const label = new Text(type, {
			fill: "#000",
			fontSize: 18,
			fontWeight: "bold",
		});
		label.anchor.set(0.5, -0.5);
		this.addChild(label);

		// Hacer la estación interactiva para limpieza
		this.bg.eventMode = "static";
		this.bg.interactive = true;
		this.bg.cursor = "pointer";
		this.bg.on("pointerdown", () => this.onClean());
	}

	public use(): void {
		this.usageCount++;
		// Cada uso reduce la limpieza
		this.cleanlinessLevel = Math.max(0, this.cleanlinessLevel - 10);
		this.updateVisuals();

		// Si baja de 50%, necesita limpieza obligatoria
		if (this.cleanlinessLevel < 50) {
			this.needsCleaning = true;
		}
	}

	public canUse(): boolean {
		// No se puede usar si está muy sucia (menos del 30%)
		return this.cleanlinessLevel >= 30;
	}

	public isHygienic(): boolean {
		// Consideramos higiénico si está por encima del 50%
		return this.cleanlinessLevel >= 50;
	}

	private onClean(): void {
		// Animación de limpieza
		this.cleanlinessLevel = Math.min(100, this.cleanlinessLevel + 30);
		this.needsCleaning = false;
		this.lastCleanTime = Date.now();
		this.updateVisuals();

		// Efecto visual de limpieza
		const sparkle = new Graphics();
		sparkle.beginFill(0xffffff, 0.8);
		sparkle.drawPolygon(0, 0, 5, 30, 15);
		sparkle.endFill();
		this.addChild(sparkle);

		new Tween(sparkle)
			.to({ alpha: 0, scale: { x: 2, y: 2 } }, 500)
			.easing(Easing.Quadratic.Out)
			.onComplete(() => {
				this.removeChild(sparkle);
			})
			.start();

		this.emit("cleaned");
	}

	private updateVisuals(): void {
		// Actualizar overlay de suciedad
		const dirtAlpha = Math.max(0, (100 - this.cleanlinessLevel) / 100) * 0.5;
		this.dirtOverlay.clear();
		this.dirtOverlay.beginFill(0x8b4513, dirtAlpha);
		this.dirtOverlay.drawRect(-this.bg.width / 2, -this.bg.height / 2, this.bg.width, this.bg.height);
		this.dirtOverlay.endFill();

		// Actualizar barra
		this.updateCleanlinessBar();

		// Efecto visual si necesita limpieza
		if (this.needsCleaning) {
			new Tween(this.bg).to({ tint: 0xff6666 }, 300).yoyo(true).repeat(1).start();
		}
	}

	private updateCleanlinessBar(): void {
		this.cleanlinessBar.clear();

		// Color según nivel
		let color = 0x00ff00; // Verde
		if (this.cleanlinessLevel < 50) {
			color = 0xffaa00;
		} // Naranja
		if (this.cleanlinessLevel < 30) {
			color = 0xff0000;
		} // Rojo

		this.cleanlinessBar.beginFill(color);
		const barWidth = (this.cleanlinessLevel / 100) * 100;
		this.cleanlinessBar.drawRoundedRect(-50, -this.bg.height / 2 - 30, barWidth, 10, 5);
		this.cleanlinessBar.endFill();
	}

	public update(_dt: number): void {
		// Degradación natural con el tiempo (muy lenta)
		const timeSinceClean = Date.now() - this.lastCleanTime;
		if (timeSinceClean > 30000) {
			// Cada 30 segundos
			this.cleanlinessLevel = Math.max(0, this.cleanlinessLevel - 1);
			this.lastCleanTime = Date.now();
			this.updateVisuals();
		}
	}

	public getCleanlinessLevel(): number {
		return this.cleanlinessLevel;
	}

	public getNeedsCleaning(): boolean {
		return this.needsCleaning;
	}
}
