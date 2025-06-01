import { Container, Graphics, Point } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager } from "../../..";

interface Bubble {
	x: number;
	y: number;
	radius: number;
	color: string;
	active: boolean;
	processed?: boolean;
}

export class PuzzleBobbleScene extends PixiScene {
	private gridSize = 32;
	private bubbleGap = 1;
	private wallSize = 4;
	private colors = ["red", "orange", "green", "yellow"];
	private level1 = [
		["R", "R", "Y", "Y", "B", "B", "G", "G"],
		["R", "R", "Y", "Y", "B", "B", "G"],
		["B", "B", "G", "G", "R", "R", "Y", "Y"],
		["B", "G", "G", "R", "R", "Y", "Y"],
	];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	private colorMap: Record<string, string> = { R: "red", G: "green", B: "blue", Y: "yellow" };
	private bubbles: Bubble[] = [];
	private particles: Bubble[] = [];

	// Posición y estado de la burbuja a disparar
	private curBubblePos!: Point;
	private curBubble!: { x: number; y: number; radius: number; color: string; speed: number; dx: number; dy: number };
	private shootDeg = 0;
	private shootDir = 0;
	private minDeg = -Math.PI / 3;
	private maxDeg = Math.PI / 3;

	// Contenedores separados
	private worldContainer = new Container();
	private uiContainer = new Container();

	constructor() {
		super();
		this.addChild(this.worldContainer);
		this.addChild(this.uiContainer);

		this.setupGrid();
		this.createShooter();

		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
	}

	private setupGrid(): void {
		const rows = 10;
		for (let row = 0; row < rows; row++) {
			const cols = row % 2 === 0 ? 8 : 7;
			for (let col = 0; col < cols; col++) {
				const cc = this.level1[row]?.[col];
				const color = cc ? this.colorMap[cc] : undefined;
				this.createBubble(col, row, color);
			}
		}
	}

	private createBubble(col: number, row: number, color?: string): void {
		const xOff = row % 2 === 0 ? 0 : this.gridSize / 2;
		const c = this.gridSize / 2;
		const x = this.wallSize + (this.gridSize + this.bubbleGap) * col + xOff + c;
		const y = this.wallSize + (this.gridSize + this.bubbleGap - 4) * row + c;
		this.bubbles.push({ x, y, radius: c, color: color || "", active: Boolean(color) });
	}

	private createShooter(): void {
		const cw = Manager.width;
		const ch = Manager.height;
		this.curBubblePos = new Point(cw / 2, ch - this.gridSize * 1.5);
		this.resetCurrentBubble();
	}

	private resetCurrentBubble(): void {
		this.curBubble = {
			x: this.curBubblePos.x,
			y: this.curBubblePos.y,
			radius: this.gridSize / 2,
			color: this.colors[Math.floor(Math.random() * this.colors.length)],
			speed: 0.5,
			dx: 0,
			dy: 0,
		};
	}

	public override update(_dt: number): void {
		this.updateScene(_dt);
	}

	private updateScene(dt: number): void {
		// ==== 1) Mundo: grilla + partículas ====
		this.worldContainer.removeChildren();

		// Dibujo burbujas y partículas
		for (const b of [...this.bubbles, ...this.particles]) {
			if (!b.active) {
				continue;
			}
			const g = new Graphics().beginFill(b.color).drawCircle(b.x, b.y, b.radius).endFill();
			this.worldContainer.addChild(g);
		}

		// Dibujo muros laterales en blanco
		const walls = new Graphics()
			.beginFill(0xffffff)
			// izquierda
			.drawRect(0, 0, this.wallSize, Manager.height)
			// derecha
			.drawRect(Manager.width - this.wallSize, 0, this.wallSize, Manager.height)
			.endFill();
		this.worldContainer.addChild(walls);

		// ==== 2) Lógica de disparo ====

		// Rotación de la flecha (frame delta * angular speed)
		this.shootDeg = Math.max(this.minDeg, Math.min(this.maxDeg, this.shootDeg + (Math.PI / 90) * this.shootDir * dt));

		// Movimiento de la burbuja en dx, dy * dt
		this.curBubble.x += this.curBubble.dx * dt;
		this.curBubble.y += this.curBubble.dy * dt;

		// Rebote en paredes
		if (this.curBubble.x - this.curBubble.radius < this.wallSize) {
			this.curBubble.x = this.wallSize + this.curBubble.radius;
			this.curBubble.dx *= -1;
		} else if (this.curBubble.x + this.curBubble.radius > Manager.width - this.wallSize) {
			this.curBubble.x = Manager.width - this.wallSize - this.curBubble.radius;
			this.curBubble.dx *= -1;
		}

		// Colisión con techo
		if (this.curBubble.y - this.curBubble.radius < this.wallSize) {
			this.handleCollision();
		}

		// Colisión con otras burbujas
		for (const b of this.bubbles) {
			if (b.active && this.collides(this.curBubble, b)) {
				this.handleCollision();
				break;
			}
		}

		// Partículas caen (fijo a 8px por frame)
		this.particles.forEach((p) => (p.y += 8));
		this.particles = this.particles.filter((p) => p.y < Manager.height);

		// ==== 3) UI: flecha + burbuja ====
		this.uiContainer.removeChildren();

		// Flecha apuntando hacia arriba, origen en la base (0,0)
		const ag = new Graphics()
			.lineStyle(2, 0xffffff)
			.moveTo(0, 0)
			// trazo principal hacia arriba
			.lineTo(0, -this.gridSize * 2)
			// alas de la flecha también hacia arriba
			.moveTo(0, 0)
			.lineTo(-10, -this.gridSize * 0.4)
			.moveTo(0, 0)
			.lineTo(10, -this.gridSize * 0.4)
			.endFill();

		// colocamos la base de la flecha en curBubblePos
		ag.position.copyFrom(this.curBubblePos);
		// rotamos alrededor de (0,0), que es la base
		ag.rotation = this.shootDeg;

		this.uiContainer.addChild(ag);
		// Burbuja disparada
		const sg = new Graphics().beginFill(this.curBubble.color).drawCircle(this.curBubble.x, this.curBubble.y, this.curBubble.radius).endFill();
		this.worldContainer.addChild(sg);
	}

