import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D, Light, LightType, LightingEnvironment, StandardMaterial, Color } from "pixi3d/pixi7";
import { RigidBodyDesc, ColliderDesc, World } from "@dimforge/rapier3d";
import type { RigidBody } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl } from "../../../index";

// --- ESCALA MICROSCÓPICA (Para que el mundo se vea gigante) ---
const FLIGHT_SPEED = 15; // Reducido para que el mundo se sienta grande al recorrerlo
const VERTICAL_SPEED = 12;
const CAMERA_LERP = 0.1;
const UNIVERSE_SIZE = 1500;
const STAR_COUNT = 500;

export class SpaceNavigationScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1"];

	private world: World;
	private playerBody: RigidBody;
	private playerMesh: Mesh3D;
	private aimControl: any;
	private isNavigating: boolean = false;

	constructor() {
		super();

		this.aimControl = cameraControl;
		// La distancia de la cámara ahora es diminuta
		this.aimControl.distance = 1.5;
		this.aimControl.angles.x = 15;

		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 2;
		dirLight.rotationQuaternion.setEulerAngles(45, 30, 0);
		LightingEnvironment.main.lights.push(dirLight);

		this.world = new World({ x: 0, y: 0, z: 0 });

		this.createStars();

		// --- PLANETAS "GIGANTES" (Pero con pocos bloques) ---
		// Un radio de 20 para una nave de 0.1 es como una ciudad entera
		this.createOptimizedPlanet(100, 20, -150, 18, 0x44ff44); // Planeta Verde
		this.createOptimizedPlanet(-150, -30, -50, 22, 0x4444ff); // Planeta Azul
		this.createOptimizedPlanet(50, -80, 200, 15, 0xffaa00); // Planeta Naranja

		// --- JUGADOR MINIATURA ---
		// El secreto: Una escala de 0.1 en lugar de 1.0
		const playerRigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(0, 5, 0).setLinearDamping(0.8);

		playerRigidBodyDesc.lockRotations();
		this.playerBody = this.world.createRigidBody(playerRigidBodyDesc);

		// El colisionador ahora mide apenas 0.1 unidades
		const playerColliderDesc = ColliderDesc.cuboid(0.05, 0.03, 0.08);
		this.world.createCollider(playerColliderDesc, this.playerBody);

		this.playerMesh = Mesh3D.createCube();
		// Visualmente diminuta
		this.playerMesh.scale.set(0.1, 0.06, 0.2);
		const shipMaterial = new StandardMaterial();
		shipMaterial.baseColor = new Color(0.8, 0.8, 1.0);
		this.playerMesh.material = shipMaterial;
		this.addChild(this.playerMesh);
	}

	private createStars(): void {
		const starMaterial = new StandardMaterial();
		starMaterial.baseColor = new Color(1, 1, 1);
		for (let i = 0; i < STAR_COUNT; i++) {
			const star = Mesh3D.createCube();
			// Estrellas también más pequeñas
			const scale = 0.05 + Math.random() * 0.1;
			star.scale.set(scale);
			star.material = starMaterial;
			star.position.set((Math.random() - 0.5) * UNIVERSE_SIZE, (Math.random() - 0.5) * UNIVERSE_SIZE, (Math.random() - 0.5) * UNIVERSE_SIZE);
			this.addChild(star);
		}
	}

	/**
	 * Crea un planeta que se ve gigante para el player mini
	 * Optimizado: Hueco por dentro y un solo colisionador esférico.
	 */
	private createOptimizedPlanet(x: number, y: number, z: number, radius: number, color: number): void {
		const planetMaterial = new StandardMaterial();
		planetMaterial.baseColor = Color.fromHex(color);

		// Visual: Solo creamos la superficie (capa exterior)
		for (let ix = -radius; ix <= radius; ix++) {
			for (let iy = -radius; iy <= radius; iy++) {
				for (let iz = -radius; iz <= radius; iz++) {
					const distance = Math.sqrt(ix * ix + iy * iy + iz * iz);

					// Solo dibujamos si es la corteza (evita miles de cubos internos)
					if (distance <= radius && distance > radius - 1.1) {
						const block = Mesh3D.createCube();
						block.material = planetMaterial;
						block.position.set(x + ix, y + iy, z + iz);
						block.scale.set(0.48);
						this.addChild(block);
					}
				}
			}
		}

		// Física: Un único colisionador esférico para todo el planeta
		const planetBodyDesc = RigidBodyDesc.fixed().setTranslation(x, y, z);
		const planetBody = this.world.createRigidBody(planetBodyDesc);
		const planetColliderDesc = ColliderDesc.ball(radius);
		this.world.createCollider(planetColliderDesc, planetBody);
	}

	public override update(_delta: number): void {
		this.handlePlayerInput();
		this.world.step();

		const t = this.playerBody.translation();
		this.playerMesh.position.set(t.x, t.y, t.z);
		this.playerMesh.rotationQuaternion.setEulerAngles(0, this.aimControl.angles.y, 0);

		const currentTarget = this.aimControl.target;
		currentTarget.x += (t.x - currentTarget.x) * CAMERA_LERP;
		currentTarget.y += (t.y - currentTarget.y) * CAMERA_LERP;
		currentTarget.z += (t.z - currentTarget.z) * CAMERA_LERP;
	}

	private handlePlayerInput(): void {
		if (Keyboard.shared.justPressed("KeyN")) {
			this.isNavigating = !this.isNavigating;
		}

		if (Keyboard.shared.isDown("ArrowLeft")) {
			this.aimControl.angles.y += 1.5;
		}
		if (Keyboard.shared.isDown("ArrowRight")) {
			this.aimControl.angles.y -= 1.5;
		}

		let dirX = 0;
		let dirZ = 0;
		if (this.isNavigating) {
			dirZ = -1;
		} else {
			if (Keyboard.shared.isDown("KeyW")) {
				dirZ -= 1;
			}
			if (Keyboard.shared.isDown("KeyS")) {
				dirZ += 1;
			}
		}
		if (Keyboard.shared.isDown("KeyA")) {
			dirX -= 1;
		}
		if (Keyboard.shared.isDown("KeyD")) {
			dirX += 1;
		}

		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
		const cameraRad = (this.aimControl.angles.y + 180) * (Math.PI / 180);
		let velX = Math.sin(cameraRad) * dirZ + Math.cos(cameraRad) * dirX;
		let velZ = Math.cos(cameraRad) * dirZ - Math.sin(cameraRad) * dirX;

		const length = Math.sqrt(velX * velX + velZ * velZ);
		if (length > 0.01) {
			velX = (velX / length) * FLIGHT_SPEED;
			velZ = (velZ / length) * FLIGHT_SPEED;
		} else if (!this.isNavigating) {
			const currentVel = this.playerBody.linvel();
			velX = currentVel.x;
			velZ = currentVel.z;
		}

		let velY = 0;
		const currentLinVel = this.playerBody.linvel();
		if (Keyboard.shared.isDown("Space")) {
			velY = VERTICAL_SPEED;
		} else if (Keyboard.shared.isDown("ShiftLeft")) {
			velY = -VERTICAL_SPEED;
		} else {
			velY = currentLinVel.y;
		}

		this.playerBody.setLinvel({ x: velX, y: velY, z: velZ }, true);
	}
}
