import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { Joystick, JoystickEmits } from "./ThisIsArgentina/Joystick";
import { Aim } from "./ThisIsArgentina/Aim";
import { JoystickPlayer } from "./ThisIsArgentina/Classes/JoystickPlayer";
import { RigidBodyDesc } from "@dimforge/rapier2d";
import { World, Vector2, ColliderDesc } from "@dimforge/rapier2d";
import { Container, Graphics, Sprite } from "pixi.js";
import { ObjectPool } from "../../engine/objectpool/ObjectPool";
import { ScaleHelper } from "../../engine/utils/ScaleHelper";
import { Color } from "@pixi/core";
import { Camera2D } from "../../utils/Camera2D";

export class JoystickTestScene extends PixiScene {
	private joystick: Joystick;
	private player: JoystickPlayer;
	private aim: Aim;
	public world: World;
	public static readonly BUNDLES = ["joystick"];
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

	constructor() {
		super();

		// Mover el contenedor del mundo
		this.worldContainer.name = "PHYSICS WORLD CONTAINER";
		this.addChild(this.worldContainer);
		this.camera = new Camera2D();

		// Crear el mundo de física con gravedad
		const gravity = new Vector2(0.0, 140); // Gravedad en Y
		this.world = new World(gravity);

		const bG = Sprite.from("big_background");
		this.backgroundContainer.addChild(bG);
		this.worldContainer.addChild(this.backgroundContainer);

		// Crear el jugador (proyectil controlado por joystick)
		this.player = new JoystickPlayer(this.world);
		this.worldContainer.addChild(this.player);

		// Crear el joystick
		this.joystick = new Joystick(this.player);
		this.addChild(this.joystick);

		// Crear el suelo (ground)
		const groundColliderDesc = ColliderDesc.cuboid(130.0, 1);
		this.world.createCollider(groundColliderDesc).setTranslation({ x: 110.0, y: 110.0 });

		// Crear una plataforma para que los bloques descansen encima
		const platformDesc = ColliderDesc.cuboid(5, 1).setRestitution(2);
		this.world.createCollider(platformDesc).setTranslation({ x: 40.0, y: 100.0 });
		// Crear una plataforma para que los bloques descansen encima
		const platformDesc2 = ColliderDesc.cuboid(5, 1).setRestitution(0.2);
		this.world.createCollider(platformDesc2).setTranslation({ x: 55.0, y: 90.0 });

		const platformDesc3 = ColliderDesc.cuboid(5, 1).setRestitution(0.2);
		this.world.createCollider(platformDesc3).setTranslation({ x: 65.0, y: 80.0 });

		const platformDesc4 = ColliderDesc.cuboid(5, 1).setRestitution(0.2);
		this.world.createCollider(platformDesc4).setTranslation({ x: 75.0, y: 70.0 });

		// Crear algunos bloques (obstáculos) en la plataforma
		this.createObstacle(80, 65); // Posición inicial del bloque
		this.createObstacle(85, 65);
		this.createObstacle(90, 65);

		// Crear un cuerpo dinámico (afectado por la gravedad)
		this.createBreakableObstacle(90, 60, 0.01);
		this.createBreakableObstacle(90, 55, 0.05);
		this.createBreakableObstacle(90, 50, 10);

		// Crear el aim
		this.aim = new Aim();
		this.player.addChild(this.aim);
		this.player.sortableChildren = true;

		// Eventos del joystick
		this.joystick.on(JoystickEmits.AIM, () => {
			this.aim.visible = true;
			this.aim.updateTrajectory({ power: this.joystick.joystickPower, angle: this.joystick.joystickAngle });
		});
		this.joystick.on(JoystickEmits.STOPAIM, () => {
			this.aim.visible = false;
		});

		// this.worldContainer.pivot.y = this.player.y;
	}

	// Método para crear obstáculos en la escena
	private createObstacle(x: number, y: number): void {
		const block = new Graphics();
		block.beginFill(0x654321); // Color marrón para los bloques
		block.drawRect(-2.5, -2.5, 5, 5); // Bloques de 5x5 metros
		block.endFill();
		this.worldContainer.addChild(block);

		const blockCollider = ColliderDesc.cuboid(2.5, 2.5).setRestitution(0.3);
		this.world.createCollider(blockCollider).setTranslation({ x, y });
	}
	// Método para crear bloques dinámicos (que se desarman al golpearse)
	private createBreakableObstacle(x: number, y: number, mass: number): void {
		const block = new Graphics();
		block.beginFill(0x654321); // Color marrón para los bloques
		block.drawRect(-2.5, -2.5, 5, 5); // Bloques de 5x5 metros
		block.endFill();
		this.worldContainer.addChild(block);

		// Crear un cuerpo dinámico (afectado por la gravedad)
		const dynamicBodyDesc = RigidBodyDesc.dynamic(); // Cuerpo dinámico
		const dynamicBody = this.world.createRigidBody(dynamicBodyDesc);
		dynamicBody.mass = () => mass;

		// Crear un nuevo collider dinámico
		const blockCollider = ColliderDesc.cuboid(2.5, 2.5).setRestitution(1);
		const collider = this.world.createCollider(blockCollider, dynamicBody);
		console.log("collider", collider);

		// Establecer la posición del cuerpo dinámico
		dynamicBody.setTranslation({ x, y }, true); // Ajustar la posición correctamente
	}
	public override update(_dt: number): void {
		this.debugDraw();
		// this.camera.anchoredOnLevel(this.worldContainer, this.player);

		// Actualizar la física del mundo
		this.world.step();

		// Actualizar la lógica del jugador
		this.player.update();

		// Actualizar el joystick
		this.joystick.updateJoystick();
		// camera anchored on character with lerp

		// this.camera.anchoredOnCharacterWithLerp(this.worldContainer, this.player, 150);
	}

	private debugDraw(): void {
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
			g.moveTo(vertices[i * 4] * JoystickTestScene.METER_TO_PIXEL, vertices[i * 4 + 1] * JoystickTestScene.METER_TO_PIXEL);
			g.lineTo(vertices[i * 4 + 2] * JoystickTestScene.METER_TO_PIXEL, vertices[i * 4 + 3] * JoystickTestScene.METER_TO_PIXEL);

			this.usedDebugGraphics.push(g);
			this.worldContainer.addChild(g);
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToScreen(this.backgroundContainer, _newW, _newH, 1280, 720, ScaleHelper.FIT);
	}
}
