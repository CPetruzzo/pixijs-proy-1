import type { Sprite } from "pixi.js";
import { Container, Graphics, Point } from "pixi.js";

// Ya no necesitamos PathWalker ni PathfindingManager ni NavigationGrid para moverse
// Pero mantenemos NavigationGrid SOLO si necesitas saber dónde están las paredes para colisionar

export abstract class BaseNPC extends Container {
	protected body: Graphics | Sprite;
	public radius: number; // Necesario para colisiones

	constructor(color: number, radius: number = 15) {
		super();
		this.radius = radius;
		this.body = new Graphics();
		this.body.beginFill(color);
		this.body.drawCircle(0, 0, radius);
		this.body.endFill();
		this.addChild(this.body);
	}

	public abstract update(dt: number, player: Container, obstacles: Graphics[]): void;
}

export abstract class SmartNPC extends BaseNPC {
	protected speed: number;
	public velocity: Point = new Point(0, 0);

	constructor(color: number, speed: number = 3) {
		super(color);
		this.speed = speed;
	}

	// Movimiento fluido con "Steering" (Dirección + Esquiva)
	protected moveTowards(targetX: number, targetY: number, stopDistance: number, obstacles: Graphics[], dt: number): void {
		const dx = targetX - this.x;
		const dy = targetY - this.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist <= stopDistance) {
			return; // Llegamos
		}

		// 1. Vector de deseo (Hacia el objetivo)
		let dirX = dx / dist;
		let dirY = dy / dist;

		// 2. Evasión de obstáculos (Raycast simple)
		// Miramos un poco hacia adelante
		const lookAhead = 50;
		const nextX = this.x + dirX * lookAhead;
		const nextY = this.y + dirY * lookAhead;

		let avoidanceX = 0;
		let avoidanceY = 0;

		// Comprobamos si chocaríamos con algún obstáculo
		for (const wall of obstacles) {
			// Asumimos que las paredes son rectángulos con x, y, widthRect, heightRect
			const wX = wall.x;
			const wY = wall.y;
			const wW = (wall as any).widthRect || 100; // Valor por defecto si no tiene propiedad
			const wH = (wall as any).heightRect || 100;

			// Chequeo simple: ¿El punto futuro está dentro del muro?
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			if (nextX > wX - this.radius && nextX < wX + wW + this.radius && nextY > wY - this.radius && nextY < wY + wH + this.radius) {
				// ¡COLISIÓN INMINENTE!
				// Calculamos fuerza de rechazo (vector desde el centro del muro hacia nosotros)
				const wallCenterX = wX + wW / 2;
				const wallCenterY = wY + wH / 2;

				const pushX = this.x - wallCenterX;
				const pushY = this.y - wallCenterY;
				const pushLen = Math.sqrt(pushX * pushX + pushY * pushY);

				// Normalizamos y añadimos fuerza fuerte de evasión
				if (pushLen > 0) {
					avoidanceX += (pushX / pushLen) * 2.0; // Fuerza 2x
					avoidanceY += (pushY / pushLen) * 2.0;
				}
			}
		}

		// 3. Combinar vectores
		dirX += avoidanceX;
		dirY += avoidanceY;

		// Renormalizar para no superar velocidad máxima
		const finalLen = Math.sqrt(dirX * dirX + dirY * dirY);
		if (finalLen > 0) {
			dirX /= finalLen;
			dirY /= finalLen;
		}

		// 4. Aplicar movimiento
		this.x += dirX * this.speed * (dt * 0.06); // Ajuste dt aproximado para 60fps
		this.y += dirY * this.speed * (dt * 0.06);
	}

	public override update(_dt: number, _player: Container, _obstacles: Graphics[]): void {
		// Base implementation does nothing
	}
}

// --- FRIENDLY NPC ---
export class FriendlyNPC extends SmartNPC {
	public isFollowing: boolean = false;
	private followDistance: number;

	constructor(followDistance: number = 60) {
		super(0x00ff00, 3); // Verde
		this.followDistance = followDistance;
	}

	public startFollowing(): void {
		this.isFollowing = true;
	}

	public override update(dt: number, player: Container, obstacles: Graphics[]): void {
		if (this.isFollowing) {
			this.moveTowards(player.x, player.y, this.followDistance, obstacles, dt);
		}
	}
}

// --- AGGRESSIVE NPC ---
export class AggressiveNPC extends SmartNPC {
	private detectionRange: number;
	private attackRange: number;

	constructor(detectionRange: number = 200) {
		super(0xff0000, 3.5); // Rojo
		this.detectionRange = detectionRange;
		this.attackRange = 30;
	}

	public override update(dt: number, player: Container, obstacles: Graphics[]): void {
		const dx = player.x - this.x;
		const dy = player.y - this.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < this.detectionRange) {
			this.moveTowards(player.x, player.y, this.attackRange, obstacles, dt);
		}
	}
}

