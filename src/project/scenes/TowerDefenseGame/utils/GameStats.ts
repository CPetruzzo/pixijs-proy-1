export class GameStats {
	private points: number;
	private score: number;

	constructor(initialPoints: number) {
		this.points = initialPoints;
		this.score = 0; // Inicializamos el score en 0
	}

	public getPoints(): number {
		return this.points;
	}

	public getScore(): number {
		return this.score;
	}

	public addPoints(amount: number): void {
		this.points += amount;
	}

	public spendPoints(cost: number): boolean {
		if (this.points >= cost) {
			this.points -= cost;
			return true;
		}
		return false;
	}

	public addScore(amount: number): void {
		this.score += amount;
	}

	public resetScore(): void {
		this.score = 0;
	}
}
