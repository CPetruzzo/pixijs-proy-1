/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import type { CameraOrbitControl } from "pixi3d/pixi7";
import { Mesh3D, StandardMaterial, Color, Light, LightType, LightingEnvironment, StandardMaterialAlphaMode } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc, Ray } from "@dimforge/rapier3d";
import { cameraControl } from "../../../index";
import { Keyboard } from "../../../engine/input/Keyboard";
import { PerlinNoise } from "../../../utils/PerlinNoise";

const CHUNK_SIZE = 32;
const WORLD_HEIGHT = 12;
const CAMERA_LERP = 0.1;
const DEBUG_SELECTION_CUBE = true;

enum BlockType {
	AIR = 0,
	GRASS = 1,
	DIRT = 2,
	STONE = 3,
	WOOD = 4,
	LEAVES = 5,
}

const BLOCK_COLORS: any = {
	[BlockType.GRASS]: 0x3a9d23,
	[BlockType.DIRT]: 0x8b4513,
	[BlockType.STONE]: 0x707070,
	[BlockType.WOOD]: 0x8e5a2a,
	[BlockType.LEAVES]: 0x2e7d32,
};

export class VoxelWorldScene extends PixiScene {
	private world: World;
	private blocks: Uint8Array;
	private wallHealth: Float32Array;
	private visualBlocks: Map<string, Mesh3D> = new Map();
	private physicsBlocks: Map<string, RigidBody> = new Map();
	private debris: { mesh: Mesh3D; vel: { x: number; y: number; z: number }; life: number }[] = [];

	private playerBody: RigidBody;
	private playerMesh: Mesh3D;
	private aimControl: CameraOrbitControl;
	private selectedMaterial: BlockType = BlockType.GRASS;
	private mouseX = 0;
	private mouseY = 0;
	private noise = new PerlinNoise(1337); // seed

	// NUEVO: Feedback visual
	private selectionCube: Mesh3D;

	constructor() {
		super();
		this.world = new World({ x: 0, y: -9.81, z: 0 });
		this.blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
		this.wallHealth = new Float32Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE).fill(100);
		this.aimControl = cameraControl;

		this.setupLights();
		this.setupCamera();
		this.generateTerrain();
		this.renderOptimizedChunk();
		this.createPlayer();
		this.createSelectionCube();

		window.addEventListener("pointerdown", (e) => {
			if (e.button === 0) {
				this.handleInteraction(true);
			}
			if (e.button === 2) {
				this.handleInteraction(false);
			}
		});
		window.addEventListener("contextmenu", (e) => e.preventDefault());

