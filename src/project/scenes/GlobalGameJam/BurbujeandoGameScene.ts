import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Timer } from "../../../engine/tweens/Timer";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Manager } from "../../..";
import { UIContainerLeft } from "./BubbleUILeft";
import { UIContainerRight } from "./BubbleUIRight";
import { Keyboard } from "../../../engine/input/Keyboard";

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

	public static readonly BUNDLES = ["storagescene", "basquet", "bubble", "package-2", "package-1", "playWithSounds"];
	private sceneContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	private backgrounds: TilingSprite[] = [];

	private lastShrinkTime: number = 0;
	private shrinkInterval: number = 1500;
	private gameOver: boolean = false;
	private kitchenBackground: TilingSprite;

	private uiLeftContainer: UIContainerLeft = new UIContainerLeft();
	private uiRightContainer: UIContainerRight = new UIContainerRight();

	constructor() {
		super();

		SoundLib.playMusic("bgMusic", { loop: true });
		this.addChild(this.backgroundContainer, this.sceneContainer, this.uiLeftContainer, this.uiRightContainer);

		this.kitchenBackground = new TilingSprite(Texture.from("kitchen"), ScaleHelper.IDEAL_WIDTH * 100, ScaleHelper.IDEAL_HEIGHT * 100);
		this.kitchenBackground.x = 0;
		this.kitchenBackground.y = 0;
		this.sceneContainer.interactive = true;
		this.sceneContainer.eventMode = "static";
		this.backgroundContainer.addChild(this.kitchenBackground);
		this.backgrounds.push(this.kitchenBackground);

		this.sceneContainer.addChild(this.backgroundContainer);

		this.createBubble();

		new Timer()
			.to(3000)
			.start()
			.onComplete(() => {
				this.gravity = 0.01;
			});

		setInterval(() => this.spawnObstacle(), 2000);
		setInterval(() => this.spawnCollectibleBubble(), 500);

		this.setupKeyboardControls();
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
		obstacle.scale.set(0.25);
		obstacle.x = ScaleHelper.IDEAL_WIDTH + 50;
		obstacle.y = Math.random() * (ScaleHelper.IDEAL_HEIGHT - 200) + 100;
		this.sceneContainer.addChild(obstacle);
		this.obstacles.push(obstacle);
		new Tween(obstacle).to({ angle: -360 }, 500).start().repeat(Infinity);
	}

	private spawnCollectibleBubble(): void {
		const collectible = Sprite.from(Texture.from("bubble"));
		collectible.scale.set(0.05);
		collectible.anchor.set(0.5);
		collectible.x = ScaleHelper.IDEAL_WIDTH + 50;
		collectible.y = Math.random() * (ScaleHelper.IDEAL_HEIGHT - 200) + 100;
		this.collectibleBubbles.push(collectible);
		this.sceneContainer.addChild(collectible);
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
		if (this.gameOver) {
			console.log("Game Over: Restarting scene...");
			Manager.changeScene(BurbujeandoGameScene);
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
		}

		// Reducir el tamaño de la burbuja cada intervalo de tiempo
		if (currentTime - this.lastShrinkTime > this.shrinkInterval) {
			this.lastShrinkTime = currentTime; // Actualiza el tiempo
			this.bubbleSize -= 0.01; // Reduce el tamaño de la burbuja
			console.log("Bubble size reduced:", this.bubbleSize);

			// Aplicar el tween a la escala de la burbuja
			new Tween(this.bubble.scale)
				.to({ x: this.bubbleSize, y: this.bubbleSize }, 200) // Escala progresiva en 500 ms
				.easing(Easing.Quadratic.InOut) // Agregar un easing para suavizar la animación
				.start();

			// Reducir la barra de vida
			const newValue = this.uiLeftContainer.currentPoints - 10;
			this.uiLeftContainer.hpBar.updateValue(newValue, 200);
			this.uiLeftContainer.currentPoints = newValue;
			// Verificar los límites del tamaño de la burbuja
			if (this.bubbleSize > 3 || this.bubbleSize < 0.1) {
				console.log("Game Over: Bubble size limit exceeded");
				this.endGame();
			}

			console.log("this.bubbleSize", this.bubbleSize);
			if (this.bubbleSize >= 0.35) {
				this.gravity = 0.2;
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
				new Tween(this.bubble).from({ alpha: 0.1 }).to({ alpha: 0.8 }, 100).repeat(10).yoyo(true).start();
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
				this.bubbleSize += 0.01;
				new Tween(this.bubble.scale)
					.to({ x: this.bubbleSize, y: this.bubbleSize }, 200) // Escala progresiva en 500 ms
					.easing(Easing.Bounce.Out) // Agregar un easing para suavizar la animación
					.start();

				const newValue = this.uiLeftContainer.currentPoints + 10;
				this.uiLeftContainer.hpBar.updateValue(newValue, 200);
				this.uiLeftContainer.currentPoints = newValue;

				// SoundLib.playSound("sfxBubble", {});
				this.sceneContainer.removeChild(collectible);
				this.collectibleBubbles.splice(index, 1);
			}
		});
	}

	private endGame(): void {
		this.gameOver = true;
		// console.log("Game Over: Restarting scene...");
		// Lógica para reiniciar o finalizar el juego

		this.uiRightContainer.saveScore();

		console.log(this.uiRightContainer.getHighScores());
		// Opcional: Reinicia la distancia para un nuevo intento
		this.uiRightContainer.resetScore();
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.sceneContainer, _newW, _newH, 1920, 1080, ScaleHelper.FILL);

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.uiRightContainer.x = 0;
		this.uiRightContainer.y = 0;
	}
}
