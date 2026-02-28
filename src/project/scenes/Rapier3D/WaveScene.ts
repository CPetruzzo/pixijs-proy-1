import { EnviromentalLights } from "./../3dgame/Lights/EnviromentalLights";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
// AÑADIDOS: MeshGeometry3D, StandardMaterial, Color
import { Mesh3D, Light, LightType, LightingEnvironment, MeshGeometry3D, StandardMaterial, Color } from "pixi3d/pixi7";
// AÑADIDO: Buffer de pixi.js
import { Buffer, Graphics } from "pixi.js";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import { Keyboard } from "../../../engine/input/Keyboard";
import { cameraControl } from "../../../index";

// Ajustes de Jugabilidad
const PLAYER_SPEED = 10;
const JUMP_FORCE = 8;
const CAMERA_OFFSET_Y = 5;
const CAMERA_LERP = 0.1;

export class WaveScene extends PixiScene {
	public static readonly BUNDLES = ["3dshooter", "package-1", "musicShooter", "sfx"];

	private world: World;
	private playerBody: RigidBody;
	private playerMesh: Mesh3D;
	private groundMesh: Mesh3D;
	private debugGraphics: Graphics;

	private aimControl: any;

	// --- VARIABLES PARA EL AGUA ---
	private waterMesh: Mesh3D;
	private time: number = 0;
	private positionsArray: Float32Array;
	private positionsBuffer: Buffer;

	// Configuración de las olas
	private readonly WAVE_SPEED = 0.002;
	private readonly WAVE_HEIGHT = 0.8;
	private readonly WAVE_FREQUENCY = 0.5;
	private readonly GRID_RESOLUTION = 40; // Reducido temporalmente para debugging

