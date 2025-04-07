import { Container, Graphics } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { GlowFilter } from "@pixi/filter-glow";

export class HealthBar extends Container {
	private maxHealth: number;
	private currentHealth: number;

	private barWidth: number;
	private barHeight: number;
	private cornerRadius: number;

	private bg: Graphics;
	private fg: Graphics;

	private healthGlow: GlowFilter;
	private glow: GlowFilter;

	constructor(maxHealth: number, width: number, height: number) {
		super();
		this.maxHealth = maxHealth;
		this.currentHealth = maxHealth;
		this.glow = new GlowFilter();

		this.barWidth = width;
		this.barHeight = height;
		// Para un semicírculo perfecto en los extremos:
		this.cornerRadius = height / 2;

		// 1) Fondo (gris oscuro)
		this.bg = new Graphics();
		this.bg.beginFill(0x273257);
		this.bg.drawRoundedRect(0, 0, this.barWidth, this.barHeight, this.cornerRadius);
		this.bg.endFill();
		this.addChild(this.bg);

		// 2) Barra de vida (rosa), inicialmente llena
		this.fg = new Graphics();
		this.fg.beginFill(0xc53570);
		this.fg.drawRoundedRect(0, 0, this.barWidth, this.barHeight, this.cornerRadius);
		this.fg.endFill();
		this.addChild(this.fg);

		// Crear el efecto de brillo
		this.healthGlow = new GlowFilter({ color: 0x273257 });
		this.filters = [this.glow];
	}

	/** Animación suave al cambiar la vida */
	private animateToWidth(targetWidth: number): void {
		// Objeto auxiliar para tween
		const proxy = { w: this.fg.width };
		new Tween(proxy)
			.to({ w: targetWidth }, 500)
			.easing(Easing.Quadratic.Out)
			.onUpdate(() => {
				// Redibuja la FG con la anchura intermedia
				this.fg.clear();
				this.fg.beginFill(0xc53570);
				this.fg.drawRoundedRect(0, 0, proxy.w, this.barHeight, this.cornerRadius);
				this.fg.endFill();
			})
			.start();
		this.filters = [this.healthGlow];
	}

	/** Ajusta inmediatamente el estado interno y lanza la animación */
	public updateHealth(health: number): void {
		this.currentHealth = Math.max(0, Math.min(this.maxHealth, health));
		const newWidth = (this.barWidth * this.currentHealth) / this.maxHealth;
		this.animateToWidth(newWidth);
	}

	/** Incrementa vida en 1 */
	public increaseHealth(): void {
		if (this.currentHealth < this.maxHealth) {
			this.updateHealth(this.currentHealth + 1);
		}
	}

	/** Decrementa vida en 1 */
	public decreaseHealth(): void {
		if (this.currentHealth > 0) {
			this.updateHealth(this.currentHealth - 1);
			if (this.currentHealth === 0) {
				console.log("El jugador perdió toda la vida.");
			}
		}
	}

	/** Devuelve la vida actual */
	public getCurrentHealth(): number {
		return this.currentHealth;
	}
}
