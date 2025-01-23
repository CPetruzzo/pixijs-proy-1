import { Container, Graphics, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import type { RigidBody } from "@dimforge/rapier2d";
import { ColliderDesc, World, RigidBodyDesc } from "@dimforge/rapier2d";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Color, Point } from "@pixi/core";
import { Keyboard } from "../../../engine/input/Keyboard";

export class GlobalGameJamScene extends PixiScene {
	public animator: StateMachineAnimator;
	public static readonly BUNDLES = ["ggj"];
	private worldContainer: Container = new Container();
	private keys: Record<string, boolean> = {};
	private world: World;
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
	private rigidBodyDesc: RigidBodyDesc;
	private rigidBody: RigidBody;

	constructor() {
		super();
		this.addChild(this.worldContainer);

		const gravity = { x: 0.0, y: 30 };
		this.world = new World(gravity);

		this.animator = new StateMachineAnimator();
		this.animator.addState(
			"idle",
			Array.from({ length: 20 }, (_, i) => Texture.from(`idle${i.toString().padStart(2, "0")}`)),
			1,
			true
		);

		this.animator.addState(
			"walk",
			Array.from({ length: 20 }, (_, i) => Texture.from(`walk${i.toString().padStart(2, "0")}`)),
			1,
			true
		);

		this.animator.addState(
			"jump",
			Array.from({ length: 8 }, (_, i) => Texture.from(`jump${i.toString().padStart(2, "0")}`)),
			1,
			false
		);

		this.animator.playState("idle");

		this.animator.anchor.set(0.5, 0.7);

		this.rigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(25.0, 1).lockRotations(); // Bloquea la rotación
		this.rigidBody = this.world.createRigidBody(this.rigidBodyDesc);
		this.rigidBody.mass = () => 10;
		const colliderDesc = ColliderDesc.capsule(1, 0.5).setTranslation(0, 0);
		this.world.createCollider(colliderDesc, this.rigidBody);

		const colliderDesc1 = ColliderDesc.cuboid(10, 10);
		this.world.createCollider(colliderDesc1).setTranslation({ x: 40.0, y: 70.0 });

		const groundColliderDesc = ColliderDesc.cuboid(10000.0, 1).setRestitution(-10);
		// groundColliderDesc.setRotation(GlobalGameJamScene.PI * 0.05);
		this.world.createCollider(groundColliderDesc).setTranslation({ x: 40.0, y: 90.0 });

		this.worldContainer.addChild(this.animator);
		this.setupKeyboardListeners();
	}

	private setupKeyboardListeners(): void {
		window.addEventListener("keydown", (e) => {
			this.keys[e.code] = true;
			this.updateAnimationState();
		});

		window.addEventListener("keyup", (e) => {
			this.keys[e.code] = false;
			this.updateAnimationState();
		});
	}

	private updateAnimationState(): void {
		if (this.keys["Space"] && this.animator.currentStateName !== "jump") {
			this.animator.playState("jump");
		} else if ((this.keys["ArrowLeft"] || this.keys["ArrowRight"] || this.keys["ArrowUp"] || this.keys["ArrowDown"]) && this.animator.currentStateName !== "walk") {
			this.animator.playState("walk");
		} else if (
			!this.keys["Space"] &&
			!this.keys["ArrowLeft"] &&
			!this.keys["ArrowRight"] &&
			!this.keys["ArrowUp"] &&
			!this.keys["ArrowDown"] &&
			this.animator.currentStateName !== "idle"
		) {
			this.animator.playState("idle");
		}

		if (this.keys["ArrowLeft"]) {
			this.animator.scale.x = -1;
		} else if (this.keys["ArrowRight"]) {
			this.animator.scale.x = 1;
		}
	}

	public override update(_dt: number): void {
		this.animator.update(_dt);
		this.world.integrationParameters.dt = _dt / 1000;
		this.world.step();

		this.worldContainer.x = -this.rigidBody.translation().x * GlobalGameJamScene.METER_TO_PIXEL + this.worldTransform.a + GlobalGameJamScene.OFFSET_CAMERA;
		this.worldContainer.y = -this.rigidBody.translation().y * GlobalGameJamScene.METER_TO_PIXEL + this.worldTransform.a + GlobalGameJamScene.OFFSET_CAMERA;

		this.animator.x = this.rigidBody.translation().x * GlobalGameJamScene.METER_TO_PIXEL;
		this.animator.y = this.rigidBody.translation().y * GlobalGameJamScene.METER_TO_PIXEL + 10;

		if (Keyboard.shared.isDown("Space")) {
			this.rigidBody.applyImpulse(new Point(0, -5), true);
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			if (this.rigidBody.linvel().x < 50) {
				this.rigidBody.applyImpulse(new Point(1, 0), true);
			}
		}
		if (Keyboard.shared.isDown("ArrowLeft")) {
			if (this.rigidBody.linvel().x > -50) {
				this.rigidBody.applyImpulse(new Point(-1, 0), true);
			}
		}

		this.debugDraw();
	}

	public override onResize(_newW: number, _newH: number): void {
		this.worldContainer.x = _newW * 0.5;
		this.worldContainer.y = _newH * 0.5;
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
			g.moveTo(vertices[i * 4] * GlobalGameJamScene.METER_TO_PIXEL, vertices[i * 4 + 1] * GlobalGameJamScene.METER_TO_PIXEL);
			g.lineTo(vertices[i * 4 + 2] * GlobalGameJamScene.METER_TO_PIXEL, vertices[i * 4 + 3] * GlobalGameJamScene.METER_TO_PIXEL);

			this.usedDebugGraphics.push(g);
			this.worldContainer.addChild(g);
		}
	}
}
