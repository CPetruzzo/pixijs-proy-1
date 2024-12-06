import type { Container } from "pixi.js";
import { Graphics, Sprite } from "pixi.js";
import { Node } from "./Node";
import { GameConfig } from "../game/GameConfig";
import { Grid } from "../utils/Grid";
import { AStarPathfinding } from "../utils/AStarPathFinding";
import { TowerDefenseScene } from "../scenes/TowerDefenseScene";

export enum EnemyTypes {
	ENEMY1 = "ENEMY1",
	ENEMY2 = "ENEMY2",
	ENEMY3 = "ENEMY3",
	ENEMY4 = "ENEMY4",
	ENEMY5 = "ENEMY5",
	ENEMY6 = "ENEMY6",
}

export class Enemy {
	public sprite: Sprite;
	public currentStep: number = 0;
	public health: number;
	public dead: boolean = false;
	private healthBar: Graphics; // Barra de vida
	private healthBarWidth: number = 80; // Ancho inicial de la barra de vida
	private healthBarHeight: number = 10; // Alto de la barra de vida

	private isShaking: boolean = false;
	private shakeCount: number = 0;
	private maxShakes: number = 6;
	private shakeIntensity: number = 5;
	private originalX: number = 0;
	private originalY: number = 0;
	private originalTint: any = 0;
	private enemyIndex: number;

	constructor(public posX: number, public posY: number, public path: Node[], tileSize: number, typeIndex: number = 0) {
		this.enemyIndex = typeIndex;
		const randomSprite = GameConfig.enemyConfig.sprites[this.enemyIndex];
		this.sprite = Sprite.from(randomSprite);
		this.sprite.tint = GameConfig.colors.enemy;
		this.sprite.width = tileSize;
		this.sprite.height = tileSize;

		this.sprite.x = posX * tileSize;
		this.sprite.y = posY * tileSize;

		this.health = GameConfig.enemyConfig.health[this.enemyIndex];

		// Crear barra de vida
		this.healthBar = new Graphics();
		this.updateHealthBar();
		this.sprite.addChild(this.healthBar); // Añadir la barra al sprite del enemigo
	}

	public update(): void {
		// Verificar si el sprite existe antes de procesar
		if (!this.sprite || this.dead) {
			return;
		}

		// Movimiento del enemigo
		if (this.currentStep < this.path.length) {
			const targetNode = this.path[this.currentStep];
			const targetX = targetNode.x * this.sprite.width;
			const targetY = targetNode.y * this.sprite.height;

			const dx = targetX - this.sprite.x;
			const dy = targetY - this.sprite.y;

			this.sprite.x += dx * 0.05;
			this.sprite.y += dy * 0.05;

			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
				this.currentStep++;
			}
		}

		if (this.isShaking) {
			this.applyShakeEffect();
		}

