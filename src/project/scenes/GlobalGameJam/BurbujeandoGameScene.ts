import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Timer } from "../../../engine/tweens/Timer";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Manager } from "../../..";
import { UIContainerMiddle } from "./BubbleUILeft";
import { UIContainerRight } from "./BubbleUIRight";
import { Keyboard } from "../../../engine/input/Keyboard";
import { BurbujeandoHighScorePopUp } from "./BurbujeandoHighScorePopUp";
import { BurbujeandoMainScene } from "./BurbujeandoMainScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { BubbleNameInputPopUp } from "./BurbujeandoNameInputPopUp";
import { BubbleEmitter } from "./BubbleEmitter";

export class BurbujeandoGameScene extends PixiScene {
	// Control del movimiento
	private velocityX = 5;
	private velocityY = 0;
	private gravity = 0;
	private lift = -2;
	private bubbleSize = 0.2;
	private bubble!: Sprite;
	private obstacles: Sprite[] = [];
	private collectibleBubbles: Sprite[] = [];
	private isJumping = false;

	public static readonly BUNDLES = ["bubble", "basquet"];
	private sceneContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	private backgrounds: TilingSprite[] = [];

	private lastShrinkTime: number = 0;
	private shrinkInterval: number = 1500;
	private gameOver: boolean = false;
	private kitchenBackground: TilingSprite;

	private uiMiddleContainer: UIContainerMiddle = new UIContainerMiddle();
	private uiRightContainer: UIContainerRight = new UIContainerRight();
	private isPaused: boolean = false;
	private isPopupOpen: boolean = false;

	private difficultyLevel: number = 1;
	private static BASE_BUBBLE_SPAWN_TIME: number = 500;
	private static BASE_OBSTACLE_SPAWN_TIME: number = 2000;
	public static OBSTACLE_SPAWN_TIME: number;
	public static BUBBLE_SPAWN_TIME: number;
	private popupOpened: boolean = false;
	private bubbleEmitter: BubbleEmitter;
	private bubbleParticleContainer: Container = new Container();

	constructor() {
		super();
		// Opcional: Reinicia la distancia para un nuevo intento
		this.uiRightContainer.resetScore();

		SoundLib.playMusic("bgMusic", { loop: true });
		this.addChild(this.backgroundContainer, this.sceneContainer, this.uiMiddleContainer, this.uiRightContainer);

		this.kitchenBackground = new TilingSprite(Texture.from("kitchen"), ScaleHelper.IDEAL_WIDTH * 100, ScaleHelper.IDEAL_HEIGHT * 100);
		this.kitchenBackground.x = 0;
		this.kitchenBackground.y = 0;

		this.backgroundContainer.addChild(this.kitchenBackground);
		this.backgrounds.push(this.kitchenBackground);

		this.sceneContainer.addChild(this.backgroundContainer);

		this.createBubble();

		Keyboard.shared.enabled = false;
		this.sceneContainer.eventMode = "none";
		this.sceneContainer.interactive = false;
		new Timer()
			.to(500)
			.start()
			.onComplete(() => {
				this.gravity = 0.01;
				Keyboard.shared.enabled = true;
				this.sceneContainer.interactive = true;
				this.sceneContainer.eventMode = "static";
			});

		this.scheduleSpawn();

		this.setupKeyboardControls();

		this.bubbleEmitter = new BubbleEmitter(this.bubbleParticleContainer);
	}

	private scheduleSpawn(): void {
		// Usa los tiempos ajustados según el nivel de dificultad
		setInterval(() => this.spawnObstacle(), BurbujeandoGameScene.BASE_OBSTACLE_SPAWN_TIME / this.difficultyLevel);
		setInterval(() => this.spawnCollectibleBubble(), BurbujeandoGameScene.BASE_BUBBLE_SPAWN_TIME / this.difficultyLevel);
	}

	private createBubble(): void {
		this.bubble = Sprite.from(Texture.from("bubble"));
		this.bubble.anchor.set(0.5);
		this.bubble.x = 200;
		this.bubble.y = ScaleHelper.IDEAL_HEIGHT / 2;
		this.bubble.alpha = 0.8;
		this.bubble.scale.set(this.bubbleSize);
		new Tween(this.bubble).to({ angle: -12 }, 1000).yoyo(true).easing(Easing.Quadratic.InOut).repeat(Infinity).start();

		this.sceneContainer.addChild(this.bubble);
	}

	private spawnObstacle(): void {
		const obstacle = Sprite.from(Texture.from("knife"));
		obstacle.anchor.set(0.5);
		obstacle.scale.set(-0.17, 0.17);
		obstacle.x = ScaleHelper.IDEAL_WIDTH + 50;
		obstacle.y = Math.random() * (ScaleHelper.IDEAL_HEIGHT - 200) + 100;
		this.sceneContainer.addChild(obstacle);
		this.obstacles.push(obstacle);
		new Tween(obstacle).to({ angle: -360 }, 1500).start().repeat(Infinity);
	}

