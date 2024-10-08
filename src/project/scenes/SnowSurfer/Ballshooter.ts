import { Graphics } from "@pixi/graphics";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import type { RigidBody } from "@dimforge/rapier2d";
import { ColliderDesc, RigidBodyDesc, World } from "@dimforge/rapier2d";
import { Color, Point } from "@pixi/core";
import { Container } from "@pixi/display";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Sprite } from "pixi.js";

export class BallShootingGame extends PixiScene {
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
	private skyPlayer: Sprite;

	constructor() {
		super();

		// Initialize world container
		this.worldContainer.name = "PHYSICS WORLD CONTAINER";
		this.addChild(this.worldContainer);

		// Setup light background (debug visibility)
		this.worldContainer.addChild(this.lightBackground);
		this.lightBackground.beginFill(0xffffff);
		this.lightBackground.drawRect(0, 0, 1500, 1500);
		this.lightBackground.endFill();

		// Create physics world with no gravity
		const gravity = { x: 0.0, y: 0.0 };
		this.world = new World(gravity);

		// Add walls and ground to the world
		this.createColliders();

		// Create a dynamic rigid body for the player
		this.rigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(25.0, 1);
		this.rigidBody = this.world.createRigidBody(this.rigidBodyDesc);

		// Create a player sprite
		this.skyPlayer = Sprite.from("img/sky.png");
		this.skyPlayer.scale.set(0.5);
		this.skyPlayer.anchor.set(0.5, 1);
		const colliderDesc = ColliderDesc.ball(1).setRestitution(0.8);
		this.world.createCollider(colliderDesc, this.rigidBody);

		// Add player to world container
		this.worldContainer.addChild(this.skyPlayer);
	}

	// Add ground, roof, and walls to the world
	private createColliders(): void {
		// Crear colliders para las paredes con restitución
		const groundCollider = ColliderDesc.cuboid(20.0, 1).setRestitution(-20); // Para el suelo
		this.world.createCollider(groundCollider).setTranslation({ x: 20.0, y: 10.0 });

		const roofCollider = ColliderDesc.cuboid(20.0, 1).setRestitution(0.8); // Para el techo
		this.world.createCollider(roofCollider).setTranslation({ x: 20.0, y: -10.0 });

		const leftWallCollider = ColliderDesc.cuboid(1, 10).setRestitution(0.8); // Para la pared izquierda
		this.world.createCollider(leftWallCollider).setTranslation({ x: 40.0, y: 0.0 });

		const rightWallCollider = ColliderDesc.cuboid(1, 10).setRestitution(0.8); // Para la pared derecha
		this.world.createCollider(rightWallCollider).setTranslation({ x: 0.0, y: 0.0 });
	}

	// Update method for physics and player movement
	public override update(dt: number): void {
		// Update world with delta time
		this.world.integrationParameters.dt = dt / 1000;
		this.world.step();

		// Render debug information
		this.debugDraw();

		// Update world and player positions
		this.updateWorldPosition();
		this.updatePlayerMovement(dt);
	}

	// Update the position of the world and player based on physics
	private updateWorldPosition(): void {
		this.worldContainer.x = -this.rigidBody.translation().x * BallShootingGame.METER_TO_PIXEL + this.worldTransform.a + BallShootingGame.OFFSET_CAMERA;
		this.worldContainer.y = -this.rigidBody.translation().y * BallShootingGame.METER_TO_PIXEL + this.worldTransform.a + BallShootingGame.OFFSET_CAMERA;

		this.skyPlayer.x = this.rigidBody.translation().x * BallShootingGame.METER_TO_PIXEL;
		this.skyPlayer.y = this.rigidBody.translation().y * BallShootingGame.METER_TO_PIXEL + 10;
	}

	// Handle player input and movement
	private updatePlayerMovement(_dt: number): void {
		if (Keyboard.shared.justReleased("Space")) {
			this.rigidBody.applyImpulse(new Point(0, -200), true);
		}
		if (Keyboard.shared.isDown("KeyD") && this.rigidBody.linvel().x < 100) {
			this.rigidBody.applyImpulse(new Point(1, 0), true);
		}
		if (Keyboard.shared.isDown("KeyA") && this.rigidBody.linvel().x > 0) {
			this.rigidBody.applyImpulse(new Point(-1, 0), true);
		}
	}

	// Debug drawing for visualizing Rapier physics
	private debugDraw(): void {
		this.usedDebugGraphics.forEach((g) => this.debugGraphicsPool.put(g));
		this.usedDebugGraphics = [];

		const { vertices, colors } = this.world.debugRender();
		for (let i = 0; i < vertices.length / 4; i++) {
			const g = this.debugGraphicsPool.get();
			const c = new Color({
				r: colors[i * 4 * 2] * 255,
				g: colors[i * 4 * 2 + 1] * 255,
				b: colors[i * 4 * 2 + 2] * 255,
				a: colors[i * 4 * 2 + 3] * 255,
			});

			g.lineStyle(2, c, 1);
			g.moveTo(vertices[i * 4] * BallShootingGame.METER_TO_PIXEL, vertices[i * 4 + 1] * BallShootingGame.METER_TO_PIXEL);
			g.lineTo(vertices[i * 4 + 2] * BallShootingGame.METER_TO_PIXEL, vertices[i * 4 + 3] * BallShootingGame.METER_TO_PIXEL);

			this.usedDebugGraphics.push(g);
			this.worldContainer.addChild(g);
		}
	}
}