	private collides(a: { x: number; y: number; radius: number }, b: Bubble): boolean {
		return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
	}

	private handleCollision(): void {
		const tgt = this.getClosestBubble(this.curBubble);
		if (!tgt) {
			return;
		}
		tgt.color = this.curBubble.color;
		tgt.active = true;
		this.resetCurrentBubble();
		this.removeMatch(tgt);
		this.dropFloatingBubbles();
	}

	private getClosestBubble(obj: { x: number; y: number; radius: number }): Bubble | null {
		const coll = this.bubbles.filter((b) => !b.active && this.collides(obj, b));
		if (!coll.length) {
			return null;
		}
		let best = coll[0],
			md = Infinity;
		for (const b of coll) {
			const d = Math.hypot(obj.x - b.x, obj.y - b.y);
			if (d < md) {
				md = d;
				best = b;
			}
		}
		return best;
	}

	private getNeighbors(b: Bubble): Bubble[] {
		const dirs = [0, 60, 120, 180, 240, 300].map((deg) => {
			const r = (deg * Math.PI) / 180;
			return { x: Math.cos(r) * this.gridSize, y: Math.sin(r) * this.gridSize };
		});
		const res: Bubble[] = [];
		for (const d of dirs) {
			const found = this.bubbles.find((x) => x.active && Math.hypot(x.x - (b.x + d.x), x.y - (b.y + d.y)) < b.radius / 2);
			if (found && !res.includes(found)) {
				res.push(found);
			}
		}
		return res;
	}

	private removeMatch(start: Bubble): void {
		const matches: Bubble[] = [start];
		this.bubbles.forEach((b) => (b.processed = false));
		start.processed = true;
		const stk = [start];
		while (stk.length) {
			const cur = stk.pop()!;
			for (const n of this.getNeighbors(cur)) {
				if (!n.processed && n.color === start.color) {
					n.processed = true;
					matches.push(n);
					stk.push(n);
				}
			}
		}
		if (matches.length >= 3) {
			matches.forEach((b) => (b.active = false));
		}
	}

	private dropFloatingBubbles(): void {
		this.bubbles.forEach((b) => (b.processed = false));
		const conn = this.bubbles.filter((b) => b.active && b.y - this.gridSize <= this.wallSize);
		conn.forEach((b) => (b.processed = true));
		for (let i = 0; i < conn.length; i++) {
			for (const n of this.getNeighbors(conn[i])) {
				if (!n.processed) {
					n.processed = true;
					conn.push(n);
				}
			}
		}
		this.bubbles
			.filter((b) => b.active && !b.processed)
			.forEach((b) => {
				b.active = false;
				this.particles.push({ ...b, active: true });
			});
	}

	public override onResize(w: number, h: number): void {
		// escalo mundo
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 720, 1980, ScaleHelper.FIT);
		this.worldContainer.x = 0;
		this.worldContainer.y = 0;
		// ui siempre en 0,0
		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, w, h, 720, 1980, ScaleHelper.FIT);
		this.uiContainer.x = 0;
		this.uiContainer.y = 0;
	}

	public override destroy(_opts?: any): void {
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		super.destroy();
	}

	private onKeyDown = (e: KeyboardEvent): void => {
		if (e.code === "ArrowLeft") {
			this.shootDir = -0.1;
		}
		if (e.code === "ArrowRight") {
			this.shootDir = 0.1;
		}
		if (e.code === "Space" && this.curBubble.dx === 0 && this.curBubble.dy === 0) {
			this.curBubble.dx = Math.sin(this.shootDeg) * this.curBubble.speed;
			this.curBubble.dy = -Math.cos(this.shootDeg) * this.curBubble.speed;
		}
	};

	private onKeyUp = (e: KeyboardEvent): void => {
		if ((e.code === "ArrowLeft" && this.shootDir === -0.1) || (e.code === "ArrowRight" && this.shootDir === 0.1)) {
			this.shootDir = 0;
		}
	};
}
