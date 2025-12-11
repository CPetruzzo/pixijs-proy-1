/* eslint-disable @typescript-eslint/naming-convention */
import type { IPointData } from "pixi.js";
import { Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";

// Rapier imports (usa la versión que ya tenés en package.json)
import type { RigidBody } from "@dimforge/rapier2d";
import { World, ColliderDesc, RigidBodyDesc, JointData } from "@dimforge/rapier2d";

export type Vec2 = { x: number; y: number };

export class HookGameScene extends PixiScene {
	private playerSprite: Graphics;
	private ropeGfx: Graphics;
	private background: Graphics;

	// Rapier world & conversion
	private world: World;
	private readonly METER_TO_PIXEL = 10;
	private readonly PIXEL_TO_METER = 1 / this.METER_TO_PIXEL;

	// Rapier bodies
	private playerBody!: RigidBody;
	private hookBody: RigidBody | null = null;
	private currentJoint: any = null;

	// Pool para debug lines
	private debugGraphicsPool = new ObjectPool({
		creator: () => new Graphics(),
		cleaner: (g: Graphics) => {
			g.clear();
			g.parent?.removeChild(g);
		},
		destroyer: (g: Graphics) => g.destroy(),
		validator: (g: Graphics) => !g.destroyed,
	});
	private usedDebugGraphics: Graphics[] = [];

	// Trail pool & state (n = 3)
	private trailPool = new ObjectPool({
		creator: () => new Graphics(),
		cleaner: (g: Graphics) => {
			g.clear();
			g.parent?.removeChild(g);
			g.alpha = 1;
		},
		destroyer: (g: Graphics) => g.destroy(),
		validator: (g: Graphics) => !g.destroyed,
	});
	private usedTrailGraphics: Graphics[] = [];
	private prevPositions: { x: number; y: number }[] = []; // en PIXEL coordinates, max length 3
	private readonly maxTrail = 30;

	// Gameplay state
	private isRetractingRope = false;
	public ropeLengthMeters = 0;

	// Retract params
	private readonly retractSpeedMetersPerSecond = 8.5 * this.PIXEL_TO_METER; // convertido a metros
	private readonly minRopeLengthMeters = 20 * this.PIXEL_TO_METER;

	constructor() {
		super();

		// Fondo interactivo
		this.background = new Graphics();
		this.background.beginFill(0x000000, 0.01);
		this.background.drawRect(0, 0, 2000, 2000);
		this.background.endFill();
		this.background.interactive = true;
		this.background.on("pointerdown", this.handleClick, this);
		this.background.on("pointerup", this.releaseHook, this);
		this.background.on("pointerupoutside", this.releaseHook, this);
		this.addChild(this.background);

		// Rope & player visual
		this.ropeGfx = new Graphics();
		this.addChild(this.ropeGfx);

		this.playerSprite = new Graphics();
		this.playerSprite.beginFill(0xff0000);
		this.playerSprite.drawCircle(0, 0, 15);
		this.playerSprite.endFill();
		this.playerSprite.x = 400;
		this.playerSprite.y = 300;
		this.addChild(this.playerSprite);

		// Inicializar Rapier world
		const gravity = { x: 0.0, y: 15.81 };
		this.world = new World(gravity);

		// Crear plataformas
		this.createPlatformsWithRapier();

		// Crear cuerpo del jugador
		const playerX_m = this.playerSprite.x * this.PIXEL_TO_METER;
		const playerY_m = this.playerSprite.y * this.PIXEL_TO_METER;

		const playerBodyDesc = RigidBodyDesc.dynamic().setTranslation(playerX_m, playerY_m);
		playerBodyDesc.setLinearDamping(0.2);
		playerBodyDesc.setAngularDamping(0.9);

		this.playerBody = this.world.createRigidBody(playerBodyDesc);
		const playerRadiusMeters = 15 * this.PIXEL_TO_METER;
		const playerCollider = ColliderDesc.ball(playerRadiusMeters);
		this.world.createCollider(playerCollider, this.playerBody);

		// Input
		window.addEventListener("keydown", (e) => {
			if (e.key === "e" || e.key === "E") {
				this.isRetractingRope = true;
			}
		});
		window.addEventListener("keyup", (e) => {
			if (e.key === "e" || e.key === "E") {
				this.isRetractingRope = false;
			}
		});
	}

	private createPlatformsWithRapier(): void {
		const platformData = [
			{ x: 200, y: 150, w: 100, h: 20 },
			{ x: 500, y: 200, w: 120, h: 20 },
			{ x: 300, y: 400, w: 150, h: 20 },
			{ x: 600, y: 350, w: 100, h: 20 },
			{ x: 100, y: 500, w: 200, h: 20 },
			{ x: 700, y: 500, w: 100, h: 20 },
		];

		platformData.forEach((p) => {
			const g = new Graphics();
			g.beginFill(0x666666);
			g.drawRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
			g.endFill();
			this.addChild(g);

			const halfW = (p.w / 2) * this.PIXEL_TO_METER;
			const halfH = (p.h / 2) * this.PIXEL_TO_METER;
			const desc = ColliderDesc.cuboid(halfW, halfH);
			const tx = p.x * this.PIXEL_TO_METER;
			const ty = p.y * this.PIXEL_TO_METER;
			this.world.createCollider(desc).setTranslation({ x: tx, y: ty });
		});
	}

	private createHookAt(hookXm: number, hookYm: number): void {
		if (this.currentJoint) {
			(this.world as any).removeImpulseJoint(this.currentJoint, true);
			this.currentJoint = null;
		}
		if (this.hookBody) {
			this.world.removeRigidBody(this.hookBody);
			this.hookBody = null;
		}

		const hookDesc = RigidBodyDesc.fixed().setTranslation(hookXm, hookYm);
		this.hookBody = this.world.createRigidBody(hookDesc);

		const playerPos = this.playerBody.translation();
		const dx = hookXm - playerPos.x;
		const dy = hookYm - playerPos.y;
		this.ropeLengthMeters = Math.sqrt(dx * dx + dy * dy);

		// rope joint: distancia máxima = ropeLengthMeters
		const anchorHookLocal = { x: 0, y: 0 };
		const anchorPlayerLocal = { x: 0, y: 0 };

		const jointData = JointData.rope(this.ropeLengthMeters, anchorHookLocal, anchorPlayerLocal);
		this.currentJoint = (this.world as any).createImpulseJoint(jointData, this.hookBody, this.playerBody, true);

		// limpiamos estela al crear nuevo hook
		this.clearTrail();
	}

	private handleClick(event: any): void {
		const mouse = event.data.global as IPointData;
		const hookX = mouse.x;
		const hookY = mouse.y;

		const hookXm = hookX * this.PIXEL_TO_METER;
		const hookYm = hookY * this.PIXEL_TO_METER;

		this.createHookAt(hookXm, hookYm);

		// Conservar momentum tangencial
		const playerPos = this.playerBody.translation();
		const dx = hookXm - playerPos.x;
		const dy = hookYm - playerPos.y;
		const vel = this.playerBody.linvel();
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		const nx = dx / dist;
		const ny = dy / dist;
		const tx = -ny;
		const ty = nx;
		const tangentialSpeed = vel.x * tx + vel.y * ty;
		const newVel = { x: tangentialSpeed * tx, y: tangentialSpeed * ty };

		if ((this.playerBody as any).setLinvel) {
			(this.playerBody as any).setLinvel(newVel, true);
		} else {
			this.playerBody.applyImpulse({ x: newVel.x - vel.x, y: newVel.y - vel.y }, true);
		}

		// start trail tracking
		this.prevPositions = [];
	}

	private releaseHook(): void {
		if (this.currentJoint) {
			(this.world as any).removeImpulseJoint(this.currentJoint, true);
			this.currentJoint = null;
		}
		if (this.hookBody) {
			this.world.removeRigidBody(this.hookBody);
			this.hookBody = null;
		}

		// limpiar estela al soltar
		this.clearTrail();
	}

	private clearTrail(): void {
		this.prevPositions = [];
		this.usedTrailGraphics.forEach((g) => this.trailPool.put(g));
		this.usedTrailGraphics = [];
	}

	public override update(dtMs: number): void {
		const dtSeconds = dtMs / 1000;
		this.world.integrationParameters.dt = dtSeconds;

		// RETRACTION: (tu lógica de retracción ya presente)
		if (this.isRetractingRope && this.hookBody) {
			const hookPos = this.hookBody.translation();
			const playerPos = this.playerBody.translation();

			const dx = playerPos.x - hookPos.x;
			const dy = playerPos.y - hookPos.y;
			const dist = Math.sqrt(dx * dx + dy * dy) || 1;

			const delta = this.retractSpeedMetersPerSecond * (dtSeconds * 60);
			const newDist = Math.max(this.minRopeLengthMeters, this.ropeLengthMeters - delta);

			if (dist > newDist) {
				const nx = dx / dist;
				const ny = dy / dist;
				const newPlayerPos = { x: hookPos.x + nx * newDist, y: hookPos.y + ny * newDist };

				const vel = this.playerBody.linvel();
				const tx = -ny;
				const ty = nx;
				const tangentialSpeed = vel.x * tx + vel.y * ty;
				const newLinvel = { x: tangentialSpeed * tx, y: tangentialSpeed * ty };

				try {
					if ((this.playerBody as any).setTranslation) {
						(this.playerBody as any).setTranslation(newPlayerPos, true);
					} else if ((this.playerBody as any).setPosition) {
						(this.playerBody as any).setPosition(newPlayerPos, true);
					} else {
						const linearDamping = (this.playerBody as any).linearDamping?.() ?? 0.9;
						const angularDamping = (this.playerBody as any).angularDamping?.() ?? 0.9;
						const desc = RigidBodyDesc.dynamic().setTranslation(newPlayerPos.x, newPlayerPos.y);
						desc.setLinearDamping(linearDamping);
						desc.setAngularDamping(angularDamping);

						this.world.removeRigidBody(this.playerBody);
						this.playerBody = this.world.createRigidBody(desc);
						const playerRadiusMeters = 15 * this.PIXEL_TO_METER;
						this.world.createCollider(ColliderDesc.ball(playerRadiusMeters), this.playerBody);
					}
				} catch (err) {
					const desc = RigidBodyDesc.dynamic().setTranslation(newPlayerPos.x, newPlayerPos.y);
					desc.setLinearDamping(0.2);
					desc.setAngularDamping(0.9);
					this.world.removeRigidBody(this.playerBody);
					this.playerBody = this.world.createRigidBody(desc);
					const playerRadiusMeters = 15 * this.PIXEL_TO_METER;
					this.world.createCollider(ColliderDesc.ball(playerRadiusMeters), this.playerBody);
				}

				if ((this.playerBody as any).setLinvel) {
					(this.playerBody as any).setLinvel(newLinvel, true);
				} else {
					const dv = { x: newLinvel.x - vel.x, y: newLinvel.y - vel.y };
					const mass = typeof (this.playerBody as any).mass === "function" ? (this.playerBody as any).mass() : (this.playerBody as any).m || 1;
					this.playerBody.applyImpulse({ x: dv.x * mass, y: dv.y * mass }, true);
				}

				this.ropeLengthMeters = newDist;
			}
		}

		// PASO DEL MUNDO
		this.world.step();

		// Sync visual
		const p = this.playerBody.translation();
		this.playerSprite.x = p.x * this.METER_TO_PIXEL;
		this.playerSprite.y = p.y * this.METER_TO_PIXEL;

		// TRAIL: registrar posiciones previas (en pixeles) y dibujar estela
		if (this.hookBody) {
			// push current pixel position
			this.prevPositions.push({ x: this.playerSprite.x, y: this.playerSprite.y });
			if (this.prevPositions.length > this.maxTrail) {
				this.prevPositions.shift();
			}
		} else {
			// si no está enganchado, limpiamos el trail
			if (this.prevPositions.length > 0) {
				this.clearTrail();
			}
		}

		// liberar trail graphics previos
		this.usedTrailGraphics.forEach((g) => this.trailPool.put(g));
		this.usedTrailGraphics = [];

		// dibujar trail desde el más antiguo al más nuevo (mas antiguo = mas transparente)
		for (let i = 0; i < this.prevPositions.length; i++) {
			const pos = this.prevPositions[i];
			const g = this.trailPool.get();
			// alpha: más antiguo más transparente. escala 0.2 .. 0.6 (ajustá si querés)
			const alpha = 0.2 + (i / Math.max(1, this.maxTrail - 1)) * 0.4;
			g.clear();
			g.beginFill(0xff0000, alpha);
			// dibujamos centrado
			g.drawCircle(0, 0, 15);
			g.endFill();
			g.x = pos.x;
			g.y = pos.y;
			// insertamos detrás del player para que no lo tape
			const playerIndex = this.getChildIndex(this.playerSprite);
			// si playerIndex es -1 (raro), añadimos al final
			if (playerIndex >= 0) {
				this.addChildAt(g, Math.max(0, playerIndex));
			} else {
				this.addChild(g);
			}
			this.usedTrailGraphics.push(g);
		}

		// Dibujo de cuerda
		this.ropeGfx.clear();
		if (this.hookBody) {
			const h = this.hookBody.translation();
			this.ropeGfx.lineStyle(3, 0xffffff);
			this.ropeGfx.moveTo(h.x * this.METER_TO_PIXEL, h.y * this.METER_TO_PIXEL);
			this.ropeGfx.lineTo(this.playerSprite.x, this.playerSprite.y);
			this.ropeGfx.beginFill(0xffff00);
			this.ropeGfx.drawCircle(h.x * this.METER_TO_PIXEL, h.y * this.METER_TO_PIXEL, 5);
			this.ropeGfx.endFill();
		}

		this.debugDraw();
	}

	private debugDraw(): void {
		this.usedDebugGraphics.forEach((g) => this.debugGraphicsPool.put(g));
		this.usedDebugGraphics = [];

		const { vertices, colors } = (this.world as any).debugRender();
		for (let i = 0; i < vertices.length / 4; i += 1) {
			const g = this.debugGraphicsPool.get();
			const ci = i * 8;
			const r = Math.min(255, (colors[ci] ?? 1) * 255) | 0;
			const gg = Math.min(255, (colors[ci + 1] ?? 1) * 255) | 0;
			const b = Math.min(255, (colors[ci + 2] ?? 1) * 255) | 0;
			const hex = (r << 16) + (gg << 8) + b;
			g.lineStyle(2, hex, 1);
			const x1 = vertices[i * 4] * this.METER_TO_PIXEL;
			const y1 = vertices[i * 4 + 1] * this.METER_TO_PIXEL;
			const x2 = vertices[i * 4 + 2] * this.METER_TO_PIXEL;
			const y2 = vertices[i * 4 + 3] * this.METER_TO_PIXEL;
			g.moveTo(x1, y1);
			g.lineTo(x2, y2);
			this.usedDebugGraphics.push(g);
			this.addChild(g);
		}
	}
}
