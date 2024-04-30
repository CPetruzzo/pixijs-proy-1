import { Graphics } from "@pixi/graphics";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import type { RigidBody } from "@dimforge/rapier2d";
import { ColliderDesc, RigidBodyDesc, World } from "@dimforge/rapier2d";
import { Color, Point, Texture } from "@pixi/core";
import { Container } from "@pixi/display";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { TilingSprite } from "@pixi/sprite-tiling";
import { Sprite } from "pixi.js";

export class RapierScene extends PixiScene {
	public static readonly BUNDLES = ["img"];
	private world: World;

	private worldContainer: Container = new Container();

	private static readonly METER_TO_PIXEL = 10.0;
	public static readonly OFFSET_CAMERA = ScaleHelper.IDEAL_WIDTH / 3;
	public static readonly PI = Math.PI;

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

	private lightBackground: Graphics = new Graphics();
	private rigidBodyDesc: RigidBodyDesc;
	private rigidBody: RigidBody;
	private backgroundContainer: Container = new Container();
	private backgrounds: TilingSprite[] = [];
	private skyPlayer: Sprite;

	constructor() {
		super();

		// Move this one to scroll the world
		this.worldContainer.name = "PHYSICS WORLD CONTAINER";
		this.addChild(this.worldContainer);

		// Rapier debug colors are really dark
		this.worldContainer.addChild(this.lightBackground);
		this.lightBackground.beginFill(0xffffff);
		this.lightBackground.drawRect(0, 0, 800, 600);
		this.lightBackground.endFill();

		// Create rapier world
		const gravity = { x: 0.0, y: 15.81 };
		this.world = new World(gravity);

		// Create the ground
		const groundColliderDesc = ColliderDesc.cuboid(10000.0, 1);
		groundColliderDesc.setRotation(RapierScene.PI * 0.05);
		this.world.createCollider(groundColliderDesc).setTranslation({ x: 40.0, y: 90.0 });

		const groundColliderDesc2 = ColliderDesc.cuboid(1000.0, 1);
		groundColliderDesc2.setRotation(RapierScene.PI * 0.05);
		this.world.createCollider(groundColliderDesc2).setTranslation({ x: 40.0, y: 50.0 });

		const groundColliderDesc3 = ColliderDesc.cuboid(150.0, 1);
		groundColliderDesc3.setRotation(-RapierScene.PI * 0.05);
		this.world.createCollider(groundColliderDesc3).setTranslation({ x: 500.0, y: 90.0 });

		const groundColliderDesc4 = ColliderDesc.cuboid(150.0, 1);
		groundColliderDesc4.setRotation(-RapierScene.PI * 0.05);
		this.world.createCollider(groundColliderDesc4).setTranslation({ x: 1000.0, y: 90.0 });

		const groundColliderDesc5 = ColliderDesc.cuboid(150.0, 1);
		groundColliderDesc5.setRotation(-RapierScene.PI * 0.05);
		this.world.createCollider(groundColliderDesc5).setTranslation({ x: 1500.0, y: 90.0 });

		const groundColliderDesc6 = ColliderDesc.cuboid(200.0, 1);
		groundColliderDesc6.setRotation(RapierScene.PI * 0.05);
		this.world.createCollider(groundColliderDesc6).setTranslation({ x: 2000.0, y: 90.0 });

		// Create a dynamic rigid-body.
		this.rigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(25.0, 1);
		this.rigidBody = this.world.createRigidBody(this.rigidBodyDesc);
		this.skyPlayer = Sprite.from("img/sky.png");
		this.skyPlayer.scale.set(0.5);
		this.skyPlayer.anchor.set(0.5, 1);

		// Create a cuboid collider attached to the dynamic rigidBody.
		const colliderDesc = ColliderDesc.ball(1);
		this.world.createCollider(colliderDesc, this.rigidBody);

		const tiling1 = new TilingSprite(Texture.from("img/big_placeholder/background-1.jpg"), ScaleHelper.IDEAL_WIDTH * 100, ScaleHelper.IDEAL_HEIGHT * 100);
		const tiling2 = new TilingSprite(Texture.from("img/big_placeholder/background-2.jpg"), ScaleHelper.IDEAL_WIDTH, ScaleHelper.IDEAL_HEIGHT * 100);
		this.backgroundContainer.addChild(tiling1, tiling2);
		this.backgrounds.push(tiling1, tiling2);

		this.worldContainer.addChild(this.backgroundContainer);
		// this.rigidBody.applyImpulse(new Point(100,0), true);
		this.worldContainer.addChild(this.skyPlayer);
	}

	public override update(dt: number): void {
		// Set rapier delta time and update
		this.world.integrationParameters.dt = dt / 1000;
		this.world.step();

		// DebugDraw
		this.debugDraw();

		this.worldContainer.x = -this.rigidBody.translation().x * RapierScene.METER_TO_PIXEL + this.worldTransform.a + RapierScene.OFFSET_CAMERA;
		this.worldContainer.y = -this.rigidBody.translation().y * RapierScene.METER_TO_PIXEL + this.worldTransform.a + RapierScene.OFFSET_CAMERA;

		this.skyPlayer.x = this.rigidBody.translation().x * RapierScene.METER_TO_PIXEL;
		this.skyPlayer.y = this.rigidBody.translation().y * RapierScene.METER_TO_PIXEL + 10;

		for (let i = 0; i < this.backgrounds.length; i++) {
			const background = this.backgrounds[i];
			if (this.rigidBody.translation().x < 0) {
				background.tilePosition.x -= dt;
			}
			background.tilePosition.y = this.rigidBody.translation().y * RapierScene.METER_TO_PIXEL + this.worldTransform.a;
		}

		if (Keyboard.shared.isDown("Space")) {
			this.rigidBody.applyImpulse(new Point(0, -5), true);
		}
		if (Keyboard.shared.isDown("KeyD")) {
			if (this.rigidBody.linvel().x < 100) {
				console.log("this.rigidBody.linvel().x", this.rigidBody.linvel().x);
				this.rigidBody.applyImpulse(new Point(1, 0), true);
			}
		}
		if (Keyboard.shared.isDown("KeyA")) {
			if (this.rigidBody.linvel().x > 0) {
				console.log("this.rigidBody.linvel().x", this.rigidBody.linvel().x);
				this.rigidBody.applyImpulse(new Point(-1, 0), true);
			}
		}
	}

	private debugDraw(): void {
		this.usedDebugGraphics.forEach((g) => this.debugGraphicsPool.put(g));
		this.usedDebugGraphics = [];

		const { vertices, colors } = this.world.debugRender();
		console.log(vertices.length, colors.length);
		for (let i = 0; i < vertices.length / 4; i += 1) {
			const g = this.debugGraphicsPool.get();
			const c = new Color({
				r: colors[i * 4 * 2] * 255,
				g: colors[i * 4 * 2 + 1] * 255,
				b: colors[i * 4 * 2 + 2] * 255,
				a: colors[i * 4 * 2 + 3] * 255,
			});

			g.lineStyle(2, c, 1);
			// Multiply the debugger lines by the meter to pixel constant
			g.moveTo(vertices[i * 4] * RapierScene.METER_TO_PIXEL, vertices[i * 4 + 1] * RapierScene.METER_TO_PIXEL);
			g.lineTo(vertices[i * 4 + 2] * RapierScene.METER_TO_PIXEL, vertices[i * 4 + 3] * RapierScene.METER_TO_PIXEL);

			this.usedDebugGraphics.push(g);

			// Add the debug to the world container
			this.worldContainer.addChild(g);
		}
	}
}
