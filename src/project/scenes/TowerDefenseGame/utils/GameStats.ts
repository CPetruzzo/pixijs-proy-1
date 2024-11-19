export class GameStats {
	private points: number;

	constructor(initialPoints: number = 0) {
		this.points = initialPoints;
	}

	public getPoints(): number {
		return this.points;
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
}
