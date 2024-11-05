import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Aim } from "../ThisIsArgentina/Aim";
import { World, Vector2, ColliderDesc, Collider } from "@dimforge/rapier2d";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Color } from "@pixi/core";
import { Camera2D } from "../../../utils/Camera2D";
import { BasquetBallJoystick, JoystickEmits } from "./BasquetBallJoystick";
import { JoystickBasquetBallPlayer } from "./JoystickBasquetBallPlayer";
import { SoundLib } from "../../../engine/sound/SoundLib";

export class BasquetballGameScene extends PixiScene {
	private joystick: BasquetBallJoystick;
	private player: JoystickBasquetBallPlayer;
	private aim: Aim;
	public world: World;
	public static readonly BUNDLES = ["joystick", "basquet"];
	private worldContainer: Container = new Container();
	private backgroundContainer: Container = new Container();
	public static readonly METER_TO_PIXEL = 10.0;
	public static readonly OFFSET_CAMERA = ScaleHelper.IDEAL_WIDTH / 3;
	public static readonly PI = Math.PI;
	public camera: Camera2D;
	private score: number = 0;
	private scoreText: Text;

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

	constructor() {
		super();

		// Mover el contenedor del mundo
		this.worldContainer.name = "PHYSICS WORLD CONTAINER";
		this.worldContainer.sortableChildren = true;

		this.addChild(this.backgroundContainer, this.worldContainer);
		this.camera = new Camera2D();

		// Crear el mundo de física con gravedad
		const gravity = new Vector2(0.0, 140); // Gravedad en Y
		this.world = new World(gravity);

		SoundLib.playMusic("courtBGM", { loop: true, volume: 0.3, singleInstance: true, });

		this.bG = Sprite.from("basquetcourt");
		this.bG.anchor.set(0.5);
		this.bG.scale.set(1.5);
		this.bG.x = 800;
		this.bG.y = 800;
		this.bG.zIndex = -1;
		this.worldContainer.addChild(this.bG);

		this.net = Sprite.from("basketnet");
		this.net.anchor.set(0.5);
		this.net.scale.set(1.55)
		this.net.position.set(464, 690);
		this.worldContainer.addChild(this.net);
		this.net.zIndex = 3;

		const rim = Sprite.from("basketrim");
		rim.anchor.set(0.5);
		rim.scale.set(1.55)
		rim.position.set(451, 644);
		this.worldContainer.addChild(rim);
		rim.zIndex = 3;

		const bG = Sprite.from("basquetcourt");
		bG.anchor.set(0.5);
		bG.scale.set(2.5);
		bG.x = 1000;
		bG.y = 800;
		this.backgroundContainer.addChild(bG);

		// Crear el jugador (proyectil controlado por joystick)
		this.player = new JoystickBasquetBallPlayer(this.world);
		this.worldContainer.addChild(this.player);
		this.player.zIndex = 2;

		const basquetball = Sprite.from("basquetball");
		basquetball.scale.set(0.11);
		basquetball.anchor.set(0.5);
		this.player.addChild(basquetball);

		// Crear el joystick
		this.joystick = new BasquetBallJoystick(this.player);
		this.addChild(this.joystick);

		// Crear el suelo (ground)
		this.groundColliderDesc = ColliderDesc.cuboid(100.0, 1);
		this.groundColliderDesc.restitution = 1.3;
		this.groundCollider = this.world.createCollider(this.groundColliderDesc);
		this.groundCollider.setTranslation({ x: 110.0, y: 110.0 });

		// Crear el suelo (ground)
		const leftWallDesc = ColliderDesc.cuboid(1, 200);
		leftWallDesc.restitution = 1.3;
		this.world.createCollider(leftWallDesc).setTranslation({ x: 10, y: 0 });
		// Crear el suelo (ground)
		const rightWallDesc = ColliderDesc.cuboid(1, 200);
		rightWallDesc.restitution = 1.3;
		this.world.createCollider(rightWallDesc).setTranslation({ x: 160.0, y: 110.0 });

		this.scoreText = new Text(`Score: ${this.score}`, { fontSize: 24, fill: 0xffffff });
		this.scoreText.position.set(50, 50); // Ubicación en pantalla
		this.addChild(this.scoreText);

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
		this.createHoop(46, 63.5);
		this.createRim(39, 56);
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
		this.hoopCollider.setTranslation({ x, y: y + 2.5 });
	}

	// Método para crear obstáculos estáticos (no afectados por gravedad)
	private createRim(x: number, y: number): void {
		const blockCollider = ColliderDesc.roundCuboid(0.5, 8, 0.7).setRestitution(1);
		this.world.createCollider(blockCollider).setTranslation({ x: x - 0.3, y: y + 1.3 });
	}

	public override update(_dt: number): void {
		// this.debugDraw();
		this.world.step();
		this.player.update();
		this.joystick.updateJoystick();

		// Detectar colisión entre la pelota y el aro, si el sensor del aro está habilitado
		if (!this.hoopSensorEnabled) {
			this.world.contactPair(this.player.collider, this.hoopCollider, (manifold, _flipped) => {
				if (manifold.numContacts() > 0) {
					const normal = manifold.localNormal1();
					console.log("Collision with hoop detected");
					// Comprobar si el contacto es adecuado para marcar el puntaje
					if (normal.y > 0) {
						this.onScore();
						console.log(`${this.score}`);
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
				if (verticalVelocity > 9) { // Umbral ajustable para detectar un rebote alto
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
				console.log('manifold.numContacts()', manifold.numContacts())
				SoundLib.playSound("hitRim", { loop: false, allowOverlap: false, volume: 0.03, singleInstance: true, });
			}
		});

		this.world.contactPair(this.player.collider, this.backCollider, (manifold, _flipped) => {
			if (manifold.numContacts() > 0) {
				console.log('manifold.numContacts()', manifold.numContacts())
				SoundLib.playSound("hitRim", { loop: false, allowOverlap: false, volume: 0.03, singleInstance: true, });
			}
		});
	}

	private onScore(): void {
		this.score += 1; // Incrementa el puntaje
		this.scoreText.text = `Score: ${this.score}`; // Actualiza el texto del marcador
		console.log("¡Anotaste! Puntaje actual: ", this.score); // Console log opcional
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

		// Centra ambos contenedores
		this.backgroundContainer.x = _newW / 2;
		this.backgroundContainer.y = _newH / 2;
		this.worldContainer.x = _newW / 2;
		this.worldContainer.y = _newH / 2;
	}

}
