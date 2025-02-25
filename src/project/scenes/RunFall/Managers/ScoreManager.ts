// ScoreManager.ts
import type { Text } from "pixi.js";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export class ScoreManager {
	private score: number = 0;
	private scoreText: Text;

	constructor(scoreText: Text) {
		this.scoreText = scoreText;
		this.updateScoreText();
	}

	public increaseScore(amount: number): void {
		this.score += amount;
		this.updateScoreText();
		// console.log(this.score);
	}

	public decreaseScore(amount: number): void {
		if (this.score > 0) {
			this.score -= amount;
			this.updateScoreText();
		}
	}

	public getScore(): number {
		return this.score;
	}

	private updateScoreText(): void {
		this.scoreText.text = `Score: ${this.score}`;
	}

	public collectCoin(amount: number): void {
		console.log("El jugador recogió una moneda.");
		this.increaseScore(amount);
		SoundLib.playSound("sound_collectable", { allowOverlap: false, singleInstance: true, loop: false, volume: 0.1 });
	}

	public activatePowerUp(): void {
		console.log("El jugador activó un power-up.");
		this.increaseScore(50);
	}
}
