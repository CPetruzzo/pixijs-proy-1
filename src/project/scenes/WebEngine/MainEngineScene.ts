import { Container, Text, Graphics, Sprite } from 'pixi.js';
import { PixiScene } from '../../../engine/scenemanager/scenes/PixiScene';
import { ScaleHelper } from '../../../engine/utils/ScaleHelper';
import { Player } from './Player';
import { Easing, Tween } from 'tweedle.js';

export class MainEngineScene extends PixiScene {
	private backgroundContainer: Container;
	private mainContainer: Container = new Container();
	private buttonsContainer: Container = new Container();
	private currentDispenser: string | null = null;
	public static readonly BUNDLES = ["engine", "fallrungame"];
	private isDrawing: boolean = false;
	private blackboard: Sprite;
	private canDraw: boolean = false;
	private player: Player;
	private treasures: Sprite[] = [];
	private traps: Sprite[] = [];
	private enemies: Sprite[] = [];
	private scoreText: Text;
	private timeText: Text;
	private time: number = 0; // Mantener el tiempo acumulado

	private createUI(): void {
		this.scoreText = new Text('Puntuación: 0', { fontFamily: 'Arial', fontSize: 24, fill: 0xffffff });
		this.timeText = new Text('Tiempo: 0', { fontFamily: 'Arial', fontSize: 24, fill: 0xffffff });

		this.scoreText.x = 10;
		this.scoreText.y = 10;

		this.timeText.x = 10;
		this.timeText.y = 40;

		this.addChild(this.scoreText);
		this.addChild(this.timeText);
	}

	public override update(dt: number): void {
		this.time += dt;
		this.timeText.text = `Tiempo: ${Math.floor(this.time / 1000)}`; // Convertir milisegundos a segundos
	}

	constructor() {
		super();

		this.backgroundContainer = new Container();
		this.backgroundContainer.name = "background";
		this.addChild(this.backgroundContainer);

		this.blackboard = Sprite.from("blackboard");
		this.blackboard.anchor.set(0.5);
		this.blackboard.interactive = true;
		this.blackboard.cursor = 'crosshair';
		this.blackboard.interactiveChildren = false;

		this.backgroundContainer.addChild(this.blackboard);
		this.addChild(this.buttonsContainer);
		this.addChild(this.mainContainer);

		this.mainContainer.name = "mainContainer";
		this.buttonsContainer.name = "buttonsContainer";
		this.createButtons();

		// Crear el jugador
		this.player = new Player(this.treasures, this.traps, this.blackboard);
		this.blackboard.addChild(this.player); // Agregar el jugador al blackboard

		this.setupInteractions();

		this.createTreasures();
		this.createTraps();
		this.createEnemies();
		this.createUI();
	}

	private createButtons(): void {
		this.createButton('Agregar Cuadrado', 50, 50, () => this.setDispenser('square'));
		this.createButton('Agregar Círculo', 50, 100, () => this.setDispenser('circle'));
	}

	private createButton(text: string, x: number, y: number, onClick: () => void): void {
		const btnBackground = new Graphics();
		btnBackground.beginFill(0xfffff);
		btnBackground.drawRoundedRect(x - 15, y, 230, 30, 15);
		btnBackground.endFill();

		const button = new Text(text, {
			fontFamily: 'Arial',
			fontSize: 24,
			fill: 0xffffff,
			align: 'center'
		});

		button.interactive = true;
		button.x = x;
		button.y = y;
		button.on('pointerup', (event) => {
			onClick();
			event.stopPropagation(); // Detiene la propagación del evento para evitar que se dibuje en el click del botón
		});

		btnBackground.addChild(button);
		this.buttonsContainer.addChild(btnBackground);
	}

	private setDispenser(objectType: string): void {
		this.currentDispenser = objectType;
		document.body.style.cursor = 'crosshair';
	}

	private setupInteractions(): void {
		this.eventMode = "static";

		this.blackboard.on('pointerdown', (event) => {
			if (this.isDrawing) {
				this.isDrawing = false;
				document.body.style.cursor = 'default';
			} else if (event.data.button === 0 && this.currentDispenser) {
				const localMousePosition = this.blackboard.toLocal(event.data.global);
				this.addObject(this.currentDispenser, localMousePosition.x, localMousePosition.y);
			}
		});

		this.blackboard.on('rightdown', () => {
			this.isDrawing = false;
			this.currentDispenser = null;
			document.body.style.cursor = 'default';
		});

		this.blackboard.on('pointerover', () => {
			this.canDraw = true;
		});

		this.blackboard.on('pointerout', () => {
			this.canDraw = false;
		});

		this.blackboard.on('pointerdown', (event) => {
			const localMousePosition = this.blackboard.toLocal(event.data.global);
			this.player.moveTowards(localMousePosition.x, localMousePosition.y, this);
		});

		this.on('pointermove', (event) => {
			if (this.isDrawing && this.currentDispenser && this.canDraw) {
				const localMousePosition = this.blackboard.toLocal(event.data.global);
				this.addObject(this.currentDispenser, localMousePosition.x, localMousePosition.y);
			}
			this.blackboard.on('pointerdown', (event) => {
				const localMousePosition = this.blackboard.toLocal(event.data.global);
				this.player.moveTowards(localMousePosition.x, localMousePosition.y, this);
			});
		});
	}

