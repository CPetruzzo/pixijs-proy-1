import { EnviromentalLights } from "./../3dgame/Lights/EnviromentalLights";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Light, LightType, LightingEnvironment, Model } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl } from "../../../index";
import { Assets, Graphics } from "pixi.js";

// Ajustes de Jugabilidad
const PLAYER_SPEED = 10;
const JUMP_FORCE = 8; // Un poco más de fuerza para que se sienta bien
const CAMERA_OFFSET_Y = 5;
const CAMERA_LERP = 0.1;

export class PlayerControllerScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx"];

	private world: World;
	private playerBody: RigidBody;
	private playerMesh: Mesh3D;
	private groundMesh: Mesh3D;
	private debugGraphics: Graphics;

	private aimControl: any;
	// private currentRotationY: number = 0;

	constructor() {
		super();
		console.log("Scene init");

		// --- 1. AMBIENTE (Océano y Luces) ---
		const sphere = Model.from(Assets.get("ocean"));
		// CORRECCIÓN: Bajamos el océano a -60 para que no tape el suelo ni los pies
		sphere.position.set(-100, -60, -100);
		sphere.scale.set(50, 50, 50);
		this.addChild(sphere);

		// Configuración Cámara
		this.aimControl = cameraControl;
		this.aimControl.distance = 20;
		this.aimControl.angles.x = 20;

		// Luces
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 1;
		dirLight.rotationQuaternion.setEulerAngles(45, 45, 0);
		LightingEnvironment.main.lights.push(dirLight);
		new EnviromentalLights();

		// --- 2. MUNDO FÍSICO ---
		this.world = new World({ x: 0, y: -9.81, z: 0 });

		// --- 3. SUELO ---
		// Suelo Visual
		this.groundMesh = Mesh3D.createPlane();
		this.groundMesh.scale.set(40, 1, 40);
		this.groundMesh.y = -5;
		this.addChild(this.groundMesh);

		// Suelo Físico (Collider)
		const groundThickness = 1; // Hacemos el suelo físico un poco más grueso hacia abajo
		const groundColliderDesc = ColliderDesc.cuboid(40, groundThickness / 2, 40);
		// Posicionamos el cuerpo:
		// Si la superficie visual está en -5, y el grosor es 1 (mitad 0.5):
		// El centro del cuerpo debe estar en -5.5 para que la cara superior esté en -5.0
		const groundBodyDesc = RigidBodyDesc.fixed().setTranslation(0, -5.5, 0);
		const groundBody = this.world.createRigidBody(groundBodyDesc);
		this.world.createCollider(groundColliderDesc, groundBody);

		// --- 4. JUGADOR ---
		const capsuleHeight = 1; // Altura del cilindro interior
		const capsuleRadius = 2; // Radio de las tapas
		// Altura total visual esperada = 1 + (0.5 * 2) = 2 metros.

		// Cuerpo dinámico
		// Empezamos en Y=0 (5 metros sobre el suelo) para caer
		const playerRigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(0, 0, 0).setLinearDamping(0.5);

		playerRigidBodyDesc.lockRotations(); // Evita que ruede
		this.playerBody = this.world.createRigidBody(playerRigidBodyDesc);
		this.playerBody.setEnabledRotations(false, true, false, true); // Bloqueo extra de seguridad

		// Collider Cápsula
		const playerColliderDesc = ColliderDesc.capsule(capsuleHeight / 2, capsuleRadius);
		playerColliderDesc.setFriction(0);
		playerColliderDesc.setRestitution(0);
		this.world.createCollider(playerColliderDesc, this.playerBody);

		// Mesh visual del jugador
		this.playerMesh = Mesh3D.createCube();
		this.playerMesh.scale.set(1, 2, 1); // Escala Visual: 2 metros de alto
		this.addChild(this.playerMesh);

		this.debugGraphics = new Graphics();
		this.addChild(this.debugGraphics);
	}

	public override update(delta: number): void {
		const deltaSec = delta / 1000;

		this.handlePlayerInput(deltaSec);
		this.world.step();

		// Sincronización
		const t = this.playerBody.translation();

		// Ajuste visual: Si sientes que sigue enterrado, puedes sumar un pequeño offset aquí
		// Por ejemplo: t.y + 0.05, pero matemáticamente ya deberían coincidir.
		this.playerMesh.position.set(t.x, t.y, t.z);

		// Cámara Follow
		const currentTarget = this.aimControl.target;
		currentTarget.x += (t.x - currentTarget.x) * CAMERA_LERP;
		currentTarget.y += (t.y + CAMERA_OFFSET_Y - currentTarget.y) * CAMERA_LERP;
		currentTarget.z += (t.z - currentTarget.z) * CAMERA_LERP;

		// Debug visual (círculo rojo en los pies)
		this.debugGraphics.clear();
		this.debugGraphics.lineStyle(2, 0xff0000);
		this.debugGraphics.drawCircle(t.x, t.z, 0.5);
	}

	private handlePlayerInput(_deltaSec: number): void {
		// Rotación de cámara
		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.aimControl.angles.y += 1;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			this.aimControl.angles.y -= 1;
		}

		let dirX = 0;
		let dirZ = 0;

		// --- TU LÓGICA INVERTIDA ---
		if (Keyboard.shared.isDown("KeyW")) {
			dirZ -= 1; // Adelante (Z negativo es "hacia el fondo" en Pixi3D estándar)
		}
		if (Keyboard.shared.isDown("KeyS")) {
			dirZ += 1; // Atrás
		}
		if (Keyboard.shared.isDown("KeyA")) {
			dirX -= 1; // Izquierda
		}
		if (Keyboard.shared.isDown("KeyD")) {
			dirX += 1; // Derecha
		}

		// Cálculo de vectores relativo a la cámara
		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
		const cameraRad = (this.aimControl.angles.y + 180) * (Math.PI / 180);
		const sin = Math.sin(cameraRad);
		const cos = Math.cos(cameraRad);

		// Vectores base
		const forwardX = sin;
		const forwardZ = cos;
		const rightX = cos;
		const rightZ = -sin;

		// Composición final
		let velX = forwardX * dirZ + rightX * dirX;
		let velZ = forwardZ * dirZ + rightZ * dirX;

		// Normalizar diagonal
		const length = Math.sqrt(velX * velX + velZ * velZ);
		if (length > 0.01) {
			velX = (velX / length) * PLAYER_SPEED;
			velZ = (velZ / length) * PLAYER_SPEED;
		} else {
			velX = 0;
			velZ = 0;
		}

		// Salto
		const currentLinVel = this.playerBody.linvel();
		let velY = currentLinVel.y;

		// Pequeña tolerancia para detectar suelo (0.1)
		if (Keyboard.shared.justPressed("Space") && Math.abs(velY) < 0.2) {
			velY = JUMP_FORCE;
		}

		this.playerBody.setLinvel({ x: velX, y: velY, z: velZ }, true);
	}
}
