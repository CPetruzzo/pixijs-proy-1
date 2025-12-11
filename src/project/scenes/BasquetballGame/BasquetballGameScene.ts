import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Aim } from "../ThisIsArgentina/Aim";
import type { Collider } from "@dimforge/rapier2d";
import { World, Vector2, ColliderDesc } from "@dimforge/rapier2d";
import { Container, Graphics, NineSlicePlane, Sprite, Texture } from "pixi.js";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Color } from "@pixi/core";
import { Camera2D } from "../../../utils/Camera2D";
import { BasquetBallJoystick, JoystickEmits } from "./BasquetBallJoystick";
import { JoystickBasquetBallPlayer } from "./JoystickBasquetBallPlayer";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { UI } from "./Utils/UI";
import { CounterEmits } from "./Utils/CounterTimer";
import { EventQueue } from "@dimforge/rapier2d";

export class BasquetballGameScene extends PixiScene {
	// #region VARIABLES
	private joystick: BasquetBallJoystick;
	private player: JoystickBasquetBallPlayer;
	private aim: Aim;
	public world: World;
	public static readonly BUNDLES = ["joystick", "basquet", "runfallsfx"];
	private worldContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	public static readonly METER_TO_PIXEL = 10.0;
	public static readonly OFFSET_CAMERA = ScaleHelper.IDEAL_WIDTH / 3;
	public static readonly PI = Math.PI;
	public camera: Camera2D;

	private debugGraphicsPool = new ObjectPool({
		creator: () => new Graphics(),
		cleaner: (g) => {
			g.clear();
			g.parent?.removeChild(g);
		},
		destroyer: (g) => g.destroy(),
		validator: (g) => !g.destroyed,
	});

	private usedDebugGraphics: Graphics[] = [];
	private bG: Sprite;
	private hoopCollider: Collider;
	private groundColliderDesc: ColliderDesc;
	private hoopSensorEnabled = false;
	private groundCollider: Collider;
	private frontCollider: Collider;
	private backCollider: Collider;
	private ui: UI;
	private wallContainer: Container = new Container();
	private noTime: boolean = false;
	private gameOver: boolean = false;
	private popupOpened: boolean = false;
	private eventQueue: EventQueue;

	// Variables de mejora
	private consecutiveScores: number = 0;
	private lastBounceTime: number = 0;
	private scoreMultiplier: number = 1;

