import { EnviromentalLights } from "./../3dgame/Lights/EnviromentalLights";
// PlayerControllerScene.ts
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Light, LightType, LightingEnvironment, Model } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
// Importamos el objeto global de cámara (asegurate de que esté exportado desde tu módulo principal)
import { aimControl } from "../../../index";
import { Assets, Graphics } from "pixi.js";

// Constantes de configuración
const PLAYER_SPEED = 5; // velocidad del jugador (unidades/seg)
const CAMERA_OFFSET_Y = 5; // altura de la cámara respecto al jugador
const CAMERA_LERP_SPEED = 0.1;

export class PlayerControllerScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx"];

	// Mundo físico
	private world: World;
	// Rigid body y Mesh3D visual del jugador
	private playerBody: RigidBody;
	private playerMesh: Mesh3D;
	// Suelo visual y rampa visual
	private groundMesh: Mesh3D;
	// Debug graphics para ver la posición del jugador (opcional)
	private debugGraphics: Graphics;
	// Gravedad (usada para crear el mundo)
	private gravity: { x: number; y: number; z: number };

	// Referencia al cameraControl
	private aimControl: any;
	// Para suavizar la interpolación del target de la cámara
	private lastCameraPosition = { x: 0, y: 0, z: 0 };

	constructor() {
		super();
		console.log("Scene init");

		const sphere = Model.from(Assets.get("ocean"));
		sphere.position.set(-100, 0, -100);
		sphere.scale.set(50, 50, 50);
		this.addChild(sphere);

		// Configuramos el cameraControl (asegurate de que esté correctamente inicializado)
		this.aimControl = aimControl;
		this.aimControl.distance = 50;
		// Inicialmente, el target será (0, CAMERA_OFFSET_Y, 0)
		this.aimControl.target = { x: 0, y: CAMERA_OFFSET_Y, z: 0 };
		this.lastCameraPosition = { ...this.aimControl.target };

		// Agregar una luz direccional para iluminar la escena
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 1;
		dirLight.rotationQuaternion.setEulerAngles(45, 45, 0);
		LightingEnvironment.main.lights.push(dirLight);

		const lights = new EnviromentalLights();
		console.log("lights", lights);

		// --- Crear mundo físico (Rapier3D) ---
		this.gravity = { x: 0, y: -9.81, z: 0 };
		this.world = new World(this.gravity);

		// --- Crear objetos visuales con Pixi3D ---
		// Suelo visual (un plano)
		this.groundMesh = Mesh3D.createPlane();
		this.groundMesh.scale.set(40, 1, 40);
		this.groundMesh.y = -80;

		this.addChild(this.groundMesh);
		// Crear colisionador para el suelo (estático)
		const groundColliderDesc = ColliderDesc.cuboid(40, 0.5, 40).setRestitution(0.1);
		this.world.createCollider(groundColliderDesc);

		// --- Crear el jugador ---
		// Usamos un collider en forma de cápsula para el jugador.
		const capsuleRadius = 0.5;
		// En este ejemplo usamos ColliderDesc.capsule; revisá la documentación de Rapier para tu versión.
		const playerColliderDesc = ColliderDesc.capsule(1, capsuleRadius);
		const playerRigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(0, 1, 0);
		// Amortiguación para evitar movimientos residuales
		playerRigidBodyDesc.linearDamping = 0.9;
		playerRigidBodyDesc.angularDamping = 0.9;
		this.playerBody = this.world.createRigidBody(playerRigidBodyDesc);
		// Si se puede, establecer fricción alta
		// if (playerColliderDesc.setFriction) {
		// 			playerColliderDesc.setFriction(1.0);
		// 	}
		this.world.createCollider(playerColliderDesc, this.playerBody);

		// Para visualizar al jugador, usamos un cubo (idealmente, usar un modelo de cápsula)
		this.playerMesh = Mesh3D.createCube();
		this.playerMesh.scale.set(1, 2.5, 1);
		this.addChild(this.playerMesh);

		// --- Debug Graphics ---
		this.debugGraphics = new Graphics();
		this.addChild(this.debugGraphics);
		console.log("Scene init end");
	}

	public override update(delta: number): void {
		const deltaSec = delta / 1000;
		// Manejar entrada
		this.handlePlayerInput(deltaSec);
		// Avanzar la simulación física
		this.world.step();
		// Sincronizar la posición visual con el rigid body
		const translation = this.playerBody.translation();
		this.playerMesh.position.set(translation.x, translation.y, translation.z);
		// Actualizar la cámara para que siga al jugador (con offset)
		this.aimControl.target.x = translation.x;
		this.aimControl.target.y = translation.y + CAMERA_OFFSET_Y;
		this.aimControl.target.z = translation.z;
		// (Opcional) Interpolación suave:
		this.aimControl.target.x = this.lastCameraPosition.x + (this.aimControl.target.x - this.lastCameraPosition.x) * CAMERA_LERP_SPEED;
		this.aimControl.target.y = this.lastCameraPosition.y + (this.aimControl.target.y - this.lastCameraPosition.y) * CAMERA_LERP_SPEED;
		this.aimControl.target.z = this.lastCameraPosition.z + (this.aimControl.target.z - this.lastCameraPosition.z) * CAMERA_LERP_SPEED;
		this.lastCameraPosition = { ...this.aimControl.target };

		// (Opcional) Dibujar debug
		this.debugGraphics.clear();
		this.debugGraphics.lineStyle(2, 0xff0000, 1);
		this.debugGraphics.drawCircle(translation.x, translation.y, 0.5);
	}

	private handlePlayerInput(_deltaSec: number): void {
		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.aimControl.angles.y += 1;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			this.aimControl.angles.y -= 1;
		}

		const angleYRad = this.aimControl.angles.y * (Math.PI / 180);

		// Corregimos los ejes para que avanzar sea en el sentido correcto
		const moveX = PLAYER_SPEED * Math.cos(angleYRad) * _deltaSec;
		const moveZ = PLAYER_SPEED * Math.sin(angleYRad) * _deltaSec;

		if (Keyboard.shared.isDown("KeyA")) {
			this.aimControl.target.x -= moveX;
			this.aimControl.target.z += moveZ;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			this.aimControl.target.x += moveX;
			this.aimControl.target.z -= moveZ;
		}
		if (Keyboard.shared.isDown("KeyW")) {
			this.aimControl.target.x += moveZ;
			this.aimControl.target.z += moveX;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			this.aimControl.target.x -= moveZ;
			this.aimControl.target.z -= moveX;
		}
		if (Keyboard.shared.justPressed("Space")) {
			this.playerBody.applyImpulse({ x: 0, y: -10 * this.gravity.y, z: 0 }, false);
		}

		// Mantener la velocidad vertical actual del jugador
		const currentVel = this.playerBody.linvel();

		// Establecer la nueva velocidad lateral en el rigid body
		this.playerBody.setLinvel(
			{
				x: (this.aimControl.target.x - this.playerBody.translation().x) * PLAYER_SPEED,
				y: currentVel.y,
				z: (this.aimControl.target.z - this.playerBody.translation().z) * PLAYER_SPEED,
			},
			false
		);
	}
}
