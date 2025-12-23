import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Color, StandardMaterial, Model, Container3D, Light, LightType, LightingEnvironment } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl } from "../../../index";
import { Assets, Graphics } from "pixi.js";

// --- CONFIGURACIÓN ---
const PLAYER_SPEED = 6;
const JUMP_FORCE = 13;
const LEVEL_LENGTH = 200;
const LEVEL_DEPTH = 16;
const FLOOR_Y = -1;
const CAM_DIST = 35;
export const CAM_HEIGHT = 6;
const CAM_ANGLE_X = 30;

export class UpScrollerScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx", "3d"];

	private world: World;
	private playerBody: RigidBody;

	private playerContainer: Container3D;
	private physicsObjects: { body: RigidBody; mesh: Mesh3D }[] = [];
	private debugGraphics: Graphics;

	// Modelos Animados
	private playerRunning: Model;
	private playerIdle: Model;
	private playerJump: Model; // 1. Nueva propiedad para el salto

	// Actualizamos el tipo de estado para incluir "jump"
	// private currentAnimState: "idle" | "running" | "jump" = "idle";
	private currentAnimState: "idle" | "running" = "idle";

	constructor() {
		super();
		// new EnviromentalLights();

		const dirLight3 = new Light();
		dirLight3.type = LightType.directional;
		dirLight3.intensity = 50;
		dirLight3.color = new Color(1, 1, 1);
		dirLight3.rotationQuaternion.setEulerAngles(80, 0, 0);
		LightingEnvironment.main.lights.push(dirLight3);

		// --- CARGA DE ASSETS ---

		// 1. IDLE
		this.playerIdle = Model.from(Assets.get("Idle"));
		this.playerIdle.name = "Idle";
		this.cleanModel(this.playerIdle);
		if (this.playerIdle.animations.length > 0) {
			this.playerIdle.animations[0].loop = true;
			this.playerIdle.animations[0].play();
		}

		// 2. RUNNING
		this.playerRunning = Model.from(Assets.get("Running"));
		this.playerRunning.name = "Running";
		this.cleanModel(this.playerRunning);
		if (this.playerRunning.animations.length > 0) {
			this.playerRunning.animations[0].loop = true;
			this.playerRunning.animations[0].play();
		}
		this.playerRunning.visible = false;

		// 3. JUMP (NUEVO)
		this.playerJump = Model.from(Assets.get("Jump")); // Asegúrate que el asset se llame "Jump" en tus bundles
		this.playerJump.name = "Jump";
		this.cleanModel(this.playerJump); // Limpiamos basura del modelo
		if (this.playerJump.animations.length > 0) {
			this.playerJump.animations[0].loop = true; // Loopeamos (útil si es una pose de caída sostenida)
			this.playerJump.animations[0].play();
			this.playerJump.animations[0].speed = 1.2;
		}
		this.playerJump.visible = false;

		// Configurar Cámara
		cameraControl.allowControl = false;
		cameraControl.distance = CAM_DIST;
		cameraControl.angles.y = 90;
		cameraControl.angles.x = CAM_ANGLE_X;
		cameraControl.target = { x: 0, y: 2, z: 0 };

		// Mundo Físico
		this.world = new World({ x: 0, y: -9.81, z: 0 });

		// Crear Escenario
		this.createEnvironment();
		this.createPlayer();
		this.createObstacles();

		// Debug gráfico
		this.debugGraphics = new Graphics();
		this.addChild(this.debugGraphics);
	}

	private cleanModel(model: Container3D): void {
		const checkChildren = (obj: Container3D): void => {
			obj.children.forEach((child) => {
				const name = child.name.toLowerCase();
				if (name.includes("cube") || name.includes("box")) {
					child.visible = false;
				}
				if (child instanceof Mesh3D && !(child as any).skin) {
					// child.visible = false; // Descomentar si es necesario
				}
				if (child instanceof Container3D) {
					checkChildren(child);
				}
			});
		};
		checkChildren(model);
	}

	private createEnvironment(): void {
		const floorMesh = Mesh3D.createPlane();
		floorMesh.scale.set(LEVEL_LENGTH, 1, LEVEL_DEPTH);
		floorMesh.position.set(LEVEL_LENGTH / 2, FLOOR_Y, 0);
		this.addChild(floorMesh);

		const floorBodyDesc = RigidBodyDesc.fixed().setTranslation(LEVEL_LENGTH / 2, FLOOR_Y - 0.5, 0);
		const floorColDesc = ColliderDesc.cuboid(LEVEL_LENGTH / 2, 0.5, LEVEL_DEPTH / 2);
		this.world.createCollider(floorColDesc, this.world.createRigidBody(floorBodyDesc));

		const bgWall = Mesh3D.createCube();
		bgWall.scale.set(LEVEL_LENGTH, 10, 1);
		bgWall.position.set(LEVEL_LENGTH / 2, 4, -LEVEL_DEPTH / 2 - 0.5);
		const wallMat = new StandardMaterial();
		wallMat.baseColor = new Color(0x3e2723);
		bgWall.material = wallMat;
		this.addChild(bgWall);

		this.createInvisibleWall(LEVEL_LENGTH / 2, 2, -LEVEL_DEPTH / 2, LEVEL_LENGTH, 5, 1);
		this.createInvisibleWall(LEVEL_LENGTH / 2, 2, LEVEL_DEPTH / 2, LEVEL_LENGTH, 5, 1);
		this.createInvisibleWall(-5, 2, 0, 1, 5, LEVEL_DEPTH);
		this.createInvisibleWall(LEVEL_LENGTH + 5, 2, 0, 1, 5, LEVEL_DEPTH);
	}

	private createInvisibleWall(x: number, y: number, z: number, w: number, h: number, d: number): void {
		const desc = RigidBodyDesc.fixed().setTranslation(x, y, z);
		const col = ColliderDesc.cuboid(w / 2, h / 2, d / 2);
		this.world.createCollider(col, this.world.createRigidBody(desc));
	}

	private createObstacles(): void {
		for (let i = 0; i < 5; i++) {
			const x = 10 + i * 15;
			const z = (Math.random() - 0.5) * (LEVEL_DEPTH - 2);
			this.createBox(x, 0.5, z);
		}
	}

	private createBox(x: number, y: number, z: number): void {
		const size = 1.5;
		const mesh = Mesh3D.createCube();
		mesh.scale.set(size, size, size);
		this.addChild(mesh);

		const bodyDesc = RigidBodyDesc.dynamic().setTranslation(x, y + 2, z);
		// Mantenemos tu corrección del tamaño del collider
		const colDesc = ColliderDesc.cuboid(size, size, size);

		const body = this.world.createRigidBody(bodyDesc);
		this.world.createCollider(colDesc, body);

		this.physicsObjects.push({ body, mesh });
	}

	private createPlayer(): void {
		const startX = 0;
		const startY = 2;
		const startZ = 0;

		const rbDesc = RigidBodyDesc.dynamic().setTranslation(startX, startY, startZ).lockRotations().setLinearDamping(1.0);

		this.playerBody = this.world.createRigidBody(rbDesc);
		this.playerBody.setEnabledRotations(false, false, false, true);

		const colDesc = ColliderDesc.capsule(0.5, 0.5);
		colDesc.setFriction(0.1);
		this.world.createCollider(colDesc, this.playerBody);

		this.playerContainer = new Container3D();
		this.playerContainer.addChild(this.playerIdle);
		this.playerContainer.addChild(this.playerRunning);
		this.playerContainer.addChild(this.playerJump); // Agregamos Jump al contenedor

		this.playerContainer.scale.set(3);
		this.playerContainer.y = -1;

		this.addChild(this.playerContainer);
	}

	public override update(_dt: number): void {
		this.handlePlayerInput();
		this.world.step();

		const pPos = this.playerBody.translation();
		this.playerContainer.position.set(pPos.x, pPos.y - 1, pPos.z);

		this.updatePlayerAnimationAndRotation();

		this.physicsObjects.forEach((obj) => {
			const t = obj.body.translation();
			const r = obj.body.rotation();
			obj.mesh.position.set(t.x, t.y, t.z);
			obj.mesh.rotationQuaternion.set(r.x, r.y, r.z, r.w);
		});

		this.updateCamera(pPos);
		this.drawShadow(pPos);
	}

	private updatePlayerAnimationAndRotation(): void {
		const vel = this.playerBody.linvel();
		const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

		const MOVING_THRESHOLD = 0.5;

		let nextState: "idle" | "running" = "idle";

		// 2. Si está en el suelo, ¿se mueve?
		if (horizontalSpeed > MOVING_THRESHOLD) {
			nextState = "running";
		}
		// 3. Si no, Idle
		else {
			nextState = "idle";
		}

		// Aplicar cambios visuales solo si el estado cambia
		if (this.currentAnimState !== nextState) {
			this.currentAnimState = nextState;

			// Ocultamos todos primero
			this.playerIdle.visible = false;
			this.playerRunning.visible = false;
			this.playerJump.visible = false;

			// Mostramos el correcto
			if (nextState === "idle") {
				this.playerIdle.visible = true;
			} else if (nextState === "running") {
				this.playerRunning.visible = true;
			} else if (nextState === "jump") {
				this.playerJump.visible = true;
			}
		}

		// Rotación (independiente de si salta o corre, si hay movimiento horizontal, giramos)
		if (Math.abs(vel.x) > 0.1) {
			const targetRotation = vel.x > 0 ? 90 : -90;
			this.playerContainer.rotationQuaternion.setEulerAngles(0, targetRotation, 0);
		}
	}

	private handlePlayerInput(): void {
		let dx = 0;
		let dz = 0;
		if (Keyboard.shared.isDown("KeyA")) {
			dx -= 1;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			dx += 1;
		}
		if (Keyboard.shared.isDown("KeyW")) {
			dz -= 1;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			dz += 1;
		}

		const len = Math.sqrt(dx * dx + dz * dz);
		if (len > 0) {
			dx = (dx / len) * PLAYER_SPEED;
			dz = (dz / len) * PLAYER_SPEED;
		}

		const currentVel = this.playerBody.linvel();
		let dy = currentVel.y;

		if (Keyboard.shared.justPressed("Space") && Math.abs(dy) < 0.1) {
			dy = JUMP_FORCE;
		}

		this.playerBody.setLinvel({ x: dx, y: dy, z: dz }, true);
	}

	private updateCamera(playerPos: { x: number; y: number; z: number }): void {
		cameraControl.target = {
			x: playerPos.x + 2,
			y: 2,
			z: 0,
		};
	}

	private drawShadow(_pos: { x: number; y: number; z: number }): void {
		this.debugGraphics.clear();
	}
}
