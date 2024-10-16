import { Container, Sprite, Texture } from "pixi.js";
import { GlowFilter } from "@pixi/filter-glow";

export class HealthBar extends Container {
	private maxHealth: number;
	private currentHealth: number;
	private healthBarBackground: Sprite;
	private healthSprites: Sprite[] = [];
	private healthGlow: GlowFilter;
	private glow: GlowFilter;

	constructor(maxHealth: number, width: number, height: number) {
		super();
		this.maxHealth = maxHealth;
		this.currentHealth = maxHealth;
		this.glow = new GlowFilter();

		// Crear el fondo de la barra de vida
		this.healthBarBackground = new Sprite(Texture.WHITE);
		this.healthBarBackground.width = width;
		this.healthBarBackground.height = height;
		this.healthBarBackground.tint = 0x273257;
		this.addChild(this.healthBarBackground);

		// Crear el efecto de brillo
		this.healthGlow = new GlowFilter({ color: 0x273257 });
		this.filters = [this.glow];

		// Crear los sprites que representan la vida
		for (let i = 0; i < this.maxHealth; i++) {
			const healthSprite = new Sprite(Texture.WHITE);
			healthSprite.width = width / this.maxHealth;
			healthSprite.height = height;
			healthSprite.tint = 0xc53570;
			healthSprite.x = i * healthSprite.width;
			this.healthSprites.push(healthSprite);
			this.addChild(healthSprite);
		}

		this.filters = [this.healthGlow];
	}

	public updateHealth(health: number): void {
		this.currentHealth = health;
		this.healthSprites.forEach((sprite, index) => {
			sprite.visible = index < this.currentHealth;
		});
	}

	public increaseHealth(): void {
		console.log("El jugador recibió curación. +1 de vida");
		if (this.currentHealth < this.maxHealth) {
			this.currentHealth++; // Incrementar la vida si no está al máximo
			this.updateHealth(this.currentHealth); // Actualizar la barra de vida
		}
	}

	public decreaseHealth(): void {
		if (this.currentHealth > 0) {
			// Verifica si el jugador todavía tiene vida
			this.currentHealth--; // Reducir la vida
			this.updateHealth(this.currentHealth); // Actualizar la barra de vida
			console.log("this.currentHealth", this.currentHealth);
			if (this.currentHealth <= 0) {
				// Aquí puedes manejar la lógica cuando el jugador pierde toda la vida
				console.log("El jugador perdió toda la vida.");
			}
		}
	}

	public getCurrentHealth(): number {
		return this.currentHealth;
	}
}