	private spawnCollectibleBubble(): void {
		const collectible = Sprite.from(Texture.from("bubble"));
		collectible.scale.set(0.05);
		collectible.anchor.set(0.5);
		collectible.x = ScaleHelper.IDEAL_WIDTH + 50;
		collectible.y = Math.random() * (ScaleHelper.IDEAL_HEIGHT - 200) + 100;

		// Añadir la burbuja al contenedor
		this.collectibleBubbles.push(collectible);
		this.sceneContainer.addChild(collectible);

		// Actualizar la posición del emisor para que siga la burbuja
		this.bubbleEmitter.updateOwnerPos(collectible.x, collectible.y);

		// Iniciar la emisión de partículas
		this.bubbleEmitter.start();

		// Detener la emisión después de un tiempo (opcional)
		setTimeout(() => {
			this.bubbleEmitter.stop();
		}, 2000); // Detiene la emisión después de 2 segundos
	}

	private setupKeyboardControls(): void {
		this.sceneContainer.on("pointerdown", () => {
			console.log("Pointer down detected");
			this.isJumping = true;
		});

		this.sceneContainer.on("pointerup", () => {
			console.log("Pointer up detected");
			this.isJumping = false;
		});
	}

	private hitTest(r1: Sprite, r2: Sprite): boolean {
		const bounds1 = r1.getBounds();
		const bounds2 = r2.getBounds();
		return bounds1.x + bounds1.width > bounds2.x && bounds1.x < bounds2.x + bounds2.width && bounds1.y + bounds1.height > bounds2.y && bounds1.y < bounds2.y + bounds2.height;
	}

	public override update(_dt: number): void {
		if (this.endGame()) {
			this.isPaused = true;
			return;
		}

		if (this.bubbleEmitter) {
			this.bubbleEmitter.update(_dt * 0.001); // Convierte _dt a segundos
		}

		this.onLevelProgressDifficulty();

		if (Keyboard.shared.justPressed("Escape")) {
			Manager.changeScene(BurbujeandoMainScene, { transitionClass: FadeColorTransition });
			return;
		}

		if (this.isPaused) {
			return;
		}

		if (this.isPopupOpen) {
			return;
		}

		const currentTime = performance.now();
		for (let i = 0; i < this.backgrounds.length; i++) {
			const background = this.backgrounds[i];

			if (this.bubble.x < 0) {
				background.tilePosition.x += 0.2 * _dt;
			} else {
				background.tilePosition.x -= 0.2 * _dt;
			}
		}

		if (Keyboard.shared.justReleased("Space")) {
			this.isJumping = true;
		}

		this.velocityY += this.gravity;

		if (this.isJumping) {
			this.velocityY = this.lift;
			this.isJumping = false;
		}

		this.bubble.y += this.velocityY;

		this.updateObstacles();
		this.updateCollectibles();

		if (this.bubble.y > ScaleHelper.IDEAL_HEIGHT || this.bubble.y < 0) {
			this.endGame();

			this.gameOver = true; // esto es raro
			this.isPaused = true;
		}

		// Reducir el tamaño de la burbuja cada intervalo de tiempo
		if (currentTime - this.lastShrinkTime > this.shrinkInterval) {
			this.lastShrinkTime = currentTime; // Actualiza el tiempo
			this.bubbleSize -= 0.01; // Reduce el tamaño de la burbuja
			console.log("Bubble size reduced:", this.bubbleSize);

			// Aplicar el tween a la escala de la burbuja
			new Tween(this.bubble.scale)
				.to({ x: this.bubbleSize, y: this.bubbleSize }, 400) // Escala progresiva en 500 ms
				.easing(Easing.Quadratic.InOut) // Agregar un easing para suavizar la animación
				.start();

			// Reducir la barra de vida
			const newValue = this.uiMiddleContainer.currentPoints - 10;
			this.uiMiddleContainer.hpBar.updateValue(newValue, 200);
			this.uiMiddleContainer.currentPoints = newValue;
			// Verificar los límites del tamaño de la burbuja
			if (this.bubbleSize > 3 || this.bubbleSize <= 0) {
				console.log("this.bubbleSize", this.bubbleSize);
				console.log("Game Over: Bubble size limit exceeded");
				this.endGame();

				this.gameOver = true; // esto es raro
				this.isPaused = true;
			}

			console.log("this.bubbleSize", this.bubbleSize);
			if (this.bubbleSize >= 0.35) {
				this.gravity = 0.1;
			} else if (this.bubbleSize >= 0.25) {
				this.gravity = 0.03;
			} else if (this.bubbleSize >= 0.2) {
				this.gravity = 0.01;
			} else {
				console.log("acabas de arrancar a jugar tu escala es a la inicial");
			}
		}

		this.uiRightContainer.updateScore(_dt);
	}

