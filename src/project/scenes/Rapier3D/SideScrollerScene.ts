import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Color, StandardMaterial, Model, Container3D, Light, LightType, LightingEnvironment } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl } from "../../../index";
import { Assets, Graphics } from "pixi.js";
import { Torch } from "../3dgame/Utils/Torch";
import { Gate } from "../3dgame/Utils/Gate";
import { Trigger } from "../3dgame/Utils/Trigger";
import { EventTrigger } from "../../../engine/trigger3d/EventTrigger";
import { DialogueOverlayManager } from "../../../engine/dialog/DialogueOverlayManager";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Easing, Tween } from "tweedle.js";

// ... (CONSTANTES IGUALES) ...
const PLAYER_SPEED = 6;
const RUN_SPEED = 12;
const JUMP_FORCE = 13;
const LEVEL_LENGTH = 200;
const LEVEL_DEPTH = 28;
const FLOOR_Y = -1;
const CAM_DIST = 30;
export const CAM_HEIGHT = 20;
const CAM_ANGLE_X = 0;
const DEBUG_CAMERACONTROL: boolean = true;

export class SideScrollerScene extends PixiScene {
	// ... (Propiedades iguales) ...
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx", "3d", "myfriend", "roboface"];
	private world: World;
	private playerBody: RigidBody;
	private playerContainer: Container3D;
	private physicsObjects: { body: RigidBody; mesh: Mesh3D }[] = [];
	private debugGraphics: Graphics;
	private torches: Torch[] = [];

	// --- TRIGGERS ---
	private gate: Gate;
	private gateBody: RigidBody;
	private trigger: Trigger; // El de la puerta
	private dialogueTrigger: EventTrigger; // <--- 2. NUEVA PROPIEDAD

	private playerRunning: Model;
	private playerIdle: Model;
	private playerRunningFast: Model;
	private playerJump: Model;
	private currentAnimState: "idle" | "running" | "runningfast" = "idle";
	private eventTriggers: EventTrigger[] = [];

	// Agrega esto arriba junto a tus otras propiedades
	private cameraFollowConfig = {
		followX: true, // Al principio sigue en X
		followZ: false, // Al principio NO sigue en Z
		fixedX: 0, // Valor fijo cuando no sigue X
		fixedZ: 0, // Valor fijo cuando no sigue Z
		offsetX: 2, // El "adelantamiento" de la cámara
		offsetZ: 0,
	};

	constructor() {
		super();
		// ... (Luces y Carga de Assets IGUAL que antes) ...
		const dirLight3 = new Light();
		dirLight3.type = LightType.directional;
		dirLight3.intensity = 5;
		dirLight3.color = new Color(1, 1, 1);
		dirLight3.rotationQuaternion.setEulerAngles(20, 180, 0);
		LightingEnvironment.main.lights.push(dirLight3);

		this.playerIdle = Model.from(Assets.get("Idle"));
		this.playerIdle.name = "Idle";
		this.cleanModel(this.playerIdle);
		if (this.playerIdle.animations.length > 0) {
			this.playerIdle.animations[0].loop = true;
			this.playerIdle.animations[0].play();
		}

		this.playerRunning = Model.from(Assets.get("Running"));
		this.playerRunning.name = "Running";
		this.cleanModel(this.playerRunning);
		if (this.playerRunning.animations.length > 0) {
			this.playerRunning.animations[0].loop = true;
			this.playerRunning.animations[0].play();
		}
		this.playerRunning.visible = false;

		this.playerRunningFast = Model.from(Assets.get("Running2"));
		this.playerRunningFast.name = "RunningFast";
		this.cleanModel(this.playerRunningFast);
		if (this.playerRunningFast.animations.length > 0) {
			this.playerRunningFast.animations[0].loop = true;
			this.playerRunningFast.animations[0].play();
		}
		this.playerRunningFast.visible = false;

		this.playerJump = Model.from(Assets.get("Jump"));
		this.playerJump.name = "Jump";
		this.cleanModel(this.playerJump);
		if (this.playerJump.animations.length > 0) {
			this.playerJump.animations[0].loop = true;
			this.playerJump.animations[0].play();
			this.playerJump.animations[0].speed = 1.2;
		}
		this.playerJump.visible = false;

		// ... (Camara y Tween IGUAL) ...
		cameraControl.allowControl = DEBUG_CAMERACONTROL;
		cameraControl.angles.y = 90;
		cameraControl.angles.x = CAM_ANGLE_X;
		cameraControl.distance = CAM_DIST - 30;

		new Tween(cameraControl.angles)
			.to({ x: CAM_ANGLE_X + 20, y: 180 }, 8000)
			.easing(Easing.Cubic.Out)
			.delay(500)
			.start();

		new Tween(cameraControl).to({ distance: CAM_DIST }, 8000).easing(Easing.Cubic.Out).delay(500).start();

		cameraControl.target = { x: 0, y: 2, z: 0 };

		this.world = new World({ x: 0, y: -9.81, z: 0 });

		this.createEnvironment();
		this.createPlayer();
		this.createObstacles();
		this.createDecorations();

		// Configurar triggers
		this.createGateAndTrigger();

		this.debugGraphics = new Graphics();
		this.addChild(this.debugGraphics);

		DialogueOverlayManager.init(this);
		DialogueOverlayManager.changeTalkerImage("roboface");

		// Mensajes iniciales...
		DialogueOverlayManager.talk("Bienvenido a un SideScroller 2.5D");
		DialogueOverlayManager.talk("Movete con A y D hacia los costados");
	}