		// Actualizar la posición de la barra de vida
		this.healthBar.x = this.sprite.width;
		this.healthBar.y = 10; // Posicionar justo encima del enemigo
	}

	public takeDamage(amount: number): void {
		if (this.dead) {
			return;
		}
		this.health -= amount;

		this.updateHealthBar();

		if (!this.isShaking) {
			this.startShakeEffect();
		}

		if (this.health <= 0) {
			this.die();
		}
	}

	private updateHealthBar(): void {
		this.healthBar.clear();
		this.healthBar.beginFill(0xff0000); // Fondo rojo
		this.healthBar.drawRect(0, 0, this.healthBarWidth, this.healthBarHeight);
		this.healthBar.endFill();

		const healthPercentage = Math.max(this.health / GameConfig.enemyConfig.health[this.enemyIndex], 0);
		this.healthBar.beginFill(0x00ff00); // Barra verde
		this.healthBar.drawRect(0, 0, this.healthBarWidth * healthPercentage, this.healthBarHeight);
		this.healthBar.endFill();
	}

	private die(): void {
		this.dead = true;
		this.sprite.destroy();
	}

	private startShakeEffect(): void {
		this.isShaking = true;
		this.shakeCount = 0;
		this.originalX = this.sprite.x;
		this.originalY = this.sprite.y;
		this.originalTint = this.sprite.tint;
		this.sprite.tint = 0xff0000;
	}

	private applyShakeEffect(): void {
		if (this.shakeCount < this.maxShakes) {
			// Alterar la posición para crear el efecto de vibración
			this.sprite.x = this.originalX + (Math.random() - 0.5) * this.shakeIntensity;
			this.sprite.y = this.originalY + (Math.random() - 0.5) * this.shakeIntensity;
			this.shakeCount++;
		} else {
			// Restaurar la posición y el color original
			this.sprite.x = this.originalX;
			this.sprite.y = this.originalY;
			this.sprite.tint = this.originalTint;

			// Detener el efecto
			this.isShaking = false;
		}
	}

	public isDefeated(): boolean {
		return this.health <= 0;
	}

	public getEnemyIndex(): number {
		return this.enemyIndex;
	}

	public getCurrentPosition(): { x: number; y: number } {
		return { x: this.path[this.currentStep].x, y: this.path[this.currentStep].y }; // Ajusta según la implementación de coordenadas en Enemy
	}

	// public static spawnEnemy(grid: number[][], enemies: Enemy[], gameContainer: Container): void {
	// 	const rows = GameConfig.gridHeight - 1;
	// 	const cols = GameConfig.gridWidth - 1;
	// 	const startX = 0;
	// 	const startY = 0;

	// 	const startNode: Node = new Node(startX, startY);
	// 	const goalNode: Node = new Node(cols - 1, rows - 1);

	// 	if (!Grid.isTileEmpty(startNode.x, startNode.y)) {
	// 		console.log("La celda de inicio está ocupada o no es válida.");
	// 		return;
	// 	}

	// 	const path = AStarPathfinding.findPath(grid, startNode, goalNode);
	// 	if (!path) {
	// 		console.log("No se encontró un camino válido.");
	// 		return;
	// 	}

	// 	// Determinar el nivel de generación según el puntaje
	// 	const score = TowerDefenseScene.gameStats.getScore();
	// 	const baseEnemyCount = GameConfig.enemyConfig.sprites.length; // Total de tipos base de enemigos
	// 	const generationLevel = Math.floor(score / 150); // Cada 150 puntos, incrementa el nivel
	// 	const enemyIndex = generationLevel % baseEnemyCount; // Cíclico entre los enemigos base
	// 	console.log("enemyIndex", enemyIndex);

	// 	// Incrementar HP según el nivel de generación
	// 	const baseHealth = GameConfig.enemyConfig.health[enemyIndex];
	// 	const healthMultiplier = 1 + Math.floor(generationLevel / baseEnemyCount) * 0.5; // Incremento del 50% por cada ciclo completo
	// 	const adjustedHealth = Math.round(baseHealth * healthMultiplier);

	// 	// Crear el enemigo con el HP ajustado
	// 	const enemy = new Enemy(startX, startY, path, TowerDefenseScene.tileSize, enemyIndex);
	// 	enemy.health = adjustedHealth; // Reemplazar el HP base con el ajustado
	// 	enemy.updateHealthBar(); // Actualizar la barra de vida para reflejar el HP ajustado

	// 	enemies.push(enemy);
	// 	gameContainer.addChild(enemy.sprite);
	// }

	public static spawnEnemy(grid: number[][], enemies: Enemy[], gameContainer: Container): void {
		const rows = GameConfig.gridHeight - 1;
		const cols = GameConfig.gridWidth - 1;
		// Verificar si la celda de inicio está ocupada
		const startX = 0;
		const startY = 0;
		const startNode: Node = new Node(startX, startY);
		const goalNode: Node = new Node(cols - 1, rows - 1);

		if (!Grid.isTileEmpty(startNode.x, startNode.y)) {
			console.log("La celda de inicio está ocupada o no es válida.");
			return;
		}
		const path = AStarPathfinding.findPath(grid, startNode, goalNode);
		if (!path) {
			console.log("No se encontró un camino válido.");
		}

		if (path) {
			let enemyIndex = 0; // Por defecto, seleccionamos el primer enemigo

			// Desbloquear enemigos más fuertes si el score supera ciertos valores
			if (TowerDefenseScene.gameStats.getScore() > 150) {
				enemyIndex = 1; // Desbloqueamos el enemigo 2
			}
			if (TowerDefenseScene.gameStats.getScore() > 400) {
				enemyIndex = 2; // Desbloqueamos el enemigo 3
			}
			if (TowerDefenseScene.gameStats.getScore() > 1500) {
				enemyIndex = 3; // Desbloqueamos el enemigo 4
			}
			if (TowerDefenseScene.gameStats.getScore() > 4000) {
				enemyIndex = 4; // Desbloqueamos el enemigo 5
			}
			if (TowerDefenseScene.gameStats.getScore() > 7000) {
				enemyIndex = 5; // Desbloqueamos el enemigo 6
			}

			if (!Grid.isTileEmpty(startX, startY)) {
				console.log("La celda de inicio está ocupada o no es válida.");
				return;
			}

			// Crear el enemigo en la posición de inicio y asignarle el camino calculado
			const enemy = new Enemy(startX, startY, path, TowerDefenseScene.tileSize, enemyIndex);
			enemies.push(enemy);
			gameContainer.addChild(enemy.sprite);
		}
	}
}
