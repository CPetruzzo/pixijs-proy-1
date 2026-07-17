/* eslint-disable @typescript-eslint/naming-convention */
import type { IPointData } from "pixi.js";
import { Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";

import type { RigidBody } from "@dimforge/rapier2d";
import { World, ColliderDesc, RigidBodyDesc, JointData } from "@dimforge/rapier2d";

type Vec2 = { x: number; y: number };

export class HookGameScene extends PixiScene {
	private playerSprite: Graphics;
	private ropeGfx: Graphics;
	private background: Graphics;

	private world: World;
	private readonly PIXELS_PER_METER = 10;
	private readonly METERS_PER_PIXEL = 1 / this.PIXELS_PER_METER;

	private readonly PLAYER_RADIUS_PX = 15;
	private readonly PLAYER_RADIUS_M = this.PLAYER_RADIUS_PX * this.METERS_PER_PIXEL;

	private playerBody!: RigidBody;
	private hookBody: RigidBody | null = null;
	private currentJoint: unknown = null;

	private debugEnabled = false;

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
	private prevPositions: Vec2[] = [];
	private readonly maxTrail = 30;

	private isRetractingRope = false;
	public ropeLengthMeters = 0;
	private readonly retractSpeedMetersPerSecond = 8.5 * this.METERS_PER_PIXEL;
	private readonly minRopeLengthMeters = 20 * this.METERS_PER_PIXEL;

	private accumulator = 0;
	private readonly fixedDt = 1 / 60;
	private readonly maxFrameDt = 0.05;

	private readonly onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === "e" || e.key === "E") {
			this.isRetractingRope = true;
		}
		if (e.key === "r" || e.key === "R") {
			this.releaseHook();
		}
	};

	private readonly onKeyUp = (e: KeyboardEvent): void => {
		if (e.key === "e" || e.key === "E") {
			this.isRetractingRope = false;
		}
	};

	private readonly onContextMenu = (e: MouseEvent): void => {
		e.preventDefault();
	};

	constructor() {
		super();

		this.background = new Graphics();
		this.background.beginFill(0x000000, 0.01);
		this.background.drawRect(0, 0, 2000, 2000);
		this.background.endFill();
		this.background.interactive = true;
		this.background.on("pointerdown", this.handlePointerDown, this);
		this.background.on("pointerupoutside", this.releaseHook, this);
		this.background.on("rightdown", this.releaseHook, this);
		this.addChild(this.background);

		this.ropeGfx = new Graphics();
		this.addChild(this.ropeGfx);

		this.playerSprite = new Graphics();
		this.playerSprite.beginFill(0xff0000);
		this.playerSprite.drawCircle(0, 0, this.PLAYER_RADIUS_PX);
		this.playerSprite.endFill();
		this.playerSprite.x = 400;
		this.playerSprite.y = 300;
		this.addChild(this.playerSprite);

		this.world = new World({ x: 0.0, y: 15.81 });
		this.createPlatformsWithRapier();

		const playerX_m = this.playerSprite.x * this.METERS_PER_PIXEL;
		const playerY_m = this.playerSprite.y * this.METERS_PER_PIXEL;
		const playerBodyDesc = RigidBodyDesc.dynamic().setTranslation(playerX_m, playerY_m);
		playerBodyDesc.setLinearDamping(0.2);
		playerBodyDesc.setAngularDamping(0.9);
		this.playerBody = this.world.createRigidBody(playerBodyDesc);
		this.world.createCollider(ColliderDesc.ball(this.PLAYER_RADIUS_M), this.playerBody);

		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		window.addEventListener("contextmenu", this.onContextMenu);
	}

	public override destroy(): void {
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		window.removeEventListener("contextmenu", this.onContextMenu);

		this.releaseHook();
		this.clearTrail();
		this.clearDebugGraphics();

		super.destroy();
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

			const halfW = (p.w / 2) * this.METERS_PER_PIXEL;
			const halfH = (p.h / 2) * this.METERS_PER_PIXEL;
			const desc = ColliderDesc.cuboid(halfW, halfH);
			this.world.createCollider(desc).setTranslation({
				x: p.x * this.METERS_PER_PIXEL,
				y: p.y * this.METERS_PER_PIXEL,
			});
		});
	}

	private removeCurrentHook(): void {
		if (this.currentJoint) {
			(this.world as any).removeImpulseJoint(this.currentJoint, true);
			this.currentJoint = null;
		}
		if (this.hookBody) {
			this.world.removeRigidBody(this.hookBody);
			this.hookBody = null;
		}
	}

	private createHookAt(hookXm: number, hookYm: number): void {
		this.removeCurrentHook();

		const playerPos = this.playerBody.translation();
		const dx = hookXm - playerPos.x;
		const dy = hookYm - playerPos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < 0.05) {
			return;
		}

		this.hookBody = this.world.createRigidBody(RigidBodyDesc.fixed().setTranslation(hookXm, hookYm));
		this.ropeLengthMeters = dist;

		const jointData = JointData.rope(this.ropeLengthMeters, { x: 0, y: 0 }, { x: 0, y: 0 });
		this.currentJoint = (this.world as any).createImpulseJoint(jointData, this.hookBody, this.playerBody, true);

		this.clearTrail();
	}

	private handlePointerDown(event: any): void {
		if (event?.button === 2) {
			this.releaseHook();
			return;
		}

		const mouse = event.data.global as IPointData;
		const hookXm = mouse.x * this.METERS_PER_PIXEL;
		const hookYm = mouse.y * this.METERS_PER_PIXEL;
		this.createHookAt(hookXm, hookYm);

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
	}

	private releaseHook(): void {
		this.removeCurrentHook();
		this.clearTrail();
	}

	private clearTrail(): void {
		this.prevPositions = [];
		this.usedTrailGraphics.forEach((g) => this.trailPool.put(g));
		this.usedTrailGraphics = [];
	}

	private clearDebugGraphics(): void {
		this.usedDebugGraphics.forEach((g) => this.debugGraphicsPool.put(g));
		this.usedDebugGraphics = [];
	}

	private updateRopeRetraction(dtSeconds: number): void {
		if (!this.isRetractingRope || !this.hookBody) {
			return;
		}

		const hookPos = this.hookBody.translation();
		const playerPos = this.playerBody.translation();
		const dx = playerPos.x - hookPos.x;
		const dy = playerPos.y - hookPos.y;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;

		const delta = this.retractSpeedMetersPerSecond * dtSeconds;
		const newDist = Math.max(this.minRopeLengthMeters, this.ropeLengthMeters - delta);

		if (dist <= newDist) {
			this.ropeLengthMeters = newDist;
			return;
		}

		const nx = dx / dist;
		const ny = dy / dist;
		const targetPos = { x: hookPos.x + nx * newDist, y: hookPos.y + ny * newDist };

		const vel = this.playerBody.linvel();
		const tx = -ny;
		const ty = nx;
		const tangentialSpeed = vel.x * tx + vel.y * ty;
		const newLinvel = { x: tangentialSpeed * tx, y: tangentialSpeed * ty };

		if ((this.playerBody as any).setTranslation) {
			(this.playerBody as any).setTranslation(targetPos, true);
		} else if ((this.playerBody as any).setPosition) {
			(this.playerBody as any).setPosition(targetPos, true);
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

	public override update(dtMs: number): void {
		const dtSeconds = Math.min(dtMs / 1000, this.maxFrameDt);
		this.accumulator += dtSeconds;

		let steps = 0;
		const maxStepsPerFrame = 5;
		while (this.accumulator >= this.fixedDt && steps < maxStepsPerFrame) {
			this.updateRopeRetraction(this.fixedDt);
			this.world.integrationParameters.dt = this.fixedDt;
			this.world.step();
			this.accumulator -= this.fixedDt;
			steps += 1;
		}

		const p = this.playerBody.translation();
		this.playerSprite.x = p.x * this.PIXELS_PER_METER;
		this.playerSprite.y = p.y * this.PIXELS_PER_METER;

		if (this.hookBody) {
			this.prevPositions.push({ x: this.playerSprite.x, y: this.playerSprite.y });
			if (this.prevPositions.length > this.maxTrail) {
				this.prevPositions.shift();
			}
		} else if (this.prevPositions.length > 0) {
			this.clearTrail();
		}

		this.usedTrailGraphics.forEach((g) => this.trailPool.put(g));
		this.usedTrailGraphics = [];

		for (let i = 0; i < this.prevPositions.length; i++) {
			const pos = this.prevPositions[i];
			const g = this.trailPool.get();
			const alpha = 0.15 + (i / Math.max(1, this.maxTrail - 1)) * 0.45;
			g.clear();
			g.beginFill(0xff0000, alpha);
			g.drawCircle(0, 0, this.PLAYER_RADIUS_PX);
			g.endFill();
			g.x = pos.x;
			g.y = pos.y;
			const playerIndex = this.getChildIndex(this.playerSprite);
			if (playerIndex >= 0) {
				this.addChildAt(g, playerIndex);
			} else {
				this.addChild(g);
			}
			this.usedTrailGraphics.push(g);
		}

		this.ropeGfx.clear();
		if (this.hookBody) {
			const h = this.hookBody.translation();
			this.ropeGfx.lineStyle(3, 0xffffff);
			this.ropeGfx.moveTo(h.x * this.PIXELS_PER_METER, h.y * this.PIXELS_PER_METER);
			this.ropeGfx.lineTo(this.playerSprite.x, this.playerSprite.y);
			this.ropeGfx.beginFill(0xffff00);
			this.ropeGfx.drawCircle(h.x * this.PIXELS_PER_METER, h.y * this.PIXELS_PER_METER, 5);
			this.ropeGfx.endFill();
		}

		if (this.debugEnabled) {
			this.debugDraw();
		}
	}

	private debugDraw(): void {
		this.clearDebugGraphics();

		const { vertices, colors } = (this.world as any).debugRender();
		for (let i = 0; i < vertices.length / 4; i += 1) {
			const g = this.debugGraphicsPool.get();
			const ci = i * 8;
			const r = Math.min(255, (colors[ci] ?? 1) * 255) | 0;
			const gg = Math.min(255, (colors[ci + 1] ?? 1) * 255) | 0;
			const b = Math.min(255, (colors[ci + 2] ?? 1) * 255) | 0;
			const hex = (r << 16) + (gg << 8) + b;
			g.lineStyle(2, hex, 1);

			const x1 = vertices[i * 4] * this.PIXELS_PER_METER;
			const y1 = vertices[i * 4 + 1] * this.PIXELS_PER_METER;
			const x2 = vertices[i * 4 + 2] * this.PIXELS_PER_METER;
			const y2 = vertices[i * 4 + 3] * this.PIXELS_PER_METER;
			g.moveTo(x1, y1);
			g.lineTo(x2, y2);
			this.usedDebugGraphics.push(g);
			this.addChild(g);
		}
	}
}
