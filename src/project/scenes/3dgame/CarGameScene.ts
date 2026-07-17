/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Assets } from "@pixi/assets";
import type { StandardMaterial } from "pixi3d/pixi7";
import { Camera, Light, LightingEnvironment, Model, LightType, Color, Mesh3D, StandardMaterialAlphaMode } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../..";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Container, Graphics, RenderTexture, Sprite, Text, TextStyle } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

/**
 * ====== TRACK SHAPE CONSTANTS ======
 * The track is an "oval stadium" shape: two straights joined by two
 * semicircular curves. Waypoints are sampled along that path and used both
 * to build the track meshes and to drive the karts (player clamp + AI follow).
 */
const STRAIGHT_LENGTH = 250;
const STRAIGHT_SEGMENTS = 20; // how many pieces each straight is chopped into (shorter walls/road strips)
const CURVE_RADIUS = 90;
const CURVE_SEGMENTS = 18; // how many waypoints approximate each 180° curve
const TRACK_WIDTH = 26;
const WALL_HEIGHT = 2.2;
const WALL_THICKNESS = 1;

// Kart handling
const MAX_SPEED = 1;
const REVERSE_MAX_SPEED = -0.6;
const ACCELERATION = 0.015;
const BRAKE_DECEL = 0.09;
const FRICTION = 0.02;
const TURN_SPEED = 2; // degrees per frame at full speed
const BOOST_SPEED = 1.2;
const BOOST_DURATION = 60; // frames

const KART_RADIUS = 1; // Usamos el mismo radio del hitbox que en los choques
const COLLISION_DEBUG = false; // Cambiá a false para ocultar los cilindros rojos

interface TrackPoint {
	x: number;
	z: number;
}

export type ItemType = "none" | "projectile" | "oilSlick";

class ItemBox {
	public model: Mesh3D;
	public active = true;
	public respawnTimer = 0;
	public x: number;
	public z: number;
	public rotationY = 0; // NUEVA VARIABLE PARA LLEVAR EL CONTROL DEL ÁNGULO
	constructor(model: Mesh3D, x: number, z: number) {
		this.model = model;
		this.x = x;
		this.z = z;
	}
}

class Projectile {
	public model: Mesh3D;
	public active = true;
	public x: number;
	public z: number;
	public velocityX: number;
	public velocityZ: number;
	public owner: Kart;
	constructor(model: Mesh3D, x: number, z: number, vx: number, vz: number, owner: Kart) {
		this.model = model;
		this.x = x;
		this.z = z;
		this.velocityX = vx;
		this.velocityZ = vz;
		this.owner = owner;
	}
}

class OilSlick {
	public model: Mesh3D;
	public active = true;
	public x: number;
	public z: number;
	public owner: Kart;
	constructor(model: Mesh3D, x: number, z: number, owner: Kart) {
		this.model = model;
		this.x = x;
		this.z = z;
		this.owner = owner;
	}
}

class Kart {
	public model: Model;
	public heading = 0;
	public speed = 0;

	public velocityX = 0;
	public velocityZ = 0;
	public steerAngle = 0;
	public readonly wheelbase = 2.5;

	public visualSteer = 0;
	public turnTimer = 0;
	public cameraHeading = 0;

	public waypointIndex = 0;
	public lap = 1;
	public boostTimer = 0;

	// NUEVAS VARIABLES PARA OBJETOS Y DAÑO
	public currentItem: ItemType = "none";
	public stunTimer = 0; // Tiempo en el que el auto queda dando vueltas
	public debugMesh?: Mesh3D; // NUEVO: Malla visual para ver la colisión

	constructor(model: Model) {
		this.model = model;
	}

	public get x(): number {
		return this.model.x;
	}
	public get z(): number {
		return this.model.z;
	}
}

export class KartRaceScene extends PixiScene {
	public static readonly BUNDLES = ["car3d", "package-1"];

	private camera1!: Camera;
	private track: TrackPoint[] = [];
	private readonly totalLaps = 7;

	private player: Kart;
	private aiRacers: Kart[] = [];

	private boostPads: TrackPoint[] = [];
	private readonly boostRadius = 6;

	// SISTEMA DE OBJETOS
	private itemBoxes: ItemBox[] = [];
	private projectiles: Projectile[] = [];
	private oilSlicks: OilSlick[] = [];

	// HUD
	private hudContainer = new Container();
	private hudText: Text;
	private raceFinished = false;
	private finishers: Kart[] = []; // NUEVO: Registro de corredores que terminaron

	// minimap
	private miniMapContainer = new Container();
	private readonly miniMapSize = 180;
	// En la clase KartRaceScene
	private gameStarted = false;
	private numPlayers = 1; // REEMPLAZA isTwoPlayer POR ESTO
	private player2: Kart | null = null;
	private player3: Kart | null = null; // NUEVO
	private overlayContainer = new Container();

	// ====== SPLIT-SCREEN ======
	private readonly scene3DContainer = new Container();
	private readonly splitScreenContainer = new Container();
	private camera2: Camera | null = null;
	private camera3: Camera | null = null; // NUEVO
	private camera4: Camera | null = null; // NUEVO (Para la IA)

	private texPlayer1: RenderTexture | null = null;
	private texPlayer2: RenderTexture | null = null;
	private texPlayer3: RenderTexture | null = null; // NUEVO
	private texPlayer4: RenderTexture | null = null; // NUEVO

	private spriteP1: Sprite | null = null;
	private spriteP2: Sprite | null = null;
	private spriteP3: Sprite | null = null; // NUEVO
	private spriteP4: Sprite | null = null; // NUEVO

	private readonly splitDivider = new Graphics();

	// ====== COUNTDOWN ======
	private countdownText!: Text;
	private countdownValue = 3;
	private countdownTimer = 0;
	private raceActive = false; // Bloquea el movimiento hasta que sea true
	// En las declaraciones de propiedades
	private leaderboardContainer = new Container();

	constructor() {
		super();

		this.camera1 = new Camera(Manager.sceneRenderer.pixiRenderer as unknown as ConstructorParameters<typeof Camera>[0]);
		Camera.main = this.camera1; // Hacemos que sea la cámara principal por defecto
		this.addChild(this.scene3DContainer); // todo el mundo 3D
		this.addChild(this.splitScreenContainer); // los 2 "ojos" cuando hay 2 jugadores
		this.splitScreenContainer.visible = false;

		this.buildTrackPath();
		this.buildGround();
		this.buildTrackMeshes();
		this.buildBoostPads();
		this.buildLights();
		this.buildOverlay();
		this.buildItemBoxes();
		// player kart
		const playerModel = Model.from(Assets.get("impala"));
		playerModel.name = "playerKart";
		playerModel.scale.set(4, 4, 4);

		// AGREGAR ESTO: Apagar el culling para que no se vea transparente
		playerModel.meshes.forEach((mesh) => {
			const mat = mesh.material as StandardMaterial;
			if (mat && mat.state) {
				mat.doubleSided = true;
			}
		});

		this.player = new Kart(playerModel);
		this.placeAtWaypoint(this.player, 0);
		this.scene3DContainer.addChild(playerModel);

		this.buildHUD();
		this.buildCountdown();
		this.buildMinimap();

		// En el constructor
		this.leaderboardContainer.visible = false;
		this.addChild(this.leaderboardContainer);
	}

	private getPlayerPosition(): string {
		// Agrupar todos los karts
		const allKarts = [this.player, ...this.aiRacers];

		// Añadir a los jugadores extra a la tabla
		if (this.numPlayers >= 2 && this.player2) {
			allKarts.push(this.player2);
		}
		if (this.numPlayers === 3 && this.player3) {
			allKarts.push(this.player3);
		}

		// Ordenarlos: 1ro por vuelta, 2do por waypoint
		allKarts.sort((a, b) => {
			if (a.lap !== b.lap) {
				return b.lap - a.lap;
			}
			return b.waypointIndex - a.waypointIndex;
		});

		// Obtener el índice del jugador
		const pos = allKarts.indexOf(this.player) + 1;

		// Formatear con sufijo (1st, 2nd, 3rd, 4th)
		const suffix = ["st", "nd", "rd", "th"][Math.min(pos - 1, 3)];
		return `${pos}${suffix}`;
	}