		window.addEventListener("pointermove", (e) => {
			this.mouseX = e.clientX;
			this.mouseY = e.clientY;
		});
	}

	private setBlock(x: number, y: number, z: number, type: BlockType) {
		if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
			return;
		}

		const idx = this.getIndex(x, y, z);
		this.blocks[idx] = type;
	}

	private generateTree(x: number, y: number, z: number) {
		const trunkHeight = 3 + Math.floor(Math.random() * 2);

		// Tronco
		for (let i = 1; i <= trunkHeight; i++) {
			this.setBlock(x, y + i, z, BlockType.WOOD);
		}

		// Hojas (copa simple cúbica)
		const top = y + trunkHeight;

		for (let lx = -2; lx <= 2; lx++) {
			for (let lz = -2; lz <= 2; lz++) {
				for (let ly = -2; ly <= 0; ly++) {
					const dist = Math.abs(lx) + Math.abs(lz);

					if (dist <= 3) {
						this.setBlock(x + lx, top + ly, z + lz, BlockType.LEAVES);
					}
				}
			}
		}
	}

	private setupLights() {
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 2;
		dirLight.rotationQuaternion.setEulerAngles(45, 30, 0);
		LightingEnvironment.main.lights.push(dirLight);
	}

	private setupCamera() {
		this.aimControl.distance = 12;
		this.aimControl.angles.x = 30;
	}

	private generateTerrain() {
		const baseHeight = 5;
		const heightScale = 5;
		const noiseScale = 0.08;

		for (let x = 0; x < CHUNK_SIZE; x++) {
			for (let z = 0; z < CHUNK_SIZE; z++) {
				const nx = x * noiseScale;
				const nz = z * noiseScale;

				const noise1 = this.noise.noise2D(nx, nz);
				const noise2 = this.noise.noise2D(nx * 2, nz * 2) * 0.5;
				const noise3 = this.noise.noise2D(nx * 4, nz * 4) * 0.25;

				const finalNoise = noise1 + noise2 + noise3;
				const normalized = (finalNoise + 1.75) / 3.5;

				const height = Math.floor(baseHeight + normalized * heightScale);

				for (let y = 0; y < WORLD_HEIGHT; y++) {
					const idx = this.getIndex(x, y, z);

					if (y > height) {
						this.blocks[idx] = BlockType.AIR;
					} else if (y === height) {
						this.blocks[idx] = BlockType.GRASS;
					} else if (y > height - 3) {
						this.blocks[idx] = BlockType.DIRT;
					} else {
						this.blocks[idx] = BlockType.STONE;
					}
				}

				// 5% probabilidad de árbol
				if (Math.random() < 0.01) {
					this.generateTree(x, height, z);
				}
			}
		}
	}

	private getIndex(x: number, y: number, z: number) {
		return x + y * CHUNK_SIZE + z * CHUNK_SIZE * WORLD_HEIGHT;
	}

	private getBlock(x: number, y: number, z: number): BlockType {
		if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
			return BlockType.AIR;
		}
		return this.blocks[this.getIndex(x, y, z)];
	}

	private renderOptimizedChunk() {
		for (let x = 0; x < CHUNK_SIZE; x++) {
			for (let y = 0; y < WORLD_HEIGHT; y++) {
				for (let z = 0; z < CHUNK_SIZE; z++) {
					this.updateBlockVisibility(x, y, z);
				}
			}
		}
	}

	private updateBlockVisibility(x: number, y: number, z: number) {
		const type = this.getBlock(x, y, z);
		const key = `${x},${y},${z}`;

		if (type === BlockType.AIR) {
			this.removeBlockFromScene(key);
			return;
		}

		const isExposed =
			this.getBlock(x, y + 1, z) === BlockType.AIR ||
			this.getBlock(x, y - 1, z) === BlockType.AIR ||
			this.getBlock(x + 1, y, z) === BlockType.AIR ||
			this.getBlock(x - 1, y, z) === BlockType.AIR ||
			this.getBlock(x, y, z + 1) === BlockType.AIR ||
			this.getBlock(x, y, z - 1) === BlockType.AIR;

		if (isExposed && !this.visualBlocks.has(key)) {
			const block = Mesh3D.createCube();
			block.scale.set(0.5); // 🔥 IMPORTANTE

			const mat = new StandardMaterial();
			mat.baseColor = Color.fromHex(BLOCK_COLORS[type]);
			block.material = mat;
			block.position.set(x, y, z);
			this.addChild(block);
			this.visualBlocks.set(key, block);

			const bodyDesc = RigidBodyDesc.fixed().setTranslation(x, y, z);
			const body = this.world.createRigidBody(bodyDesc);
			const colliderDesc = ColliderDesc.cuboid(0.5, 0.5, 0.5);
			this.world.createCollider(colliderDesc, body);
			this.physicsBlocks.set(key, body);
		} else if (!isExposed) {
			this.removeBlockFromScene(key);
		}
	}

	private removeBlockFromScene(key: string) {
		const visual = this.visualBlocks.get(key);
		if (visual) {
			this.removeChild(visual);
			visual.destroy();
			this.visualBlocks.delete(key);
		}
		const physics = this.physicsBlocks.get(key);
		if (physics) {
			this.world.removeRigidBody(physics);
			this.physicsBlocks.delete(key);
		}
	}

	private createSelectionCube() {
		this.selectionCube = Mesh3D.createCube();

		this.selectionCube.scale.set(0.51); // apenas más grande que 0.5

		const mat = new StandardMaterial();
		mat.baseColor = new Color(1, 1, 1, 0.25);
		mat.unlit = true;
		mat.alphaMode = StandardMaterialAlphaMode.blend;

		// 🔥 Esto es CLAVE
		mat.depthMask = false;

		this.selectionCube.material = mat;
		this.selectionCube.visible = DEBUG_SELECTION_CUBE;

		this.addChild(this.selectionCube);
	}

	private updateSelection() {
		if (!this.aimControl || !this.aimControl.camera) {
			return null;
		}

		const cam = this.aimControl.camera;

		const pixiRay = cam.screenToRay(this.mouseX, this.mouseY, {
			width: window.innerWidth,
			height: window.innerHeight,
		});

		if (!pixiRay) {
			return null;
		}

		// 🔥 Convertimos Ray de Pixi → Ray de Rapier
		const origin = pixiRay.origin;
		const direction = pixiRay.direction;

		const rapierRay = new Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: direction.x, y: direction.y, z: direction.z });

		const hit = this.world.castRayAndGetNormal(rapierRay, 20, true, undefined, undefined, undefined, this.playerBody);

		if (hit) {
			const point = {
				x: origin.x + direction.x * hit.toi,
				y: origin.y + direction.y * hit.toi,
				z: origin.z + direction.z * hit.toi,
			};

			const bx = Math.round(point.x - hit.normal.x * 0.1);
			const by = Math.round(point.y - hit.normal.y * 0.1);
			const bz = Math.round(point.z - hit.normal.z * 0.1);

			this.selectionCube.visible = true;
			this.selectionCube.position.set(bx, by, bz);

			return { bx, by, bz, normal: hit.normal };
		}

		this.selectionCube.visible = false;
		return null;
	}

	private handleInteraction(isMining: boolean) {
		const target = this.updateSelection();
		if (!target) {
			return;
		}

		const { bx, by, bz, normal } = target;

		let actualX = bx;
		let actualY = by;
		let actualZ = bz;

		if (!isMining) {
			// Si construimos, sumamos la normal de la cara tocada
			actualX += Math.round(normal.x);
			actualY += Math.round(normal.y);
			actualZ += Math.round(normal.z);
		}

		const idx = this.getIndex(actualX, actualY, actualZ);

		// Validar límites del mundo
		if (actualX < 0 || actualX >= CHUNK_SIZE || actualY < 0 || actualY >= WORLD_HEIGHT || actualZ < 0 || actualZ >= CHUNK_SIZE) {
			return;
		}

		if (isMining) {
			if (this.blocks[idx] !== BlockType.AIR) {
				this.wallHealth[idx] -= 100;
				this.spawnDebris(actualX, actualY, actualZ);
				if (this.wallHealth[idx] <= 0) {
					this.blocks[idx] = BlockType.AIR;
					this.removeBlockFromScene(`${actualX},${actualY},${actualZ}`);
					this.updateNeighbors(actualX, actualY, actualZ);
				}
			}
		} else {
			if (this.blocks[idx] === BlockType.AIR) {
				this.blocks[idx] = this.selectedMaterial;
				this.wallHealth[idx] = 100;
				this.updateBlockVisibility(actualX, actualY, actualZ);
				this.updateNeighbors(actualX, actualY, actualZ);
			}
		}
	}

	private spawnDebris(x: number, y: number, z: number) {
		for (let i = 0; i < 4; i++) {
			const p = Mesh3D.createCube();
			p.scale.set(0.05 + Math.random() * 0.1);
			p.position.set(x + (Math.random() - 0.5) * 0.5, y + 0.5, z + (Math.random() - 0.5) * 0.5);
			const mat = new StandardMaterial();
			mat.baseColor = Color.fromHex(BLOCK_COLORS[this.getBlock(x, y, z)] || 0x888888);
			p.material = mat;
			this.addChild(p);
			this.debris.push({
				mesh: p,
				vel: { x: (Math.random() - 0.5) * 0.1, y: 0.1 + Math.random() * 0.1, z: (Math.random() - 0.5) * 0.1 },
				life: 1.0,
			});
		}
	}

	private updateNeighbors(x: number, y: number, z: number) {
		const neighbors = [
			[1, 0, 0],
			[-1, 0, 0],
			[0, 1, 0],
			[0, -1, 0],
			[0, 0, 1],
			[0, 0, -1],
		];
		neighbors.forEach(([dx, dy, dz]) => this.updateBlockVisibility(x + dx, y + dy, z + dz));
	}

	private createPlayer() {
		const playerBodyDesc = RigidBodyDesc.dynamic().setTranslation(8, 15, 8).setLinearDamping(0.5);
		playerBodyDesc.lockRotations();
		this.playerBody = this.world.createRigidBody(playerBodyDesc);
		this.world.createCollider(ColliderDesc.capsule(0.5, 0.4), this.playerBody);
		this.playerMesh = Mesh3D.createCube();
		this.playerMesh.scale.set(0.6, 1.6, 0.6);
		const playerMat = new StandardMaterial();
		playerMat.baseColor = new Color(1, 0.5, 0);
		this.playerMesh.material = playerMat;
		this.addChild(this.playerMesh);
	}

	public override update(_dt: number): void {
		// Solo actualizamos si el cuerpo físico existe
		if (!this.playerBody) {
			return;
		}

		this.handleInput();

		// Guardamos la selección para no calcularla dos veces si el usuario hace click
		this.world.step();
		this.updateSelection();

		const t = this.playerBody.translation();

		// Sincronización visual:
		// Tanto el collider como el Mesh3D de cubo se originan en su centro.
		// Simplemente igualamos posiciones para que coincidan perfectamente.
		this.playerMesh.position.set(t.x, t.y, t.z);

		// La cámara sigue al jugador (un poco arriba para simular los ojos)
		if (this.aimControl && this.aimControl.target) {
			const target = this.aimControl.target;
			target.x += (t.x - target.x) * CAMERA_LERP;
			target.y += (t.y + 0.5 - target.y) * CAMERA_LERP; // Altura de la vista
			target.z += (t.z - target.z) * CAMERA_LERP;
		}

		for (let i = this.debris.length - 1; i >= 0; i--) {
			const p = this.debris[i];
			p.mesh.position.x += p.vel.x;
			p.mesh.position.y += p.vel.y;
			p.mesh.position.z += p.vel.z;
			p.vel.y -= 0.01;
			p.life -= 0.02;
			if (p.life <= 0) {
				this.removeChild(p.mesh);
				p.mesh.destroy();
				this.debris.splice(i, 1);
			}
		}
		this.visualBlocks.forEach((b) => {
			if (b.scale.x < 0.5) {
				b.scale.set(b.scale.x + 0.05);
			}
		});
	}

	private handleInput() {
		if (!this.playerBody) {
			return;
		}
		if (Keyboard.shared.isDown("Digit1")) {
			this.selectedMaterial = BlockType.GRASS;
		}
		if (Keyboard.shared.isDown("Digit2")) {
			this.selectedMaterial = BlockType.DIRT;
		}
		if (Keyboard.shared.isDown("Digit3")) {
			this.selectedMaterial = BlockType.STONE;
		}

		let dirX = 0,
			dirZ = 0;
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
		const velX = (Math.sin(cameraRad) * dirZ + Math.cos(cameraRad) * dirX) * 7;
		const velZ = (Math.cos(cameraRad) * dirZ - Math.sin(cameraRad) * dirX) * 7;
		const currentVel = this.playerBody.linvel();
		let velY = currentVel.y;
		if (Keyboard.shared.justPressed("Space") && Math.abs(velY) < 0.1) {
			velY = 6;
		}
		this.playerBody.setLinvel({ x: velX, y: velY, z: velZ }, true);
	}
}
