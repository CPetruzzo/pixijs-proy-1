import { Container, Graphics, Text, TextStyle } from "pixi.js";

export class PlayerStats {
	private maxHp: number;
	private currentHp: number;
	public playerId: string;
	private healthBarContainer: Container;
	private healthBarBg: Graphics;
	private healthBar: Graphics;
	private healthText: Text;

	constructor(playerId: string, maxHp: number = 10) {
		this.playerId = playerId;
		this.maxHp = maxHp;
		this.currentHp = maxHp;

		// Create health bar UI
		this.healthBarContainer = new Container();
		this.createHealthBar();
	}

	private createHealthBar(): void {
		const barWidth = 100;
		const barHeight = 10;

		// Background (red)
		this.healthBarBg = new Graphics();
		this.healthBarBg.beginFill(0xff0000);
		this.healthBarBg.drawRect(-barWidth / 2, 0, barWidth, barHeight);
		this.healthBarBg.endFill();

		// Foreground (green)
		this.healthBar = new Graphics();
		this.healthBar.beginFill(0x00ff00);
		this.healthBar.drawRect(-barWidth / 2, 0, barWidth, barHeight);
		this.healthBar.endFill();

		// Health text
		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 12,
			fill: "white",
			fontWeight: "bold",
		});

		this.healthText = new Text(`${this.currentHp}/${this.maxHp}`, textStyle);
		this.healthText.anchor.set(0.5, 0);
		this.healthText.y = barHeight + 2;

		this.healthBarContainer.addChild(this.healthBarBg);
		this.healthBarContainer.addChild(this.healthBar);
		this.healthBarContainer.addChild(this.healthText);

		// Position above player
		this.healthBarContainer.y = -60;
	}

	public takeDamage(amount: number): number {
		this.currentHp = Math.max(0, this.currentHp - amount);
		this.updateHealthBar();
		return this.currentHp;
	}

	public heal(amount: number): void {
		this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
		this.updateHealthBar();
	}

	private updateHealthBar(): void {
		const barWidth = 100;
		const healthPercentage = this.currentHp / this.maxHp;

		// Update health bar width
		this.healthBar.clear();
		this.healthBar.beginFill(0x00ff00);
		this.healthBar.drawRect(-barWidth / 2, 0, barWidth * healthPercentage, 10);
		this.healthBar.endFill();

		// Update text
		this.healthText.text = `${this.currentHp}/${this.maxHp}`;
	}

	public getHealthBarContainer(): Container {
		return this.healthBarContainer;
	}

	public getCurrentHp(): number {
		return this.currentHp;
	}

	public getMaxHp(): number {
		return this.maxHp;
	}

	public isAlive(): boolean {
		return this.currentHp > 0;
	}

	public reset(): void {
		this.currentHp = this.maxHp;
		this.updateHealthBar();
	}
}