	private updateObstacles(): void {
		this.obstacles.forEach((obstacle, index) => {
			// Los obstáculos se mueven hacia la izquierda
			obstacle.x -= this.velocityX;
			if (obstacle.x < -50) {
				// Si el obstáculo ya salió de la pantalla (considerando su ancho)
				this.sceneContainer.removeChild(obstacle);
				this.obstacles.splice(index, 1);
			}

			if (this.hitTest(this.bubble, obstacle)) {
				// Verificar colisión con la burbuja
				// console.log("Game Over: Hit an obstacle");
				new Tween(this.bubble)
					.from({ alpha: 0.1 })
					.to({ alpha: 0.8 }, 100)
					.repeat(10)
					.yoyo(true)
					.start()
					.onStart(() => {
						this.sceneContainer.removeChild(obstacle);
						this.obstacles.splice(index, 1);

						this.bubbleSize -= 0.01;
						new Tween(this.bubble.scale)
							.to({ x: this.bubbleSize, y: this.bubbleSize }, 400) // Escala progresiva en 500 ms
							.easing(Easing.Bounce.Out) // Agregar un easing para suavizar la animación
							.start();

						const newValue = this.uiMiddleContainer.currentPoints - 10;
						this.uiMiddleContainer.hpBar.updateValue(newValue, 200);
						this.uiMiddleContainer.currentPoints = newValue;
					});
			}
		});
	}

	private updateCollectibles(): void {
		this.collectibleBubbles.forEach((collectible, index) => {
			// Las burbujas recolectables se mueven hacia la izquierda
			collectible.x -= this.velocityX;
			if (collectible.x < -50) {
				// Si el objeto ya salió de la pantalla
				this.sceneContainer.removeChild(collectible);
				this.collectibleBubbles.splice(index, 1);
			}

			if (this.hitTest(this.bubble, collectible)) {
				// Verificar si la burbuja tocó un objeto coleccionable
				this.bubbleSize += 0.015;
				new Tween(this.bubble.scale)
					.to({ x: this.bubbleSize, y: this.bubbleSize }, 400) // Escala progresiva en 500 ms
					.easing(Easing.Bounce.Out) // Agregar un easing para suavizar la animación
					.start();

				const newValue = this.uiMiddleContainer.currentPoints + 15;
				this.uiMiddleContainer.hpBar.updateValue(newValue, 200);
				this.uiMiddleContainer.currentPoints = newValue;

				// SoundLib.playSound("sfxBubble", {});
				this.sceneContainer.removeChild(collectible);
				this.collectibleBubbles.splice(index, 1);
			}
		});
	}

	private endGame(): boolean {
		this.uiRightContainer.saveScore();
		if (this.gameOver && !this.popupOpened) {
			this.openNameInputPopup();
			this.popupOpened = true;
			return true;
		}
		return false;
	}

	private async openGameOverPopup(): Promise<void> {
		try {
			const popupInstance = await Manager.openPopup(BurbujeandoHighScorePopUp, [this.uiRightContainer.getHighScore()]);
			if (popupInstance instanceof BurbujeandoHighScorePopUp) {
				popupInstance.showHighscores(this.uiRightContainer.getHighScore());
			} else {
				console.error("Error al abrir el popup: no se pudo obtener la instancia de BasePopup.");
			}
		} catch (error) {
			console.error("Error al abrir el popup:", error);
		}
	}

	private onLevelProgressDifficulty(): void {
		// Incrementa la dificultad con base en el puntaje
		const currentScore = this.uiRightContainer.getHighScore() * 0.1;
		if (currentScore > 100 * this.difficultyLevel) {
			this.difficultyLevel++;
			console.log(`Increased difficulty to level: ${this.difficultyLevel}`);

			BurbujeandoGameScene.OBSTACLE_SPAWN_TIME = Math.max(500, BurbujeandoGameScene.BASE_OBSTACLE_SPAWN_TIME / this.difficultyLevel);
			BurbujeandoGameScene.BUBBLE_SPAWN_TIME = Math.max(300, BurbujeandoGameScene.BASE_BUBBLE_SPAWN_TIME / this.difficultyLevel);

			// Opcional: Incrementar la velocidad de los obstáculos
			this.velocityX += 0.3;
			console.log(`Obstacle speed increased to: ${this.velocityX}`);
		}
	}

	public async openNameInputPopup(): Promise<void> {
		this.isPopupOpen = true;
		this.isPaused = true;

		try {
			const popupInstance = await Manager.openPopup(BubbleNameInputPopUp);
			if (popupInstance instanceof BubbleNameInputPopUp) {
				popupInstance.showButtons();
			}
			if (popupInstance instanceof BubbleNameInputPopUp) {
				popupInstance.on("HIGHSCORE_NAME_READY", () => {
					console.log("cerrate loco");
					this.isPaused = false;
					this.isPopupOpen = false;
					this.openGameOverPopup();
				});
			}
		} catch (error) {
			console.error("Error opening settings popup:", error);
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.sceneContainer, _newW, _newH, 1920, 1080, ScaleHelper.FILL);

		ScaleHelper.setScaleRelativeToIdeal(this.uiMiddleContainer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.uiMiddleContainer.x = _newW * 0.5;
		this.uiMiddleContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.uiRightContainer.x = 0;
		this.uiRightContainer.y = 0;
	}
}