	// #endregion VARIABLES
	constructor() {
		super();
		this.eventQueue = new EventQueue(true);

		this.sortableChildren = true;
		this.worldContainer.name = "PHYSICS WORLD CONTAINER";
		this.worldContainer.sortableChildren = true;
		this.ui = new UI();

		this.wallContainer.zIndex = 98;
		this.ui.rightContainer.zIndex = 99;
		this.ui.leftContainer.zIndex = 99;
		this.ui.leftDownContainer.zIndex = 99;
		this.ui.timeContainer.zIndex = 99;

		this.addChild(
			this.backgroundContainer,
			this.worldContainer,
			this.wallContainer,
			this.ui.rightContainer,
			this.ui.leftContainer,
			this.ui.leftDownContainer,
			this.ui.timeContainer
		);
		this.camera = new Camera2D();

		const gravity = new Vector2(0.0, 140);
		this.world = new World(gravity);

		SoundLib.playMusic("courtBGM", { loop: true, singleInstance: true });

		this.bG = Sprite.from("basquetcourtFullScreen");
		this.bG.anchor.set(0.5);
		this.bG.scale.set(1.5);
		this.bG.x = 1200;
		this.bG.y = 850;
		this.bG.zIndex = -1;
		this.worldContainer.addChild(this.bG);

		const rim = Sprite.from("basketrim");
		rim.anchor.set(0.5);
		rim.scale.set(1.55);
		rim.position.set(850, 690);
		this.worldContainer.addChild(rim);
		rim.zIndex = 3;

		const bG = Sprite.from("basquetcourtFullScreen");
		bG.anchor.set(0.5);
		bG.scale.set(2.5);
		bG.x = 1000;
		bG.y = 800;
		this.backgroundContainer.addChild(bG);

		this.player = new JoystickBasquetBallPlayer(this.world);
		this.worldContainer.addChild(this.player);
		this.worldContainer.zIndex = 2;

		const basquetball = Sprite.from("basquetball");
		basquetball.scale.set(0.11);
		basquetball.anchor.set(0.5);
		this.player.addChild(basquetball);

		this.joystick = new BasquetBallJoystick(this.player);
		this.worldContainer.addChild(this.joystick);

		// Física mejorada
		this.groundColliderDesc = ColliderDesc.cuboid(100.0, 1);
		this.groundColliderDesc.restitution = 0.7; // Más realista
		this.groundCollider = this.world.createCollider(this.groundColliderDesc);
		this.groundCollider.setTranslation({ x: 128.0, y: 118.0 });

		const leftWallDesc = ColliderDesc.cuboid(1, 200);
		leftWallDesc.restitution = 0.6;
		this.world.createCollider(leftWallDesc).setTranslation({ x: 45, y: 0 });

		const rightWallDesc = ColliderDesc.cuboid(1, 200);
		rightWallDesc.restitution = 0.6;
		this.world.createCollider(rightWallDesc).setTranslation({ x: 221.0, y: 110.0 });

		const topWallDesc = ColliderDesc.cuboid(100, 1);
		topWallDesc.restitution = 0.6;
		this.world.createCollider(topWallDesc).setTranslation({ x: 128, y: 0 });

		this.aim = new Aim();

		this.joystick.on(JoystickEmits.AIM, () => {
			if (!this.player.hasShot) {
				this.player.addChild(this.aim);
				this.aim.visible = true;
				this.aim.updateTrajectory({
					power: this.joystick.joystickPower,
					angle: this.joystick.joystickAngle,
				});
			}
		});

		this.joystick.on(JoystickEmits.STOPAIM, () => {
			this.player.removeChild(this.aim);
		});

		this.worldContainer.pivot.y = this.player.y;
		this.worldContainer.pivot.set(this.worldContainer.width * 0.5, this.worldContainer.height * 0.5);
		this.backgroundContainer.pivot.set(this.backgroundContainer.width * 0.5, this.backgroundContainer.height * 0.5);

		this.createHoop(86, 68);
		this.createRim(78, 61);

		const megaWall = new NineSlicePlane(Texture.from("emptyframe"), 15, 15, 15, 15);
		megaWall.height = ScaleHelper.IDEAL_HEIGHT;
		megaWall.width = ScaleHelper.IDEAL_WIDTH;
		megaWall.pivot.set(megaWall.width * 0.47, megaWall.height * 0.5);
		megaWall.position.set(-50, 0);
	}

	private createHoop(x: number, y: number): void {
		const hoop = new Graphics();
		hoop.beginFill(0xffd700);
		hoop.drawRect(-5, 0, 50, 1);
		hoop.endFill();
		hoop.position.set(x * BasquetballGameScene.METER_TO_PIXEL, y * BasquetballGameScene.METER_TO_PIXEL);

		// Colliders mejorados
		const frontColliderDesc = ColliderDesc.ball(0.8).setRestitution(1.0);
		this.frontCollider = this.world.createCollider(frontColliderDesc);
		this.frontCollider.setTranslation({ x: x - 5.5, y });

		const backColliderDesc = ColliderDesc.ball(0.8).setRestitution(1.0);
		this.backCollider = this.world.createCollider(backColliderDesc);
		this.backCollider.setTranslation({ x: x + 5, y });

		const hoopColliderDesc = ColliderDesc.cuboid(5, 1).setRestitution(0.3);
		this.hoopCollider = this.world.createCollider(hoopColliderDesc);
		this.hoopCollider.setTranslation({ x, y: y + 3.5 });
	}

