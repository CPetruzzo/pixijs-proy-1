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
import { Manager } from "../../..";
import { BasketballHighScorePopUp } from "./BasketballHighScorePopUp";

export class BasquetballGameScene extends PixiScene {
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
	private hoopSensorEnabled = false; // Indica si el aro está en modo sensor
	private groundCollider: Collider; // Collider del suelo
	private frontCollider: Collider;
	private backCollider: Collider;
	private net: Sprite;
	private ui: UI;
	private wallContainer: Container = new Container();
	private noTime: boolean = false;
	private gameOver: boolean = false;
	private popupOpened: boolean = false;

	// private basketballPlayer: BasketballPlayer;
	constructor() {
		super();

		this.sortableChildren = true;
		// Mover el contenedor del mundo
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

		// Crear el mundo de física con gravedad
		const gravity = new Vector2(0.0, 140);
		this.world = new World(gravity);

		SoundLib.playMusic("courtBGM", { loop: true, volume: 0.3, singleInstance: true });

		this.bG = Sprite.from("basquetcourtFullScreen");
		this.bG.anchor.set(0.5);
		this.bG.scale.set(1.5);
		this.bG.x = 1200;
		this.bG.y = 850;
		this.bG.zIndex = -1;
		this.worldContainer.addChild(this.bG);

		this.net = Sprite.from("basketnet");
		this.net.anchor.set(0.5);
		this.net.scale.set(1.55);
		this.net.position.set(860, 735);
		this.worldContainer.addChild(this.net);
		this.net.zIndex = 3;

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

		// Crear el jugador (proyectil controlado por joystick)
		this.player = new JoystickBasquetBallPlayer(this.world);
		this.worldContainer.addChild(this.player);
		this.worldContainer.zIndex = 2;

		const basquetball = Sprite.from("basquetball");
		basquetball.scale.set(0.11);
		basquetball.anchor.set(0.5);
		this.player.addChild(basquetball);

		// Crear el joystick
		this.joystick = new BasquetBallJoystick(this.player);
		this.worldContainer.addChild(this.joystick);

		// Crear el suelo (ground)
		this.groundColliderDesc = ColliderDesc.cuboid(100.0, 1);
		this.groundColliderDesc.restitution = 1.3;
		this.groundCollider = this.world.createCollider(this.groundColliderDesc);
		this.groundCollider.setTranslation({ x: 128.0, y: 118.0 });

		// Crear el suelo (ground)
		const leftWallDesc = ColliderDesc.cuboid(1, 200);
		leftWallDesc.restitution = 1.3;
		this.world.createCollider(leftWallDesc).setTranslation({ x: 45, y: 0 });
		// Crear el suelo (ground)
		const rightWallDesc = ColliderDesc.cuboid(1, 200);
		rightWallDesc.restitution = 1.3;
		this.world.createCollider(rightWallDesc).setTranslation({ x: 221.0, y: 110.0 });

		// Crear el aim
		this.aim = new Aim();

		this.joystick.on(JoystickEmits.AIM, () => {
			this.player.addChild(this.aim);
			this.aim.visible = true;
			this.aim.updateTrajectory({ power: this.joystick.joystickPower, angle: this.joystick.joystickAngle });
		});

		this.joystick.on(JoystickEmits.STOPAIM, () => {
			this.player.removeChild(this.aim);
		});

		this.worldContainer.pivot.y = this.player.y;
		this.worldContainer.pivot.set(this.worldContainer.width * 0.5, this.worldContainer.height * 0.5);
		this.backgroundContainer.pivot.set(this.backgroundContainer.width * 0.5, this.backgroundContainer.height * 0.5);
		this.createHoop(86, 68);
		this.createRim(78, 61);

		// this.basketballPlayer = new BasketballPlayer(this.world);
		// this.basketballPlayer.x = 1100;
		// this.basketballPlayer.y = 1049;
		// this.basketballPlayer.anchor.set(0.5);
		// this.basketballPlayer.scale.set(1.1);
		// this.basketballPlayer.zIndex = 5;
		// this.worldContainer.addChild(this.basketballPlayer);

		const megaWall = new NineSlicePlane(Texture.from("emptyframe"), 15, 15, 15, 15);
		megaWall.height = ScaleHelper.IDEAL_HEIGHT;
		megaWall.width = ScaleHelper.IDEAL_WIDTH;
		megaWall.pivot.set(megaWall.width * 0.47, megaWall.height * 0.5);
		megaWall.position.set(-50, 0);
		// this.wallContainer.addChild(megaWall);
	}