	private startGame(playersCount: number): void {
		this.numPlayers = playersCount;
		this.gameStarted = true;
		this.overlayContainer.visible = false;
		this.miniMapContainer.visible = true;

		const p2Color = new Color(0.2, 0.8, 0.2); // Verde
		const p3Color = new Color(0.8, 0.2, 0.8); // Violeta
		const aiColors = [new Color(1, 0.3, 0.3), new Color(0.3, 0.6, 1), new Color(1, 0.85, 0.2)];

		// Calculamos IAs para que siempre haya 4 corredores en total
		const numAIs = 4 - playersCount;

		const startingGrid: Kart[] = [this.player];

		if (playersCount >= 2) {
			const p2Model = Model.from(Assets.get("impala"));
			p2Model.name = "player2Kart";
			p2Model.scale.set(4, 4, 4);
			p2Model.meshes.forEach((mesh) => {
				const mat = mesh.material as StandardMaterial;
				(mat as unknown as { baseColor?: Color }).baseColor = p2Color;
				if (mat && mat.state) {
					mat.doubleSided = true;
				}
			});
			this.player2 = new Kart(p2Model);
			this.scene3DContainer.addChild(p2Model);
			startingGrid.push(this.player2);
		}

		if (playersCount === 3) {
			const p3Model = Model.from(Assets.get("impala"));
			p3Model.name = "player3Kart";
			p3Model.scale.set(4, 4, 4);
			p3Model.meshes.forEach((mesh) => {
				const mat = mesh.material as StandardMaterial;
				(mat as unknown as { baseColor?: Color }).baseColor = p3Color;
				if (mat && mat.state) {
					mat.doubleSided = true;
				}
			});
			this.player3 = new Kart(p3Model);
			this.scene3DContainer.addChild(p3Model);
			startingGrid.push(this.player3);
		}

		// Instanciar AIs
		for (let i = 0; i < numAIs; i++) {
			const aiModel = Model.from(Assets.get("impala"));
			aiModel.name = `aiKart${i}`;
			aiModel.scale.set(4, 4, 4);
			aiModel.meshes.forEach((mesh) => {
				const mat = mesh.material as StandardMaterial;
				(mat as unknown as { baseColor?: Color }).baseColor = aiColors[i];
				if (mat && mat.state) {
					mat.doubleSided = true;
				}
			});
			const ai = new Kart(aiModel);
			this.aiRacers.push(ai);
			this.scene3DContainer.addChild(aiModel);
			startingGrid.push(ai);
		}

		const totalKarts = startingGrid.length;
		const spacing = 6;
		for (let i = 0; i < totalKarts; i++) {
			const latOffset = (i - (totalKarts - 1) / 2) * spacing;
			this.placeAtWaypoint(startingGrid[i], 0, latOffset);
		}

		this.raceActive = false;
		this.countdownValue = 3;
		this.countdownTimer = 0;
		this.countdownText.text = "3";
		this.countdownText.visible = true;
		this.countdownText.position.set(Manager.width / 2, -200);
	}
	private buildCountdown(): void {
		const style = new TextStyle({
			fill: ["#ffffff", "#ffaa00"],
			fontFamily: "Arial Rounded MT",
			fontSize: 160,
			fontWeight: "bold",
			stroke: "black",
			strokeThickness: 12,
			dropShadow: true,
			dropShadowColor: "#000000",
			dropShadowBlur: 4,
			dropShadowDistance: 6,
		});
		this.countdownText = new Text("3", style);
		this.countdownText.anchor.set(0.5); // Centra el texto en su propio eje
		this.countdownText.visible = false;

		// Lo agregamos directo a la escena (por encima del mundo 3D y la UI)
		this.addChild(this.countdownText);
	}

	// ============================================================
	// ITEMS
	// ============================================================

	private buildItemBoxes(): void {
		const n = this.track.length;
		// Colocar filas de cajas al 25%, 60% y 85% de la pista
		[Math.floor(n * 0.25), Math.floor(n * 0.6), Math.floor(n * 0.85)].forEach((idx) => {
			const p = this.track[idx];
			const next = this.track[(idx + 1) % n];
			const dx = next.x - p.x;
			const dz = next.z - p.z;
			const segLen = Math.sqrt(dx * dx + dz * dz) || 1;
			const nx = -dz / segLen;
			const nz = dx / segLen;

			// Tres cajas esparcidas a lo ancho
			[-8, 0, 8].forEach((offset) => {
				const bx = p.x + nx * offset;
				const bz = p.z + nz * offset;

				const boxMesh = this.scene3DContainer.addChild(Mesh3D.createCube());
				boxMesh.position.set(bx, 1, bz);
				boxMesh.scale.set(1.5, 1.5, 1.5);
				const mat = (boxMesh as unknown as { material?: StandardMaterial }).material;
				if (mat) {
					(mat as unknown as { baseColor?: Color }).baseColor = new Color(0.2, 0.8, 0.8); // Cajas moradas/celestes
					mat.exposure = 1.5;
				}

				this.itemBoxes.push(new ItemBox(boxMesh, bx, bz));
			});
		});
	}

	private useItem(kart: Kart): void {
		if (kart.currentItem === "none") {
			return;
		}

		const headingRad = (kart.heading * Math.PI) / 180;

		if (kart.currentItem === "projectile") {
			// Disparar proyectil hacia adelante
			const px = kart.x + Math.sin(headingRad) * 4;
			const pz = kart.z + Math.cos(headingRad) * 4;
			const projSpeed = 2.5; // Más rápido que la velocidad máxima del auto
			const vx = Math.sin(headingRad) * projSpeed;
			const vz = Math.cos(headingRad) * projSpeed;

			const projMesh = this.scene3DContainer.addChild(Mesh3D.createCube());
			projMesh.position.set(px, 1, pz);
			projMesh.scale.set(1, 1, 1);
			const mat = (projMesh as unknown as { material?: StandardMaterial }).material;
			if (mat) {
				(mat as unknown as { baseColor?: Color }).baseColor = new Color(1, 0.2, 0.2);
			} // Proyectil Rojo

			this.projectiles.push(new Projectile(projMesh, px, pz, vx, vz, kart));
		} else if (kart.currentItem === "oilSlick") {
			// Soltar mancha de aceite atrás
			const px = kart.x - Math.sin(headingRad) * 4;
			const pz = kart.z - Math.cos(headingRad) * 4;

			const slickMesh = this.scene3DContainer.addChild(Mesh3D.createPlane());
			slickMesh.position.set(px, 0.05, pz);
			slickMesh.scale.set(2, 1, 2);
			const mat = (slickMesh as unknown as { material?: StandardMaterial }).material;
			if (mat) {
				(mat as unknown as { baseColor?: Color }).baseColor = new Color(0.1, 0.1, 0.1);
			} // Mancha Negra

			this.oilSlicks.push(new OilSlick(slickMesh, px, pz, kart));
		}

		kart.currentItem = "none"; // Vaciar el inventario
	}

	private updateItemsManager(dt: number): void {
		const allKarts = [this.player, ...this.aiRacers];
		if (this.numPlayers >= 2 && this.player2) {
			allKarts.push(this.player2);
		}
		if (this.numPlayers === 3 && this.player3) {
			allKarts.push(this.player3);
		}

		// 1. Actualizar Cajas
		for (const box of this.itemBoxes) {
			if (!box.active) {
				box.respawnTimer -= dt;
				if (box.respawnTimer <= 0) {
					box.active = true;
					box.model.visible = true;
				}
				continue;
			}

			// Rotación animada de la caja
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			// Rotación animada de la caja
			box.rotationY += 3 * dt;
			box.model.rotationQuaternion.setEulerAngles(20, box.rotationY, 20);
			for (const kart of allKarts) {
				if (kart.stunTimer > 0) {
					continue;
				}
				const dx = kart.x - box.x;
				const dz = kart.z - box.z;
				if (dx * dx + dz * dz < 9) {
					// Choque con caja
					box.active = false;
					box.model.visible = false;
					box.respawnTimer = 300; // ~5 segundos para reaparecer

					if (kart.currentItem === "none") {
						// 50% de probabilidad de misil o mancha
						kart.currentItem = Math.random() > 0.5 ? "projectile" : "oilSlick";
					}
					break;
				}
			}
		}

		// 2. Actualizar Proyectiles
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const proj = this.projectiles[i];
			if (!proj.active) {
				continue;
			}

			proj.x += proj.velocityX * dt;
			proj.z += proj.velocityZ * dt;
			proj.model.position.set(proj.x, 1, proj.z);

			let hit = false;

			for (const kart of allKarts) {
				if (kart === proj.owner) {
					continue;
				} // No autogolpearse al disparar
				const dx = kart.x - proj.x;
				const dz = kart.z - proj.z;
				if (dx * dx + dz * dz < 9) {
					kart.stunTimer = 60; // 1 segundo detenido
					kart.speed = 0;
					hit = true;
					break;
				}
			}

			// Destruir proyectil si sale de la pista
			const seg = this.nearestSegment(proj.x, proj.z, 0);
			if (Math.abs(seg.lateral) > TRACK_WIDTH / 2) {
				hit = true;
			}

			if (hit) {
				proj.active = false;
				this.scene3DContainer.removeChild(proj.model);
				this.projectiles.splice(i, 1);
			}
		}