	private createRim(x: number, y: number): void {
		const blockCollider = ColliderDesc.roundCuboid(0.5, 8, 0.7).setRestitution(0.8);
		this.world.createCollider(blockCollider).setTranslation({ x: x - 0.3, y: y + 1.3 });
	}

	public override update(_dt: number): void {
		if (this.ui.pauseButton.paused || this.isGameOver()) {
			return;
		}

		this.ui.counterTime.on(CounterEmits.TIME_ENDED, () => {
			this.noTime = true;
		});

		if (!this.ui.isPaused) {
			this.world.step(this.eventQueue);
			this.player.update();
			this.joystick.updateJoystick();
			this.ui.counterTime.updateCounterTime(0.02, false);

			this.detectHoopCollision();
			this.detectGroundCollision();
			this.detectRimCollisions();
			this.detectDrainCollisionEvents();
		}
	}

	private isGameOver(): boolean {
		if (this.gameOver && !this.popupOpened) {
			this.ui.openNameInputPopup();
			this.popupOpened = true;
			return true;
		}
		if (this.noTime) {
			this.gameOver = true;
			return true;
		}
		return false;
	}

	// Detección de colisión con el aro - EXACTAMENTE como el original pero con mejoras
	private detectHoopCollision(): void {
		if (!this.hoopSensorEnabled) {
			this.world.contactPair(this.player.collider, this.hoopCollider, (manifold, _flipped) => {
				if (manifold.numContacts() > 0) {
					const normal = manifold.localNormal1();
					if (normal.y > 0) {
						// Sistema de rachas
						this.consecutiveScores++;

						if (this.consecutiveScores >= 5) {
							this.scoreMultiplier = 3;
						} else if (this.consecutiveScores >= 3) {
							this.scoreMultiplier = 2;
						} else {
							this.scoreMultiplier = 1;
						}

						// Actualizar puntaje con multiplicador
						const points = 2 * this.scoreMultiplier;
						this.ui.updateScore(points);

						console.log(`Puntaje actualizado: ${this.ui.score} | Racha: ${this.consecutiveScores}x | Multiplicador: ${this.scoreMultiplier}x`);

						// Activa el sensor
						this.hoopCollider.setSensor(true);
						this.hoopSensorEnabled = true;

						// Resetea después de 2 segundos
						setTimeout(() => {
							this.resetHoopSensor();
						}, 2000);
					}
				}
			});
		}
	}

	private resetHoopSensor(): void {
		this.hoopCollider.setSensor(false);
		this.hoopSensorEnabled = false;
		console.log("Sensor de aro reiniciado");
	}

	private onScoreDetected(): void {
		console.log("Scored!");
		this.player.spawnPlayer();
		console.log("Player respawneado en posición:", this.player.rigidBody.translation());
	}

	// Detección mejorada con el suelo
	private detectGroundCollision(): void {
		this.world.contactPair(this.player.collider, this.groundCollider, (manifold, _flipped) => {
			if (manifold.numContacts() > 0) {
				const velocity = this.player.rigidBody.linvel();
				const verticalVelocity = Math.abs(velocity.y);
				const currentTime = Date.now();

				// Audio mejorado con control de tiempo
				if (verticalVelocity > 9 && currentTime - this.lastBounceTime > 200) {
					SoundLib.playSound("bounce", {
						loop: false,
						singleInstance: true,
						allowOverlap: false,
						volume: Math.min(verticalVelocity / 20, 1.0),
					});
					this.lastBounceTime = currentTime;
				} else if (verticalVelocity < 2) {
					this.player.rigidBody.setLinvel({ x: velocity.x * 0.7, y: 0 }, true);
					this.player.isOnGround = true;
				}

				// Desactivar el sensor del aro
				if (this.hoopSensorEnabled) {
					this.hoopCollider.setSensor(false);
					this.hoopSensorEnabled = false;
				}

				// Respawnear si ha disparado
				if (this.player.hasShot) {
					// Romper racha si no anotó
					if (!this.hoopSensorEnabled) {
						this.consecutiveScores = 0;
						this.scoreMultiplier = 1;
						console.log("Racha rota - falló el tiro");
					}

					this.player.spawnPlayer();
					this.player.hasShot = false;
				}
			}
		});
	}

