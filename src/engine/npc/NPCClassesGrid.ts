import type { Sprite } from "pixi.js";
import { Container, Graphics, Point } from "pixi.js";
import { PathWalker } from "../utils/PathWalker";
import { PathfindingManager } from "../utils/PathFindingManager";
import type { NavigationGrid } from "../utils/NavigationGrid";

export abstract class BaseNPC extends Container {
	protected body: Graphics | Sprite;

	constructor(color: number, radius: number = 15) {
		super();
		this.body = new Graphics();
		this.body.beginFill(color);
		this.body.drawCircle(0, 0, radius);
		this.body.endFill();
		this.addChild(this.body);
	}

	public abstract update(dt: number, player: Container): void;
}

export abstract class SmartNPC extends BaseNPC {
	protected pathWalker: PathWalker;
	protected navGrid: NavigationGrid;
	protected speed: number;

	protected pathRecalcTimer: number = 0;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected readonly PATH_RECALC_DELAY: number = 500; // ms

	// Guardamos la última posición conocida del objetivo para no recalcular si no se movió
	private lastTargetPos: Point = new Point(-1, -1);

	constructor(navGrid: NavigationGrid, color: number, speed: number = 3) {
		super(color);
		this.navGrid = navGrid;
		this.speed = speed;
		// En SmartNPC constructor:
		this.pathWalker = new PathWalker(this, {
			tileSize: navGrid.tileSize, // ej: 40
			speed: speed,
			smoothUpdates: true, // IMPORTANTE: True para que no de tirones al seguirte
		});
	}

	protected moveToTarget(target: Container, stopDistance: number = 40): void {
		const dx = target.x - this.x;
		const dy = target.y - this.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist <= stopDistance) {
			this.pathWalker.stop();
			return;
		}

		if (this.pathRecalcTimer <= 0) {
			// Verificamos si el objetivo se movió significativamente para no spammear A*
			const targetMoved = Math.abs(target.x - this.lastTargetPos.x) > 20 || Math.abs(target.y - this.lastTargetPos.y) > 20;

			if (targetMoved) {
				const start = this.navGrid.getGridCoords(this.x, this.y);
				const end = this.navGrid.getGridCoords(target.x, target.y);

				const gridPath = PathfindingManager.getInstance().findPath(this.navGrid.grid, new Point(start.x, start.y), new Point(end.x, end.y), true);

				if (gridPath && gridPath.length > 0) {
					// --- CORRECCIÓN ---
					// ELIMINADO EL SHIFT(). Pasamos la ruta completa (Inicio -> Fin)
					// El PathWalker nuevo se encargará de fusionarla suavemente.
					this.pathWalker.setPath(gridPath);
				}

				this.lastTargetPos.set(target.x, target.y);
			}

			this.pathRecalcTimer = this.PATH_RECALC_DELAY;
		}
	}

	public override update(dt: number, _player: Container): void {
		if (this.pathRecalcTimer > 0) {
			this.pathRecalcTimer -= dt;
		}
		this.pathWalker.update(dt);
	}
}

// ... (FriendlyNPC y AggressiveNPC se mantienen igual que tu archivo original)
export class FriendlyNPC extends SmartNPC {
	public isFollowing: boolean = false;
	private followDistance: number;

	constructor(navGrid: NavigationGrid, followDistance: number = 60) {
		super(navGrid, 0x00ff00, 3);
		this.followDistance = followDistance;
	}

	public startFollowing(): void {
		this.isFollowing = true;
	}

	public stopFollowing(): void {
		this.isFollowing = false;
		this.pathWalker.stop();
	}

	public override update(dt: number, player: Container): void {
		super.update(dt, player);
		if (this.isFollowing) {
			this.moveToTarget(player, this.followDistance);
		}
	}
}

export class AggressiveNPC extends SmartNPC {
	private detectionRange: number;
	private attackRange: number;

	constructor(navGrid: NavigationGrid, detectionRange: number = 200) {
		super(navGrid, 0xff0000, 3.5); // Un poco más rápido
		this.detectionRange = detectionRange;
		this.attackRange = 30;
	}

	public override update(dt: number, player: Container): void {
		super.update(dt, player);

		const dx = player.x - this.x;
		const dy = player.y - this.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < this.detectionRange) {
			this.moveToTarget(player, this.attackRange);
		} else {
			this.pathWalker.stop();
		}
	}
}
