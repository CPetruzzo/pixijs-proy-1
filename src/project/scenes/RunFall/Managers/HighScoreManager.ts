interface HighscoreEntry {
	playerName: string;
	score: number;
}

export class HighScoreManager {
	private localStorageKey = "highscores";
	private highscores: HighscoreEntry[] = [];

	constructor() {
		this.loadHighscores();
	}

	// Cargar los highscores desde el localStorage
	private loadHighscores(): void {
		const storedHighscores = localStorage.getItem(this.localStorageKey);
		if (storedHighscores) {
			this.highscores = JSON.parse(storedHighscores);
		}
	}

	// Guardar los highscores en el localStorage
	private saveHighscores(): void {
		localStorage.setItem(this.localStorageKey, JSON.stringify(this.highscores));
	}

	// Agregar un nuevo score
	public addHighscore(playerName: string, playerScore: number): void {
		this.highscores.push({ playerName, score: playerScore });
		this.highscores.sort((a, b) => b.score - a.score);
		this.saveHighscores();
	}

	// Obtener los primeros N highscores
	public getTopHighscores(limit: number): HighscoreEntry[] {
		return this.highscores.slice(0, limit);
	}
}