	// Detección mejorada con el aro
	private detectRimCollisions(): void {
		[this.frontCollider, this.backCollider].forEach((collider) => {
			this.world.contactPair(this.player.collider, collider, (manifold, _flipped) => {
				if (manifold.numContacts() > 0) {
					const velocity = this.player.rigidBody.linvel();
					const impact = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

					console.log("Colisión detectada con el aro");
					if (impact > 2) {
						SoundLib.playSound("hitRim", {
							loop: false,
							allowOverlap: false,
							volume: Math.min(impact / 50 + 0.03, 0.3),
						});
					}
				}
			});
		});
	}

	// EXACTAMENTE como el original
	private detectDrainCollisionEvents(): void {
		this.eventQueue.drainCollisionEvents((collider1, collider2, started) => {
			if (started && this.isPlayerHoopCollision(collider1, collider2)) {
				this.onScoreDetected();
				console.log("onScoreDetected");
			}
		});
	}

	private isPlayerHoopCollision(collider1: number, collider2: number): boolean {
		return (
			(collider1 === this.player.collider.handle && collider2 === this.hoopCollider.handle) ||
			(collider2 === this.player.collider.handle && collider1 === this.hoopCollider.handle)
		);
	}

	public debugDraw(): void {
		this.usedDebugGraphics.forEach((g) => this.debugGraphicsPool.put(g));
		this.usedDebugGraphics = [];

		const { vertices, colors } = this.world.debugRender();
		for (let i = 0; i < vertices.length / 4; i += 1) {
			const g = this.debugGraphicsPool.get();
			const c = new Color({
				r: colors[i * 4 * 2] * 255,
				g: colors[i * 4 * 2 + 1] * 255,
				b: colors[i * 4 * 2 + 2] * 255,
				a: colors[i * 4 * 2 + 3] * 255,
			});

			g.lineStyle(2, c, 1);
			g.moveTo(vertices[i * 4] * BasquetballGameScene.METER_TO_PIXEL, vertices[i * 4 + 1] * BasquetballGameScene.METER_TO_PIXEL);
			g.lineTo(vertices[i * 4 + 2] * BasquetballGameScene.METER_TO_PIXEL, vertices[i * 4 + 3] * BasquetballGameScene.METER_TO_PIXEL);

			this.usedDebugGraphics.push(g);
			this.worldContainer.addChild(g);
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, _newW * 1.15, _newH * 1.15, 1920, 1920, ScaleHelper.FILL);
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, _newW, _newH, 1920, 1080, ScaleHelper.FILL);
		ScaleHelper.setScaleRelativeToIdeal(this.ui.rightContainer, _newW * 0.3, _newH * 0.3, 1920, 1080, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.ui.leftContainer, _newW * 0.3, _newH * 0.3, 1920, 1080, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.ui.leftDownContainer, _newW * 0.3, _newH * 0.3, 1920, 1080, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.ui.timeContainer, _newW * 0.3, _newH * 0.3, 1920, 1080, ScaleHelper.FIT);

		ScaleHelper.setScaleRelativeToIdeal(this.wallContainer, _newW, _newH, 1920, 1080, ScaleHelper.FIT);
		this.wallContainer.x = _newW / 2;
		this.wallContainer.y = _newH / 2;

		this.ui.rightContainer.x = _newW;
		this.ui.leftContainer.x = 0;
		this.ui.leftDownContainer.x = _newW;
		this.ui.leftDownContainer.y = _newH;

		this.ui.timeContainer.x = _newW * 0.5;
		this.ui.timeContainer.y = 0;

		this.backgroundContainer.x = _newW / 2;
		this.backgroundContainer.y = _newH / 2;
		this.worldContainer.x = _newW * 0.6;
		this.worldContainer.y = _newH * 0.7;
	}
}
