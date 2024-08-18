import { Container, Sprite } from 'pixi.js';
import { Easing, Tween } from 'tweedle.js';

export class Player extends Container {
	public playerSprite: Sprite;
	private arrowTween: any | null = null;
	private treasures: Sprite[];
	private traps: Sprite[];
	private blackboard: Container;

	constructor(treasures: Sprite[], traps: Sprite[], blackboard: Container) {
		super();

		this.treasures = treasures;
		this.traps = traps;
		this.blackboard = blackboard;

		// Crear el sprite del jugador (aquí debes reemplazar por tu sprite real del jugador)
		this.playerSprite = Sprite.from('player1');
		this.playerSprite.anchor.set(0.5);
		this.addChild(this.playerSprite);
	}

	public moveTowards(x: number, y: number, context: any): void {
		const duration = 1000;

		if (this.arrowTween) {
			this.arrowTween.stop();
		}

		this.arrowTween = new Tween(this.playerSprite)
			.to({ x: x, y: y }, duration)
			.easing(Easing.Quadratic.Out)
			.start()
			.onComplete(() => {
				this.checkForTreasures(context);
				this.checkForTraps(context);
			});
	}

	private checkForTreasures(context: any): void {
		const playerBounds = this.playerSprite.getBounds();
		this.treasures = this.treasures.filter(treasure => {
			const treasureBounds = treasure.getBounds();
			if (this.isColliding(playerBounds, treasureBounds)) {
				this.collectTreasure(context, treasure);
				return false;
			}
			return true;
		});
	}

	private isColliding(rect1: any, rect2: any): boolean {
		return rect1.x < rect2.x + rect2.width &&
			rect1.x + rect1.width > rect2.x &&
			rect1.y < rect2.y + rect2.height &&
			rect1.y + rect1.height > rect2.y;
	}

	private collectTreasure(context: any, treasure: Sprite): void {
		this.blackboard.removeChild(treasure);
		this.updateScore(context, 50); // Aumentar puntuación u otras acciones
	}

	private checkForTraps(context: any): void {
		const playerBounds = this.playerSprite.getBounds();
		this.traps.forEach(trap => {
			const trapBounds = trap.getBounds();
			if (this.isColliding(playerBounds, trapBounds)) {
				this.triggerTrap(trap);
				this.updateScore(context, -50); // Reducir puntuación u otras acciones
			}
		});
	}

	public triggerTrap(_trap: Sprite): void {
		console.log("huy" + _trap);
	}

	private updateScore(context: any, scoreDelta: number): void {
		const currentScore = parseInt(context.scoreText.text.split(": ")[1]);
		const newScore = currentScore + scoreDelta;
		context.scoreText.text = `Puntuación: ${newScore}`;
	}
}