		// 3. Actualizar Aceite
		for (let i = this.oilSlicks.length - 1; i >= 0; i--) {
			const slick = this.oilSlicks[i];
			if (!slick.active) {
				continue;
			}

			for (const kart of allKarts) {
				// Evitar que el dueño patine apenas la suelta
				if (kart === slick.owner) {
					const dx = kart.x - slick.x;
					const dz = kart.z - slick.z;
					if (dx * dx + dz * dz < 16) {
						continue;
					}
				}

				const dx = kart.x - slick.x;
				const dz = kart.z - slick.z;
				if (dx * dx + dz * dz < 9) {
					kart.stunTimer = 90; // 1.5 segundos dando trompos
					kart.speed *= 0.3; // Pierde mucha velocidad
					slick.active = false;
					this.scene3DContainer.removeChild(slick.model);
					this.oilSlicks.splice(i, 1);
					break;
				}
			}
		}
	}
	// ============================================================
	// TRACK CONSTRUCTION
	// ============================================================

	private buildTrackPath(): void {
		const half = STRAIGHT_LENGTH / 2;
		const pts: TrackPoint[] = [];

		// bottom straight, left -> right (subdivided so wall/road segments stay short)
		for (let i = 0; i <= STRAIGHT_SEGMENTS; i++) {
			const x = -half + (STRAIGHT_LENGTH * i) / STRAIGHT_SEGMENTS;
			pts.push({ x, z: -CURVE_RADIUS });
		}

		// right curve, sweeps from -90deg to +90deg around center (half, 0)
		for (let i = 1; i <= CURVE_SEGMENTS; i++) {
			const t = -90 + (180 * i) / CURVE_SEGMENTS;
			const rad = (t * Math.PI) / 180;
			pts.push({ x: half + CURVE_RADIUS * Math.cos(rad), z: CURVE_RADIUS * Math.sin(rad) });
		}

		// top straight, right -> left (subdivided so wall/road segments stay short)
		for (let i = 1; i <= STRAIGHT_SEGMENTS; i++) {
			const x = half - (STRAIGHT_LENGTH * i) / STRAIGHT_SEGMENTS;
			pts.push({ x, z: CURVE_RADIUS });
		}

		// left curve, sweeps from +90deg down to -90deg around center (-half, 0)
		for (let i = 1; i <= CURVE_SEGMENTS; i++) {
			const t = 90 - (180 * i) / CURVE_SEGMENTS;
			const rad = (t * Math.PI) / 180;
			pts.push({ x: -half - CURVE_RADIUS * Math.cos(rad), z: CURVE_RADIUS * Math.sin(rad) });
		}

		this.track = pts;
	}

	private buildGround(): void {
		const grass = this.scene3DContainer.addChild(Mesh3D.createPlane());
		grass.y = -0.08;
		grass.scale.set(STRAIGHT_LENGTH + CURVE_RADIUS * 4, 1, CURVE_RADIUS * 5);
		// @ts-expect-error
		const mat = grass.meshes ? undefined : undefined; // grass is a Mesh3D, has .material directly
		const grassMat = (grass as unknown as { material?: StandardMaterial }).material;
		if (grassMat) {
			(grassMat as unknown as { baseColor?: Color }).baseColor = new Color(0.25, 0.55, 0.25);
			grassMat.roughness = 1;
			grassMat.metallic = 0;
		}
	}

	private buildTrackMeshes(): void {
		const n = this.track.length;
		for (let i = 0; i < n; i++) {
			const a = this.track[i];
			const b = this.track[(i + 1) % n];

			const dx = b.x - a.x;
			const dz = b.z - a.z;
			const segLength = Math.sqrt(dx * dx + dz * dz);
			const angleDeg = (Math.atan2(dx, dz) * 180) / Math.PI;

			const midX = (a.x + b.x) / 2;
			const midZ = (a.z + b.z) / 2;

			// road strip
			const road = this.scene3DContainer.addChild(Mesh3D.createPlane());
			road.position.set(midX, 0, midZ);
			road.rotationQuaternion.setEulerAngles(0, angleDeg, 0);
			road.scale.set(TRACK_WIDTH, 1, segLength * 1.05); // slight overlap avoids seams
			const roadMat = (road as unknown as { material?: StandardMaterial }).material;
			if (roadMat) {
				(roadMat as unknown as { baseColor?: Color }).baseColor = new Color(0.2, 0.2, 0.22);
				roadMat.roughness = 0.9;
				roadMat.metallic = 0;
				roadMat.doubleSided = true; // <-- AGREGAR
			}

			// side walls every couple of segments to keep mesh count sane
			if (i % 2 === 0) {
				this.createSideWall(a, b, angleDeg, segLength, TRACK_WIDTH / 2 + WALL_THICKNESS / 2);
				this.createSideWall(a, b, angleDeg, segLength, -(TRACK_WIDTH / 2 + WALL_THICKNESS / 2));
			}

			// checkpoint arches every few waypoints
			if (i % 6 === 0) {
				this.createCheckpointArch(a, b, angleDeg, i === 0);
			}
		}
	}

	private createSideWall(a: TrackPoint, b: TrackPoint, angleDeg: number, segLength: number, lateralOffset: number): void {
		const nx = Math.cos((angleDeg * Math.PI) / 180); // normal x (perp to segment direction)
		const nz = -Math.sin((angleDeg * Math.PI) / 180);
		const midX = (a.x + b.x) / 2 + nx * lateralOffset;
		const midZ = (a.z + b.z) / 2 + nz * lateralOffset;

		const wall = this.scene3DContainer.addChild(Mesh3D.createCube());
		wall.position.set(midX, WALL_HEIGHT / 2, midZ);
		wall.rotationQuaternion.setEulerAngles(0, angleDeg, 0);
		wall.scale.set(WALL_THICKNESS, WALL_HEIGHT, segLength * 1.1);
		const wallMat = (wall as unknown as { material?: StandardMaterial }).material;
		if (wallMat) {
			(wallMat as unknown as { baseColor?: Color }).baseColor = new Color(0.9, 0.2, 0.2);
			wallMat.roughness = 0.6;
			wallMat.metallic = 0.1;
			wallMat.doubleSided = true; // <-- AGREGAR
		}
	}

	private createCheckpointArch(a: TrackPoint, _b: TrackPoint, angleDeg: number, isStartFinish: boolean): void {
		const postHeight = 5;
		const postThickness = 0.6;

		for (const side of [-1, 1]) {
			const nx = Math.cos((angleDeg * Math.PI) / 180);
			const nz = -Math.sin((angleDeg * Math.PI) / 180);
			const px = a.x + nx * (TRACK_WIDTH / 2) * side;
			const pz = a.z + nz * (TRACK_WIDTH / 2) * side;

			const post = this.scene3DContainer.addChild(Mesh3D.createCube());
			post.position.set(px, postHeight / 2, pz);
			post.scale.set(postThickness, postHeight, postThickness);
			const postMat = (post as unknown as { material?: StandardMaterial }).material;
			if (postMat) {
				(postMat as unknown as { baseColor?: Color }).baseColor = isStartFinish ? new Color(1, 1, 1) : new Color(0.9, 0.7, 0.1);
				postMat.doubleSided = true; // <-- AGREGAR
			}
		}

		// top bar
		const bar = this.scene3DContainer.addChild(Mesh3D.createCube());
		bar.position.set(a.x, postHeight, a.z);
		bar.rotationQuaternion.setEulerAngles(0, angleDeg, 0);
		bar.scale.set(TRACK_WIDTH, 0.5, postThickness);
		const barMat = (bar as unknown as { material?: StandardMaterial }).material;
		if (barMat) {
			(barMat as unknown as { baseColor?: Color }).baseColor = isStartFinish ? new Color(1, 0.1, 0.1) : new Color(0.9, 0.7, 0.1);
			barMat.doubleSided = true; // <-- AGREGAR
		}
	}

	private buildBoostPads(): void {
		const n = this.track.length;
		// place a boost pad roughly every quarter of the lap, centered on the road
		[Math.floor(n * 0.15), Math.floor(n * 0.45), Math.floor(n * 0.75)].forEach((idx) => {
			const p = this.track[idx];
			this.boostPads.push(p);

			const pad = this.scene3DContainer.addChild(Mesh3D.createPlane());
			pad.position.set(p.x, 0.02, p.z);
			pad.scale.set(TRACK_WIDTH * 0.6, 1, 8);
			const padMat = (pad as unknown as { material?: StandardMaterial }).material;
			if (padMat) {
				(padMat as unknown as { baseColor?: Color }).baseColor = new Color(1, 0.6, 0);
				padMat.exposure = 1.4;
				padMat.doubleSided = true; // <-- AGREGAR
			}
		});
	}

	private buildLights(): void {
		const sun = new Light();
		sun.type = LightType.directional;
		sun.intensity = 4.5;
		sun.color = new Color(1, 1, 0.95);
		sun.rotationQuaternion.setEulerAngles(50, -60, 0);
		LightingEnvironment.main.lights.push(sun);

		const fill = new Light();
		fill.type = LightType.directional;
		fill.intensity = 2;
		fill.color = new Color(0.7, 0.8, 1);
		fill.rotationQuaternion.setEulerAngles(-40, 120, 0);
		LightingEnvironment.main.lights.push(fill);
	}

	// ============================================================
	// HUD + MINIMAP
	// ============================================================

	private showLeaderboard(): void {
		this.leaderboardContainer.visible = true;
		this.leaderboardContainer.removeChildren();

		// Fondo del tablero
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.9);
		bg.drawRect(Manager.width / 4, Manager.height / 4, Manager.width / 2, Manager.height / 2);
		bg.endFill();
		this.leaderboardContainer.addChild(bg);

		const style = new TextStyle({ fill: "white", fontSize: 40, fontFamily: "Arial Rounded MT" });

		// Título
		const title = new Text("RACE RESULTS", { ...style, fontSize: 60, fill: "gold" });
		title.position.set(Manager.width / 2, Manager.height / 4 + 50);
		title.anchor.set(0.5);
		this.leaderboardContainer.addChild(title);

		// Listado de ganadores
		this.finishers.forEach((kart, index) => {
			// Identificar si es el jugador o una IA
			let name = "AI Kart";
			if (kart === this.player) {
				name = "PLAYER 1";
			} else if (kart === this.player2) {
				name = "PLAYER 2";
			}

			const row = new Text(`${index + 1}st place: ${name}`, style);
			row.position.set(Manager.width / 2, Manager.height / 4 + 150 + index * 60);
			row.anchor.set(0.5);
			this.leaderboardContainer.addChild(row);
		});

		// NUEVO: Botón para volver al menú principal
		const btnRestart = new Text("MAIN MENU", { ...style, fill: "#00ff00", fontSize: 45 });
		btnRestart.position.set(Manager.width / 2, Manager.height / 4 + 400); // Ajusta la altura (Y) según sea necesario
		btnRestart.anchor.set(0.5);
		btnRestart.interactive = true;

		// Evento al hacer clic: recarga la escena entera
		btnRestart.on("pointerdown", () => {
			Manager.changeScene(KartRaceScene);
		});

		// Efectos visuales al pasar el mouse por encima (opcional)
		btnRestart.on("pointerover", () => (btnRestart.style.fill = "#ffffff"));
		btnRestart.on("pointerout", () => (btnRestart.style.fill = "#00ff00"));

		this.leaderboardContainer.addChild(btnRestart);
	}

	private buildOverlay(): void {
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.8);
		bg.drawRect(0, 0, 1920, 1080); // Ajustar según tu resolución ideal
		bg.endFill();
		this.overlayContainer.addChild(bg);

		const style = new TextStyle({ fill: "white", fontSize: 48, fontFamily: "Arial Rounded MT" });

		const btn1P = new Text("1 Player (Correr contra 3 IAs)", style);
		btn1P.position.set(400, 300);
		btn1P.interactive = true;
		btn1P.on("pointerdown", () => this.startGame(1));

		const btn2P = new Text("2 Players Split-Screen (Correr contra 2 IAs)", style);
		btn2P.position.set(400, 500);
		btn2P.interactive = true;
		btn2P.on("pointerdown", () => this.startGame(2));

		const btn3P = new Text("3 Players (3 Players + 1 IA Camera)", style);
		btn3P.position.set(400, 700);
		btn3P.interactive = true;
		btn3P.on("pointerdown", () => this.startGame(3));

		this.overlayContainer.addChild(btn1P, btn2P, btn3P);
		this.addChild(this.overlayContainer);
	}

	private buildHUD(): void {
		const style = new TextStyle({
			fill: "white",
			fontFamily: "Arial Rounded MT",
			fontSize: 28,
			stroke: "black",
			strokeThickness: 6,
			lineJoin: "round",
		});
		this.hudText = new Text("", style);
		this.hudContainer.addChild(this.hudText);
		this.addChild(this.hudContainer);
	}

	private updateHUD(): void {
		const speedKmh = Math.round(Math.abs(this.player.speed) * 120);
		const posLabel = this.getPlayerPosition();

		const totalKarts = this.numPlayers + this.aiRacers.length;
		let lapLabel = `Lap ${Math.min(this.player.lap, this.totalLaps)}/${this.totalLaps}`;

		if (this.finishers.includes(this.player)) {
			lapLabel = "FINISHED!";
		}
		if (this.raceFinished) {
			lapLabel = "RACE OVER!";
		}

		// NUEVO: Construimos el texto del inventario para todos los jugadores activos
		const itemP1 = this.player.currentItem === "none" ? "Empty" : this.player.currentItem === "projectile" ? "Missile" : "Oil Slick";
		let itemsText = `P1 Item: ${itemP1}`;

		if (this.numPlayers >= 2 && this.player2) {
			const itemP2 = this.player2.currentItem === "none" ? "Empty" : this.player2.currentItem === "projectile" ? "Missile" : "Oil Slick";
			itemsText += `\nP2 Item: ${itemP2}`;
		}
		if (this.numPlayers === 3 && this.player3) {
			const itemP3 = this.player3.currentItem === "none" ? "Empty" : this.player3.currentItem === "projectile" ? "Missile" : "Oil Slick";
			itemsText += `\nP3 Item: ${itemP3}`;
		}

		this.hudText.text = `Pos: ${posLabel}/${totalKarts}\n${lapLabel}\nSpeed: ${speedKmh} km/h\n${itemsText}`;
	}

	private buildMinimap(): void {
		this.miniMapContainer.pivot.set(0, 0);
		this.miniMapContainer.visible = false;
		this.addChild(this.miniMapContainer);
		this.redrawMinimapTrack();
	}

	private redrawMinimapTrack(): void {
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.4);
		bg.drawRect(-this.miniMapSize / 2 - 10, -this.miniMapSize / 2 - 10, this.miniMapSize + 20, this.miniMapSize + 20);
		bg.endFill();
		this.miniMapContainer.addChild(bg);

		const scale = this.miniMapSize / (CURVE_RADIUS * 2.4);
		const line = new Graphics();
		line.lineStyle(2, 0xffffff, 0.8);
		this.track.forEach((p, i) => {
			const mx = p.x * scale;
			const mz = p.z * scale;
			if (i === 0) {
				line.moveTo(mx, mz);
			} else {
				line.lineTo(mx, mz);
			}
		});
		line.closePath();
		this.miniMapContainer.addChild(line);
	}

	private updateMinimapMarkers(): void {
		// remove previous kart dots (keep first 2 children: bg + track line)
		while (this.miniMapContainer.children.length > 2) {
			this.miniMapContainer.removeChildAt(2);
		}
		const scale = this.miniMapSize / (CURVE_RADIUS * 2.4);

		const drawDot = (kart: Kart, color: number): void => {
			const dot = new Graphics();
			dot.beginFill(color);
			dot.drawCircle(kart.x * scale, kart.z * scale, 4);
			dot.endFill();
			this.miniMapContainer.addChild(dot);
		};

		this.aiRacers.forEach((ai) => drawDot(ai, 0x3399ff));
		drawDot(this.player, 0x33ff33); // Player 1 en Verde

		// Reemplazar: if (this.isTwoPlayer && this.player2) { drawDot(...) }
		if (this.numPlayers >= 2 && this.player2) {
			drawDot(this.player2, 0xff3333);
		} // Player 2 en Rojo
		if (this.numPlayers === 3 && this.player3) {
			drawDot(this.player3, 0x8833ff);
		} // Player 3 en Violeta
	}
	// ============================================================
	// KART LOGIC
	// ============================================================

	private placeAtWaypoint(kart: Kart, index: number, lateralOffset: number = 0): void {
		const n = this.track.length;
		const i = ((index % n) + n) % n;
		const p = this.track[i];
		const next = this.track[(i + 1) % n];

		// 1. Calculamos hacia dónde mira el auto
		kart.heading = (Math.atan2(next.x - p.x, next.z - p.z) * 180) / Math.PI;
		kart.cameraHeading = kart.heading;
		kart.model.rotationQuaternion.setEulerAngles(0, kart.heading, 0);

		// 2. Coordenadas base (centro de la pista)
		let spawnX = p.x;
		let spawnZ = p.z;

		// 3. Aplicar offset lateral si existe
		if (lateralOffset !== 0) {
			const dx = next.x - p.x;
			const dz = next.z - p.z;
			const segLen = Math.sqrt(dx * dx + dz * dz) || 1;

			// Calculamos el vector perpendicular (normal) a la dirección de la pista
			const nx = -dz / segLen;
			const nz = dx / segLen;

			// Movemos el punto de aparición hacia el costado
			spawnX += nx * lateralOffset;
			spawnZ += nz * lateralOffset;
		}

		kart.model.position.set(spawnX, 0, spawnZ);
		kart.waypointIndex = i;
	}

	/** Finds the nearest track segment to (x,z), searching a small forward window from a hint index for perf. */
	private nearestSegment(x: number, z: number, hintIndex: number): { index: number; lateral: number; forward: number } {
		const n = this.track.length;
		let best = { index: hintIndex, distSq: Infinity, lateral: 0, forward: 0 };

		for (let offset = -3; offset <= 6; offset++) {
			const i = (((hintIndex + offset) % n) + n) % n;
			const a = this.track[i];
			const b = this.track[(i + 1) % n];
			const dx = b.x - a.x;
			const dz = b.z - a.z;
			const segLenSq = dx * dx + dz * dz || 1;
			let t = ((x - a.x) * dx + (z - a.z) * dz) / segLenSq;
			t = Math.max(0, Math.min(1, t));
			const px = a.x + dx * t;
			const pz = a.z + dz * t;
			const distSq = (x - px) * (x - px) + (z - pz) * (z - pz);
			if (distSq < best.distSq) {
				// lateral offset (signed) via cross product of segment dir and point offset
				const cross = dx * (z - a.z) - dz * (x - a.x);
				const segLen = Math.sqrt(segLenSq);
				best = { index: i, distSq, lateral: cross / segLen, forward: t };
			}
		}
		return { index: best.index, lateral: best.lateral, forward: best.forward };
	}

	private updateKartInput(kart: Kart, dt: number, playerIndex: number): void {
		// 1. LEER EL JOYSTICK (Gamepad API)
		const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
		const pad = gamepads[playerIndex]; // Lee el joystick 0, 1 o 2

		let padAccelerating = false;
		let padBraking = false;
		let padLeft = false;
		let padRight = false;
		let padItem = false;

		if (pad) {
			padAccelerating = pad.buttons[0]?.pressed;
			padBraking = pad.buttons[2]?.pressed;
			const dpadLeft = pad.buttons[14]?.pressed;
			const dpadRight = pad.buttons[15]?.pressed;
			const analogX = pad.axes[0];
			padLeft = dpadLeft || analogX < -0.3;
			padRight = dpadRight || analogX > 0.3;
			padItem = pad.buttons[7]?.pressed;
		}

		// 2. COMBINAR TECLADO Y JOYSTICK
		let keyAccel = false,
			keyBrake = false,
			keyLeft = false,
			keyRight = false,
			keyItem = false;

		if (playerIndex === 0) {
			// Player 1: WASD + Space
			keyAccel = Keyboard.shared.isDown("KeyW");
			keyBrake = Keyboard.shared.isDown("KeyS");
			keyLeft = Keyboard.shared.isDown("KeyA");
			keyRight = Keyboard.shared.isDown("KeyD");
			keyItem = Keyboard.shared.justPressed("Space");
		} else if (playerIndex === 1) {
			// Player 2: Flechas + Enter
			keyAccel = Keyboard.shared.isDown("ArrowUp");
			keyBrake = Keyboard.shared.isDown("ArrowDown");
			keyLeft = Keyboard.shared.isDown("ArrowLeft");
			keyRight = Keyboard.shared.isDown("ArrowRight");
			keyItem = Keyboard.shared.justPressed("Enter");
		} else if (playerIndex === 2) {
			// Player 3: IJKL + Shift Derecho (Fallback)
			keyAccel = Keyboard.shared.isDown("KeyI");
			keyBrake = Keyboard.shared.isDown("KeyK");
			keyLeft = Keyboard.shared.isDown("KeyJ");
			keyRight = Keyboard.shared.isDown("KeyL");
			keyItem = Keyboard.shared.justPressed("ShiftRight");
		}

		const accelerating = keyAccel || padAccelerating;
		const braking = keyBrake || padBraking;
		const left = keyLeft || padLeft;
		const right = keyRight || padRight;

		// 3. CRONÓMETRO DE GIRO (Para el drift)
		if (left || right) {
			kart.turnTimer += dt;
		} else {
			kart.turnTimer = 0;
		}

		// 4. LÓGICA DE DIRECCIÓN (Normal vs Drift)
		const isDrifting = kart.turnTimer > 20;
		const currentMaxSteer = isDrifting ? 4 : 2;
		const steerSpeed = 0.2;

		if (left) {
			kart.steerAngle = Math.min(kart.steerAngle + steerSpeed * dt, currentMaxSteer);
		} else if (right) {
			kart.steerAngle = Math.max(kart.steerAngle - steerSpeed * dt, -currentMaxSteer);
		} else {
			kart.steerAngle *= 0.9;
		}

		// 5. LÓGICA DE ACELERACIÓN Y FRENADO
		if (accelerating) {
			const targetCap = kart.boostTimer > 0 ? BOOST_SPEED : MAX_SPEED;

			if (kart.speed < targetCap) {
				kart.speed = Math.min(kart.speed + ACCELERATION * dt, targetCap);
			} else if (kart.speed > targetCap) {
				kart.speed = Math.max(targetCap, kart.speed - FRICTION * 1.5 * dt);
			}
		} else if (braking) {
			kart.speed = Math.max(kart.speed - BRAKE_DECEL * dt, REVERSE_MAX_SPEED);
		} else {
			if (kart.speed > 0) {
				kart.speed = Math.max(0, kart.speed - FRICTION * dt);
			} else if (kart.speed < 0) {
				kart.speed = Math.min(0, kart.speed + FRICTION * dt);
			}
		}

		// 6. PENALIZACIÓN DE VELOCIDAD POR DRIFT
		if (Math.abs(kart.steerAngle) > 2.2 && kart.speed > 0) {
			if (kart.boostTimer <= 0) {
				kart.speed = Math.max(0.4, kart.speed - FRICTION * 2 * dt);
			}
		}

		// Solo disparamos si se acaba de presionar la tecla asignada (keyItem) o el gatillo R2 (padItem)
		if (keyItem || padItem) {
			this.useItem(kart);
		}
	}

	private advanceKart(kart: Kart, dt: number): void {
		// NUEVO: Lógica de aturdimiento / resbalar
		if (kart.stunTimer > 0) {
			kart.stunTimer -= dt;

			// Efecto visual: Dar trompos
			kart.heading += 25 * dt;
			kart.visualSteer = 0;
			kart.model.rotationQuaternion.setEulerAngles(0, kart.heading, 0);

			// Pierde velocidad y se desliza con mucha fricción
			kart.speed = Math.max(0, kart.speed - FRICTION * 4 * dt);
			kart.velocityX *= 0.85;
			kart.velocityZ *= 0.85;

			// Movimiento residual mientras patina
			let nx = kart.x + kart.velocityX * dt;
			let nz = kart.z + kart.velocityZ * dt;
			kart.model.position.set(nx, 0, nz);
			return; // Salimos de advanceKart para que no pueda manejar
		}
		// 1. Convertir ángulos a radianes
		const headingRad = (kart.heading * Math.PI) / 180;
		const steerRad = (kart.steerAngle * Math.PI) / 180;

		// 2. Calcular la rotación del chasis basado en la velocidad y el giro de las ruedas (Bicycle Model)
		// Math.cos y Math.sin aquí asumen que 0 grados es el eje Z en tu sistema
		const yawRate = (kart.speed / kart.wheelbase) * Math.tan(steerRad);
		kart.heading += ((yawRate * 180) / Math.PI) * dt;

		// 3. Calcular la tracción ideal en la dirección hacia la que mira ahora el auto
		const targetVelX = Math.sin(headingRad) * kart.speed;
		const targetVelZ = Math.cos(headingRad) * kart.speed;

		// 4. Aplicar INERCIA (Interpolación lineal entre la inercia actual y la velocidad ideal)
		// Un valor bajo de grip (ej. 0.1) = mucho derrape. Un valor alto (ej. 0.3) = más agarre.
		// El agarre base cuando vas en línea recta
		const baseGrip = 0.15;

		// Reducimos el agarre proporcionalmente a qué tanto estamos doblando.
		// Sabemos que maxSteer es 4 según tu método updateKartInput.
		const slipFactor = (Math.abs(kart.steerAngle) / 4) * 0.09;
		const dynamicGrip = baseGrip - slipFactor;

		kart.velocityX += (targetVelX - kart.velocityX) * dynamicGrip;
		kart.velocityZ += (targetVelZ - kart.velocityZ) * dynamicGrip;

		// 5. Mover el auto
		let nx = kart.x + kart.velocityX * dt;
		let nz = kart.z + kart.velocityZ * dt;

		// --- Lógica existente de rieles suaves y colisiones se mantiene igual debajo de esto ---
		const seg = this.nearestSegment(nx, nz, kart.waypointIndex);

		// soft rail: keep the kart within the track corridor
		// NUEVO: Paredes con colisión física y rebote de inercia
		const halfWidth = TRACK_WIDTH / 2 - KART_RADIUS;

		if (Math.abs(seg.lateral) > halfWidth) {
			const over = Math.abs(seg.lateral) - halfWidth;
			const pushBack = Math.sign(seg.lateral) * over;

			const a = this.track[seg.index];
			const b = this.track[(seg.index + 1) % this.track.length];
			const dx = b.x - a.x;
			const dz = b.z - a.z;
			const segLen = Math.sqrt(dx * dx + dz * dz) || 1;

			// Vector normal hacia la derecha de la pista
			const normalX = -dz / segLen;
			const normalZ = dx / segLen;

			// 1. SEPARACIÓN FÍSICA: Mantiene el auto estrictamente dentro del circuito
			nx -= normalX * pushBack;
			nz -= normalZ * pushBack;

			// 2. REBOTE FÍSICO: Le aplicamos fuerza a la inercia (velocity) hacia adentro de la pista
			// Calculamos la normal que apunta hacia adentro (alejándose de la pared que chocó)
			const inwardNormalX = -normalX * Math.sign(seg.lateral);
			const inwardNormalZ = -normalZ * Math.sign(seg.lateral);

			const wallBounce = 0.15; // Fuerza del resorte contra la pared
			kart.velocityX += inwardNormalX * wallBounce;
			kart.velocityZ += inwardNormalZ * wallBounce;

			// 3. PENALIDAD: Suavizamos la pérdida de velocidad para que el auto "resbale" mejor por la curva
			if (kart.boostTimer <= 0) {
				kart.speed *= 0.92; // Pasó de 0.85 a 0.92 (pierde menos velocidad al raspar)
			}
		}

		kart.model.position.set(nx, 0, nz);
		// 1. Calculamos un factor de velocidad (0 a 1)
		// 1. Calculamos un factor de velocidad (0 a 1)
		const speedRatio = Math.abs(kart.speed) / 1; // MAX_SPEED es 1

		// NUEVO: Interpolamos el valor visual hacia el steerAngle real.
		// El valor 0.15 dicta qué tan rápido se acomoda el chasis.
		// (Menor = más lento y suave; Mayor = más rápido y brusco)
		kart.visualSteer += (kart.steerAngle - kart.visualSteer) * 0.15;
		// 1. Yaw (sobreviraje visual). Usamos visualSteer en vez de steerAngle
		const visualYaw = kart.heading + kart.visualSteer * 4.5 * speedRatio;

		// 2. Aplicamos SOLO el ángulo Y (Yaw). Mantenemos X (Pitch) y Z (Roll) en 0
		// para que el auto nunca levante la trompa ni la cola bajo ninguna circunstancia.
		kart.model.rotationQuaternion.setEulerAngles(0, visualYaw, 0);
		// lap detection: went from near the end of the waypoint list back to the start
		if (kart.waypointIndex > this.track.length - 6 && seg.index < 6) {
			kart.lap++;
		}
		kart.waypointIndex = seg.index;

		if (kart.boostTimer > 0) {
			kart.boostTimer -= dt;
			// INYECCIÓN SUAVE: Empuja el auto hacia la velocidad de boost, incluso si no presiona acelerar.
			// El 0.1 controla qué tan rápido entra el empujón.
			kart.speed += (BOOST_SPEED - kart.speed) * 0.05 * dt;
		}

		// boost pads
		for (const pad of this.boostPads) {
			const d = (nx - pad.x) * (nx - pad.x) + (nz - pad.z) * (nz - pad.z);
			if (d < this.boostRadius * this.boostRadius && kart.boostTimer <= 0) {
				kart.boostTimer = BOOST_DURATION;
				// ELIMINADO: kart.speed = BOOST_SPEED; ¡Ya no hay saltos bruscos!
			}
		}

		// ==========================================
		// DIBUJAR HITBOXES (DEBUG)
		// ==========================================
		if (COLLISION_DEBUG) {
			if (!kart.debugMesh) {
				// Generar el cilindro la primera vez
				kart.debugMesh = this.scene3DContainer.addChild(Mesh3D.createCylinder());
				// Un cilindro por defecto mide 1 de diámetro. Lo escalamos al doble del radio (diámetro real)
				kart.debugMesh.scale.set(KART_RADIUS * 2, 2, KART_RADIUS * 2);

				const mat = kart.debugMesh.material as StandardMaterial;
				if (mat) {
					mat.baseColor = new Color(1, 0, 0); // Color Rojo
					mat.alphaMode = StandardMaterialAlphaMode.blend;
					mat.baseColor.a = 0.4; // Semi-transparente para ver el auto adentro
					mat.doubleSided = true;
				}
			}
			// Sincronizar la posición del cilindro con el kart en cada frame
			kart.debugMesh.position.set(kart.x, 1, kart.z);
		} else if (kart.debugMesh) {
			// Si apagamos el debug en caliente, ocultamos la malla
			kart.debugMesh.visible = false;
		}
	}

	private updateAI(ai: Kart, dt: number): void {
		const n = this.track.length;
		const lookahead = 3;
		const target = this.track[(ai.waypointIndex + lookahead) % n];

		const desiredHeading = (Math.atan2(target.x - ai.x, target.z - ai.z) * 180) / Math.PI;
		let diff = desiredHeading - ai.heading;
		while (diff > 180) {
			diff -= 360;
		}
		while (diff < -180) {
			diff += 360;
		}
		ai.heading += Math.max(-TURN_SPEED, Math.min(TURN_SPEED, diff)) * dt * 0.5;

		const targetCap = ai.boostTimer > 0 ? BOOST_SPEED : MAX_SPEED * 0.92;

		if (ai.speed < targetCap) {
			ai.speed = Math.min(ai.speed + ACCELERATION * dt, targetCap);
		} else if (ai.speed > targetCap) {
			ai.speed = Math.max(targetCap, ai.speed - FRICTION * 1.5 * dt);
		}
		// La IA usa objetos automáticamente
		if (ai.currentItem !== "none" && Math.random() < 0.015) {
			this.useItem(ai);
		}
		this.advanceKart(ai, dt);

		// advance the AI's own tracking index towards the lookahead point as it nears it
		const distToTarget = Math.hypot(target.x - ai.x, target.z - ai.z);
		if (distToTarget < 6) {
			ai.waypointIndex = (ai.waypointIndex + 1) % n;
		}
	}

	private updateCamera(targetKart: Kart, camera: Camera): void {
		const distance = 3; // Qué tan lejos está la cámara del auto
		const height = 1; // Qué tan arriba está la cámara

		// 1. Calcular la diferencia entre a dónde mira la cámara y a dónde mira el auto
		let diff = targetKart.heading - targetKart.cameraHeading;

		// 2. Normalizar el ángulo para que busque el camino más corto (evita giros de 360°)
		while (diff > 180) {
			diff -= 360;
		}
		while (diff < -180) {
			diff += 360;
		}

		// 3. INTERPOLACIÓN (Inercia visual).
		// Multiplicar por 0.15 significa que la cámara cubre el 15% de la diferencia por frame.
		// Si quieres que derrape más visualmente, bájalo a 0.08. Si quieres menos, súbelo a 0.3.
		targetKart.cameraHeading += diff * 0.15;

		// 4. Convertir a radianes usando el ángulo suavizado de la cámara
		const rad = (targetKart.cameraHeading * Math.PI) / 180;

		// 5. Posicionar la cámara
		camera.position.x = targetKart.x - Math.sin(rad) * distance;
		camera.position.y = height;
		camera.position.z = targetKart.z - Math.cos(rad) * distance;

		// 6. Rotar la cámara
		camera.rotationQuaternion.setEulerAngles(12, targetKart.cameraHeading, 0);
	}

	private ensureSplitScreenResources(): void {
		if (!this.camera2) {
			this.camera2 = new Camera(Manager.sceneRenderer.pixiRenderer as unknown as ConstructorParameters<typeof Camera>[0]);
		}
		if (this.numPlayers === 3) {
			if (!this.camera3) {
				this.camera3 = new Camera(Manager.sceneRenderer.pixiRenderer as unknown as ConstructorParameters<typeof Camera>[0]);
			}
			if (!this.camera4) {
				this.camera4 = new Camera(Manager.sceneRenderer.pixiRenderer as unknown as ConstructorParameters<typeof Camera>[0]);
			}
		}
		this.layoutSplitScreen(Manager.width, Manager.height);
	}

	// private ensureSplitScreenResources(): void {
	// 	if (this.camera2) {
	// 		return;
	// 	}
	// 	this.camera2 = new Camera(Manager.sceneRenderer.pixiRenderer as unknown as ConstructorParameters<typeof Camera>[0]);
	// 	this.layoutSplitScreen(Manager.width, Manager.height);
	// }

	/** (Re)crea/ajusta las render textures y acomoda los 2 sprites uno arriba y otro abajo. */
	private layoutSplitScreen(w: number, h: number): void {
		if (this.numPlayers === 2) {
			const halfH = Math.floor(h / 2);
			if (!this.texPlayer1) {
				this.texPlayer1 = RenderTexture.create({ width: w, height: halfH });
				this.texPlayer1.baseTexture.framebuffer.addDepthTexture();
				this.texPlayer2 = RenderTexture.create({ width: w, height: halfH });
				this.texPlayer2.baseTexture.framebuffer.addDepthTexture();
				this.spriteP1 = new Sprite(this.texPlayer1);
				this.spriteP2 = new Sprite(this.texPlayer2);
				this.splitScreenContainer.addChild(this.spriteP1, this.spriteP2, this.splitDivider);
			} else {
				this.texPlayer1.resize(w, halfH);
				this.texPlayer2!.resize(w, halfH); // ¡Agregado!
			}

			this.spriteP1!.scale.y = -1; // ¡Agregado!
			this.spriteP2!.scale.y = -1; // ¡Agregado!
			this.spriteP1!.position.set(0, halfH); // ¡Agregado!
			this.spriteP2!.position.set(0, h); // ¡Agregado!

			this.splitDivider
				.clear()
				.beginFill(0x000000)
				.drawRect(0, halfH - 2, w, 4)
				.endFill();
		} else if (this.numPlayers === 3) {
			const halfW = Math.floor(w / 2);
			const halfH = Math.floor(h / 2);

			if (!this.texPlayer1) {
				// Crear las 4 texturas
				this.texPlayer1 = RenderTexture.create({ width: halfW, height: halfH });
				this.texPlayer1.baseTexture.framebuffer.addDepthTexture();
				this.texPlayer2 = RenderTexture.create({ width: halfW, height: halfH });
				this.texPlayer2.baseTexture.framebuffer.addDepthTexture();
				this.texPlayer3 = RenderTexture.create({ width: halfW, height: halfH });
				this.texPlayer3.baseTexture.framebuffer.addDepthTexture();
				this.texPlayer4 = RenderTexture.create({ width: halfW, height: halfH });
				this.texPlayer4.baseTexture.framebuffer.addDepthTexture();

				this.spriteP1 = new Sprite(this.texPlayer1);
				this.spriteP2 = new Sprite(this.texPlayer2);
				this.spriteP3 = new Sprite(this.texPlayer3);
				this.spriteP4 = new Sprite(this.texPlayer4);
				this.splitScreenContainer.addChild(this.spriteP1, this.spriteP2, this.spriteP3, this.spriteP4, this.splitDivider);
			} else {
				this.texPlayer1.resize(halfW, halfH);
				this.texPlayer2!.resize(halfW, halfH); // ¡Agregado!
				this.texPlayer3!.resize(halfW, halfH); // ¡Agregado!
				this.texPlayer4!.resize(halfW, halfH); // ¡Agregado!
			}

			// Posicionar Cuadrícula (Recuerda que crecen hacia arriba en Y)
			this.spriteP1!.scale.y = -1; // ¡Agregado!
			this.spriteP2!.scale.y = -1; // ¡Agregado!
			this.spriteP3!.scale.y = -1; // ¡Agregado!
			this.spriteP4!.scale.y = -1; // ¡Agregado!

			this.spriteP1!.position.set(0, halfH); // Top Left (P1)
			this.spriteP2!.position.set(halfW, halfH); // Top Right (P2)
			this.spriteP3!.position.set(0, h); // Bottom Left (P3)
			this.spriteP4!.position.set(halfW, h); // Bottom Right (AI)

			this.splitDivider
				.clear()
				.beginFill(0x000000)
				.drawRect(0, halfH - 2, w, 4) // Linea Horizontal
				.drawRect(halfW - 2, 0, 4, h) // Linea Vertical
				.endFill();
		}
	}

	private resolveKartCollisions(): void {
		// 1. Agrupamos a todos los autos en pista
		const allKarts = [this.player, ...this.aiRacers];
		if (this.numPlayers >= 2 && this.player2) {
			allKarts.push(this.player2);
		}
		if (this.numPlayers === 3 && this.player3) {
			allKarts.push(this.player3);
		}

		// 2. Definimos el radio de choque. Un valor de 2.0 a 2.5 suele ser el ancho ideal del auto.
		// const KART_RADIUS = 2.0;
		const MIN_DIST = KART_RADIUS * 2;

		// 3. Comparamos todos contra todos (sin repetir pares)
		for (let i = 0; i < allKarts.length; i++) {
			for (let j = i + 1; j < allKarts.length; j++) {
				const kA = allKarts[i];
				const kB = allKarts[j];

				const dx = kB.x - kA.x;
				const dz = kB.z - kA.z;
				const distSq = dx * dx + dz * dz;

				// Si la distancia al cuadrado es menor al límite, ¡CHOCARON!
				if (distSq > 0 && distSq < MIN_DIST * MIN_DIST) {
					const dist = Math.sqrt(distSq);
					const overlap = MIN_DIST - dist;

					// Vector normal de la colisión (dirección del choque)
					const nx = dx / dist;
					const nz = dz / dist;

					// A) SEPARACIÓN FÍSICA: Empujamos a cada auto hacia afuera la mitad de lo que se superpusieron
					const pushX = (nx * overlap) / 2;
					const pushZ = (nz * overlap) / 2;

					kA.model.position.x -= pushX;
					kA.model.position.z -= pushZ;
					kB.model.position.x += pushX;
					kB.model.position.z += pushZ;

					// B) REBOTE ARCADE: Les inyectamos inercia lateral opuesta para que se repelan
					const bounceForce = 0.3; // Qué tan fuerte es el empujón
					kA.velocityX -= nx * bounceForce;
					kA.velocityZ -= nz * bounceForce;

					kB.velocityX += nx * bounceForce;
					kB.velocityZ += nz * bounceForce;

					// C) PENALIDAD DE VELOCIDAD: Al rozarse o chocar, ambos pierden un poco de velocidad frontal
					kA.speed *= 0.95;
					kB.speed *= 0.95;
				}
			}
		}
	}

	// ============================================================
	// MAIN LOOP
	// ============================================================

	public override update(dt: number): void {
		super.update(dt);
		if (!this.gameStarted) {
			return;
		} // Pausar hasta elegir modo

		const delta = dt / 16;

		// ==========================================
		// LÓGICA DE COUNTDOWN (3, 2, 1, GO)
		// ==========================================
		if (!this.raceActive) {
			this.countdownTimer += dt;
			const phaseDuration = 1000; // 1000ms = 1 segundo por número

			// Animación: Caer hacia el centro de la pantalla suavizado (Lerp)
			const targetY = Manager.height / 2;
			this.countdownText.y += (targetY - this.countdownText.y) * 0.15 * delta;

			// Cambiar al siguiente estado luego de 1 segundo
			if (this.countdownTimer >= phaseDuration) {
				this.countdownTimer -= phaseDuration;
				this.countdownValue--;
				this.countdownText.y = -200; // Reiniciar arriba para que caiga el siguiente

				if (this.countdownValue > 0) {
					this.countdownText.text = this.countdownValue.toString();
				} else if (this.countdownValue === 0) {
					this.countdownText.text = "GO!";
				} else {
					// Terminó el contador
					this.raceActive = true;
					this.countdownText.visible = false;
				}
			}
		}

		if (!this.raceFinished) {
			this.updateItemsManager(delta);
			// 1. Revisar quién acaba de cruzar la meta y añadirlo a la lista
			const allKarts = [this.player, ...this.aiRacers];

			allKarts.forEach((kart) => {
				if (kart.lap > this.totalLaps && !this.finishers.includes(kart)) {
					this.finishers.push(kart);
				}
			});

			// 2. Terminar la carrera si los primeros 3 ya llegaron
			// En tu método update(dt: number)
			// 2. Terminar la carrera si los primeros 3 ya llegaron
			if (this.finishers.length >= 3 && !this.raceFinished) {
				this.raceFinished = true;
				this.showLeaderboard(); // <-- Llamamos al tablero aquí
			}

			// Lógica Player 1
			if (!this.finishers.includes(this.player) && this.raceActive) {
				this.updateKartInput(this.player, delta, 0);
			}
			this.advanceKart(this.player, delta);

			// Lógica Player 2
			if (this.numPlayers >= 2 && this.player2) {
				if (!this.finishers.includes(this.player2) && this.raceActive) {
					this.updateKartInput(this.player2, delta, 1);
				}
				this.advanceKart(this.player2, delta);
			}

			// Lógica Player 3
			if (this.numPlayers === 3 && this.player3) {
				if (!this.finishers.includes(this.player3) && this.raceActive) {
					this.updateKartInput(this.player3, delta, 2);
				}
				this.advanceKart(this.player3, delta);
			}
			// 4. Lógica de los AI
			this.aiRacers.forEach((ai) => {
				if (!this.finishers.includes(ai)) {
					// Solo mover la IA si la carrera está activa
					if (this.raceActive) {
						this.updateAI(ai, delta);
					} else {
						// Mientras esperan, solo actualizamos física (para mantenerlos en el piso)
						this.advanceKart(ai, delta);
					}
				} else {
					// Frenado automático para la IA que ya cruzó la meta
					if (ai.speed > 0) {
						ai.speed = Math.max(0, ai.speed - FRICTION * delta);
					}
					this.advanceKart(ai, delta);
				}
			});

			// ==========================================
			// ¡NUEVO! RESOLVER COLISIONES ENTRE AUTOS
			// ==========================================
			this.resolveKartCollisions();
		} // <-- Cierra el if (!this.raceFinished)

		// Pantalla dividida: cada mitad se renderiza aparte (con su propia cámara) a una
		// render texture, y esas texturas se muestran como sprites (mitad de arriba / abajo).
		// El resto del render loop del motor sigue dibujando la escena una sola vez como
		// siempre; acá solo hacemos 2 pasadas extra *antes* de eso para "precomputar" cada ojo.
		if (this.numPlayers === 2) {
			this.ensureSplitScreenResources();
			this.scene3DContainer.visible = true;
			this.splitScreenContainer.visible = true;

			this.updateCamera(this.player, this.camera1);
			Camera.main = this.camera1;
			Manager.sceneRenderer.pixiRenderer.render(this.scene3DContainer, { renderTexture: this.texPlayer1!, clear: true });

			this.updateCamera(this.player2!, this.camera2!);
			Camera.main = this.camera2!;
			Manager.sceneRenderer.pixiRenderer.render(this.scene3DContainer, { renderTexture: this.texPlayer2!, clear: true });

			this.scene3DContainer.visible = false;
		} else if (this.numPlayers === 3) {
			this.ensureSplitScreenResources();
			this.scene3DContainer.visible = true;
			this.splitScreenContainer.visible = true;

			// P1 (Top Left)
			this.updateCamera(this.player, this.camera1);
			Camera.main = this.camera1;
			Manager.sceneRenderer.pixiRenderer.render(this.scene3DContainer, { renderTexture: this.texPlayer1!, clear: true });

			// P2 (Top Right)
			this.updateCamera(this.player2!, this.camera2!);
			Camera.main = this.camera2!;
			Manager.sceneRenderer.pixiRenderer.render(this.scene3DContainer, { renderTexture: this.texPlayer2!, clear: true });

			// P3 (Bottom Left)
			this.updateCamera(this.player3!, this.camera3!);
			Camera.main = this.camera3!;
			Manager.sceneRenderer.pixiRenderer.render(this.scene3DContainer, { renderTexture: this.texPlayer3!, clear: true });

			// AI (Bottom Right - Sigue al primer corredor IA)
			if (this.aiRacers.length > 0) {
				this.updateCamera(this.aiRacers[0], this.camera4!);
				Camera.main = this.camera4!;
				Manager.sceneRenderer.pixiRenderer.render(this.scene3DContainer, { renderTexture: this.texPlayer4!, clear: true });
			}

			this.scene3DContainer.visible = false;
		} else {
			// Modo 1 Jugador
			this.scene3DContainer.visible = true;
			this.splitScreenContainer.visible = false;
			this.updateCamera(this.player, this.camera1);
			Camera.main = this.camera1;
		}
		this.updateHUD();
		this.updateMinimapMarkers();

		if (Keyboard.shared.justPressed("KeyP")) {
			// simple pause hook, wire up to your Manager pause UI if needed
			console.log("pause pressed");
		}
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.hudContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.hudContainer.x = newW * 0.05;
		this.hudContainer.y = newH * 0.05;

		ScaleHelper.setScaleRelativeToIdeal(this.miniMapContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.miniMapContainer.x = newW * 0.85;
		this.miniMapContainer.y = newH * 0.2;

		ScaleHelper.setScaleRelativeToIdeal(this.overlayContainer, newW, newH, 1920, 1080, ScaleHelper.FILL);

		if (this.texPlayer1 && this.texPlayer2) {
			this.layoutSplitScreen(newW, newH);
		}

		if (this.countdownText) {
			this.countdownText.x = newW / 2;
		}
	}
}