	// ... (Métodos createFloor, createEnvironmentObject... IGUAL) ...
	private createFloor(): void {
		const road1 = Model.from(Assets.get("road"));
		road1.scale.set(1, 1, LEVEL_DEPTH);
		road1.rotationQuaternion.setEulerAngles(0, 90, 0);
		road1.position.set(LEVEL_LENGTH * 3, FLOOR_Y, 4);
		this.addChild(road1);
	}

	private createEnvironmentObject(): void {
		const carFire = Model.from(Assets.get("car_fire"));
		carFire.animations[0].loop = true;
		carFire.animations[0].play();
		carFire.scale.set(2);
		carFire.rotationQuaternion.setEulerAngles(0, -120, 0);
		carFire.position.set(-5, FLOOR_Y - 14, -29);
		this.addChild(carFire);
	}

	private createGateAndTrigger(): void {
		const gateX = 100;
		const gateY = 2.5;
		const scaleX = 1;
		const scaleY = 4;
		const scaleZ = 16;

		// ... (Gate, GateBody, Trigger, DialogueTrigger... se mantienen igual) ...

		this.gate = new Gate(this, { x: gateX, y: gateY, z: 0 }, { x: scaleX, y: scaleY, z: scaleZ });
		// ... (Configuración visual y física de Gate) ...
		const gateMat = new StandardMaterial();
		gateMat.baseColor = new Color(0.2, 0.2, 0.2);
		this.gate.mesh.material = gateMat;

		const bodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(gateX, gateY, 0);
		this.gateBody = this.world.createRigidBody(bodyDesc);
		const colDesc = ColliderDesc.cuboid(scaleX, scaleY, scaleZ);
		this.world.createCollider(colDesc, this.gateBody);

		this.trigger = new Trigger(this, this.gate, { x: 85, y: -0.5, z: 0 }, { x: 2, y: 0.2, z: 2 });
		const triggerMat = new StandardMaterial();
		triggerMat.baseColor = new Color(0.8, 0, 0);
		this.trigger.mesh.material = triggerMat;

		this.createBox(85, -0.5, 0, 3);
		this.createBall(95, 5, 0, 0.5);

		this.dialogueTrigger = new EventTrigger(this, { x: 80, y: 1, z: 0 }, { x: 1, y: 4, z: 20 }, () => {
			DialogueOverlayManager.talk("Una pared tapa todo el camino.");
			DialogueOverlayManager.talk("Debo buscar la forma de abrirme paso.");

			// Ejecutamos esta función SOLO después de que el último diálogo ha terminado.
			DialogueOverlayManager.chainEvent(() => {
				// 1. Buscamos la posición del trigger en el array
				const dialogIndex = this.eventTriggers.indexOf(this.dialogueTrigger);

				if (dialogIndex !== -1) {
					// 2. [LIMPIEZA VISUAL] Quitamos la malla 3D de la escena.
					this.dialogueTrigger.mesh.removeFromParent();

					// 3. [CORRECCIÓN] Usamos splice para remover el trigger del array de actualización.
					this.eventTriggers.splice(dialogIndex, 1);

					// Opcional: Esto es bueno para que la memoria se libere.
					(this.dialogueTrigger as any) = null;
				}
			});
		});
		this.eventTriggers.push(this.dialogueTrigger); // Agregamos el diálogo trigger a la lista para que se actualice

		// --- NUEVO: TRAMO INCLINADO Y CURVO ---
		const curveStartX = 125;
		const curveY = FLOOR_Y - 1;
		const rampLength = 60;
		const rampAngle = 0;
		const turnAngle = 90;

		this.createCurvedRamp(curveStartX, curveY, 0, rampLength, rampAngle, turnAngle);

		// ----------------------------------------------------
		// --- 1. TRIGGER FORWARD (SideScroller -> 3D Runner) ---
		// ----------------------------------------------------
		// Posición: En la entrada del nuevo camino (eje X).
		const camTriggerForward = new EventTrigger(this, { x: curveStartX + 1, y: 1, z: 1 }, { x: 2, y: 4, z: 11 }, () => {
			// Solo ejecuta si estamos en el modo SideScroller (followX = true)
			if (!this.cameraFollowConfig.followX) {
				return;
			}

			// Rotación de cámara
			new Tween(cameraControl.angles)
				.to({ y: 270 }, 1500) // 270 grados (mirando hacia -Z)
				.easing(Easing.Quadratic.Out)
				.start();

			// Configuración: Dejar de seguir X, empezar a seguir Z
			this.cameraFollowConfig.followX = false;
			this.cameraFollowConfig.fixedX = curveStartX + 1; // Fija el target X en el centro del pasillo
			this.cameraFollowConfig.followZ = true;
			this.cameraFollowConfig.offsetZ = -5;
		});
		this.eventTriggers.push(camTriggerForward);

		// ----------------------------------------------------
		// --- 2. TRIGGER BACKWARD (3D Runner -> SideScroller) ---
		// ----------------------------------------------------
		// Posición: En la entrada del nuevo camino, pero extendido en Z.
		const camTriggerBack = new EventTrigger(this, { x: curveStartX - 1, y: 1, z: 1 }, { x: 2, y: 4, z: 11 }, () => {
			// Solo ejecuta si estamos en el modo 3D Runner (followZ = true)
			if (!this.cameraFollowConfig.followZ) {
				return;
			}

			// Rotación de cámara
			new Tween(cameraControl.angles)
				.to({ y: 180 }, 1500) // 90 grados (mirando hacia +X, SideScroller)
				.easing(Easing.Quadratic.Out)
				.start();

			// Configuración: Volver a seguir X, dejar de seguir Z
			this.cameraFollowConfig.followX = true;
			this.cameraFollowConfig.offsetX = 2;

			this.cameraFollowConfig.followZ = false;
			this.cameraFollowConfig.fixedZ = 0; // Fija el target Z en el centro del camino principal
		});
		this.eventTriggers.push(camTriggerBack);
	}

