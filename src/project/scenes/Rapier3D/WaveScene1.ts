import { EnviromentalLights } from "./../3dgame/Lights/EnviromentalLights";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Light, LightType, LightingEnvironment, StandardMaterial, Color, MeshGeometry3D, Model } from "pixi3d/pixi7";
import { Assets, Graphics } from "pixi.js";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl } from "../../../index";

const PLAYER_SPEED = 10;
const JUMP_FORCE = 8;
const CAMERA_OFFSET_Y = 5;
const GRID_SIZE = 100;
const GRID_SPACING = 2;

export class WaveScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx"];

	private world: World;
	private playerBody: RigidBody;
	private playerMesh: Mesh3D;
	private groundMesh: Mesh3D;
	private debugGraphics: Graphics;
	private aimControl: any;

	private waterMesh: Mesh3D;
	private waterMaterial: StandardMaterial;
	private time: number = 0;

	// Guardar los datos de la geometría original
	private waterIndices: Uint16Array;
	private waterUvs: Float32Array;
	private waterPositions: Float32Array;

	private readonly WAVE_SPEED = 1;
	private readonly WAVE_HEIGHT = 0.3;

	constructor() {
		super();
		console.log("Scene init - Simple Water Version");
		// --- 1. AMBIENTE (Océano y Luces) ---
		const sphere = Model.from(Assets.get("ocean"));
		// CORRECCIÓN: Bajamos el océano a -60 para que no tape el suelo ni los pies
		sphere.position.set(-200, 30, -130);
		sphere.scale.set(80, 80, 80);
		this.addChild(sphere);

		// Material del agua
		this.waterMaterial = new StandardMaterial();
		this.waterMaterial.roughness = 0.2;
		this.waterMaterial.metallic = 0.8;
		this.waterMaterial.doubleSided = true;
		this.waterMaterial.baseColor = new Color(0, 0.6, 0.9, 0.95);
		this.waterMaterial.exposure = 2.0;

		const positions: number[] = [];
		const indices: number[] = [];
		const uvs: number[] = [];

		// Generar los puntos del grid
		for (let z = 0; z <= GRID_SIZE; z++) {
			for (let x = 0; x <= GRID_SIZE; x++) {
				positions.push(x * GRID_SPACING, 0, z * GRID_SPACING);
				uvs.push(x / GRID_SIZE, z / GRID_SIZE);
			}
		}

		// Conectar los puntos con triángulos
		for (let z = 0; z < GRID_SIZE; z++) {
			for (let x = 0; x < GRID_SIZE; x++) {
				const row1 = z * (GRID_SIZE + 1);
				const row2 = (z + 1) * (GRID_SIZE + 1);

				indices.push(row1 + x, row1 + x + 1, row2 + x);
				indices.push(row1 + x + 1, row2 + x + 1, row2 + x);
			}
		}

		// Guardar copias de los arrays
		this.waterPositions = new Float32Array(positions);
		this.waterIndices = new Uint16Array(indices);
		this.waterUvs = new Float32Array(uvs);

		// Crear el mesh inicial
		this.createWaterMesh();

		// Configuración de cámara
		this.aimControl = cameraControl;
		this.aimControl.distance = 20;
		this.aimControl.angles.x = 20;

		// Luces
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 1.2;
		dirLight.rotationQuaternion.setEulerAngles(45, 45, 0);
		LightingEnvironment.main.lights.push(dirLight);
		new EnviromentalLights();

		// Mundo físico
		this.world = new World({ x: 0, y: -9.81, z: 0 });

		// Suelo
		this.groundMesh = Mesh3D.createPlane();
		this.groundMesh.scale.set(40, 1, 40);
		this.groundMesh.y = -5;
		this.addChild(this.groundMesh);

		const groundThickness = 1;
		const groundColliderDesc = ColliderDesc.cuboid(40, groundThickness / 2, 40);
		const groundBodyDesc = RigidBodyDesc.fixed().setTranslation(0, -5.5, 0);
		const groundBody = this.world.createRigidBody(groundBodyDesc);
		this.world.createCollider(groundColliderDesc, groundBody);

		// Jugador
		const capsuleHeight = 1;
		const capsuleRadius = 2;

		const playerRigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(0, 0, 0).setLinearDamping(0.5);
		playerRigidBodyDesc.lockRotations();
		this.playerBody = this.world.createRigidBody(playerRigidBodyDesc);
		this.playerBody.setEnabledRotations(false, true, false, true);

		const playerColliderDesc = ColliderDesc.capsule(capsuleHeight / 2, capsuleRadius);
		playerColliderDesc.setFriction(0);
		playerColliderDesc.setRestitution(0);
		this.world.createCollider(playerColliderDesc, this.playerBody);

		this.playerMesh = Mesh3D.createCube();
		this.playerMesh.scale.set(1, 2, 1);
		this.addChild(this.playerMesh);

		this.debugGraphics = new Graphics();
		this.addChild(this.debugGraphics);
	}

	private createWaterMesh(): void {
		if (this.waterMesh) {
			this.removeChild(this.waterMesh);
			this.waterMesh.destroy();
		}

		const geometry = new MeshGeometry3D();
		geometry.positions = {
			buffer: new Float32Array(this.waterPositions),
		};
		geometry.indices = {
			buffer: new Uint16Array(this.waterIndices),
		};
		geometry.uvs = [
			{
				buffer: new Float32Array(this.waterUvs),
			},
		];

		this.waterMesh = new Mesh3D(geometry, this.waterMaterial);
		this.waterMesh.position.set(-(GRID_SIZE * GRID_SPACING) / 2, -6, -(GRID_SIZE * GRID_SPACING) / 2);
		this.addChild(this.waterMesh);
	}

	public override update(delta: number): void {
		super.update(delta);
		const deltaSec = delta / 1000;
		this.time += deltaSec * this.WAVE_SPEED;

		// Actualizar las posiciones en el array original
		for (let i = 0; i < this.waterPositions.length; i += 3) {
			const x = this.waterPositions[i];
			const z = this.waterPositions[i + 2];

			this.waterPositions[i + 1] = Math.sin(x * 0.5 + this.time) * Math.cos(z * 0.3 + this.time) * this.WAVE_HEIGHT;
		}

		// Recrear el mesh con las nuevas posiciones
		this.createWaterMesh();

		this.world.step();
		this.handlePlayerInput(deltaSec);

		const playerPos = this.playerBody.translation();
		this.playerMesh.position.set(playerPos.x, playerPos.y, playerPos.z);

		this.aimControl.target.x = playerPos.x;
		this.aimControl.target.y = playerPos.y + CAMERA_OFFSET_Y;
		this.aimControl.target.z = playerPos.z;
	}

	private handlePlayerInput(_deltaSec: number): void {
		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.aimControl.angles.y += 1;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			this.aimControl.angles.y -= 1;
		}

		let dirX = 0;
		let dirZ = 0;

		if (Keyboard.shared.isDown("KeyW")) {
			dirZ -= 1;
		}
		if (Keyboard.shared.isDown("KeyS")) {
			dirZ += 1;
		}
		if (Keyboard.shared.isDown("KeyA")) {
			dirX -= 1;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			dirX += 1;
		}

		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
		const cameraRad = (this.aimControl.angles.y + 180) * (Math.PI / 180);
		const sin = Math.sin(cameraRad);
		const cos = Math.cos(cameraRad);

		const forwardX = sin;
		const forwardZ = cos;
		const rightX = cos;
		const rightZ = -sin;

		let velX = forwardX * dirZ + rightX * dirX;
		let velZ = forwardZ * dirZ + rightZ * dirX;

		const length = Math.sqrt(velX * velX + velZ * velZ);
		if (length > 0.01) {
			velX = (velX / length) * PLAYER_SPEED;
			velZ = (velZ / length) * PLAYER_SPEED;
		} else {
			velX = 0;
			velZ = 0;
		}

		const currentLinVel = this.playerBody.linvel();
		let velY = currentLinVel.y;

		if (Keyboard.shared.justPressed("Space") && Math.abs(velY) < 0.2) {
			velY = JUMP_FORCE;
		}

		this.playerBody.setLinvel({ x: velX, y: velY, z: velZ }, true);
	}
}
