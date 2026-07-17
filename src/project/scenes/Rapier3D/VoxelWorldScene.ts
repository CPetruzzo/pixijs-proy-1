/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import type { CameraOrbitControl } from "pixi3d/pixi7";
import { Mesh3D, StandardMaterial, Color, Light, LightType, LightingEnvironment, StandardMaterialAlphaMode } from "pixi3d/pixi7";
import type { RigidBody } from "@dimforge/rapier3d";
import { World, RigidBodyDesc, ColliderDesc, Ray } from "@dimforge/rapier3d";
import { cameraControl } from "../../../index";
import { Keyboard } from "../../../engine/input/Keyboard";
import { PerlinNoise } from "../../../utils/PerlinNoise";
import { Graphics } from "pixi.js";

// AJUSTES DE CHUNKS
const CHUNK_SIZE = 10; // Tamaño 16 es más estable para rendimiento por bloques individuales
const RENDER_DISTANCE = 1; // Radio de chunks (Cargará un área de 5x5 chunks)
const PRELOAD_DISTANCE = 2; // Cargamos datos de un anillo extra
const WORLD_HEIGHT = 26;
const CAMERA_LERP = 1;
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
	private chunkData: Map<string, Uint8Array> = new Map();
	private activeChunks: Set<string> = new Set();

	private visualBlocks: Map<string, Mesh3D> = new Map();
	private physicsBlocks: Map<string, RigidBody> = new Map();
	private debris: { mesh: Mesh3D; vel: { x: number; y: number; z: number }; life: number }[] = [];

	private playerBody: RigidBody;
	private playerMesh: Mesh3D;
	private aimControl: CameraOrbitControl;
	private selectedMaterial: BlockType = BlockType.GRASS;
	private mouseX = 0;
	private mouseY = 0;
	private noise = new PerlinNoise(1337);

	private selectionCube: Mesh3D;
	private lastPlayerChunk = { cx: Infinity, cz: Infinity };
	private chunkBuildQueue: { cx: number; cz: number }[] = [];
	private blocksToUpdateQueue: { gx: number; gy: number; gz: number }[] = [];
	private readonly BLOCKS_PER_FRAME = 150; // Ajusta este número según el rendimiento

	// ... dentro de la clase VoxelWorldScene
	private miningProgress = 0; // De 0 a 1
	private isMouseDown = false;
	private currentMiningTarget: { bx: number; by: number; bz: number } | null = null;
	private miningGraphics: Graphics; // El círculo UI

	// Ajustes de minado
	private readonly MINING_SPEED = 0.01; // Cuánto progresa por frame (~0.8s para romper)
	constructor() {
		super();
		this.world = new World({ x: 0, y: -9.81, z: 0 });
		this.aimControl = cameraControl;
		this.sortableChildren = true; // Permite que el zIndex funcione
		this.setupLights();
		this.setupCamera();

		// 1. Creamos al jugador primero
		this.createPlayer();
		this.createSelectionCube();

		// 2. Generación inicial inmediata para que no caiga al vacío
		this.updateWorldChunks();

		this.setupEventListeners();

		this.miningGraphics = new Graphics();
		this.miningGraphics.zIndex = 1000; // Un valor alto para que siempre esté al frente
		this.addChild(this.miningGraphics); // PixiScene permite mezclar 2D y 3D
	}

	private setupEventListeners() {
		window.addEventListener("pointerdown", (e) => {
			if (e.button === 0) {
				this.isMouseDown = true;
			} // Click izquierdo para minar
			if (e.button === 2) {
				this.handleInteraction(false);
			} // Click derecho construcción instantánea
		});
		window.addEventListener("pointerup", (e) => {
			if (e.button === 0) {
				this.isMouseDown = false;
				this.resetMining();
			}
		});
		window.addEventListener("pointermove", (e) => {
			this.mouseX = e.clientX;
			this.mouseY = e.clientY;
		});
		window.addEventListener("contextmenu", (e) => e.preventDefault());
	}
	private resetMining() {
		this.miningProgress = 0;
		this.currentMiningTarget = null;
		this.miningGraphics.clear();
	}
	// --- SISTEMA DE COORDENADAS ---

	private getChunkCoords(gx: number, gz: number) {
		return {
			cx: Math.floor(gx / CHUNK_SIZE),
			cz: Math.floor(gz / CHUNK_SIZE),
		};
	}

	private getBlockIndex(lx: number, y: number, lz: number) {
		return lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_HEIGHT;
	}

	// --- GESTIÓN DE CHUNKS ---

	private generateChunk(cx: number, cz: number) {
		const key = `${cx},${cz}`;
		if (this.chunkData.has(key)) {
			return;
		}

		const data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
		const noiseScale = 0.05;

		for (let lx = 0; lx < CHUNK_SIZE; lx++) {
			for (let lz = 0; lz < CHUNK_SIZE; lz++) {
				const gx = cx * CHUNK_SIZE + lx;
				const gz = cz * CHUNK_SIZE + lz;

				const n = this.noise.noise2D(gx * noiseScale, gz * noiseScale);
				const height = Math.floor(8 + n * 4);

				for (let y = 0; y < WORLD_HEIGHT; y++) {
					const idx = this.getBlockIndex(lx, y, lz);
					if (y > height) {
						data[idx] = BlockType.AIR;
					} else if (y === height) {
						data[idx] = BlockType.GRASS;
					} else if (y > height - 3) {
						data[idx] = BlockType.DIRT;
					} else {
						data[idx] = BlockType.STONE;
					}
				}
			}
		}
		this.chunkData.set(key, data);
	}

	private updateWorldChunks() {
		if (!this.playerBody) {
			return;
		}

		const pos = this.playerBody.translation();
		const { cx: pCX, cz: pCZ } = this.getChunkCoords(pos.x, pos.z);

		// CRÍTICO: Si el jugador no ha cambiado de chunk, no calculamos nada
		if (pCX === this.lastPlayerChunk.cx && pCZ === this.lastPlayerChunk.cz) {
			return;
		}
		this.lastPlayerChunk = { cx: pCX, cz: pCZ };

		const chunksToRender = new Set<string>();

		// PASO 1: Pre-generar datos (Sigue igual, es rápido)
		for (let x = -PRELOAD_DISTANCE; x <= PRELOAD_DISTANCE; x++) {
			for (let z = -PRELOAD_DISTANCE; z <= PRELOAD_DISTANCE; z++) {
				const cx = pCX + x;
				const cz = pCZ + z;
				const key = `${cx},${cz}`;
				if (!this.chunkData.has(key)) {
					this.generateChunk(cx, cz);
				}
			}
		}

		// PASO 2: Identificar chunks para la cola de renderizado
		for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
			for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
				const cx = pCX + x;
				const cz = pCZ + z;
				const key = `${cx},${cz}`;
				chunksToRender.add(key);

				if (!this.activeChunks.has(key)) {
					// En lugar de renderChunk(cx, cz) de golpe, lo mandamos a la cola
					this.chunkBuildQueue.push({ cx, cz });
					this.activeChunks.add(key);
				}
			}
		}

		// PASO 3: Limpieza
		this.activeChunks.forEach((key) => {
			if (!chunksToRender.has(key)) {
				const [cx, cz] = key.split(",").map(Number);
				this.unloadChunk(cx, cz);
				this.activeChunks.delete(key);
				// Limpiamos también si estaba en cola de espera
				this.chunkBuildQueue = this.chunkBuildQueue.filter((c) => `${c.cx},${c.cz}` !== key);
			}
		});
	}
	private processQueue() {
		// 1. Si hay chunks nuevos, pasamos sus bloques a la cola de bloques
		if (this.chunkBuildQueue.length > 0 && this.blocksToUpdateQueue.length === 0) {
			const { cx, cz } = this.chunkBuildQueue.shift()!;
			for (let lx = 0; lx < CHUNK_SIZE; lx++) {
				for (let lz = 0; lz < CHUNK_SIZE; lz++) {
					for (let y = 0; y < WORLD_HEIGHT; y++) {
						this.blocksToUpdateQueue.push({
							gx: cx * CHUNK_SIZE + lx,
							gy: y,
							gz: cz * CHUNK_SIZE + lz,
						});
					}
				}
			}
		}

		// 2. Procesamos solo N bloques en este frame
		let processed = 0;
		while (processed < this.BLOCKS_PER_FRAME && this.blocksToUpdateQueue.length > 0) {
			const b = this.blocksToUpdateQueue.shift()!;
			this.updateBlockVisibility(b.gx, b.gy, b.gz);
			processed++;
		}
	}

	private unloadChunk(cx: number, cz: number) {
		for (let lx = 0; lx < CHUNK_SIZE; lx++) {
			for (let lz = 0; lz < CHUNK_SIZE; lz++) {
				for (let y = 0; y < WORLD_HEIGHT; y++) {
					const key = `${cx * CHUNK_SIZE + lx},${y},${cz * CHUNK_SIZE + lz}`;
					this.removeBlockFromScene(key);
				}
			}
		}
	}

	// --- HELPERS DE BLOQUES ---

	private getBlock(gx: number, gy: number, gz: number): BlockType {
		const { cx, cz } = this.getChunkCoords(gx, gz);
		const data = this.chunkData.get(`${cx},${cz}`);
		if (!data || gy < 0 || gy >= WORLD_HEIGHT) {
			return BlockType.AIR;
		}

		const lx = ((gx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
		const lz = ((gz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
		return data[this.getBlockIndex(lx, gy, lz)];
	}

	private setBlock(gx: number, gy: number, gz: number, type: BlockType) {
		const { cx, cz } = this.getChunkCoords(gx, gz);
		const data = this.chunkData.get(`${cx},${cz}`);
		if (!data) {
			return;
		} // Si el chunk no existe, no hacemos nada (o podríamos generarlo)

		if (gy < 0 || gy >= WORLD_HEIGHT) {
			return;
		}

		const lx = ((gx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
		const lz = ((gz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
		data[this.getBlockIndex(lx, gy, lz)] = type;
	}

	private updateBlockVisibility(gx: number, gy: number, gz: number) {
		const type = this.getBlock(gx, gy, gz);
		const key = `${gx},${gy},${gz}`;

		if (type === BlockType.AIR) {
			this.removeBlockFromScene(key);
			return;
		}

		const isExposed =
			this.getBlock(gx, gy + 1, gz) === BlockType.AIR ||
			this.getBlock(gx, gy - 1, gz) === BlockType.AIR ||
			this.getBlock(gx + 1, gy, gz) === BlockType.AIR ||
			this.getBlock(gx - 1, gy, gz) === BlockType.AIR ||
			this.getBlock(gx, gy, gz + 1) === BlockType.AIR ||
			this.getBlock(gx, gy, gz - 1) === BlockType.AIR;

		if (isExposed && !this.visualBlocks.has(key)) {
			const block = Mesh3D.createCube();
			block.scale.set(0.5);
			const mat = new StandardMaterial();
			mat.baseColor = Color.fromHex(BLOCK_COLORS[type] || 0xffffff);

			// --- NUEVO: Habilitar transparencia ---
			mat.alphaMode = StandardMaterialAlphaMode.blend;

			block.material = mat;
			block.position.set(gx, gy, gz);
			this.addChild(block);
			this.visualBlocks.set(key, block);

			const body = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(gx, gy, gz));
			this.world.createCollider(ColliderDesc.cuboid(0.5, 0.5, 0.5), body);
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

	// --- INTERACCIÓN ---

	private handleInteraction(isMining: boolean) {
		const target = this.updateSelection();
		if (!target) {
			return;
		}

		let { bx, by, bz } = target;
		if (!isMining) {
			bx += Math.round(target.normal.x);
			by += Math.round(target.normal.y);
			bz += Math.round(target.normal.z);
		}

		if (isMining) {
			this.setBlock(bx, by, bz, BlockType.AIR);
			this.removeBlockFromScene(`${bx},${by},${bz}`);
			this.spawnDebris(bx, by, bz, this.getBlock(bx, by, bz));
		} else {
			this.setBlock(bx, by, bz, this.selectedMaterial);
			this.updateBlockVisibility(bx, by, bz);
		}
		this.updateNeighbors(bx, by, bz);
	}

	private updateBlocksAlpha() {
		if (!this.playerBody) {
			return;
		}

		const pPos = this.playerBody.translation();
		// Definimos el radio máximo basado en tu RENDER_DISTANCE
		const maxDist = RENDER_DISTANCE * CHUNK_SIZE;
		// Empezamos el fade al 60% de la distancia total para que sea suave
		// const minDist = maxDist * 0.6;
		const minDist = maxDist;

		this.visualBlocks.forEach((mesh) => {
			const dx = mesh.position.x - pPos.x;
			const dz = mesh.position.z - pPos.z;
			// Distancia euclidiana en el plano XZ (radial)
			const dist = Math.sqrt(dx * dx + dz * dz);

			let alpha = 1;
			if (dist > minDist) {
				alpha = 1 - (dist - minDist) / (maxDist - minDist);
			}

			// Clamp del valor entre 0 y 1 y aplicación al material
			const finalAlpha = Math.max(0, Math.min(1, alpha));

			if (mesh.material instanceof StandardMaterial) {
				mesh.material.baseColor.a = finalAlpha;
			}
		});
	}

	private updateNeighbors(x: number, y: number, z: number) {
		const dirs = [
			[1, 0, 0],
			[-1, 0, 0],
			[0, 1, 0],
			[0, -1, 0],
			[0, 0, 1],
			[0, 0, -1],
		];
		dirs.forEach(([dx, dy, dz]) => this.updateBlockVisibility(x + dx, y + dy, z + dz));
	}

	// --- CONFIGURACIÓN ESCENA ---

	private setupLights() {
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 2;
		dirLight.rotationQuaternion.setEulerAngles(45, 30, 0);
		LightingEnvironment.main.lights.push(dirLight);

		const dirLight2 = new Light();
		dirLight2.type = LightType.directional;
		dirLight2.intensity = 5;
		dirLight2.rotationQuaternion.setEulerAngles(-120, 30, 0);
		LightingEnvironment.main.lights.push(dirLight2);
	}

	private setupCamera() {
		this.aimControl.distance = 12;
		this.aimControl.angles.x = 30;
	}

	private createPlayer() {
		const playerBodyDesc = RigidBodyDesc.dynamic().setTranslation(8, 20, 8).setLinearDamping(0.5);
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

	private createSelectionCube() {
		this.selectionCube = Mesh3D.createCube();
		this.selectionCube.scale.set(0.51);
		const mat = new StandardMaterial();
		mat.baseColor = new Color(1, 1, 1, 0.25);
		mat.unlit = true;
		mat.alphaMode = StandardMaterialAlphaMode.blend;
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
		const pixiRay = cam.screenToRay(this.mouseX, this.mouseY, { width: window.innerWidth, height: window.innerHeight });
		if (!pixiRay) {
			return null;
		}

		const rapierRay = new Ray(pixiRay.origin, pixiRay.direction);
		const hit = this.world.castRayAndGetNormal(rapierRay, 20, true, undefined, undefined, undefined, this.playerBody);

		if (hit) {
			const bx = Math.round(pixiRay.origin.x + pixiRay.direction.x * hit.toi - hit.normal.x * 0.1);
			const by = Math.round(pixiRay.origin.y + pixiRay.direction.y * hit.toi - hit.normal.y * 0.1);
			const bz = Math.round(pixiRay.origin.z + pixiRay.direction.z * hit.toi - hit.normal.z * 0.1);
			this.selectionCube.visible = true;
			this.selectionCube.position.set(bx, by, bz);
			return { bx, by, bz, normal: hit.normal };
		}
		this.selectionCube.visible = false;
		return null;
	}

	private spawnDebris(x: number, y: number, z: number, type: BlockType) {
		for (let i = 0; i < 3; i++) {
			const p = Mesh3D.createCube();
			p.scale.set(0.1);
			p.position.set(x, y, z);
			const mat = new StandardMaterial();
			mat.baseColor = Color.fromHex(BLOCK_COLORS[type] || 0xffffff);
			p.material = mat;
			this.addChild(p);
			this.debris.push({
				mesh: p,
				vel: { x: (Math.random() - 0.5) * 0.1, y: 0.15, z: (Math.random() - 0.5) * 0.1 },
				life: 1.0,
			});
		}
	}

	private handleInput() {
		const currentVel = this.playerBody.linvel();
		let velY = currentVel.y;
		if (Keyboard.shared.justPressed("Space") && Math.abs(velY) < 0.2) {
			velY = 12;
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

		const cameraRad = (this.aimControl.angles.y + 180) * (Math.PI / 180);
		const velX = (Math.sin(cameraRad) * dirZ + Math.cos(cameraRad) * dirX) * 7;
		const velZ = (Math.cos(cameraRad) * dirZ - Math.sin(cameraRad) * dirX) * 7;

		this.playerBody.setLinvel({ x: velX, y: velY, z: velZ }, true);
	}

	public override update(_dt: number): void {
		if (!this.playerBody) {
			return;
		}

		this.updateWorldChunks(); // Solo hace lógica pesada al cruzar fronteras
		this.processQueue(); // Procesa un poquito de carga visual en cada frame
		this.handleInput();
		this.world.step();
		this.updateSelection();

		this.updateBlocksAlpha();

		const t = this.playerBody.translation();
		this.playerMesh.position.set(t.x, t.y, t.z);
		this.handleMiningProgress(); // <--- Nueva función
		this.drawMiningUI(); // <--- Nueva función
		if (this.aimControl.target) {
			const target = this.aimControl.target;
			target.x += (t.x - target.x) * CAMERA_LERP;
			target.y += (t.y + 0.5 - target.y) * CAMERA_LERP;
			target.z += (t.z - target.z) * CAMERA_LERP;
		}

		// Partículas de rotura
		for (let i = this.debris.length - 1; i >= 0; i--) {
			const p = this.debris[i];
			p.mesh.position.x += p.vel.x;
			p.mesh.position.y += p.vel.y;
			p.mesh.position.z += p.vel.z;
			p.vel.y -= 0.01;
			p.life -= 0.03;
			if (p.life <= 0) {
				this.removeChild(p.mesh);
				p.mesh.destroy();
				this.debris.splice(i, 1);
			}
		}
	}

	private drawMiningUI() {
		this.miningGraphics.clear();
		if (this.miningProgress <= 0) {
			return;
		}
		// Opcional: Esto asegura que el círculo no se "meta" dentro de los bloques 3D
		// si el motor intenta hacer pruebas de profundidad.
		this.miningGraphics.position.set(0, 0);
		// Dibujamos en la posición del mouse
		const x = this.mouseX;
		const y = this.mouseY;
		const outerRadius = 30;
		const innerRadius = outerRadius * this.miningProgress;

		// Círculo exterior (fijo y sutil)
		this.miningGraphics.lineStyle(2, 0xffffff, 0.3);
		this.miningGraphics.drawCircle(x, y, outerRadius);

		// Círculo interior (crece con el progreso)
		// Cambia de color de blanco a verde según se completa
		const color = this.miningProgress > 0.8 ? 0x55ff55 : 0xffffff;
		this.miningGraphics.lineStyle(4, color, 0.8);
		this.miningGraphics.drawCircle(x, y, innerRadius);
	}

	private handleMiningProgress() {
		if (!this.isMouseDown) {
			return;
		}

		const target = this.updateSelection(); // Reutilizamos tu raycast actual

		if (target) {
			// ¿Estamos mirando al mismo bloque que el frame anterior?
			if (this.currentMiningTarget && target.bx === this.currentMiningTarget.bx && target.by === this.currentMiningTarget.by && target.bz === this.currentMiningTarget.bz) {
				this.miningProgress += this.MINING_SPEED;

				if (this.miningProgress >= 1) {
					this.executeMining(target.bx, target.by, target.bz);
					this.resetMining();
				}
			} else {
				// Si movemos la cámara a otro bloque, reiniciamos el progreso
				this.miningProgress = 0;
				this.currentMiningTarget = { bx: target.bx, by: target.by, bz: target.bz };
			}
		} else {
			this.resetMining();
		}
	}

	private executeMining(bx: number, by: number, bz: number) {
		const type = this.getBlock(bx, by, bz);
		this.setBlock(bx, by, bz, BlockType.AIR);
		this.removeBlockFromScene(`${bx},${by},${bz}`);
		this.spawnDebris(bx, by, bz, type);
		this.updateNeighbors(bx, by, bz);
	}
}