// --- NUEVO: Estados del Cliente ---
export enum CustomerState {
	ARRIVING, // Caminando hacia la barra
	WAITING, // Esperando ser atendido (Timer activo)
	LEAVING_HAPPY, // Atendido, se va feliz
	LEAVING_ANGRY, // Se acabó el tiempo, se va enojado
	FINISHED, // Salió de pantalla
}

// --- CUSTOMER NPC ---
export class CustomerNPC extends SmartNPC {
	public state: CustomerState = CustomerState.ARRIVING;

	private targetPos: Point;
	private exitPos: Point;

	// Lógica de Paciencia
	private totalPatience: number;
	private currentPatience: number;
	private patienceBar: Graphics;

	constructor(spawnX: number, spawnY: number, targetX: number, targetY: number, exitX: number, exitY: number, patienceMs: number) {
		super(0xf1c40f, 3); // Amarillo inicial
		this.x = spawnX;
		this.y = spawnY;
		this.targetPos = new Point(targetX, targetY);
		this.exitPos = new Point(exitX, exitY); // Guardamos la salida para usarla después

		this.totalPatience = patienceMs;
		this.currentPatience = patienceMs;

		// Barra de paciencia visual
		this.patienceBar = new Graphics();
		this.patienceBar.y = -25; // Arriba de la cabeza
		this.addChild(this.patienceBar);

		// Inicialización segura
		this.updatePatienceBar();
		this.patienceBar.visible = false; // Empieza oculta hasta que llegue
	}

	// CORRECCIÓN PRINCIPAL AQUÍ
	public reset(spawnX: number, spawnY: number, targetX: number, targetY: number, exitX: number, exitY: number, patienceMs: number): void {
		this.x = spawnX;
		this.y = spawnY;
		this.targetPos.set(targetX, targetY);
		this.exitPos.set(exitX, exitY);
		this.totalPatience = patienceMs;
		this.currentPatience = patienceMs;
		this.state = CustomerState.ARRIVING;

		// 1. Restaurar color del cuerpo
		(this.body as Graphics).tint = 0xf1c40f;

		// 2. FORZAR el redibujado de la barra ahora mismo (para que esté llena internamente)
		this.updatePatienceBar();

		// 3. Ocultarla mientras camina (hacia la entrada)
		// Esto soluciona que se vea la barra vieja flotando mientras entra.
		this.patienceBar.visible = false;

		this.visible = false; // Invisible por estar fuera de pantalla (se maneja en update)
	}

	public serve(): void {
		if (this.state !== CustomerState.WAITING) {
			return;
		}

		this.state = CustomerState.LEAVING_HAPPY;
		(this.body as Graphics).tint = 0x2ecc71;
		this.patienceBar.visible = false; // Ocultar barra al irse
	}

	public override update(dt: number, _player: Container, obstacles: Graphics[]): void {
		// Lógica de visibilidad (screen bounds)
		const isInside = this.x >= 0 && this.x <= 800;
		// Solo visible si está dentro Y no ha terminado
		this.visible = isInside && this.state !== CustomerState.FINISHED;

		switch (this.state) {
			case CustomerState.ARRIVING:
				this.moveTowards(this.targetPos.x, this.targetPos.y, 0, obstacles, dt);

				// Al llegar al mostrador...
				if (this.getDistance(this.targetPos) < 5) {
					this.state = CustomerState.WAITING;

					// ¡AQUÍ HACEMOS VISIBLE LA BARRA!
					// Aparece llena y limpia justo cuando empieza a esperar.
					this.patienceBar.visible = true;
				}
				break;

			case CustomerState.WAITING:
				this.currentPatience -= dt;
				this.updatePatienceBar();

				if (this.currentPatience <= 0) {
					this.state = CustomerState.LEAVING_ANGRY;
					(this.body as Graphics).tint = 0xe74c3c;
					this.patienceBar.visible = false; // Ocultar barra al irse enojado
				}
				break;

			case CustomerState.LEAVING_HAPPY:
			case CustomerState.LEAVING_ANGRY:
				this.moveTowards(this.exitPos.x, this.exitPos.y, 0, obstacles, dt);
				if (this.getDistance(this.exitPos) < 10) {
					this.state = CustomerState.FINISHED;
					this.visible = false;
				}
				break;
		}
	}

	private updatePatienceBar(): void {
		const pct = Math.max(0, this.currentPatience / this.totalPatience);
		this.patienceBar.clear();

		// Fondo negro
		this.patienceBar.beginFill(0x000000);
		this.patienceBar.drawRect(-15, 0, 30, 6);
		this.patienceBar.endFill();

		// Barra de color (Verde -> Rojo según porcentaje)
		const color = pct > 0.5 ? 0x00ff00 : 0xff0000;
		this.patienceBar.beginFill(color);
		this.patienceBar.drawRect(-14, 1, 28 * pct, 4);
		this.patienceBar.endFill();
	}

	private getDistance(target: Point): number {
		const dx = target.x - this.x;
		const dy = target.y - this.y;
		return Math.sqrt(dx * dx + dy * dy);
	}
}
