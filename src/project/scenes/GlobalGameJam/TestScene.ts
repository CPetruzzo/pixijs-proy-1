import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Timer } from "../../../engine/tweens/Timer";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class TestScene extends PixiScene {
	// Control del movimiento
	private velocityX = 5; // Velocidad horizontal constante de los enemigos
	private velocityY = 0; // Velocidad vertical (afectada por gravedad)
	private gravity = 0; // Gravedad que afecta a la burbuja
	private lift = -2; // Fuerza hacia arriba cuando el jugador presiona espacio
	private bubbleSize = 0.2; // Tamaño inicial de la burbuja
	private bubble!: Sprite; // Sprite de la burbuja principal
	private obstacles: Sprite[] = []; // Lista de obstáculos
	private collectibleBubbles: Sprite[] = []; // Lista de burbujas recolectables
	private isJumping = false; // Control del salto
	private moveLeft = false; // Control para mover la burbuja hacia la izquierda

	public static readonly BUNDLES = ["storagescene", "basquet", "bubble", "package-2", "fallrungame"];
	private sceneContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	private backgrounds: TilingSprite[] = [];

	private lastShrinkTime: number = 0; // Último tiempo registrado para reducir el tamaño
	private shrinkInterval: number = 2500; // Intervalo en milisegundos para reducir el tamaño

	constructor() {
		super();

		SoundLib.playMusic("bgMusic", { loop: true });
		// Agregar el contenedor principal
		this.addChild(this.backgroundContainer, this.sceneContainer);

		// Configurar el fondo como TilingSprite
		const kitchenBackground = new TilingSprite(Texture.from("kitchen"), ScaleHelper.IDEAL_WIDTH * 100, ScaleHelper.IDEAL_HEIGHT * 100);
		kitchenBackground.x = 0;
		kitchenBackground.y = 0;
		this.backgroundContainer.addChild(kitchenBackground);
		this.backgrounds.push(kitchenBackground);

		this.sceneContainer.addChild(this.backgroundContainer);

		// Crear decoraciones y burbuja inicial
		this.createBubble();

		// Configurar controles
		this.setupKeyboardControls();

		new Timer()
			.to(3000)
			.start()
			.onComplete(() => {
				this.gravity = 0.03;
			});

		setInterval(() => this.spawnObstacle(), 2000);
		setInterval(() => this.spawnCollectibleBubble(), 1500);
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
		obstacle.x = ScaleHelper.IDEAL_WIDTH + 50; // Aparece fuera de la pantalla
		obstacle.y = Math.random() * (ScaleHelper.IDEAL_HEIGHT - 200) + 100; // Altura aleatoria
		this.sceneContainer.addChild(obstacle);
		this.obstacles.push(obstacle);
		new Tween(obstacle).to({ angle: -360 }, 500).start().repeat(Infinity);
	}

	private spawnCollectibleBubble(): void {
		const collectible = Sprite.from(Texture.from("loli"));
		collectible.scale.set(0.3);
		collectible.anchor.set(0.5);
		collectible.x = ScaleHelper.IDEAL_WIDTH + 50;
		collectible.y = Math.random() * (ScaleHelper.IDEAL_HEIGHT - 200) + 100;
		this.collectibleBubbles.push(collectible);
		this.sceneContainer.addChild(collectible);
	}

	private setupKeyboardControls(): void {
		// Listener para controles de teclado
		window.addEventListener("keydown", (event) => {
			if (event.code === "Space") {
				this.isJumping = true; // Saltar cuando se presiona espacio
			}
		});

		window.addEventListener("keyup", (event) => {
			if (event.code === "Space") {
				this.isJumping = false; // Dejar de saltar al soltar espacio
			}
		});
	}

	private hitTest(r1: Sprite, r2: Sprite): boolean {
		const bounds1 = r1.getBounds();
		const bounds2 = r2.getBounds();
		return bounds1.x + bounds1.width > bounds2.x && bounds1.x < bounds2.x + bounds2.width && bounds1.y + bounds1.height > bounds2.y && bounds1.y < bounds2.y + bounds2.height;
	}

	public override update(_dt: number): void {
		const currentTime = performance.now(); // Obtén el tiempo actual
		// Movimiento del fondo
		for (let i = 0; i < this.backgrounds.length; i++) {
			const background = this.backgrounds[i];

			// Mover el fondo en función del movimiento de la burbuja
			if (this.bubble.x < 0) {
				background.tilePosition.x += 0.2 * _dt;
			} else {
				// Ajustar la posición del fondo cuando la burbuja se mueve hacia la izquierda
				background.tilePosition.x -= 0.2 * _dt;
			}
		}

		// Movimiento horizontal de la burbuja (solo hacia la izquierda)
		if (this.moveLeft) {
			this.bubble.x -= 5; // Mover la burbuja hacia la izquierda
		}

		// Aplicar gravedad
		this.velocityY += this.gravity;

		// Si el jugador está presionando espacio, aplica fuerza hacia arriba
		if (this.isJumping) {
			this.velocityY = this.lift;
		}

		// Actualizar posición de la burbuja
		this.bubble.y += this.velocityY;

		// Limitar el tamaño de la burbuja
		if (this.bubbleSize > 3 || this.bubbleSize < 0) {
			console.log("Game Over: Bubble size limit exceeded");
			this.endGame();
		}

		// Actualizar posición de obstáculos y recolectables
		this.updateObstacles();
		this.updateCollectibles();

		// Verificar si la burbuja toca el suelo o sale de pantalla
		if (this.bubble.y > ScaleHelper.IDEAL_HEIGHT || this.bubble.y < 0) {
			console.log("Game Over: Bubble fell or flew out of bounds");
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

			// Verificar los límites del tamaño de la burbuja
			if (this.bubbleSize > 3 || this.bubbleSize < 0.5) {
				console.log("Game Over: Bubble size limit exceeded");
				this.endGame();
			}

			if (this.bubbleSize >= 3) {
				this.gravity = 0.9;
			} else if (this.bubbleSize >= 2) {
				this.gravity = 0.5;
			} else if (this.bubbleSize >= 1) {
				this.gravity = 0.2;
			} else {
				console.log("acabas de arrancar a jugar tu escala es a la inicial");
			}
		}
	}

	private updateObstacles(): void {
		this.obstacles.forEach((obstacle, index) => {
			// Los obstáculos se mueven hacia la izquierda
			obstacle.x -= this.velocityX;
			if (obstacle.x < -50) {
				console.log("obstacle.x", obstacle.x);
				console.log("obstacle.y", obstacle.y);
				// Si el obstáculo ya salió de la pantalla (considerando su ancho)
				this.sceneContainer.removeChild(obstacle);
				this.obstacles.splice(index, 1);
			}

			if (this.hitTest(this.bubble, obstacle)) {
				// Verificar colisión con la burbuja
				// console.log("Game Over: Hit an obstacle");
				this.endGame();
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
				this.bubble.scale.set(this.bubbleSize);
				SoundLib.playSound("sfxBubble", {});
				this.sceneContainer.removeChild(collectible);
				this.collectibleBubbles.splice(index, 1);
			}
		});
	}

	private endGame(): void {
		// console.log("Game Over: Restarting scene...");
		// Lógica para reiniciar o finalizar el juego
	}
}