	// --- MÉTODO NUEVO PARA RAMPA CURVA ---
	private createCurvedRamp(x: number, y: number, z: number, length: number, slopeAngle: number, turnAngle: number): void {
		// Este método es similar a createRamp pero aplica rotación en Y también.

		// 1. Calcular rotación combinada (Cuaternión)
		// Pixi3D usa Euler, Rapier usa Quaternion.

		// Visual
		const mesh = Mesh3D.createCube();
		mesh.scale.set(length, 1, LEVEL_DEPTH);
		// Rotamos primero en Z (pendiente) y luego en Y (curva)
		mesh.rotationQuaternion.setEulerAngles(0, turnAngle, slopeAngle);

		const mat = new StandardMaterial();
		mat.baseColor = new Color(0.5, 0.5, 0.5);
		mesh.material = mat;

		// Calcular posición del centro (compensando la rotación)
		// Para simplificar, lo posicionamos en el centro y ajustamos a mano o usamos un contenedor pivote.
		// Aquí usaremos aritmética simple:
		const radTurn = turnAngle * (Math.PI / 180);
		const radSlope = slopeAngle * (Math.PI / 180);

		// El centro se desplaza en X y Z debido al giro
		const centerX = x + (Math.cos(radTurn) * Math.cos(radSlope) * length) / 2;
		const centerZ = z - (Math.sin(radTurn) * Math.cos(radSlope) * length) / 2;
		const centerY = y + (Math.sin(radSlope) * length) / 2;

		mesh.position.set(centerX, centerY, centerZ);
		this.addChild(mesh);

		// Física
		// Rapier necesita un cuaternión que combine ambas rotaciones.
		// Podemos usar una librería de math o aproximarlo si son ejes separados.
		// La forma correcta es crear un cuaternión desde Euler (0, turn, slope).

		// Como no tenemos una lib de math completa a mano aquí, usaremos la propiedad de rotación de Pixi
		// para obtener el cuaternión y pasárselo a Rapier.
		const q = mesh.rotationQuaternion; // Pixi ya calculó el cuaternión combinado

		const bodyDesc = RigidBodyDesc.fixed().setTranslation(centerX, centerY, centerZ).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); // Copiamos rotación visual a física

