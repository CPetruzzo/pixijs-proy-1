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
		this.cornerRadius = height / 2;

		this.healthGlow = new GlowFilter({ color: 0x273257 });

		// Background
		this.bg = new Graphics();
		this.drawBackground();
		this.addChild(this.bg);

		// Foreground
		this.fg = new Graphics();
		this.drawForeground((this.barWidth * this.currentHealth) / this.maxHealth);
		this.addChild(this.fg);

		this.filters = [this.glow];
	}

	/** Redraws the background shape */
	private drawBackground(): void {
		this.bg.clear();
		this.bg.beginFill(0x273257);
		this.bg.drawRoundedRect(0, 0, this.barWidth, this.barHeight, this.cornerRadius);
		this.bg.endFill();
	}

	/** Redraws the foreground at given width */
	private drawForeground(width: number): void {
		this.fg.clear();
		this.fg.beginFill(0xc53570);
		this.fg.drawRoundedRect(0, 0, width, this.barHeight, this.cornerRadius);
		this.fg.endFill();
	}

	/** Smoothly tween the FG to targetWidth */
	private animateToWidth(targetWidth: number): void {
		const proxy = { w: this.fg.width };
		new Tween(proxy)
			.to({ w: targetWidth }, 500)
			.easing(Easing.Quadratic.Out)
			.onUpdate(() => this.drawForeground(proxy.w))
			.start();
		this.filters = [this.healthGlow];
	}

	/** Clamp and animate to new health */
	public updateHealth(health: number): void {
		this.currentHealth = Math.max(0, Math.min(this.maxHealth, health));
		const newWidth = (this.barWidth * this.currentHealth) / this.maxHealth;
		this.animateToWidth(newWidth);
	}

	/** Increment health by 1 */
	public increaseHealth(): void {
		if (this.currentHealth < this.maxHealth) {
			this.updateHealth(this.currentHealth + 1);
		}
	}

	/** Decrement health by 1 */
	public decreaseHealth(): void {
		if (this.currentHealth > 0) {
			this.updateHealth(this.currentHealth - 1);
			if (this.currentHealth === 0) {
				console.log("El jugador perdió toda la vida.");
			}
		}
	}

	/** Returns current health */
	public getCurrentHealth(): number {
		return this.currentHealth;
	}

	/** 🚀 Set a new maximum health and redraw */
	public setMaxHealth(n: number): void {
		this.maxHealth = Math.max(1, n);
		// clamp currentHealth
		if (this.currentHealth > this.maxHealth) {
			this.currentHealth = this.maxHealth;
		}
		// redraw background & foreground immediately
		this.drawBackground();
		const fgWidth = (this.barWidth * this.currentHealth) / this.maxHealth;
		this.drawForeground(fgWidth);
	}

	/** 🚀 Set current health (clamped) and animate */
	public setCurrentHealth(n: number): void {
		this.updateHealth(n);
	}
}