	private createTreasures(): void {
		for (let i = 0; i < 10; i++) {
			const treasure = Sprite.from('coin');
			treasure.anchor.set(0.5);
			treasure.x = Math.random() * this.blackboard.width - this.blackboard.width * 0.5;
			treasure.y = Math.random() * this.blackboard.height - this.blackboard.height * 0.5;
			this.treasures.push(treasure);
			this.blackboard.addChild(treasure);
		}
	}

	private createTraps(): void {
		for (let i = 0; i < 5; i++) { // Generar 5 trampas
			const trap = Sprite.from('obstacule');
			trap.anchor.set(0.5);
			trap.x = Math.random() * this.blackboard.width - this.blackboard.width * 0.5;
			trap.y = Math.random() * this.blackboard.height - this.blackboard.height * 0.5;
			this.traps.push(trap);
			this.blackboard.addChild(trap);
		}
	}

	private createEnemies(): void {
		for (let i = 0; i < 3; i++) { // Generar 3 enemigos
			const enemy = Sprite.from('enemy');
			enemy.anchor.set(0.5);
			enemy.x = Math.random() * this.blackboard.width - this.blackboard.width * 0.5;
			enemy.y = Math.random() * this.blackboard.height - this.blackboard.height * 0.5;
			this.enemies.push(enemy);
			this.blackboard.addChild(enemy);
			this.patrolEnemy(enemy);
		}
	}

	private patrolEnemy(enemy: Sprite): void {
		const patrolPoints = [
			{ x: -this.blackboard.width / 2 + 50, y: -this.blackboard.height / 2 + 50 },
			{ x: this.blackboard.width / 2 - 50, y: -this.blackboard.height / 2 + 50 },
			{ x: this.blackboard.width / 2 - 50, y: this.blackboard.height / 2 - 50 },
			{ x: -this.blackboard.width / 2 + 50, y: this.blackboard.height / 2 - 50 }
		];

		let currentPointIndex = 0;

		const moveToNextPoint = () => {
			const nextPoint = patrolPoints[currentPointIndex];
			const duration = 2000;
			new Tween(enemy)
				.to({ x: nextPoint.x, y: nextPoint.y }, duration)
				.easing(Easing.Quadratic.InOut)
				.onUpdate(() => {
					this.checkForPlayerCollision(enemy);
				})
				.start()
				.onComplete(() => {
					currentPointIndex = (currentPointIndex + 1) % patrolPoints.length;
					moveToNextPoint();
				});
		};

		moveToNextPoint();
	}

	private checkForPlayerCollision(enemy: Sprite): void {
		const playerBounds = this.player.playerSprite.getBounds();
		const enemyBounds = enemy.getBounds();

		if (this.isColliding(playerBounds, enemyBounds)) {
			this.player.triggerTrap(enemy); // Aplicar el daño o penalización al jugador
		}
	}

	private isColliding(rect1: any, rect2: any): boolean {
		return rect1.x < rect2.x + rect2.width &&
			rect1.x + rect1.width > rect2.x &&
			rect1.y < rect2.y + rect2.height &&
			rect1.y + rect1.height > rect2.y;
	}



	private addObject(objectType: string, x: number, y: number): void {
		let newObject: Graphics;

		if (objectType === 'square') {
			newObject = new Graphics();
			newObject.beginFill(0xff0000);
			newObject.drawRect(0, 0, 50, 50);
			newObject.endFill();

			newObject.x = x - newObject.width / 2;
			newObject.y = y - newObject.height / 2;
		} else if (objectType === 'circle') {
			newObject = new Graphics();
			newObject.beginFill(0x00ff00);
			newObject.drawCircle(0, 0, 25);
			newObject.endFill();

			newObject.x = x;
			newObject.y = y;
		} else {
			return;
		}

		this.blackboard.addChild(newObject);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.buttonsContainer, newW, newH, 1920, 1080, ScaleHelper.FILL);
		this.buttonsContainer.x = newW * 0.5;
		this.buttonsContainer.y = newH * 0.8;

		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, newW, newH, 1920, 1080, ScaleHelper.FILL);
		this.backgroundContainer.x = newW * 0.5;
		this.backgroundContainer.y = newH * 0.5;
	}
}