		const body = this.world.createRigidBody(bodyDesc);
		const colDesc = ColliderDesc.cuboid(length, 1, LEVEL_DEPTH / 2);
		colDesc.setFriction(0.5);
		this.world.createCollider(colDesc, body);
	}

	public override update(_dt: number): void {
		this.handlePlayerInput();
		this.world.step();

		const pPos = this.playerBody.translation();
		this.playerContainer.position.set(pPos.x, pPos.y - 1, pPos.z);

		this.updatePlayerAnimationAndRotation();

		// Actualizar físicas visuales
		this.physicsObjects.forEach((obj) => {
			const t = obj.body.translation();
			const r = obj.body.rotation();
			obj.mesh.position.set(t.x, t.y, t.z);
			obj.mesh.rotationQuaternion.set(r.x, r.y, r.z, r.w);
		});

		this.torches.forEach((torch) => {
			torch.update(pPos);
		});

		// --- ACTUALIZAR TRIGGERS ---

		// Trigger de la puerta
		if (this.trigger) {
			this.trigger.update(this.playerContainer);
		}

		// 4. Trigger de Diálogo (EventTrigger)
		if (this.dialogueTrigger) {
			this.dialogueTrigger.update(this.playerContainer);
		}

		// Mover física de la puerta
		if (this.gate && this.gateBody) {
			const gateVisualPos = this.gate.mesh.position;
			this.gateBody.setNextKinematicTranslation({
				x: gateVisualPos.x,
				y: gateVisualPos.y,
				z: gateVisualPos.z,
			});
		}
		// En el método update():
		this.eventTriggers.forEach((trigger) => trigger.update(this.playerContainer));
		this.updateCamera(pPos);
		this.drawShadow(pPos);
	}

	// ... (El resto de métodos createDecorations, createRamp, cleanModel, createEnvironment, createInvisibleWall, createObstacles, createBox, createPlayer, updatePlayerAnimationAndRotation, handlePlayerInput, updateCamera, drawShadow SE MANTIENEN IGUAL) ...
	// Los omito por brevedad, no los borres.
	private createDecorations(): void {
		const t1 = new Torch(this, 5, -3, 0.03);
		this.torches.push(t1);
		const t2 = new Torch(this, 55, 3, 0.03);
		this.torches.push(t2);
		const t3 = new Torch(this, 95, 0, 0.03);
		this.torches.push(t3);
		for (let i = 0; i < 10; i++) {
			const fence = Model.from(Assets.get("fence"));
			this.cleanModel(fence);
			fence.position.set(i * 15, FLOOR_Y, 15);
			fence.scale.set(3);
			fence.rotationQuaternion.setEulerAngles(0, 90, 0);
			this.addChild(fence);
		}
		for (let i = 0; i < 5; i++) {
			const light = Model.from(Assets.get("streelight"));
			this.cleanModel(light);
			light.position.set(15 + i * 60, FLOOR_Y + 5, -360);
			light.scale.set(2);
			this.addChild(light);
		}
		const barrier = Model.from(Assets.get("barrier"));
		this.cleanModel(barrier);
		barrier.position.set(90, FLOOR_Y, 2);
		barrier.scale.set(2);
		for (let i = 0; i < 2; i++) {
			const streetwall = Model.from(Assets.get("streetwall"));
			this.cleanModel(streetwall);
			streetwall.position.set(30 + i * 60, FLOOR_Y + 4, -40);
			streetwall.scale.set(3);
			this.addChild(streetwall);
		}
	}
	private createRamp(startX: number, startY: number, z: number, scaleLength: number, angleDegrees: number): void {
		const scaleHeight = 1;
		const scaleDepth = LEVEL_DEPTH;
		const angleRad = angleDegrees * (Math.PI / 180);
		const centerX = startX + Math.cos(angleRad) * scaleLength;
		const centerY = startY + Math.sin(angleRad) * scaleLength;
		const rampMesh = Mesh3D.createCube();
		rampMesh.scale.set(scaleLength, scaleHeight, scaleDepth / 2);
		rampMesh.rotationQuaternion.setEulerAngles(0, 0, angleDegrees);
		const mat = new StandardMaterial();
		mat.baseColor = new Color(0.6, 0.3, 0.1);
		rampMesh.material = mat;
		rampMesh.position.set(centerX, centerY, z);
		this.addChild(rampMesh);
		const halfAngle = angleRad / 2;
		const qz = Math.sin(halfAngle);
		const qw = Math.cos(halfAngle);
		const bodyDesc = RigidBodyDesc.fixed().setTranslation(centerX, centerY, z).setRotation({ x: 0, y: 0, z: qz, w: qw });
		const body = this.world.createRigidBody(bodyDesc);
		const colDesc = ColliderDesc.cuboid(scaleLength, scaleHeight, scaleDepth / 2);
		colDesc.setFriction(0.5);
		this.world.createCollider(colDesc, body);
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
	private createEnvironment(): void {
		const floorMesh = Mesh3D.createPlane();
		floorMesh.scale.set(LEVEL_LENGTH, 1, LEVEL_DEPTH);
		floorMesh.position.set(LEVEL_LENGTH / 2, FLOOR_Y, 0);
		floorMesh.visible = false;
		this.addChild(floorMesh);

		this.createFloor();
		this.createEnvironmentObject();

		// Suelo físico base
		const floorBodyDesc = RigidBodyDesc.fixed().setTranslation(LEVEL_LENGTH / 2, FLOOR_Y - 0.5, 0);
		const floorColDesc = ColliderDesc.cuboid(LEVEL_LENGTH / 2, 0.5, LEVEL_DEPTH / 2);
		this.world.createCollider(floorColDesc, this.world.createRigidBody(floorBodyDesc));

		// --- CONFIGURACIÓN DE PAREDES EN FORMA DE "L" ---

		const TURN_START_X = 120; // Aproximadamente donde empieza tu curva
		const NEW_PATH_LENGTH = 100; // Cuánto se mete hacia el fondo

		// 1. PARED FRONTAL (La que está cerca de la cámara)
		// Esta puede seguir siendo larga o detenerse si quieres caer al vacío más adelante
		this.createInvisibleWall(LEVEL_LENGTH / 2, 2, LEVEL_DEPTH / 2, LEVEL_LENGTH, 5, 1);

		// 2. PARED TRASERA (La que bloquea el fondo)
		// AHORA ES MÁS CORTA: Solo va desde el inicio (0) hasta el giro (120)
		// Posición X = mitad de 120 = 60. Ancho = 120.
		this.createInvisibleWall(60, 2, -LEVEL_DEPTH / 2, 120, 5, 1);

		// 3. NUEVAS PAREDES PARA EL CAMINO HACIA EL FONDO (La "pata" de la L)
		// Suponiendo que el nuevo camino va hacia -Z (hacia el fondo) partiendo desde X=120

		// Pared Izquierda del nuevo camino (Para que no te vayas muy a la izquierda en el tramo nuevo)
		// La situamos en X = 115 (un poco antes de 120) y que vaya hacia el fondo
		this.createInvisibleWall(
			TURN_START_X - 10, // X
			2, // Y
			-NEW_PATH_LENGTH / 2, // Z (centro del nuevo tramo)
			1, // Ancho (fino en X)
			5, // Alto
			NEW_PATH_LENGTH // Largo (largo en Z)
		);

		// Pared Derecha del nuevo camino
		// La situamos en X = 145 (un poco después de la curva) para hacer un pasillo
		this.createInvisibleWall(
			TURN_START_X + 25, // X
			2, // Y
			-NEW_PATH_LENGTH / 2, // Z
			1, // Ancho
			5, // Alto
			NEW_PATH_LENGTH // Largo
		);

		// Límites laterales extremos (Inicio y Fin del nivel en X)
		this.createInvisibleWall(-5, 2, 0, 1, 5, LEVEL_DEPTH);
		this.createInvisibleWall(LEVEL_LENGTH + 5, 2, 0, 1, 5, LEVEL_DEPTH);

		// Rampa inicial
		this.createRamp(10, FLOOR_Y - 1, 0, 10, 25);
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
	private createBox(x: number, y: number, z: number, size: number = 1.5): void {
		const mesh = Mesh3D.createCube();
		mesh.scale.set(size, size, size);
		this.addChild(mesh);

		const bodyDesc = RigidBodyDesc.dynamic().setTranslation(x, y + 2, z);
		const colDesc = ColliderDesc.cuboid(size, size, size);

		// --- SOLUCIÓN ---
		// Reducimos la densidad (por defecto es 1.0).
		// Con 0.1, la caja será mucho más ligera y fácil de empujar.
		// Podés ajustar este valor: 0.5 para pesada, 0.1 para liviana.
		colDesc.setDensity(0.1);

		const body = this.world.createRigidBody(bodyDesc);
		this.world.createCollider(colDesc, body);
		this.physicsObjects.push({ body, mesh });
	}

	private createBall(x: number, y: number, z: number, radius: number = 0.5): void {
		// 1. Visual
		const mesh = Mesh3D.createSphere();
		mesh.scale.set(radius, radius, radius); // Pixi sphere base radius is 1? Check documentation, usually size 1 diameter.
		// Actually Mesh3D.createSphere() creates a sphere with radius 1 usually.
		// So scale of 0.5 makes radius 0.5.

		// Material colorido para verla bien
		const mat = new StandardMaterial();
		mat.baseColor = new Color(0, 0.5, 1); // Azul brillante
		mat.roughness = 0.2;
		mesh.material = mat;

		this.addChild(mesh);

		// 2. Física
		const bodyDesc = RigidBodyDesc.dynamic()
			.setTranslation(x, y, z)
			// Aumentamos amortiguación angular para que no ruede eternamente
			.setAngularDamping(0.5);

		const body = this.world.createRigidBody(bodyDesc);

		// Collider de bola
		const colDesc = ColliderDesc.ball(radius);
		colDesc.setRestitution(0.8); // Rebote alto (0 a 1)
		colDesc.setDensity(0.2); // Liviana para poder empujarla

		this.world.createCollider(colDesc, body);

		// Añadir a la lista de objetos sincronizados
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
		this.playerContainer.addChild(this.playerRunningFast);
		this.playerContainer.addChild(this.playerJump);
		this.playerContainer.scale.set(3);
		this.playerContainer.y = -1;
		this.addChild(this.playerContainer);
	}
	private updatePlayerAnimationAndRotation(): void {
		const vel = this.playerBody.linvel();
		const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
		const MOVING_THRESHOLD = 0.5;
		const RUNNING_FAST_THRESHOLD = PLAYER_SPEED + 1;
		let nextState: "idle" | "running" | "runningfast" = "idle";
		if (horizontalSpeed > RUNNING_FAST_THRESHOLD) {
			nextState = "runningfast";
		} else if (horizontalSpeed > MOVING_THRESHOLD) {
			nextState = "running";
		} else {
			nextState = "idle";
		}
		if (this.currentAnimState !== nextState) {
			this.currentAnimState = nextState;
			this.playerIdle.visible = false;
			this.playerRunning.visible = false;
			this.playerRunningFast.visible = false;
			this.playerJump.visible = false;
			if (nextState === "idle") {
				this.playerIdle.visible = true;
				SoundLib.stopMusic("leafwalk");
			} else if (nextState === "running") {
				this.playerRunning.visible = true;
				SoundLib.playMusic("leafwalk", { loop: true, volume: 0.3, speed: 1.2 });
			} else if (nextState === "runningfast") {
				this.playerRunningFast.visible = true;
				SoundLib.playMusic("leafwalk", { loop: true, volume: 0.5, speed: 1.6 });
			} else if (nextState === "jump") {
				this.playerJump.visible = true;
				SoundLib.stopMusic("leafwalk");
			}
		}
		if (horizontalSpeed > 0.1) {
			// Math.atan2(x, z) nos da el ángulo en radianes basado en el vector de velocidad.
			// Usamos (vel.x, vel.z) para que coincida con tu sistema donde X+ es 90 grados.
			const angleRad = Math.atan2(vel.x, vel.z);

			// Convertimos radianes a grados
			const angleDeg = angleRad * (180 / Math.PI);

			// Aplicamos la rotación
			this.playerContainer.rotationQuaternion.setEulerAngles(0, angleDeg, 0);
		}
	}

	private handlePlayerInput(): void {
		// 1. Input Base (Local al jugador)
		let inputX = 0;
		let inputZ = 0;

		if (Keyboard.shared.isDown("KeyA")) {
			inputX -= 1;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			inputX += 1;
		}
		if (Keyboard.shared.isDown("KeyW")) {
			inputZ -= 1;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			inputZ += 1;
		}

		// 2. Si no hay input, frenamos (pero mantenemos gravedad Y)
		if (inputX === 0 && inputZ === 0) {
			const currentVel = this.playerBody.linvel();
			this.playerBody.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true);
			return;
		}

		// 3. Normalizar Input
		const len = Math.sqrt(inputX * inputX + inputZ * inputZ);
		if (len > 0) {
			// Velocidad base
			const isSprinting = Keyboard.shared.isDown("ShiftLeft");
			const actualSpeed = isSprinting ? RUN_SPEED : PLAYER_SPEED;

			inputX = (inputX / len) * actualSpeed;
			inputZ = (inputZ / len) * actualSpeed;
		}

		// 4. ROTACIÓN DE INPUTS (La Magia)
		// Convertimos el ángulo de la cámara a radianes
		// Restamos 180 porque tu cámara "mira hacia atrás" por defecto en tu setup inicial
		const cameraAngleRad = (cameraControl.angles.y - 180) * (Math.PI / 180);

		// Aplicamos rotación 2D al vector de movimiento
		// dx = x * cos - z * sin
		// dz = x * sin + z * cos
		// Nota: En 3D a veces Z es invertido, probá cambiar signos si va al revés.
		const rotatedDx = inputX * Math.cos(cameraAngleRad) + inputZ * Math.sin(cameraAngleRad);
		const rotatedDz = -inputX * Math.sin(cameraAngleRad) + inputZ * Math.cos(cameraAngleRad);

		// 5. Aplicar al cuerpo físico
		const currentVel = this.playerBody.linvel();
		let dy = currentVel.y;

		if (Keyboard.shared.justPressed("Space") && Math.abs(dy) < 0.1) {
			dy = JUMP_FORCE;
		}

		this.playerBody.setLinvel({ x: rotatedDx, y: dy, z: rotatedDz }, true);
	}

	private updateCamera(playerPos: { x: number; y: number; z: number }): void {
		// Calculamos X: Si followX es true, usa la pos del player + offset. Si no, usa el valor fijo.
		const targetX = this.cameraFollowConfig.followX ? playerPos.x + this.cameraFollowConfig.offsetX : this.cameraFollowConfig.fixedX;

		// Calculamos Z: Lo mismo para Z
		const targetZ = this.cameraFollowConfig.followZ ? playerPos.z + this.cameraFollowConfig.offsetZ : this.cameraFollowConfig.fixedZ;

		// Asignamos el target (Y se mantiene constante en 2 por ahora)
		cameraControl.target = { x: targetX, y: 2, z: targetZ };
	}

	private drawShadow(_pos: { x: number; y: number; z: number }): void {
		this.debugGraphics.clear();
	}
}
