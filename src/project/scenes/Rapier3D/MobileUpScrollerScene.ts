/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Color, StandardMaterial, Model, Container3D, Light, LightType, LightingEnvironment, StandardMaterialAlphaMode } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc, ActiveEvents, EventQueue } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl, Manager } from "../../../index";
// En la parte superior de MobileUpScrollerScene.ts
import { Assets, Text, Texture, Graphics, Container, Point } from "pixi.js";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";

const FORWARD_SPEED = 8;
const LATERAL_SPEED = 10;
const ROAD_WIDTH = 40;
const LEVEL_LENGTH = 1000;
const JOYSTICK_RADIUS = 50; // Radio máximo de movimiento del joystick
type GateOp = {
	type: "add" | "sub" | "mul" | "div" | "win"; // Añadido "win"
	value: number;
	text: string;
};

export class MobileUpScrollerScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx", "3d"];

	private world: World;
	private crowd: { body: RigidBody; container: Container3D; model: Model }[] = [];
	private eventQueue: EventQueue;
	private lastSpawnX: number = 30;
	private gateData: Map<number, GateOp> = new Map();
	private isFinished: boolean = false; // Flag para detener el juego al ganar
	private scoreText: Text;
	private obstacleHandles: Set<number> = new Set();

	// Propiedades para el Joystick Virtual
	private joystickContainer: Container;
	private joystickBase: Graphics;
	private joystickHandle: Graphics;
	private touchStartPos: Point = new Point();
	private isTouching: boolean = false;
	private mobileLateralInput: number = 0;

	constructor() {
		super();
		this.setupLights();
		this.world = new World({ x: 0, y: -9.81, z: 0 });

		const sphere = Model.from(Assets.get("ocean"));
		sphere.position.set(-200, 0, -500);
		sphere.scale.set(300, 300, 300);
		this.addChild(sphere);

		cameraControl.allowControl = false;
		cameraControl.distance = 35;
		cameraControl.angles.y = 90; // desde atrás
		cameraControl.angles.x = 25; // la inclinación hacia abajo

		this.createEnvironment();
		this.createWalls();

		this.spawnPlayerMember(0, 0);
		this.createFinishGate(); // Creamos la meta al iniciar
		this.eventQueue = new EventQueue(true);

		// En el constructor:
		this.scoreText = new Text("1", { fill: 0xffffff, fontSize: 40, fontWeight: "bold" });
		this.addChild(this.scoreText);

		// Inicializar Joystick
		this.setupJoystick();
	}

	private setupLights(): void {
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 5;
		dirLight.rotationQuaternion.setEulerAngles(45, 45, 0);
		LightingEnvironment.main.lights.push(dirLight);

		LightingEnvironment.main.fog = {
			color: new Color(0.5, 0.7, 1), // Color del horizonte
			near: 50,
			far: 200,
		};
	}

	private createEnvironment(): void {
		const floorMesh = Mesh3D.createPlane();
		floorMesh.scale.set(LEVEL_LENGTH / 2, 1, ROAD_WIDTH / 2);
		floorMesh.position.set(LEVEL_LENGTH / 2, -1, 0);
		const roadMat = new StandardMaterial();
		roadMat.baseColor = new Color(0.2, 0.2, 0.2);
		floorMesh.material = roadMat;
		this.addChild(floorMesh);

		const floorBody = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(LEVEL_LENGTH / 2, -1.5, 0));
		this.world.createCollider(ColliderDesc.cuboid(LEVEL_LENGTH / 2, 0.5, ROAD_WIDTH / 2), floorBody);
	}

	// NUEVO: Crea un portal gigante al final del camino
	// eslint-disable-next-line @typescript-eslint/require-await
	private async createFinishGate(): Promise<void> {
		const x = LEVEL_LENGTH - 5; // Posicionado al final del suelo
		const z = 0;
		const gateMesh = Mesh3D.createPlane();
		gateMesh.rotationQuaternion.setEulerAngles(0, 270, 90);
		// Scale en Z es ROAD_WIDTH / 2 para que ocupe todo el ancho (20 unidades)
		gateMesh.scale.set(ROAD_WIDTH / 2, 2, 10);
		gateMesh.position.set(x, 9, z);

		const mat = new StandardMaterial();
		const canvas = document.createElement("canvas");
		canvas.width = 512;
		canvas.height = 256;
		const ctx = canvas.getContext("2d")!;

		// Estilo Dorado para la victoria
		ctx.fillStyle = "rgba(255, 215, 0, 0.9)";
		ctx.fillRect(0, 0, 512, 256);
		ctx.strokeStyle = "white";
		ctx.lineWidth = 20;
		ctx.strokeRect(10, 10, 492, 236);
		ctx.fillStyle = "black";
		ctx.font = "bold 100px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("¡META!", 256, 128);

		mat.baseColorTexture = Texture.from(canvas);
		mat.alphaMode = StandardMaterialAlphaMode.blend;
		gateMesh.material = mat;
		this.addChild(gateMesh);

		const body = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(x, 2, z));
		const collider = ColliderDesc.cuboid(0.5, 4, ROAD_WIDTH / 2)
			.setSensor(true)
			.setActiveEvents(ActiveEvents.COLLISION_EVENTS);
		const colHandle = this.world.createCollider(collider, body).handle;

		this.gateData.set(colHandle, { type: "win", value: 0, text: "META" });
	}

	private spawnPlayerMember(x: number, z: number): void {
		const rbDesc = RigidBodyDesc.dynamic().setTranslation(x, 1, z).lockRotations().setLinearDamping(0.5);
		const body = this.world.createRigidBody(rbDesc);
		const colDesc = ColliderDesc.capsule(0.5, 0.3);
		this.world.createCollider(colDesc, body);

		const container = new Container3D();
		const model = Model.from(Assets.get("Running"));
		model.scale.set(3);
		model.y = -1;
		if (model.animations.length > 0) {
			model.animations[0].loop = true;
			model.animations[0].play();
		}
		this.cleanModel(model);

		container.addChild(model);
		this.addChild(container);
		this.crowd.push({ body, container, model });
	}

	private spawnRandomContent(playerX: number): void {
		if (playerX > LEVEL_LENGTH - 100) {
			return;
		}

		if (playerX + 80 > this.lastSpawnX) {
			const nextX = this.lastSpawnX + 40;

			// Decidimos aleatoriamente si poner portales o un obstáculo
			if (Math.random() > 0.2) {
				// 70% de probabilidad: Portales
				this.createRandomGate(nextX, -6);
				this.createRandomGate(nextX, 6);
			} else {
				// 30% de probabilidad: Un obstáculo en medio
				this.createObstacle(nextX / 2, (Math.random() - 0.5) * 10); // <--- LLÁMALA AQUÍ
			}

			this.lastSpawnX = nextX;
		}
	}

	private createRandomGate(x: number, z: number) {
		const types: GateOp["type"][] = ["add", "sub", "mul", "div"];
		const type = types[Math.floor(Math.random() * types.length)];
		let value = 0;
		let text = "";

		switch (type) {
			case "add":
				value = Math.floor(Math.random() * 10) + 1;
				text = `+${value}`;
				break;
			case "sub":
				value = Math.floor(Math.random() * 5) + 1;
				text = `-${value}`;
				break;
			case "mul":
				value = Math.floor(Math.random() * 2) + 2;
				text = `x${value}`;
				break;
			case "div":
				value = 2;
				text = `÷${value}`;
				break;
		}
		this.createGate(x, z, { type, value, text });
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async createGate(x: number, z: number, op: GateOp): Promise<void> {
		const gateMesh = Mesh3D.createPlane();
		gateMesh.rotationQuaternion.setEulerAngles(0, 270, 90);
		// Escala en Z ajustada para cubrir la mitad de la pista cada portal
		gateMesh.scale.set(4, 1, 4);
		gateMesh.position.set(x, 4, z);

		const mat = new StandardMaterial();
		const canvas = document.createElement("canvas");
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext("2d")!;

		const isPositive = op.type === "add" || op.type === "mul";
		ctx.fillStyle = isPositive ? "rgba(0, 150, 255, 0.8)" : "rgba(255, 50, 50, 0.8)";
		ctx.fillRect(0, 0, 256, 256);
		ctx.strokeStyle = "white";
		ctx.lineWidth = 15;
		ctx.strokeRect(0, 0, 256, 256);
		ctx.fillStyle = "white";
		ctx.font = "bold 80px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(op.text, 128, 128);

		mat.baseColorTexture = Texture.from(canvas);
		mat.alphaMode = StandardMaterialAlphaMode.blend;
		gateMesh.material = mat;
		this.addChild(gateMesh);

		const body = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(x, 1.5, z));
		const collider = ColliderDesc.cuboid(0.2, 2, 5).setSensor(true).setActiveEvents(ActiveEvents.COLLISION_EVENTS);
		const colHandle = this.world.createCollider(collider, body).handle;
		this.gateData.set(colHandle, op);
	}

	private setupJoystick(): void {
		this.joystickContainer = new Container();
		this.joystickContainer.visible = false;

		// Base del joystick (aro exterior)
		this.joystickBase = new Graphics();
		this.joystickBase.lineStyle(2, 0xffffff, 0.5);
		this.joystickBase.beginFill(0xffffff, 0.2);
		this.joystickBase.drawCircle(0, 0, JOYSTICK_RADIUS);
		this.joystickBase.endFill();

		// Palanca del joystick (círculo interior)
		this.joystickHandle = new Graphics();
		this.joystickHandle.beginFill(0xffffff, 0.8);
		this.joystickHandle.drawCircle(0, 0, JOYSTICK_RADIUS * 0.5);
		this.joystickHandle.endFill();

		this.joystickContainer.addChild(this.joystickBase);
		this.joystickContainer.addChild(this.joystickHandle);
		this.addChild(this.joystickContainer as any);

		// Eventos de pantalla completa
		this.eventMode = "static";
		// @ts-ignore
		this.hitArea = { contains: () => true }; // Permitir clics en toda la pantalla

		this.on("pointerdown", (e) => {
			if (this.isFinished) {
				return;
			}
			this.isTouching = true;
			this.touchStartPos.copyFrom(e.global);

			this.joystickContainer.position.copyFrom(e.global);
			this.joystickHandle.position.set(0, 0);
			this.joystickContainer.visible = true;
		});

		this.on("pointermove", (e) => {
			if (!this.isTouching) {
				return;
			}

			const dx = e.global.x - this.touchStartPos.x;
			const dy = e.global.y - this.touchStartPos.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Limitar el movimiento del handle al radio del joystick
			const clampedDistance = Math.min(distance, JOYSTICK_RADIUS);
			const angle = Math.atan2(dy, dx);

			const moveX = Math.cos(angle) * clampedDistance;
			const moveY = Math.sin(angle) * clampedDistance;

			this.joystickHandle.position.set(moveX, moveY);

			// Normalizar la entrada lateral (-1 a 1)
			this.mobileLateralInput = moveX / JOYSTICK_RADIUS;
		});

		this.on("pointerup", () => this.resetJoystick());
		this.on("pointerupoutside", () => this.resetJoystick());
	}

	private resetJoystick(): void {
		this.isTouching = false;
		this.joystickContainer.visible = false;
		this.mobileLateralInput = 0;
	}

	private createWalls(): void {
		const wallLeft = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(LEVEL_LENGTH / 2, 2, -ROAD_WIDTH / 2));
		this.world.createCollider(ColliderDesc.cuboid(LEVEL_LENGTH / 2, 5, 0.5), wallLeft);

		const wallRight = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(LEVEL_LENGTH / 2, 2, ROAD_WIDTH / 2));
		this.world.createCollider(ColliderDesc.cuboid(LEVEL_LENGTH / 2, 5, 0.5), wallRight);
	}

	private createObstacle(x: number, z: number) {
		const mesh = Mesh3D.createCylinder();
		mesh.position.set(x, 0, z);
		mesh.scale.set(3, 5, 3);
		const mat = new StandardMaterial();
		mat.baseColor = new Color(1, 0, 0); // Rojo brillante
		mesh.material = mat;
		this.addChild(mesh);

		const body = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(x, 0, z));
		const colDesc = ColliderDesc.cylinder(1, 0.5).setActiveEvents(ActiveEvents.COLLISION_EVENTS);
		const colHandle = this.world.createCollider(colDesc, body).handle;
		this.world.createCollider(colDesc, body);

		this.obstacleHandles.add(colHandle); // <--- Guardamos el ID del obstáculo
	}
	private cleanModel(model: Container3D): void {
		const checkChildren = (obj: Container3D): void => {
			obj.children.forEach((child) => {
				const name = child.name.toLowerCase();
				if (name.includes("cube") || name.includes("box")) {
					child.visible = false;
				}
				if (child instanceof Container3D) {
					checkChildren(child);
				}
			});
		};
		checkChildren(model);
	}

	private handleCollisions(): void {
		this.eventQueue.drainCollisionEvents((h1, h2, started) => {
			if (!started) {
				return;
			}

			// 1. Lógica de Portales (la que ya tienes)
			const op = this.gateData.get(h1) || this.gateData.get(h2);
			if (op) {
				this.applyGateEffect(op);
				this.gateData.delete(h1);
				this.gateData.delete(h2);
				return;
			}

			// 2. Lógica de Obstáculos (NUEVA)
			if (this.obstacleHandles.has(h1) || this.obstacleHandles.has(h2)) {
				// Si chocamos con un obstáculo rojo, eliminamos a un soldado
				if (this.crowd.length > 1) {
					const member = this.crowd.pop();
					if (member) {
						this.world.removeRigidBody(member.body);
						member.container.destroy();
					}
				} else {
					// Si solo queda el líder, podrías llamar a una función de "Game Over"
					console.log("GAME OVER");
				}
			}
		});
	}

	private applyGateEffect(op: GateOp): void {
		if (op.type === "win") {
			this.showWinPopup();
			return;
		}

		const currentCount = this.crowd.length;
		let targetCount = currentCount;

		if (op.type === "add") {
			targetCount += op.value;
		} else if (op.type === "sub") {
			targetCount = Math.max(1, currentCount - op.value);
		} else if (op.type === "mul") {
			targetCount = currentCount * op.value;
		} else if (op.type === "div") {
			targetCount = Math.max(1, Math.floor(currentCount / op.value));
		}

		targetCount = Math.min(targetCount, 50);

		// En applyGateEffect, mejora el posicionamiento:
		if (targetCount > currentCount) {
			const toAdd = targetCount - currentCount;
			const leaderPos = this.crowd[0].body.translation();

			for (let i = 0; i < toAdd; i++) {
				// Ángulo de oro para distribución perfecta (aprox 137.5 grados)
				const angle = (currentCount + i) * 137.5 * (Math.PI / 180);
				// Aumentamos el multiplicador (1.5) para que no nazcan tan pegados
				const radius = Math.sqrt(currentCount + i);

				const offsetX = -radius * Math.cos(angle) - 2;
				const offsetZ = radius * Math.sin(angle);

				this.spawnPlayerMember(leaderPos.x + offsetX, leaderPos.z + offsetZ);
			}
		} else if (targetCount < currentCount) {
			const toRemove = currentCount - targetCount;
			for (let i = 0; i < toRemove; i++) {
				const member = this.crowd.pop();
				if (member) {
					this.world.removeRigidBody(member.body);
					member.container.destroy();
				}
			}
		}
	}

	private showWinPopup(): void {
		this.isFinished = true;
		const score = this.crowd.length;
		console.log("score", score);

		// Detener movimiento de los cuerpos físicos
		this.crowd.forEach((m) => m.body.setLinvel({ x: 0, y: 0, z: 0 }, true));

		// Contenedor para la UI (2D)
		const uiOverlay = new Container();
		uiOverlay.name = "victory_ui";

		// 1. Fondo oscuro
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.7);
		bg.drawRect(0, 0, window.innerWidth, window.innerHeight);
		bg.endFill();
		uiOverlay.addChild(bg);

		// 2. Botón "Volver a jugar"
		const button = new Graphics();
		button.beginFill(0xffd700); // Dorado
		button.drawRoundedRect(-100, -25, 200, 50, 15);
		button.endFill();

		// Posicionamiento centrado (ajustar según tu motor)
		button.x = window.innerWidth / 2;
		button.y = window.innerHeight / 2 + 60;

		// Interactividad
		button.eventMode = "static";
		button.cursor = "pointer";
		button.on("pointertap", () => Manager.changeScene(MobileUpScrollerScene, { transitionClass: FadeColorTransition }));

		// Texto del botón
		const btnText = new Text("VOLVER A JUGAR", {
			fontSize: 20,
			fontWeight: "bold",
			fill: 0x000000,
		});
		btnText.anchor.set(0.5);
		button.addChild(btnText);

		uiOverlay.addChild(button);

		// Añadir al stage de Pixi (puedes usar this.addChild si el motor lo permite)
		this.addChild(uiOverlay as any);
	}

	public override update(_dt: number): void {
		if (this.isFinished) {
			return;
		}

		const leader = this.crowd[0];
		if (!leader) {
			return;
		}

		const playerPos = leader.body.translation();
		this.handleCrowdMovement();
		this.spawnRandomContent(playerPos.x);

		const leaderPos = this.crowd[0].container.position;
		this.scoreText.text = this.crowd.length.toString();
		this.scoreText.position.set(leaderPos.x, leaderPos.y + 5);

		this.world.step(this.eventQueue);
		this.handleCollisions();

		this.crowd.forEach((member) => {
			const pos = member.body.translation();
			member.container.position.set(pos.x, pos.y, pos.z);
			member.container.rotationQuaternion.setEulerAngles(0, 90, 0);
		});

		cameraControl.target = { x: playerPos.x, y: 1, z: 0 };
	}

	private handleCrowdMovement(): void {
		let lateralInput = 0;

		// Prioridad Teclado
		if (Keyboard.shared.isDown("KeyA") || Keyboard.shared.isDown("ArrowLeft")) {
			lateralInput = -1;
		} else if (Keyboard.shared.isDown("KeyD") || Keyboard.shared.isDown("ArrowRight")) {
			lateralInput = 1;
		}
		// Si no hay teclado, usar input de mobile
		else if (this.isTouching) {
			lateralInput = this.mobileLateralInput;
		}

		this.crowd.forEach((member) => {
			const vel = member.body.linvel();
			const pos = member.body.translation();
			let dz = lateralInput * LATERAL_SPEED;

			// Límites de la carretera
			if ((pos.z > ROAD_WIDTH / 2 && dz > 0) || (pos.z < -ROAD_WIDTH / 2 && dz < 0)) {
				dz = 0;
			}
			member.body.setLinvel({ x: FORWARD_SPEED, y: vel.y, z: dz }, true);
		});
	}
}
