/* eslint-disable @typescript-eslint/naming-convention */
import type { FederatedPointerEvent } from "pixi.js";
import { Container, Sprite, Texture, Point, Graphics, Text, TextStyle, Rectangle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { CRTFilter } from "@pixi/filter-crt";
import { GlitchFilter } from "@pixi/filter-glitch";

interface IBoid {
	posi: Point;
	velocity: Point;
	maxSpeed: number;
	maxForce: number;
	sprite: Sprite;
	history: Point[];
	isNovaProjectile?: boolean;
}

interface IEnemy {
	posi: Point;
	velocity: Point;
	sprite: Sprite;
	isDead: boolean;
}

interface IParticle {
	posi: Point;
	velocity: Point;
	sprite: Graphics;
	life: number;
}

export class SteeringScene extends PixiScene {
	private worldContainer: Container;
	private boids: IBoid[] = [];
	private enemies: IEnemy[] = [];
	private particles: IParticle[] = [];
	private leader: IBoid;
	private gameLayer: Container;
	private uiLayer: Container;
	private mobileLayer: Container;
	private overlayLayer: Container;
	private trailGraphics: Graphics;
	private healthGraphics: Graphics;
	private tutorialOverlay: Graphics;
	private keys: Set<string> = new Set();

	// Filtros oficiales de Pixi
	private crtFilter: CRTFilter;
	private glitchFilter: GlitchFilter;
	private glitchIntensity = 0;

	// Estadísticas de Juego
	private leaderHP = 100;
	public readonly LEADER_MAX_HP = 100;
	private shieldHP = 100;
	private readonly SHIELD_MAX_HP = 100;
	private score = 0;
	private scoreText: Text;
	private isGameOver = false;

	// Energía de Sierra
	private sawEnergy = 300;
	private readonly MAX_SAW_ENERGY = 300;
	private readonly SAW_CONSUMPTION = 0.3;
	private readonly SAW_RECHARGE = 0.1;

	// Mecánica de Nova
	private isNovaActive = false;
	private novaTimer = 0;
	private readonly NOVA_DURATION = 180;
	private readonly NOVA_MIN_SHIELD = 50;

	// Efectos
	private hitStopTimer = 0;
	private readonly HIT_STOP_NORMAL = 90;
	private readonly HIT_STOP_DEATH = 200;
	private invulnerabilityTimer = 0;
	private readonly INVULNERABILITY_DURATION = 130;
	private deathZoomActive = false;
	private currentZoom = 1;

	// Ajustes
	private initialBoidsCount = 12;
	private baseLeaderSpeed = 4;
	private readonly FOLLOWER_SPEED = 4.5;
	private readonly ENEMY_SPEED = 1.6;
	private readonly SMOOTHNESS = 0.05;
	private readonly FRICTION = 0.95;
	private readonly TRAIL_MAX_LENGTH = 20;
	public readonly ROTATION_SPEED = 0.15;

	// Mecánicas
	private circleRadius = 110;
	private formationAngle = 0;
	private isShieldMode = false;
	private isSpinning = false;
	private dashTimer = 0;
	private dashCooldown = 0;
	private readonly DASH_DURATION = 90;
	private readonly DASH_RECHARGE = 120;
	private readonly DASH_MULTIPLIER = 4;

	// Controles Móviles
	private isMobile = false;
	private joystickContainer: Container;
	private joystickKnob: Graphics;
	private joystickActive = false;
	private joystickVector = new Point(0, 0);
	private readonly JOYSTICK_RADIUS = 60;

	// Tutorial y Progresión
	private tutorialStep = -1;
	private tutorialLabel: Text;
	private spawnTimer = 0;
	private spawnInterval = 300;
	private difficultyTimer = 0;
	private startTimer = 60;

	constructor() {
		super();
		this.worldContainer = new Container();
		this.gameLayer = new Container();
		this.uiLayer = new Container();
		this.mobileLayer = new Container();
		this.overlayLayer = new Container();
		this.trailGraphics = new Graphics();
		this.healthGraphics = new Graphics();
		this.tutorialOverlay = new Graphics();

		// Inicializar CRTFilter oficial
		this.crtFilter = new CRTFilter({
			lineWidth: 3,
			lineContrast: 0.25,
			vignetting: 0.7,
			vignettingAlpha: 0.5,
			vignettingBlur: 0.3,
			curvature: 2.0,
			noise: 0.3,
			seed: Math.random(),
		});

		// Inicializar GlitchFilter oficial
		this.glitchFilter = new GlitchFilter({
			slices: 0,
			offset: 0,
			direction: 0,
		});

		// Aplicar filtros a toda la pantalla
		this.worldContainer.filterArea = new Rectangle(0, 0, window.innerWidth, window.innerHeight);
		this.worldContainer.filters = [this.crtFilter, this.glitchFilter];

		// Detección simple de mobile
		this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || "ontouchstart" in window;

		this.addChild(this.worldContainer);
		this.worldContainer.addChild(this.trailGraphics);
		this.worldContainer.addChild(this.gameLayer);

		this.addChild(this.tutorialOverlay);
		this.addChild(this.uiLayer);
		this.addChild(this.mobileLayer);
		this.addChild(this.overlayLayer);

		this.uiLayer.addChild(this.healthGraphics);

		this.setupEvents();
		this.initGame();
		this.createUI();

		if (this.isMobile) {
			this.createMobileControls();
		}

		const completed = localStorage.getItem("defensa_tutorial_completado");
		if (!completed) {
			this.startTutorial();
		}
	}

	private setupEvents(): void {
		window.addEventListener("keydown", (e) => {
			if (this.isGameOver) {
				return;
			}
			this.keys.add(e.code);
			if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
				this.isShieldMode = !this.isShieldMode;
			}
			if ((e.code === "KeyQ" || e.code === "KeyE") && this.dashCooldown <= 0) {
				this.triggerDash();
			}
			if (e.code === "Space") {
				if (this.sawEnergy > 5) {
					this.isSpinning = !this.isSpinning;
				}
			}
			if (e.code === "KeyR") {
				this.triggerNova();
			}
		});
		window.addEventListener("keyup", (e) => this.keys.delete(e.code));

		window.addEventListener("resize", () => {
			this.worldContainer.filterArea = new Rectangle(0, 0, window.innerWidth, window.innerHeight);
		});
	}

	private createMobileControls(): void {
		this.mobileLayer.removeChildren();

		this.joystickContainer = new Container();
		this.joystickContainer.position.set(100, window.innerHeight - 100);

		const base = new Graphics().beginFill(0xffffff, 0.1).lineStyle(2, 0xffffff, 0.3).drawCircle(0, 0, this.JOYSTICK_RADIUS).endFill();
		this.joystickKnob = new Graphics().beginFill(0xffffff, 0.5).drawCircle(0, 0, 30).endFill();

		this.joystickContainer.addChild(base, this.joystickKnob);
		this.joystickContainer.interactive = true;

		this.joystickContainer.on("pointerdown", (e: FederatedPointerEvent) => {
			this.joystickActive = true;
			this.updateJoystick(e);
		});

		window.addEventListener("pointermove", (e: PointerEvent) => {
			if (this.joystickActive) {
				this.updateJoystick(e);
			}
		});

		window.addEventListener("pointerup", () => {
			this.joystickActive = false;
			this.joystickKnob.position.set(0, 0);
			this.joystickVector.set(0, 0);
		});

		this.mobileLayer.addChild(this.joystickContainer);

		const btnSize = 50;
		const margin = 20;
		const rightX = window.innerWidth - margin - btnSize;
		const bottomY = window.innerHeight - margin - btnSize;

		this.createActionButton("DASH", rightX - 70, bottomY, 0xffffff, () => {
			if (this.dashCooldown <= 0) {
				this.triggerDash();
			}
		});

		this.createActionButton("SAW", rightX, bottomY - 70, 0x00ffff, () => {
			if (this.sawEnergy > 5) {
				this.isSpinning = !this.isSpinning;
			}
		});

		this.createActionButton("SHLD", rightX - 140, bottomY, 0xffaa00, () => {
			this.isShieldMode = !this.isShieldMode;
		});

		this.createActionButton("NOVA", rightX, bottomY - 140, 0xff00ff, () => {
			this.triggerNova();
		});
	}

	private createActionButton(label: string, x: number, y: number, color: number, callback: () => void): void {
		const btn = new Container();
		const bg = new Graphics().beginFill(0x222222, 0.7).lineStyle(2, color, 0.8).drawCircle(25, 25, 30).endFill();

		const txt = new Text(label, { fill: color, fontSize: 12, fontWeight: "bold", fontFamily: "Arial" });
		txt.anchor.set(0.5);
		txt.position.set(25, 25);

		btn.addChild(bg, txt);
		btn.position.set(x, y);
		btn.interactive = true;
		btn.on("pointerdown", () => {
			bg.alpha = 1;
			callback();
		});
		btn.on("pointerup", () => (bg.alpha = 0.7));
		btn.on("pointerupoutside", () => (bg.alpha = 0.7));

		this.mobileLayer.addChild(btn);
	}

	private updateJoystick(e: FederatedPointerEvent | PointerEvent): void {
		const localPos = this.joystickContainer.toLocal(new Point(e.clientX, e.clientY));
		const dist = Math.sqrt(localPos.x ** 2 + localPos.y ** 2);
		const angle = Math.atan2(localPos.y, localPos.x);

		const clampedDist = Math.min(dist, this.JOYSTICK_RADIUS);
		this.joystickKnob.x = Math.cos(angle) * clampedDist;
		this.joystickKnob.y = Math.sin(angle) * clampedDist;

		this.joystickVector.x = this.joystickKnob.x / this.JOYSTICK_RADIUS;
		this.joystickVector.y = this.joystickKnob.y / this.JOYSTICK_RADIUS;
	}

	private initGame(): void {
		this.gameLayer.removeChildren();
		this.overlayLayer.removeChildren();
		this.boids = [];
		this.enemies = [];
		this.particles = [];
		this.leaderHP = 100;
		this.shieldHP = 100;
		this.sawEnergy = 300;
		this.score = 0;
		this.isGameOver = false;
		this.isSpinning = false;
		this.isShieldMode = false;
		this.isNovaActive = false;
		this.spawnInterval = 300;
		this.difficultyTimer = 0;
		this.hitStopTimer = 0;
		this.invulnerabilityTimer = 0;
		this.deathZoomActive = false;
		this.currentZoom = 1;
		this.glitchIntensity = 0;

		this.worldContainer.scale.set(1);
		this.worldContainer.pivot.set(0, 0);
		this.worldContainer.position.set(0, 0);

		this.leader = this.createBoid(window.innerWidth / 2, window.innerHeight / 2, 0xff4444, this.baseLeaderSpeed);
		for (let i = 0; i < this.initialBoidsCount; i++) {
			this.boids.push(this.createBoid(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 0x00f0ff, this.FOLLOWER_SPEED));
		}
		if (this.scoreText) {
			this.scoreText.text = "SCORE: 0";
		}
	}

	private triggerNova(): void {
		if (this.isNovaActive || this.shieldHP < this.NOVA_MIN_SHIELD || this.isGameOver) {
			return;
		}

		this.isNovaActive = true;
		this.novaTimer = this.NOVA_DURATION;
		this.shieldHP = 0;
		this.isShieldMode = false;
		this.isSpinning = false;

		this.boids.forEach((b) => {
			b.isNovaProjectile = true;
			b.maxSpeed = this.FOLLOWER_SPEED * 2.5;
			b.maxForce = b.maxSpeed * 0.25;
		});

		this.flashScreen(0x00ffff, 0.4);
		this.hitStopTimer = 10;
		this.glitchIntensity = 5;
	}

	private createUI(): void {
		const style = new TextStyle({
			fill: "#ffffff",
			fontSize: this.isMobile ? 14 : 16,
			fontWeight: "bold",
			fontFamily: "Arial",
		});

		const label = new Text("SISTEMA DE DEFENSA", style);
		label.position.set(20, 15);
		this.uiLayer.addChild(label);

		this.scoreText = new Text("SCORE: 0", style);
		this.scoreText.anchor.set(1, 0);
		this.scoreText.position.set(window.innerWidth - 20, 15);
		this.uiLayer.addChild(this.scoreText);

		const btnTut = new Container();
		const bg = new Graphics().beginFill(0x444444).drawRoundedRect(0, 0, 120, 30, 5).endFill();
		const txt = new Text("VER TUTORIAL", { fill: "#ffffff", fontSize: 12, fontFamily: "Arial" });
		txt.anchor.set(0.5);
		txt.position.set(60, 15);
		btnTut.addChild(bg, txt);
		btnTut.position.set(20, this.isMobile ? 125 : 115);
		btnTut.interactive = true;
		btnTut.on("pointerdown", () => this.startTutorial());
		this.uiLayer.addChild(btnTut);

		this.tutorialLabel = new Text("", {
			fill: "#00f0ff",
			fontSize: this.isMobile ? 18 : 22,
			fontWeight: "bold",
			fontFamily: "Arial",
			align: "center",
			stroke: "#000000",
			strokeThickness: 4,
		});
		this.tutorialLabel.anchor.set(0.5);
		this.tutorialLabel.position.set(window.innerWidth / 2, window.innerHeight / 2 - 120);
		this.uiLayer.addChild(this.tutorialLabel);
	}

	private startTutorial(): void {
		this.tutorialStep = 0;
		this.tutorialLabel.visible = true;
		const moveText = this.isMobile ? "mueve el joystick" : "WASD";
		this.tutorialLabel.text = `INICIANDO TUTORIAL...\nUsa ${moveText} para moverte`;
	}

	private createBoid(x: number, y: number, color: number, speed: number): IBoid {
		const sprite = Sprite.from(Texture.WHITE);
		sprite.tint = color;
		sprite.width = 16;
		sprite.height = 16;
		sprite.anchor.set(0.5);
		this.gameLayer.addChild(sprite);

		return {
			posi: new Point(x, y),
			velocity: new Point(0, 0),
			maxSpeed: speed,
			maxForce: speed * this.SMOOTHNESS,
			sprite: sprite,
			history: [],
		};
	}

	private triggerDash(): void {
		if (this.leaderHP <= 0 || this.isGameOver) {
			return;
		}
		this.dashTimer = this.DASH_DURATION;
		this.dashCooldown = this.DASH_RECHARGE;
		this.leader.sprite.scale.set(1.5);
	}

	public override update(_dt: number): void {
		super.update(_dt);

		// Animación constante de CRT
		this.crtFilter.time += _dt * 0.1;
		this.crtFilter.seed = Math.random();

		// Actualizar intensidad del GlitchFilter
		if (this.glitchIntensity > 0) {
			this.glitchFilter.slices = Math.floor(this.glitchIntensity * 20);
			this.glitchFilter.offset = this.glitchIntensity * 40;
			this.glitchFilter.seed = Math.random();
			this.glitchIntensity -= 0.01 * _dt;
			if (this.glitchIntensity < 0) {
				this.glitchIntensity = 0;
			}
		} else {
			this.glitchFilter.slices = 0;
			this.glitchFilter.offset = 0;
		}

		if (this.deathZoomActive) {
			this.currentZoom += (2.5 - this.currentZoom) * 0.05;
			this.worldContainer.scale.set(this.currentZoom);
			const centerX = window.innerWidth / 2;
			const centerY = window.innerHeight / 2;
			this.worldContainer.pivot.x += (this.leader.posi.x - this.worldContainer.pivot.x) * 0.1;
			this.worldContainer.pivot.y += (this.leader.posi.y - this.worldContainer.pivot.y) * 0.1;
			this.worldContainer.position.set(centerX, centerY);
		}

		if (this.hitStopTimer > 0) {
			this.hitStopTimer--;
			const shakePower = this.deathZoomActive ? 15 : 8;
			this.worldContainer.x = (window.innerWidth / 2) * (this.deathZoomActive ? 1 : 0) + (Math.random() - 0.5) * shakePower;
			this.worldContainer.y = (window.innerHeight / 2) * (this.deathZoomActive ? 1 : 0) + (Math.random() - 0.5) * shakePower;

			if (this.hitStopTimer === 0 && this.leaderHP <= 0 && !this.isGameOver) {
				this.explode(this.leader.posi.x, this.leader.posi.y, 0xff4444);
				this.leader.sprite.visible = false;
				setTimeout(() => this.showGameOver(), 1500);
			}
			return;
		} else if (!this.deathZoomActive) {
			this.worldContainer.x = 0;
			this.worldContainer.y = 0;
		}

		if (this.invulnerabilityTimer > 0) {
			this.invulnerabilityTimer--;
			this.leader.sprite.alpha = Math.floor(this.invulnerabilityTimer / 5) % 2 === 0 ? 0.3 : 1.0;
		} else {
			this.leader.sprite.alpha = 1.0;
		}

		this.updateParticles();

		if (this.isGameOver) {
			return;
		}

		this.updateTutorialLogic();

		if (this.leaderHP > 0) {
			this.handleLeaderInput();
			if (this.tutorialStep === -1) {
				this.updateProgresion();
			}
		}

		this.updateMechanics();
		this.updateEnemies();
		this.checkCollisions();
		this.drawTrails();
		this.drawUI();
	}

	private updateTutorialLogic(): void {
		if (this.tutorialStep === -1) {
			return;
		}

		const shieldKey = this.isMobile ? "botón SHLD" : "SHIFT";
		const sawKey = this.isMobile ? "botón SAW" : "ESPACIO";
		const dashKey = this.isMobile ? "botón DASH" : "Q o E";
		const novaKey = this.isMobile ? "botón NOVA" : "R";

		switch (this.tutorialStep) {
			case 0:
				if (Math.abs(this.leader.velocity.x) > 1 || Math.abs(this.leader.velocity.y) > 1) {
					this.tutorialStep = 1;
					this.tutorialLabel.text = `¡Bien! Presiona ${shieldKey} para ESCUDO`;
				}
				break;
			case 1:
				if (this.isShieldMode) {
					this.tutorialStep = 2;
					this.tutorialLabel.text = `Perfecto. Presiona ${sawKey} para SIERRA\n(Consume energía)`;
				}
				break;
			case 2:
				if (this.isSpinning) {
					this.tutorialStep = 3;
					this.tutorialLabel.text = `¡Increíble! Usa ${dashKey} para DASH\n(Invulnerable y recupera boids)`;
				}
				break;
			case 3:
				if (this.dashTimer > 0) {
					this.tutorialStep = 4;
					this.tutorialLabel.text = `¡Letal! Finalmente presiona ${novaKey} para BOID NOVA\n(Requiere 50% de escudo)`;
				}
				break;
			case 4:
				if (this.isNovaActive) {
					this.tutorialStep = -1;
					this.tutorialLabel.text = "¡DOMINIO TOTAL!";
					localStorage.setItem("defensa_tutorial_completado", "true");
					setTimeout(() => (this.tutorialLabel.visible = false), 2000);
				}
				break;
		}
	}

	private updateParticles(): void {
		this.particles = this.particles.filter((p) => {
			p.posi.x += p.velocity.x;
			p.posi.y += p.velocity.y;
			p.sprite.x = p.posi.x;
			p.sprite.y = p.posi.y;
			p.life -= 0.012;
			p.sprite.alpha = p.life;
			if (p.life <= 0) {
				this.gameLayer.removeChild(p.sprite);
				p.sprite.destroy();
				return false;
			}
			return true;
		});
	}

	private explode(x: number, y: number, color: number): void {
		const count = this.leaderHP <= 0 ? 50 : 20;
		for (let i = 0; i < count; i++) {
			const p = new Graphics().beginFill(color).drawRect(0, 0, 4, 4).endFill();
			this.gameLayer.addChild(p);
			const angle = Math.random() * Math.PI * 2;
			const speed = Math.random() * 12;
			this.particles.push({
				posi: new Point(x, y),
				velocity: new Point(Math.cos(angle) * speed, Math.sin(angle) * speed),
				sprite: p,
				life: 1.0 + Math.random(),
			});
		}
	}

	private updateProgresion(): void {
		if (this.startTimer > 0) {
			this.startTimer--;
			return;
		}
		this.difficultyTimer++;
		if (this.difficultyTimer % 600 === 0) {
			this.spawnInterval = Math.max(60, this.spawnInterval - 30);
		}
		this.spawnTimer++;
		if (this.spawnTimer >= this.spawnInterval) {
			this.spawnTimer = 0;
			const count = 1 + Math.floor(this.difficultyTimer / 1800);
			for (let i = 0; i < count; i++) {
				this.spawnEnemy();
			}
		}
	}

	private spawnEnemy(): void {
		const side = Math.floor(Math.random() * 4);
		let x = 0,
			y = 0;
		if (side === 0) {
			x = -50;
			y = Math.random() * window.innerHeight;
		} else if (side === 1) {
			x = window.innerWidth + 50;
			y = Math.random() * window.innerHeight;
		} else if (side === 2) {
			x = Math.random() * window.innerWidth;
			y = -50;
		} else {
			x = Math.random() * window.innerWidth;
			y = window.innerHeight + 50;
		}

		const s = Sprite.from(Texture.WHITE);
		s.tint = 0x9900ff;
		s.width = 24;
		s.height = 24;
		s.anchor.set(0.5);
		this.gameLayer.addChild(s);
		this.enemies.push({ posi: new Point(x, y), velocity: new Point(0, 0), sprite: s, isDead: false });
	}

	private updateEnemies(): void {
		this.enemies = this.enemies.filter((enemy) => {
			if (enemy.isDead) {
				this.gameLayer.removeChild(enemy.sprite);
				enemy.sprite.destroy();
				return false;
			}
			const target = this.leaderHP > 0 ? this.leader.posi : new Point(window.innerWidth / 2, window.innerHeight / 2);
			const desired = new Point(target.x - enemy.posi.x, target.y - enemy.posi.y);
			const mag = Math.sqrt(desired.x ** 2 + desired.y ** 2);
			enemy.velocity.x += (desired.x / mag) * 0.08;
			enemy.velocity.y += (desired.y / mag) * 0.08;
			const currentMag = Math.sqrt(enemy.velocity.x ** 2 + enemy.velocity.y ** 2);
			if (currentMag > this.ENEMY_SPEED) {
				enemy.velocity.x = (enemy.velocity.x / currentMag) * this.ENEMY_SPEED;
				enemy.velocity.y = (enemy.velocity.y / currentMag) * this.ENEMY_SPEED;
			}
			enemy.posi.x += enemy.velocity.x;
			enemy.posi.y += enemy.velocity.y;
			enemy.sprite.x = enemy.posi.x;
			enemy.sprite.y = enemy.posi.y;
			enemy.sprite.rotation += 0.05;
			return true;
		});
	}

	private checkCollisions(): void {
		if (this.tutorialStep >= 0 || this.leaderHP <= 0) {
			return;
		}
		this.enemies.forEach((enemy) => {
			if (enemy.isDead) {
				return;
			}
			let blockedByShield = false;
			this.boids.forEach((boid, bIndex) => {
				const dist = Math.sqrt((enemy.posi.x - boid.posi.x) ** 2 + (enemy.posi.y - boid.posi.y) ** 2);
				if (boid.isNovaProjectile && dist < 35) {
					this.killEnemy(enemy);
					this.explode(boid.posi.x, boid.posi.y, 0x00ffff);
					this.gameLayer.removeChild(boid.sprite);
					boid.sprite.destroy();
					this.boids.splice(bIndex, 1);
					return;
				}
				if (this.isSpinning && dist < 25) {
					this.killEnemy(enemy);
					return;
				}
				if (this.isShieldMode && dist < 35) {
					blockedByShield = true;
					this.takeShieldDamage(5);
					this.repelEnemy(enemy);
				}
			});
			if (enemy.isDead || blockedByShield) {
				return;
			}
			const distToLeader = Math.sqrt((enemy.posi.x - this.leader.posi.x) ** 2 + (enemy.posi.y - this.leader.posi.y) ** 2);
			if (this.dashTimer > 0) {
				if (distToLeader < 45) {
					this.killEnemy(enemy);
					this.shieldHP = Math.min(this.SHIELD_MAX_HP, this.shieldHP + 12);
					this.syncShieldBoids();
					this.explode(enemy.posi.x, enemy.posi.y, 0xffffff);
				}
				return;
			}
			if (this.invulnerabilityTimer <= 0) {
				if (distToLeader < 30 && this.leaderHP > 0) {
					this.takeLeaderDamage(15);
					this.leader.velocity.x *= -2.0;
					this.leader.velocity.y *= -2.0;
				}
			}
		});
	}

	private syncShieldBoids(): void {
		if (this.isNovaActive) {
			return;
		}
		const expectedBoids = Math.ceil((this.shieldHP / this.SHIELD_MAX_HP) * this.initialBoidsCount);
		while (this.boids.length > expectedBoids && this.boids.length > 0) {
			const removed = this.boids.pop();
			if (removed) {
				this.gameLayer.removeChild(removed.sprite);
				removed.sprite.destroy();
			}
		}
		while (this.boids.length < expectedBoids && this.boids.length < this.initialBoidsCount) {
			this.boids.push(this.createBoid(this.leader.posi.x, this.leader.posi.y, 0x00f0ff, this.FOLLOWER_SPEED));
		}
	}

	private killEnemy(enemy: IEnemy): void {
		enemy.isDead = true;
		this.score += 100;
		this.scoreText.text = `SCORE: ${this.score}`;
		this.flashScreen(0xffffff, 0.15);
		if (this.shieldHP < this.SHIELD_MAX_HP) {
			this.shieldHP = Math.min(this.SHIELD_MAX_HP, this.shieldHP + 10);
			this.syncShieldBoids();
		}
	}

	private takeShieldDamage(amount: number): void {
		this.shieldHP -= amount;
		if (this.shieldHP < 0) {
			this.shieldHP = 0;
		}
		this.glitchIntensity = 0.25; // Pequeña interferencia
		this.syncShieldBoids();
	}

	private takeLeaderDamage(amount: number): void {
		this.leaderHP -= amount;
		if (this.leaderHP <= 0) {
			this.leaderHP = 0;
			this.hitStopTimer = this.HIT_STOP_DEATH;
			this.deathZoomActive = true;
			this.glitchIntensity = 3; // Corrupción total
		} else {
			this.hitStopTimer = this.HIT_STOP_NORMAL;
			this.invulnerabilityTimer = this.INVULNERABILITY_DURATION;
			this.glitchIntensity = 1; // Glitch fuerte
		}
	}

	private repelEnemy(enemy: IEnemy): void {
		const diff = new Point(enemy.posi.x - this.leader.posi.x, enemy.posi.y - this.leader.posi.y);
		const mag = Math.sqrt(diff.x ** 2 + diff.y ** 2);
		if (mag !== 0) {
			enemy.velocity.x += (diff.x / mag) * 10;
			enemy.velocity.y += (diff.y / mag) * 10;
		}
	}

	private showGameOver(): void {
		this.isGameOver = true;
		const scores: number[] = JSON.parse(localStorage.getItem("defensa_scores_v1") || "[]");
		scores.push(this.score);
		scores.sort((a, b) => b - a);
		const top5 = scores.slice(0, 5);
		localStorage.setItem("defensa_scores_v1", JSON.stringify(top5));

		const bg = new Graphics().beginFill(0x000000, 0.85).drawRect(0, 0, window.innerWidth, window.innerHeight).endFill();
		this.overlayLayer.addChild(bg);

		// Ajustes de fuente para mobile
		const titleSize = this.isMobile ? 28 : 40;
		const scoreSize = this.isMobile ? 18 : 24;
		const boardSize = this.isMobile ? 14 : 18;

		const title = new Text("NAVE DESTRUIDA", { fill: "#ff4444", fontSize: titleSize, fontWeight: "bold", fontFamily: "Arial" });
		title.anchor.set(0.5);
		title.position.set(window.innerWidth / 2, window.innerHeight * 0.15);

		const curScore = new Text(`PUNTAJE FINAL: ${this.score}`, { fill: "#ffffff", fontSize: scoreSize, fontFamily: "Arial" });
		curScore.anchor.set(0.5);
		curScore.position.set(window.innerWidth / 2, window.innerHeight * 0.25);

		const boardStr = top5.map((s, i) => `${i + 1}. ${s}`).join("\n");
		const board = new Text(`TOP 5 MEJORES:\n${boardStr}`, { fill: "#00f0ff", fontSize: boardSize, fontFamily: "Arial", align: "center" });
		board.anchor.set(0.5);
		board.position.set(window.innerWidth / 2, window.innerHeight * 0.45);

		const btnWidth = this.isMobile ? 160 : 200;
		const btnHeight = this.isMobile ? 40 : 50;

		const btn = new Container();
		const btnBg = new Graphics().beginFill(0xffffff).drawRoundedRect(0, 0, btnWidth, btnHeight, 10).endFill();
		const btnTxt = new Text("REINTENTAR", { fill: "#000000", fontSize: this.isMobile ? 14 : 18, fontWeight: "bold", fontFamily: "Arial" });
		btnTxt.anchor.set(0.5);
		btnTxt.position.set(btnWidth / 2, btnHeight / 2);
		btn.addChild(btnBg, btnTxt);
		btn.position.set(window.innerWidth / 2 - btnWidth / 2, window.innerHeight * 0.75);
		btn.interactive = true;
		btn.on("pointerdown", () => this.initGame());

		this.overlayLayer.addChild(title, curScore, board, btn);
	}

	private drawUI(): void {
		this.healthGraphics.clear();
		this.healthGraphics.beginFill(0x222222);
		const uiWidth = this.isMobile ? 160 : 200;
		this.healthGraphics.drawRoundedRect(20, 40, uiWidth, 10, 4);
		this.healthGraphics.drawRoundedRect(20, 60, uiWidth, 10, 4);
		this.healthGraphics.drawRoundedRect(20, 80, uiWidth, 8, 4);
		this.healthGraphics.endFill();
		if (this.leaderHP > 0) {
			this.healthGraphics.beginFill(0xff4444);
			this.healthGraphics.drawRoundedRect(20, 40, (this.leaderHP / 100) * uiWidth, 10, 4);
		}
		if (this.shieldHP > 0) {
			this.healthGraphics.beginFill(0xffaa00);
			this.healthGraphics.drawRoundedRect(20, 60, (this.shieldHP / 100) * uiWidth, 10, 4);
		}
		if (this.sawEnergy > 0) {
			this.healthGraphics.beginFill(0x00ffff);
			this.healthGraphics.drawRoundedRect(20, 80, (this.sawEnergy / this.MAX_SAW_ENERGY) * uiWidth, 8, 4);
		}
	}

	private updateMechanics(): void {
		if (this.dashTimer > 0) {
			this.dashTimer--;
		}
		if (this.dashCooldown > 0) {
			this.dashCooldown--;
		}
		if (this.isSpinning) {
			this.sawEnergy -= this.SAW_CONSUMPTION;
			if (this.sawEnergy <= 0) {
				this.sawEnergy = 0;
				this.isSpinning = false;
			}
		} else {
			this.sawEnergy = Math.min(this.MAX_SAW_ENERGY, this.sawEnergy + this.SAW_RECHARGE);
		}
		if (this.isNovaActive) {
			this.novaTimer--;
			if (this.novaTimer <= 0 || this.boids.length === 0) {
				this.isNovaActive = false;
				this.boids.forEach((b) => (b.isNovaProjectile = false));
			}
		}
		this.formationAngle += this.isSpinning ? 0.05 : 0.025;
		const targetRadius = this.isSpinning ? 110 : this.isShieldMode ? 45 : 100;
		this.circleRadius += (targetRadius - this.circleRadius) * 0.12;
		let targetSpeed = this.isShieldMode ? 2.2 : this.baseLeaderSpeed;
		if (this.dashTimer > 0) {
			targetSpeed *= this.DASH_MULTIPLIER;
		}
		this.leader.maxSpeed += (targetSpeed - this.leader.maxSpeed) * 0.2;

		if (this.leaderHP > 0) {
			this.leader.sprite.tint = this.dashTimer > 0 ? 0xffffff : this.isShieldMode ? 0xffaa00 : 0xff4444;
		}
		const leaderSpeedSq = this.leader.velocity.x ** 2 + this.leader.velocity.y ** 2;
		const isLeaderStopped = leaderSpeedSq < 0.2;
		this.boids.forEach((boid, index) => {
			let desiredVelocity: Point;
			if (boid.isNovaProjectile) {
				let closest: IEnemy | null = null;
				let minDist = Infinity;
				this.enemies.forEach((e) => {
					const d = Math.sqrt((e.posi.x - boid.posi.x) ** 2 + (e.posi.y - boid.posi.y) ** 2);
					if (d < minDist) {
						minDist = d;
						closest = e;
					}
				});
				desiredVelocity = closest ? new Point(closest.posi.x - boid.posi.x, closest.posi.y - boid.posi.y) : boid.velocity;
				boid.sprite.tint = 0xffffff;
				boid.sprite.scale.set(1.5);
			} else {
				desiredVelocity =
					this.isSpinning || isLeaderStopped || this.isShieldMode
						? this.arriveAtOrbital(boid, index, this.boids.length)
						: this.leaderFollow(boid, this.leader, 110, 45, this.boids);
				boid.sprite.tint = this.isSpinning ? 0xffffff : this.isShieldMode ? 0xffaa00 : 0x00f0ff;
				boid.sprite.scale.set(this.isSpinning || this.isShieldMode ? 1.3 : 1.0);
			}
			this.applySteering(boid, desiredVelocity, boid.isNovaProjectile ? 4.5 : 1);
		});

		[this.leader, ...this.boids].forEach((b) => {
			b.history.push(new Point(b.posi.x, b.posi.y));
			if (b.history.length > this.TRAIL_MAX_LENGTH) {
				b.history.shift();
			}
			b.posi.x += b.velocity.x;
			b.posi.y += b.velocity.y;
			b.velocity.x *= this.FRICTION;
			b.velocity.y *= this.FRICTION;
			b.sprite.x = b.posi.x;
			b.sprite.y = b.posi.y;
			this.screenWrap(b);
		});
	}

	private arriveAtOrbital(boid: IBoid, index: number, total: number): Point {
		const angle = (index / total) * Math.PI * 2 + this.formationAngle;
		const target = new Point(this.leader.posi.x + Math.cos(angle) * this.circleRadius, this.leader.posi.y + Math.sin(angle) * this.circleRadius);
		const desired = new Point(target.x - boid.posi.x, target.y - boid.posi.y);
		const d = Math.sqrt(desired.x ** 2 + desired.y ** 2);
		return this.limitVector(desired, d < 60 ? (d / 60) * boid.maxSpeed : boid.maxSpeed);
	}

	private handleLeaderInput(): void {
		// Prioridad Mobile Joystick
		if (this.isMobile && (Math.abs(this.joystickVector.x) > 0.01 || Math.abs(this.joystickVector.y) > 0.01)) {
			this.applySteering(this.leader, new Point(this.joystickVector.x * this.leader.maxSpeed, this.joystickVector.y * this.leader.maxSpeed), this.dashTimer > 0 ? 2.5 : 1);
			return;
		}

		// Keyboard Input
		const v = new Point(0, 0);
		if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) {
			v.y -= 1;
		}
		if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) {
			v.y += 1;
		}
		if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
			v.x -= 1;
		}
		if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
			v.x += 1;
		}

		if (v.x !== 0 || v.y !== 0) {
			const m = Math.sqrt(v.x * v.x + v.y * v.y);
			this.applySteering(this.leader, new Point((v.x / m) * this.leader.maxSpeed, (v.y / m) * this.leader.maxSpeed), this.dashTimer > 0 ? 2.5 : 1);
		}
	}

	private applySteering(boid: IBoid, desired: Point, mult: number = 1): void {
		const steer = new Point(desired.x - boid.velocity.x, desired.y - boid.velocity.y);
		const lim = this.limitVector(steer, boid.maxForce * mult);
		boid.velocity.x += lim.x;
		boid.velocity.y += lim.y;
		boid.velocity = this.limitVector(boid.velocity, boid.maxSpeed);
	}

	private leaderFollow(boid: IBoid, leader: IBoid, fDist: number, sDist: number, all: IBoid[]): Point {
		const n = this.limitVector(leader.velocity, 1);
		const target = new Point(leader.posi.x - n.x * fDist, leader.posi.y - n.y * fDist);
		const seek = new Point(target.x - boid.posi.x, target.y - boid.posi.y);
		const sep = new Point(0, 0);
		all.forEach((o) => {
			if (o === boid) {
				return;
			}
			const d = Math.sqrt((o.posi.x - boid.posi.x) ** 2 + (o.posi.y - boid.posi.y) ** 2);
			if (d < sDist) {
				const diff = new Point(boid.posi.x - o.posi.x, boid.posi.y - o.posi.y);
				const f = (1 - d / sDist) * 15;
				sep.x += diff.x * f;
				sep.y += diff.y * f;
			}
		});
		return this.limitVector(new Point(seek.x + sep.x, seek.y + sep.y), boid.maxSpeed);
	}

	private limitVector(v: Point, max: number): Point {
		const m = Math.sqrt(v.x * v.x + v.y * v.y);
		return m > max && m !== 0 ? new Point((v.x / m) * max, (v.y / m) * max) : v;
	}

	private screenWrap(b: IBoid): void {
		if (b.posi.x < -100) {
			b.posi.x = window.innerWidth + 100;
			b.history = [];
		}
		if (b.posi.x > window.innerWidth + 100) {
			b.posi.x = -100;
			b.history = [];
		}
		if (b.posi.y < -100) {
			b.posi.y = window.innerHeight + 100;
			b.history = [];
		}
		if (b.posi.y > window.innerHeight + 100) {
			b.posi.y = -100;
			b.history = [];
		}
	}

	private drawTrails(): void {
		this.trailGraphics.clear();
		[this.leader, ...this.boids].forEach((b) => {
			if (b.history.length < 2) {
				return;
			}
			const isLeader = b === this.leader;
			const isDashing = isLeader && this.dashTimer > 0;
			const isNova = b.isNovaProjectile;
			for (let i = 0; i < b.history.length - 1; i++) {
				const alpha = i / b.history.length;
				const trailColor = isNova ? 0xffffff : this.isSpinning && !isLeader ? 0xffffff : b.sprite.tint;
				this.trailGraphics.lineStyle((i / b.history.length) * (isDashing || isNova ? 25 : 10), trailColor, alpha * 0.4);
				this.trailGraphics.moveTo(b.history[i].x, b.history[i].y);
				this.trailGraphics.lineTo(b.history[i + 1].x, b.history[i + 1].y);
			}
		});
	}

	private flashScreen(color: number, alpha: number): void {
		const f = new Graphics().beginFill(color, alpha).drawRect(0, 0, window.innerWidth, window.innerHeight).endFill();
		this.addChild(f);
		setTimeout(() => f.destroy(), 100);
	}
}