	private createHoop(x: number, y: number): void {
		const hoop = new Graphics();
		hoop.beginFill(0xffd700);
		hoop.drawRect(-5, 0, 50, 1);
		hoop.endFill();
		hoop.position.set(x * BasquetballGameScene.METER_TO_PIXEL, y * BasquetballGameScene.METER_TO_PIXEL);
		// this.worldContainer.addChild(hoop);

		const frontColliderDesc = ColliderDesc.ball(0.8).setRestitution(1.5);
		this.frontCollider = this.world.createCollider(frontColliderDesc);
		this.frontCollider.setTranslation({ x: x - 5.5, y });

		const backColliderDesc = ColliderDesc.ball(0.8).setRestitution(1.5);
		this.backCollider = this.world.createCollider(backColliderDesc);
		this.backCollider.setTranslation({ x: x + 5, y });

		const hoopColliderDesc = ColliderDesc.cuboid(5, 1).setRestitution(0.3);
		this.hoopCollider = this.world.createCollider(hoopColliderDesc);
		this.hoopCollider.setTranslation({ x, y: y + 3.5 });
	}

	private createRim(x: number, y: number): void {
		const blockCollider = ColliderDesc.roundCuboid(0.5, 8, 0.7).setRestitution(1);
		this.world.createCollider(blockCollider).setTranslation({ x: x - 0.3, y: y + 1.3 });
	}

	private async openGameOverPopup(): Promise<void> {
		try {
			const popupInstance = await Manager.openPopup(BasketballHighScorePopUp, [this.ui.score]);
			if (popupInstance instanceof BasketballHighScorePopUp) {
				popupInstance.showHighscores(this.ui.score);
				// popupInstance.showPlayerScore();
			} else {
				console.error("Error al abrir el popup: no se pudo obtener la instancia de BasePopup.");
			}
		} catch (error) {
			console.error("Error al abrir el popup:", error);
		}
	}

	public override update(_dt: number): void {
		if (this.gameOver && !this.popupOpened) {
			this.openGameOverPopup();
			this.popupOpened = true; // Evita aperturas múltiples
			return;
		}
		this.ui.counterTime.on(CounterEmits.TIME_ENDED, () => {
			this.noTime = true;
		});

		if (this.ui.isPaused) {
			return;
		}

		if (this.noTime) {
			this.gameOver = true;
			return;
		} else {
			// this.debugDraw();
			this.world.step();
			this.player.update();
			this.joystick.updateJoystick();
			// this.basketballPlayer.update(_dt);
			this.ui.counterTime.updateCounterTime(0.02, false);

			// Detectar colisión entre la pelota y el aro, si el sensor del aro está habilitado
			if (!this.hoopSensorEnabled) {
				this.world.contactPair(this.player.collider, this.hoopCollider, (manifold, _flipped) => {
					if (manifold.numContacts() > 0) {
						const normal = manifold.localNormal1();
						console.log("Collision with hoop detected");
						// Comprobar si el contacto es adecuado para marcar el puntaje
						if (normal.y > 0) {
							this.ui.updateScore(2);
							console.log(`${this.ui.score}`);
						}
						this.hoopCollider.setSensor(true); // Desactiva colisiones futuras temporalmente
						this.hoopSensorEnabled = true;
					}
				});
			}

			// Detectar si la pelota toca el suelo
			this.world.contactPair(this.player.collider, this.groundCollider, (manifold, _flipped) => {
				if (manifold.numContacts() > 0) {
					const verticalVelocity = this.player.rigidBody.linvel().y;
					if (verticalVelocity > 9) {
						// Umbral ajustable para detectar un rebote alto
						SoundLib.playSound("bounce", { loop: false, singleInstance: true, allowOverlap: false, volume: 0.06 });
					} else {
						this.player.rigidBody.linvel().y = 0;
					}
					this.hoopCollider.setSensor(false);
					this.hoopSensorEnabled = false;
				}
			});

			// Detectar colisiones con los colliders front y back del aro
			this.world.contactPair(this.player.collider, this.frontCollider, (manifold, _flipped) => {
				if (manifold.numContacts() > 0) {
					console.log("manifold.numContacts()", manifold.numContacts());
					SoundLib.playSound("hitRim", { loop: false, allowOverlap: false, volume: 0.03 });
				}
			});

			this.world.contactPair(this.player.collider, this.backCollider, (manifold, _flipped) => {
				if (manifold.numContacts() > 0) {
					console.log("manifold.numContacts()", manifold.numContacts());
					SoundLib.playSound("hitRim", { loop: false, allowOverlap: false, volume: 0.03 });
				}
			});
		}
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
		// Escala ambos contenedores para que coincidan con el tamaño ideal de la pantalla
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, _newW, _newH, 1920, 1920, ScaleHelper.FILL);
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

		// Centra ambos contenedores
		this.backgroundContainer.x = _newW / 2;
		this.backgroundContainer.y = _newH / 2;
		this.worldContainer.x = _newW * 0.6;
		this.worldContainer.y = _newH * 0.7;
	}
}