	constructor() {
		super();
		console.log("Scene init");

		// --- 1. AMBIENTE (Nuevo Océano Dinámico) ---

		// Material del agua
		const waterMaterial = new StandardMaterial();
		waterMaterial.roughness = 0.1;
		waterMaterial.doubleSided = true;
		waterMaterial.unlit = true;
		waterMaterial.baseColor = new Color(0, 0.5, 1, 1);
		waterMaterial.exposure = 3.0;

		// Generamos la malla
		const { pos, norm, ind, uv } = this.generateMeshData(this.GRID_RESOLUTION);
		this.positionsArray = pos;

		// Crear Buffers
		this.positionsBuffer = new Buffer(pos as any, false, false);
		const normalsBuffer = new Buffer(norm as any, false, false);
		const uvBuffer = new Buffer(uv as any, false, false);

		// SOLUCIÓN DEFINITIVA: Crear el buffer y forzar múltiples propiedades
		const indexBuffer = new Buffer(ind as any, false, true);

		// Forzar propiedades internas del buffer que PixiJS usa para determinar el tipo
		(indexBuffer as any).data = ind; // Mantener el Uint16Array
		(indexBuffer as any).type = 5123; // UNSIGNED_SHORT
		(indexBuffer as any)._type = 5123; // Por si usa _type internamente

		// Crear geometría
		const geometry = new MeshGeometry3D();
		geometry.positions = { buffer: this.positionsBuffer as any, componentCount: 3 };
		geometry.normals = { buffer: normalsBuffer as any, componentCount: 3 };
		geometry.uvs = [{ buffer: uvBuffer as any, componentCount: 2 }];

		// Crear el objeto indices con TODAS las propiedades posibles
		const indicesDescriptor: any = {
			buffer: indexBuffer,
			componentCount: 1,
			componentType: 5123, // UNSIGNED_SHORT
			type: 5123,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			_type: 5123,
			normalized: false,
		};

		geometry.indices = indicesDescriptor;

		// Triple verificación: forzar en geometry.indices también
		(geometry.indices as any).componentType = 5123;
		(geometry.indices as any).type = 5123;

		this.waterMesh = new Mesh3D(geometry, waterMaterial);
		this.waterMesh.scale.set(500, 1, 500);
		this.waterMesh.y = -4;

		// PARCHE POST-CREACIÓN: Forzar el tipo después de que Mesh3D procese la geometría
		// Este timing es crítico - debe hacerse DESPUÉS de crear el Mesh3D
		const patchIndexType = (): void => {
			try {
				// Intentar acceder a todas las propiedades internas posibles
				const geom: any = this.waterMesh.geometry;
				const indices: any = geom?.indices;

				if (indices) {
					// Forzar TODAS las propiedades de tipo posibles
					indices.componentType = 5123;
					indices.type = 5123;
					if (indices._componentType !== undefined) {
						indices._componentType = 5123;
					}
					if (indices._type !== undefined) {
						indices._type = 5123;
					}

					// Si hay un buffer interno
					if (indices.buffer) {
						indices.buffer.type = 5123;
						if (indices.buffer._type !== undefined) {
							indices.buffer._type = 5123;
						}
						// Asegurar que los datos sean Uint16Array
						if (!(indices.buffer.data instanceof Uint16Array)) {
							console.warn("Buffer data was not Uint16Array! Converting...");
							indices.buffer.data = ind;
						}
					}
				}

				// También parchear en el nivel de geometría
				if (geom?.indexBuffer) {
					geom.indexBuffer.type = 5123;
					if (geom.indexBuffer._type !== undefined) {
						geom.indexBuffer._type = 5123;
					}
				}

				if (geom?._indexBuffer) {
					geom._indexBuffer.type = 5123;
					if (geom._indexBuffer._type !== undefined) {
						geom._indexBuffer._type = 5123;
					}
				}

				console.log("✓ Index type patched successfully");
			} catch (e) {
				console.error("Failed to patch index type:", e);
			}
		};

		// Aplicar el parche inmediatamente y también en el próximo frame
		patchIndexType();
		setTimeout(patchIndexType, 0);
		requestAnimationFrame(patchIndexType);

		this.addChild(this.waterMesh);

		// --- CONFIGURACIÓN DE CÁMARA ---
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
		this.groundMesh = Mesh3D.createPlane();
		this.groundMesh.scale.set(40, 1, 40);
		this.groundMesh.y = -5;
		this.addChild(this.groundMesh);

		const groundThickness = 1;
		const groundColliderDesc = ColliderDesc.cuboid(40, groundThickness / 2, 40);
		const groundBodyDesc = RigidBodyDesc.fixed().setTranslation(0, -5.5, 0);
		const groundBody = this.world.createRigidBody(groundBodyDesc);
		this.world.createCollider(groundColliderDesc, groundBody);

		// --- 4. JUGADOR ---
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

	// Generador de datos de la malla
	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	private generateMeshData(res: number) {
		const totalVertices = (res + 1) * (res + 1);
		const pos = new Float32Array(totalVertices * 3);
		const norm = new Float32Array(totalVertices * 3);
		const uv = new Float32Array(totalVertices * 2);

		// IMPORTANTE: Usar Uint16Array para soportar hasta 65535 vértices
		// Si necesitas más, tendrías que usar Uint32Array y configurar WebGL2
		const ind = new Uint16Array(res * res * 6);

		let v = 0;
		for (let z = 0; z <= res; z++) {
			for (let x = 0; x <= res; x++) {
				const i = v * 3;
				pos[i] = x / res - 0.5;
				pos[i + 1] = 0;
				pos[i + 2] = z / res - 0.5;

				// Normales hacia arriba
				norm[i] = 0;
				norm[i + 1] = 1;
				norm[i + 2] = 0;

				uv[v * 2] = x / res;
				uv[v * 2 + 1] = z / res;
				v++;
			}
		}

		let i = 0;
		for (let z = 0; z < res; z++) {
			for (let x = 0; x < res; x++) {
				const r1 = z * (res + 1);
				const r2 = (z + 1) * (res + 1);
				ind[i++] = r1 + x;
				ind[i++] = r1 + x + 1;
				ind[i++] = r2 + x;
				ind[i++] = r1 + x + 1;
				ind[i++] = r2 + x + 1;
				ind[i++] = r2 + x;
			}
		}
		return { pos, norm, ind, uv };
	}

	public override update(delta: number): void {
		const deltaSec = delta / 1000;

		// 1. Lógica del Jugador y Física
		this.handlePlayerInput(deltaSec);
		this.world.step();

		const t = this.playerBody.translation();
		this.playerMesh.position.set(t.x, t.y, t.z);

		// Cámara Follow
		const currentTarget = this.aimControl.target;
		currentTarget.x += (t.x - currentTarget.x) * CAMERA_LERP;
		currentTarget.y += (t.y + CAMERA_OFFSET_Y - currentTarget.y) * CAMERA_LERP;
		currentTarget.z += (t.z - currentTarget.z) * CAMERA_LERP;

		this.debugGraphics.clear();
		this.debugGraphics.lineStyle(2, 0xff0000);
		this.debugGraphics.drawCircle(t.x, t.z, 0.5);

		// 2. Lógica del AGUA (Animación)
		this.time += delta * this.WAVE_SPEED;

		for (let i = 0; i < this.positionsArray.length; i += 3) {
			const x = this.positionsArray[i];
			const z = this.positionsArray[i + 2];

			const wave = Math.sin(x * this.WAVE_FREQUENCY + this.time) + Math.cos(z * this.WAVE_FREQUENCY + this.time);

			this.positionsArray[i + 1] = wave * this.WAVE_HEIGHT;
		}

		this.positionsBuffer.update(this.positionsArray as any);
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
