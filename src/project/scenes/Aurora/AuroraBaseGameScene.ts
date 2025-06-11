import { Text, TextStyle } from "pixi.js";
import { Container, Graphics, Point, Sprite } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Easing, Tween } from "tweedle.js";

class Node {
	// eslint-disable-next-line prettier/prettier
	constructor(public x: number, public y: number, public g: number = 0, public h: number = 0, public f: number = 0, public parent: Node | null = null) { }
}

enum DialoguePhase {
	DIALOG0,
	DIALOG1,
	DIALOG2,
	DIALOG3,
}

// Nuevas fases de gameplay
enum GamePhase {
	SELECT, // Mover selector para elegir unidad
	MOVE, // Previsualizar y confirmar movimiento
	MOVING, // Animación de movimiento en curso
	ATTACK, // Rango de ataque, elegir objetivo o atacar
	END, // Fin de turno / reset
}

// Definición básica de unidad jugador
interface PlayerUnit {
	id: string;
	gridX: number;
	gridY: number;
	puntosDeMovimiento: number;
	attackRange: number;
	sprite: Sprite;
	hasActed: boolean;
	isEnemy: boolean;
	// Stats:
	strength: number;
	defense: number;
	avoid: number; // porcentaje, ej. 0.03 para 3%
	maxHealthPoints: number;
	healthPoints: number;
	// Health bar:
	healthBar: Graphics;
}

export class AuroraBaseGameScene extends PixiScene {
	private grid: number[][] = [];
	private tileSize = 64;
	private worldContainer = new Container();
	private uiContainer = new Container();
	public static readonly BUNDLES = ["aurora-latest", "abandonedhouse"];

	// Texto para indicar la fase actual
	private phaseText!: Text;

	// Fases de A* pathing (no confundir con GamePhase)
	private pathQueue: Point[] = [];
	private stepStart: Point | null = null;
	private stepEnd: Point | null = null;
	private stepElapsed = 0;
	private stepDuration = 0;
	private speed = 200; // px/segundo para animar movimiento

	// Cámara / Zoom
	private zoom = 2;
	private viewWidth = 0;
	private viewHeight = 0;

	// UI Containers (si los usas)
	private uiRightContainer = new Container();
	private uiCenterContainer = new Container();
	private uiLeftContainer = new Container();
	private pauseContainer = new Container();
	private attackHighlightContainer = new Container();

	private attackRangeCells: Set<string> = new Set();

	// Debug
	private debugText!: Text;

	// Para el grid interactivo
	private tiles: Array<{ tile: Graphics; i: number; j: number }> = [];

	// Selector de grilla
	private selector: Graphics;
	private selectorPos: Point; // coordenadas en grilla del selector

	// Unidades jugador (por ahora 1 unidad; si tienes más, serían varios elementos)
	private playerUnits: PlayerUnit[] = [];
	private selectedUnit: PlayerUnit | null = null;

	// Movimiento: almacenamiento del área de alcance
	private movementRange: Set<string> = new Set(); // claves "x,y"
	// Contenedor para highlights de movimiento
	private highlightContainer = new Container();
	// Para previsualizar ruta
	private pathPreviewContainer: Container | null = null;

	// Fase actual de gameplay
	private gamePhase: GamePhase = GamePhase.SELECT;

	// Zonas caminables (no estrictamente necesario usar)
	private walkableZones: Point[] = [];

	// Variables de diálogo / fases previas que tenías
	private phase = DialoguePhase.DIALOG0;

	constructor() {
		super();

		// Crear grid de ejemplo
		this.grid = this.createGrid();

		// Añadir contenedores
		this.addChild(this.worldContainer, this.uiContainer);

		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiCenterContainer);
		this.addChild(this.uiRightContainer);
		this.addChild(this.pauseContainer);

		// Fondo (tile map o sprite de mapa)
		this.createBackground();

		// Ejemplo de sprite de fondo
		const spr = Sprite.from("map2");
		spr.alpha = 0.7;
		spr.scale.set(0.5);
		// Centrar pivot si deseas rotar/scale
		this.worldContainer.pivot.set(this.worldContainer.width / 2, this.worldContainer.height / 2);
		this.worldContainer.addChild(spr);

		// Crear unidades jugador
		this.createPlayerUnits();

		// Crear selector inicial en (0,0) o en la posición de la unidad
		this.selectorPos = new Point(this.playerUnits[0].gridX, this.playerUnits[0].gridY);
		this.selector = new Graphics();
		// Rectángulo con línea amarilla
		this.selector.lineStyle(2, 0xffff00).drawRect(0, 0, this.tileSize, this.tileSize);
		// Posicionar en world
		this.worldContainer.addChild(this.selector);
		this.updateSelectorPosition();

		// Añadir highlightContainer para mostrar rangos
		this.worldContainer.addChild(this.highlightContainer);

		// Debug text
		this.debugText = new Text("0,0", new TextStyle({ fill: "#ffffff", fontSize: 14 }));
		this.debugText.position.set(10, 10);
		// this.uiContainer.addChild(this.debugText);

		// Recolectar zonas caminables si lo necesitas
		for (let i = 0; i < this.grid.length; i++) {
			for (let j = 0; j < this.grid[0].length; j++) {
				if (this.grid[i][j] === 0) {
					this.walkableZones.push(new Point(i, j));
				}
			}
		}

		// Habilitar interacciones por click solo si lo vas a usar; en este caso usaremos teclado, así que no es necesario
		// this.enableTilesInteraction();

		// 1) Añadimos el text de fase en la UI
		const style = new TextStyle({
			fill: "#ffffff",
			fontSize: 18,
			fontWeight: "bold",
		});
		this.phaseText = new Text("", style);
		// Posición fija en la esquina superior izquierda de la ventana:
		this.phaseText.x = 10;
		this.phaseText.y = 10;
		this.uiContainer.addChild(this.phaseText);

		const bg = new Graphics();
		bg.beginFill(0x000000, 0.5).drawRect(0, 0, 150, 24).endFill();
		this.uiContainer.addChild(bg);
		this.uiContainer.addChild(this.phaseText);
		this.phaseText.x = 5;
		this.phaseText.y = 4;

		// Llamar a la primera vez para mostrar la fase inicial
		this.updatePhaseText();
		this.worldContainer.addChild(this.attackHighlightContainer);
	}

	/**
	 * Calcula attackRangeCells desde la posición de la unidad: BFS hasta depth = attackRange.
	 * - No atraviesa muros (grid===1).
	 * - Si encuentra una unidad enemiga en una celda dentro del rango: incluye esa celda, pero no continúa más allá.
	 * - Si encuentra un aliado: no incluye esa celda ni continúa más allá.
	 */
	private calculateAttackRange(unit: PlayerUnit): void {
		this.attackRangeCells.clear();
		const maxRange = unit.attackRange;
		const rows = this.grid.length;
		const cols = this.grid[0].length;
		type QNode = { x: number; y: number; depth: number };
		const queue: QNode[] = [{ x: unit.gridX, y: unit.gridY, depth: 0 }];
		const visited = new Map<string, number>();
		visited.set(`${unit.gridX},${unit.gridY}`, 0);

		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		];

		while (queue.length) {
			const { x, y, depth } = queue.shift()!;
			if (depth >= maxRange) {
				continue;
			}
			for (const [dx, dy] of dirs) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= rows || ny < 0 || ny >= cols) {
					continue;
				}
				const key = `${nx},${ny}`;
				// Muro?
				if (this.grid[nx][ny] === 1) {
					continue;
				}
				// ¿Unidad en esa celda?
				const occupyingUnit = this.playerUnits.find((u) => u.gridX === nx && u.gridY === ny);
				if (occupyingUnit) {
					if (occupyingUnit.isEnemy) {
						// Enemigo: incluir celda, pero no continuar BFS más allá de aquí
						this.attackRangeCells.add(key);
					}
					// Si es aliado, bloquea: no incluir ni encolar
					continue;
				}
				// Celda vacía: incluir y continuar BFS si no se ha visitado con menor depth
				const nextDepth = depth + 1;
				const prev = visited.get(key);
				if (prev === undefined || nextDepth < prev) {
					visited.set(key, nextDepth);
					this.attackRangeCells.add(key);
					queue.push({ x: nx, y: ny, depth: nextDepth });
				}
			}
		}
	}

	/** Dibuja highlights de ataque en attackRangeCells, ocupando 90% del tile centrado */
	private showAttackRange(): void {
		this.attackHighlightContainer.removeChildren();
		const pad = this.tileSize * 0.05;
		const size = this.tileSize * 0.9;
		for (const key of this.attackRangeCells) {
			const [xs, ys] = key.split(",").map((s) => parseInt(s, 10));
			const g = new Graphics();
			g.beginFill(0x800000, 0.3)
				.drawRect(xs * this.tileSize + pad, ys * this.tileSize + pad, size, size)
				.endFill();
			this.attackHighlightContainer.addChild(g);
		}
	}

	/** Limpia highlights de ataque */
	private clearAttackRange(): void {
		this.attackHighlightContainer.removeChildren();
		this.attackRangeCells.clear();
	}

	private createPlayerUnits(): void {
		// Ejemplo: unidad aliada
		{
			const spriteA = Sprite.from("colonial1");
			spriteA.anchor.set(0.5);
			spriteA.scale.set(0.5);
			const gridX = 5,
				gridY = 1;
			spriteA.x = gridX * this.tileSize + this.tileSize / 2;
			spriteA.y = gridY * this.tileSize + this.tileSize / 2;

			// Crear healthBar Graphics
			const healthBar = new Graphics();
			// Lo añadiremos tras crear unit
			this.worldContainer.addChild(spriteA);
			this.worldContainer.addChild(healthBar);

			const unitA: PlayerUnit = {
				id: "ally1",
				gridX,
				gridY,
				puntosDeMovimiento: 5,
				attackRange: 2,
				sprite: spriteA,
				hasActed: false,
				isEnemy: false,
				// Stats de ejemplo:
				strength: 10,
				defense: 3,
				avoid: 0.04,
				maxHealthPoints: 30,
				healthPoints: 30,
				healthBar,
			};
			// Inicializar la barra (se dibujará en updateHealthBar)
			this.playerUnits.push(unitA);
			// Dibujar posición inicial de la barra:
			this.drawHealthBar(unitA);
		}

		// Ejemplo: unidad enemiga
		{
			const spriteE = Sprite.from("quilmes1");
			spriteE.anchor.set(0.5);
			spriteE.scale.set(0.5);
			const gridX = 8,
				gridY = 3;
			spriteE.x = gridX * this.tileSize + this.tileSize / 2;
			spriteE.y = gridY * this.tileSize + this.tileSize / 2;

			const healthBar = new Graphics();
			this.worldContainer.addChild(spriteE);
			this.worldContainer.addChild(healthBar);

			const unitE: PlayerUnit = {
				id: "enemy1",
				gridX,
				gridY,
				puntosDeMovimiento: 4,
				attackRange: 1,
				sprite: spriteE,
				hasActed: false,
				isEnemy: true,
				// Stats de ejemplo:
				strength: 8,
				defense: 2,
				avoid: 0.02,
				maxHealthPoints: 20,
				healthPoints: 20,
				healthBar,
			};
			this.playerUnits.push(unitE);
			this.drawHealthBar(unitE);
		}
	}

	/**
	 * Dibuja o actualiza la health bar de una unidad:
	 * - Mide el ancho en base a un porcentaje (p.ej. 80% de tileSize).
	 * - Posiciona el Graphics centrado horizontalmente sobre el sprite, un poco arriba.
	 */
	private drawHealthBar(unit: PlayerUnit): void {
		const g = unit.healthBar;
		g.clear();

		const sprite = unit.sprite;
		// Configuración de la barra:
		const barWidth = this.tileSize * 0.8; // 80% del tile
		const barHeight = 6; // altura fija
		const borderThickness = 1; // grosor del contorno
		const percent = unit.healthPoints / unit.maxHealthPoints;
		const filledWidth = Math.max(0, percent) * barWidth;

		// Coordenadas: queremos que la barra quede centrada horizontalmente sobre el sprite,
		// y verticalmente un poco encima: por ejemplo sprite.y - sprite.height/2 - offset.
		// Como el sprite.anchor está en (0.5,0.5), sprite.y es el centro en Y.
		const offsetY = this.tileSize * 0.5; // ajusta este valor a tu sprite; p.ej. 0.5 tile arriba.
		const x = sprite.x - barWidth / 2;
		const y = sprite.y - offsetY;

		// 1) Dibuja fondo de la barra (por ejemplo gris oscuro):
		g.beginFill(0x333333);
		g.drawRect(x, y, barWidth, barHeight);
		g.endFill();

		// 2) Dibuja la parte llena (verde->amarillo->rojo según percent, opcional):
		let color = 0x00ff00;
		if (percent < 0.3) {
			color = 0xff0000;
		} else if (percent < 0.6) {
			color = 0xffff00;
		}
		g.beginFill(color);
		g.drawRect(x + borderThickness, y + borderThickness, Math.max(0, filledWidth - 2 * borderThickness), barHeight - 2 * borderThickness);
		g.endFill();

		// 3) (Opcional) Dibuja contorno:
		g.lineStyle(1, 0x000000);
		g.drawRect(x, y, barWidth, barHeight);
		g.lineStyle(0);
	}

	public override update(dt: number): void {
		// Animar movimiento si hay pathQueue en curso
		this.followPath(dt);

		// updateCamera si quieres centrar en selector o en unidad
		// this.updateCamera(dt);

		// Debug: mostrar coords del selector
		if (this.debugText) {
			this.debugText.text = `Sel: ${this.selectorPos.x},${this.selectorPos.y}`;
		}

		// Manejar input según fase
		this.handleInput();

		// Después de manejar input, actualizar el texto por si la fase cambió
		this.updatePhaseText();

		// Después de posible movimiento, actualizar barras de vida:
		for (const unit of this.playerUnits) {
			this.drawHealthBar(unit);
		}

		// También tus transiciones de diálogo si aún las necesitas
		if (Keyboard.shared.justReleased("Enter")) {
			switch (this.phase) {
				case DialoguePhase.DIALOG0:
					this.phase = DialoguePhase.DIALOG1;
					break;
				case DialoguePhase.DIALOG1:
					this.phase = DialoguePhase.DIALOG2;
					break;
				case DialoguePhase.DIALOG2:
					this.phase = DialoguePhase.DIALOG3;
					break;
				case DialoguePhase.DIALOG3:
					break;
			}
		}

		// Zoom con Numpad (opcional)
		if (Keyboard.shared.justPressed("NumpadAdd")) {
			this.setZoom(this.zoom + 0.4);
		}
		if (Keyboard.shared.justPressed("NumpadSubtract")) {
			this.setZoom(this.zoom - 1);
		}
	}

	/** Actualiza el contenido de phaseText según this.gamePhase */
	private updatePhaseText(): void {
		// Opción 1: usar directamente el nombre del enum:
		const phaseName = GamePhase[this.gamePhase];
		// Opción 2: mapping más amigable, por ejemplo:
		// const phaseLabels: Record<GamePhase, string> = {
		//     [GamePhase.SELECT]: "Fase: Selección",
		//     [GamePhase.MOVE]:   "Fase: Movimiento",
		//     [GamePhase.ATTACK]: "Fase: Ataque",
		//     [GamePhase.END]:    "Fase: Fin de turno",
		// };
		// const phaseName = phaseLabels[this.gamePhase];
		this.phaseText.text = `Fase: ${phaseName}`;
	}

	/** Manejo de input por teclado para mover el selector y confirmar acciones según fase */
	private handleInput(): void {
		if (this.gamePhase === GamePhase.MOVING) {
			// Ignorar input de flechas o confirmaciones mientras la unidad se mueve
			return;
		}
		// Movimiento del selector con flechas
		let moved = false;
		const oldPos = this.selectorPos.clone();

		if (Keyboard.shared.justPressed("ArrowUp")) {
			this.selectorPos.y = Math.max(0, this.selectorPos.y - 1);
			moved = true;
		}
		if (Keyboard.shared.justPressed("ArrowDown")) {
			this.selectorPos.y = Math.min(this.grid[0].length - 1, this.selectorPos.y + 1);
			moved = true;
		}
		if (Keyboard.shared.justPressed("ArrowLeft")) {
			this.selectorPos.x = Math.max(0, this.selectorPos.x - 1);
			moved = true;
		}
		if (Keyboard.shared.justPressed("ArrowRight")) {
			this.selectorPos.x = Math.min(this.grid.length - 1, this.selectorPos.x + 1);
			moved = true;
		}
		if (moved) {
			// Si en ATTACK, restringir solo a attackRangeCells o propia celda
			if (this.gamePhase === GamePhase.ATTACK && this.selectedUnit) {
				const key = `${this.selectorPos.x},${this.selectorPos.y}`;
				const isOrigin = this.selectorPos.x === this.selectedUnit.gridX && this.selectorPos.y === this.selectedUnit.gridY;
				if (!isOrigin && !this.attackRangeCells.has(key)) {
					// Fuera de rango, revertir
					this.selectorPos = oldPos;
				}
			}
			this.updateSelectorPosition();
			if (this.gamePhase === GamePhase.MOVE) {
				this.updatePathPreview();
			}
		}
		// Confirmar o cambiar fase con Enter o Q
		if (Keyboard.shared.justPressed("Enter")) {
			switch (this.gamePhase) {
				case GamePhase.SELECT:
					this.trySelectUnit();
					break;
				case GamePhase.MOVE:
					this.confirmMove();
					break;
				case GamePhase.ATTACK:
					// Podrías permitir “skip” de ataque con Enter
					this.skipAttack();
					break;
				case GamePhase.END:
					// Resetear para siguiente turno
					this.resetForNextTurn();
					break;
			}
		}

		if (Keyboard.shared.justPressed("KeyQ")) {
			if (this.gamePhase === GamePhase.ATTACK) {
				this.doAttack();
			}
		}
	}

	/** Actualiza la posición visual del selector en el mundo según selectorPos */
	private updateSelectorPosition(): void {
		this.selector.x = this.selectorPos.x * this.tileSize;
		this.selector.y = this.selectorPos.y * this.tileSize;
	}

	/** Intentar seleccionar unidad si el selector está sobre una unidad que no haya actuado */
	private trySelectUnit(): void {
		for (const unit of this.playerUnits) {
			// Solo unidades aliadas no actuadas:
			if (!unit.hasActed && !unit.isEnemy && unit.gridX === this.selectorPos.x && unit.gridY === this.selectorPos.y) {
				this.selectedUnit = unit;
				this.gamePhase = GamePhase.MOVE;
				this.calculateMovementRange(unit);
				this.showMovementHighlights();
				this.clearPathPreview();
				return;
			}
		}
		console.log("No hay unidad aliada seleccionable en esa casilla");
	}

	/**
	 * Calcula movementRange como conjunto de celdas alcanzables, considerando:
	 * - Costo de terreno (grid 0 → costo 1; grid 2 → costo 2; grid 1 → muro bloqueante).
	 * - Puntos de movimiento de la unidad.
	 * - Bloqueo de paso por cualquier unidad en el tablero (aliada o enemiga), salvo la casilla de origen.
	 */
	private calculateMovementRange(unit: PlayerUnit): void {
		this.movementRange.clear();
		const visited = new Map<string, number>(); // "x,y" -> costo mínimo hasta allí
		type NodeBM = { x: number; y: number; costSoFar: number };
		const queue: NodeBM[] = [{ x: unit.gridX, y: unit.gridY, costSoFar: 0 }];
		visited.set(`${unit.gridX},${unit.gridY}`, 0);

		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		];

		while (queue.length) {
			const { x, y, costSoFar } = queue.shift()!;
			// Agregar a movementRange si no es la casilla inicial
			if (!(x === unit.gridX && y === unit.gridY)) {
				this.movementRange.add(`${x},${y}`);
			}
			for (const [dx, dy] of dirs) {
				const nx = x + dx;
				const ny = y + dy;
				// Verificar límites
				if (nx < 0 || nx >= this.grid.length || ny < 0 || ny >= this.grid[0].length) {
					continue;
				}
				// Terreno bloqueante?
				const cell = this.grid[nx][ny];
				if (cell === 1) {
					continue; // muro
				}
				// **Chequeo de ocupación**: si hay alguna unidad en (nx,ny), bloquea el paso y no incluimos
				const occupied = this.playerUnits.some((u) => u.gridX === nx && u.gridY === ny);
				if (occupied) {
					continue;
				}
				// Cálculo de costo: grid 0 → 1; grid 2 → 2
				const terrenoCost = cell === 2 ? 2 : 1;
				const newCost = costSoFar + terrenoCost;
				if (newCost > unit.puntosDeMovimiento) {
					continue;
				}
				const key = `${nx},${ny}`;
				const prevCost = visited.get(key);
				if (prevCost === undefined || newCost < prevCost) {
					visited.set(key, newCost);
					queue.push({ x: nx, y: ny, costSoFar: newCost });
				}
			}
		}
	}

	/** Dibuja highlights semitransparentes en movementRange, ocupando 90% del tile centrado */
	private showMovementHighlights(): void {
		this.highlightContainer.removeChildren();
		const pad = this.tileSize * 0.05; // 5% de tileSize
		const size = this.tileSize * 0.9; // 90% de tileSize
		for (const key of this.movementRange) {
			const [xs, ys] = key.split(",").map((s) => parseInt(s, 10));
			const g = new Graphics();
			g.beginFill(0x00ff00, 0.3)
				// desplazamos el rect centrado: xs*tileSize + pad, ys*tileSize + pad
				.drawRect(xs * this.tileSize + pad, ys * this.tileSize + pad, size, size)
				.endFill();
			this.highlightContainer.addChild(g);
		}
	}

	private clearMovementHighlights(): void {
		this.highlightContainer.removeChildren();
	}

	/** Limpia previsualización de ruta */
	private clearPathPreview(): void {
		if (this.pathPreviewContainer) {
			this.worldContainer.removeChild(this.pathPreviewContainer);
			this.pathPreviewContainer = null;
		}
	}

	/** Al moverse el selector en fase MOVE, actualiza previsualización de ruta si la casilla está en movementRange */
	private updatePathPreview(): void {
		this.clearPathPreview();
		if (!this.selectedUnit) {
			return;
		}
		const key = `${this.selectorPos.x},${this.selectorPos.y}`;
		if (!this.movementRange.has(key) && !(this.selectorPos.x === this.selectedUnit.gridX && this.selectorPos.y === this.selectedUnit.gridY)) {
			// fuera de rango o no es la posición inicial
			return;
		}
		// Obtener ruta A* considerando costo de terreno
		const path = this.aStarPath(this.selectedUnit, this.selectorPos.x, this.selectorPos.y);
		if (!path) {
			return;
		}
		// Dibujar ruta
		const container = new Container();
		for (const node of path) {
			// Omitir la primera casilla si quieres, porque es la de origen
			if (node.x === this.selectedUnit.gridX && node.y === this.selectedUnit.gridY) {
				continue;
			}
			const dot = new Graphics()
				.beginFill(0xff0000, 0.5)
				.drawCircle(node.x * this.tileSize + this.tileSize / 2, node.y * this.tileSize + this.tileSize / 2, 3)
				.endFill();
			container.addChild(dot);
		}
		this.worldContainer.addChild(container);
		this.pathPreviewContainer = container;
	}

	/** A* que respeta costo de terreno y evita pasar por casillas bloqueadas.
	 *  También evita tiles ocupados por otras unidades (salvo destino si es la posición inicial). */
	private aStarPath(unit: PlayerUnit, targetX: number, targetY: number): Node[] | null {
		const cols = this.grid.length,
			rows = this.grid[0].length;
		const start = new Node(unit.gridX, unit.gridY, 0, 0, 0, null);
		const goal = new Node(targetX, targetY);
		const open: Node[] = [start],
			closed: Node[] = [];
		while (open.length) {
			// sacar nodo con menor f
			let idx = 0;
			for (let i = 1; i < open.length; i++) {
				if (open[i].f < open[idx].f) {
					idx = i;
				}
			}
			const curr = open[idx];
			if (curr.x === goal.x && curr.y === goal.y) {
				// reconstruir path
				const path: Node[] = [];
				for (let c: Node | null = curr; c; c = c.parent) {
					path.push(new Node(c.x, c.y));
				}
				return path.reverse();
			}
			open.splice(idx, 1);
			closed.push(curr);

			const dirs = [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			];
			for (const [dx, dy] of dirs) {
				const nx = curr.x + dx,
					ny = curr.y + dy;
				if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
					continue;
				}
				// Terreno bloqueado?
				const cell = this.grid[nx][ny];
				if (cell === 1) {
					continue;
				}
				// Evitar pasar por otras unidades (si hay múltiples). En este ejemplo sólo playerUnits:
				const occupied = this.playerUnits.some((u) => u.gridX === nx && u.gridY === ny && !(nx === targetX && ny === targetY));
				if (occupied) {
					continue;
				}
				// Costo de terreno
				const terrenoCost = cell === 2 ? 2 : 1;
				const tentativeG = curr.g + terrenoCost;
				// Evitar exceder puntos de movimiento
				if (tentativeG > unit.puntosDeMovimiento) {
					continue;
				}
				// Comprobar en closed
				if (closed.some((n) => n.x === nx && n.y === ny)) {
					continue;
				}
				// Verificar en open
				const existing = open.find((n) => n.x === nx && n.y === ny);
				const h = Math.abs(nx - goal.x) + Math.abs(ny - goal.y);
				if (!existing) {
					const nb = new Node(nx, ny);
					nb.g = tentativeG;
					nb.h = h;
					nb.f = nb.g + nb.h;
					nb.parent = curr;
					open.push(nb);
				} else if (tentativeG < existing.g) {
					existing.g = tentativeG;
					existing.f = tentativeG + existing.h;
					existing.parent = curr;
				}
			}
		}
		return null;
	}

	/** Confirmar movimiento: mover la unidad seleccionada a selectorPos */
	private confirmMove(): void {
		if (!this.selectedUnit) {
			return;
		}
		const key = `${this.selectorPos.x},${this.selectorPos.y}`;
		let willMove = false;
		if (this.selectorPos.x === this.selectedUnit.gridX && this.selectorPos.y === this.selectedUnit.gridY) {
			// no mueve: nos quedamos en la misma celda
			willMove = false;
		} else if (this.movementRange.has(key)) {
			const path = this.aStarPath(this.selectedUnit, this.selectorPos.x, this.selectorPos.y);
			if (path) {
				this.pathQueue = path.map((n) => new Point(n.x * this.tileSize + this.tileSize / 2, n.y * this.tileSize + this.tileSize / 2));
				this.stepStart = this.stepEnd = null;
				willMove = true;
			}
		} else {
			console.log("Destino fuera de rango de movimiento");
			return;
		}
		this.clearMovementHighlights();
		this.clearPathPreview();

		if (willMove) {
			// Pasamos a fase MOVING y la animación arrancará en followPath
			this.gamePhase = GamePhase.MOVING;
			console.log("Animando movimiento, fase MOVING...");
		} else {
			// No se mueve: la unidad ya está en su casilla. Directamente pasamos a ATTACK:
			this.gamePhase = GamePhase.ATTACK;
			// Calculamos rango en la posición actual, que ya es la final.
			if (this.selectedUnit) {
				this.calculateAttackRange(this.selectedUnit);
				this.showAttackRange();
			}
			console.log("Fase ATTACK: presiona Q para atacar o Enter para saltar");
		}
	}

	/** Cuando followPath termina (pathQueue vacía), actualizar gridX, gridY de la unidad */
	private followPath(dt: number): void {
		if (!this.selectedUnit) {
			return;
		}
		const sprite = this.selectedUnit.sprite;

		if (!this.stepEnd && this.pathQueue.length) {
			// Inicia nuevo paso de animación
			this.stepStart = new Point(sprite.x, sprite.y);
			this.stepEnd = this.pathQueue.shift()!;
			// Ajustar orientación, etc.
			const dx = this.stepEnd.x - this.stepStart.x;
			if (dx < 0) {
				sprite.scale.x = -Math.abs(sprite.scale.x);
			} else if (dx > 0) {
				sprite.scale.x = Math.abs(sprite.scale.x);
			}
			const dy = this.stepEnd.y - this.stepStart.y;
			const dist = Math.hypot(dx, dy);
			this.stepDuration = dist / this.speed;
			this.stepElapsed = 0;
		}

		if (this.stepEnd && this.stepStart) {
			this.stepElapsed += dt / 1000;
			const t = Math.min(this.stepElapsed / this.stepDuration, 1);
			sprite.x = this.stepStart.x + (this.stepEnd.x - this.stepStart.x) * t;
			sprite.y = this.stepStart.y + (this.stepEnd.y - this.stepStart.y) * t;

			if (t >= 1) {
				// Snap final de este paso
				sprite.x = this.stepEnd.x;
				sprite.y = this.stepEnd.y;

				if (this.pathQueue.length === 0) {
					// Último paso completado
					// Actualizar gridX/gridY en la unidad
					const gridX = Math.floor(sprite.x / this.tileSize);
					const gridY = Math.floor(sprite.y / this.tileSize);
					this.selectedUnit.gridX = gridX;
					this.selectedUnit.gridY = gridY;

					// Limpiar step para no reentrar
					this.stepStart = null;
					this.stepEnd = null;

					// Si estábamos en MOVING, terminamos movimiento y pasamos a ATTACK
					if (this.gamePhase === GamePhase.MOVING) {
						this.gamePhase = GamePhase.ATTACK;
						console.log("Movimiento finalizado. Fase ATTACK: presiona Q para atacar o Enter para saltar");
						// Calcular rango centrándose en la nueva posición:
						this.calculateAttackRange(this.selectedUnit);
						this.showAttackRange();
					}
				} else {
					// Todavía quedan pasos: avanzar al siguiente
					this.stepStart = null;
					this.stepEnd = null;
				}
			}
		}
	}

	/** Ejecutar ataque con animación de avance/retroceso del atacante y shake del enemigo */
	private doAttack(): void {
		if (!this.selectedUnit) {
			return;
		}
		const tx = this.selectorPos.x,
			ty = this.selectorPos.y;
		const target = this.playerUnits.find((u) => u.isEnemy && u.gridX === tx && u.gridY === ty);
		if (!target) {
			console.log("No hay enemigo en la celda para atacar");
			this.clearAttackRange();
			this.endAction();
			return;
		}
		// 1) Chequear esquiva antes de animar:
		const rand = Math.random();
		if (rand < target.avoid) {
			console.log(`${target.id} esquivó el ataque de ${this.selectedUnit.id}!`);
			// Animación de swing-miss:
			this.animateMissEffect(this.selectedUnit, target, () => {
				this.clearAttackRange();
				this.endAction();
			});
		} else {
			// Hit: animar golpe real y después aplicar daño
			this.animateAttackEffect(this.selectedUnit, target, () => {
				this.applyDamage(this.selectedUnit, target);
				this.clearAttackRange();
				this.endAction();
			});
		}
	}

	/**
	 * Aplica el daño de atacante a objetivo según stats: strength, defense, avoid.
	 * Si el objetivo esquiva, no recibe daño.
	 * Si el HP del objetivo llega a 0, se maneja la muerte.
	 */
	private applyDamage(attacker: PlayerUnit, target: PlayerUnit): void {
		// 1) Chance de esquivar
		const rand = Math.random();
		if (rand < target.avoid) {
			console.log(`${target.id} esquivó el ataque de ${attacker.id}!`);
			// Efecto de miss:
			this.animateMissEffect(attacker, target, () => {
				// Tras el efecto de miss, simplemente retornamos sin cambiar HP
				// (Si quisieras terminar acción aquí, ya lo hará el caller).
			});
			return;
		}
		// 2) Calcular daño
		const rawDamage = attacker.strength;
		const mitigated = rawDamage - target.defense;
		const damage = Math.max(0, mitigated);
		// 3) Restar HP
		target.healthPoints = Math.max(0, target.healthPoints - damage);
		console.log(`${attacker.id} hace ${damage} de daño a ${target.id}. HP restante: ${target.healthPoints}/${target.maxHealthPoints}`);
		// Mostrar texto flotante de daño
		this.showFloatingText(`${damage}`, target.sprite.x, target.sprite.y - this.tileSize * 0.3, 0xff0000);
		// (Opcional) actualizar barra de HP si la tienes
		this.updateHpBar?.(target);

		// 4) Si llega a 0: muerte
		if (target.healthPoints <= 0) {
			console.log(`${target.id} ha sido derrotado.`);
			this.handleUnitDefeat(target);
		}
	}

	/**
	 * Efecto visual cuando el ataque falla:
	 * - Texto flotante "Miss" en color amarillo.
	 * - Flash rápido del sprite del objetivo (tint).
	 * - Pequeña sacudida leve del atacante (opcional).
	 * @param attacker Unidad atacante.
	 * @param target Unidad objetivo que esquiva.
	 * @param onComplete Callback opcional cuando termina la animación de miss.
	 */
	private animateMissEffect(attacker: PlayerUnit, target: PlayerUnit, onComplete?: () => void): void {
		// 1) Mostrar texto flotante "Miss" sobre el objetivo
		this.showFloatingText("Miss", target.sprite.x, target.sprite.y - this.tileSize * 0.3, 0xffff00);

		// 2) Flash / tint breve del objetivo:
		const sprite = target.sprite;
		const originalTint = sprite.tint;
		const flashTint = 0x999999; // color de flash (gris claro). Ajusta según tu estilo.
		const flashDuration = 200; // ms totales para tintar y restaurar

		// Tween para tint: primero a flashTint, luego de regreso a originalTint
		// Como Tween no trabaja directamente con tint en Pixi (tween de número funciona, pero interpolar tint puede verse raro),
		// haremos un setTimeout simple: tint inmediato, y restaurar tras delay.
		sprite.tint = flashTint;
		setTimeout(() => {
			sprite.tint = originalTint;
		}, flashDuration);

		// 3) Pequeña sacudida del atacante para indicar swing sin impacto
		// Podríamos usar shakeSprite con valores muy leves, o simplemente un avance y retroceso muy pequeño.
		const atkSprite = attacker.sprite;
		// Guardar posición original
		const atkOrigX = atkSprite.x;
		const atkOrigY = atkSprite.y;
		// Dirección hacia el target
		const dx = target.sprite.x - atkOrigX;
		const dy = target.sprite.y - atkOrigY;
		const dist = Math.hypot(dx, dy);
		const dirX = dist > 0 ? dx / dist : 0;
		const dirY = dist > 0 ? dy / dist : 0;
		const advanceDistance = 5; // px leve, menor que en golpe real
		const advanceDuration = 100; // ms para avanzar
		const retreatDuration = 100; // ms para retroceder

		// Tween avance:
		const advanceTween = new Tween(atkSprite)
			.to(
				{
					x: atkOrigX + dirX * advanceDistance,
					y: atkOrigY + dirY * advanceDistance,
				},
				advanceDuration
			)
			.easing(Easing.Quadratic.Out);

		advanceTween.onComplete(() => {
			// Al completar avance, retroceder:
			const retreatTween = new Tween(atkSprite).to({ x: atkOrigX, y: atkOrigY }, retreatDuration).easing(Easing.Quadratic.In);
			retreatTween.onComplete(() => {
				// Al terminar retroceso, invocamos onComplete si existe
				if (onComplete) {
					onComplete();
				}
			});
			retreatTween.start();
		});

		advanceTween.start();

		// Si no quieres sacudida del atacante, puedes omitir la parte de advanceTween y simplemente llamar onComplete tras flash:
		// setTimeout(() => { if (onComplete) onComplete(); }, flashDuration);
	}

	/**
	 * Muestra un texto flotante (por ejemplo, daño) sobre cierta posición en pantalla.
	 * Esto es opcional, sirve para feedback visual.
	 */
	private showFloatingText(text: string, worldX: number, worldY: number, color: number): void {
		const style = new TextStyle({ fill: color.toString(16), fontSize: 16, fontWeight: "bold" });
		const txt = new Text(text, style);
		txt.anchor.set(0.5);
		txt.x = worldX;
		txt.y = worldY;
		this.worldContainer.addChild(txt);
		// Animar hacia arriba y fade out:
		const duration = 800; // ms
		const targetY = worldY - 20;
		const tween = new Tween(txt).to({ y: targetY, alpha: 0 }, duration).easing(Easing.Quadratic.Out);
		tween.onComplete(() => {
			this.worldContainer.removeChild(txt);
		});
		tween.start();
	}

	/**
	 * Maneja la muerte de una unidad: remover sprite, marcar estado, etc.
	 */
	private handleUnitDefeat(unit: PlayerUnit): void {
		// Remover sprite de la escena:
		if (unit.sprite.parent) {
			unit.sprite.parent.removeChild(unit.healthBar);
			unit.sprite.parent.removeChild(unit.sprite);
		}
		// Opcional: quitar de this.playerUnits
		const idx = this.playerUnits.indexOf(unit);
		if (idx >= 0) {
			this.playerUnits.splice(idx, 1);
		}
		// Si el derrotado es el seleccionado, limpiamos selectedUnit:
		if (this.selectedUnit === unit) {
			this.selectedUnit = null;
		}
		// Aquí podrías reproducir animación de muerte, SFX, etc.
	}

	// Función para actualizar barra:
	private updateHpBar(unit: PlayerUnit): void {
		const bar = (unit as any).hpBar as Graphics;
		if (!bar) {
			return;
		}
		const x = unit.gridX * this.tileSize;
		const y = unit.gridY * this.tileSize - 8; // justo encima del tile
		const w = this.tileSize * 0.8;
		const h = 4;
		const pct = unit.healthPoints / unit.maxHealthPoints;
		bar.clear();
		// Fondo
		bar.beginFill(0x000000)
			.drawRect(x + (this.tileSize - w) / 2, y, w, h)
			.endFill();
		// Vida
		bar.beginFill(0x00ff00)
			.drawRect(x + (this.tileSize - w) / 2, y, w * pct, h)
			.endFill();
	}
	/**
	 * Anima el avance y retroceso del atacante y el shake del objetivo.
	 * @param attacker Unidad atacante
	 * @param target Unidad objetivo
	 * @param onComplete Callback cuando toda la animación finaliza
	 */
	private animateAttackEffect(attacker: PlayerUnit, target: PlayerUnit, onComplete: () => void): void {
		const atkSprite = attacker.sprite;
		const tgtSprite = target.sprite;

		// Guardar posiciones originales en pixeles
		const atkOrigX = atkSprite.x;
		const atkOrigY = atkSprite.y;
		const tgtOrigX = tgtSprite.x;
		const tgtOrigY = tgtSprite.y;

		// Calcular dirección desde atacante hacia objetivo
		const dx = tgtOrigX - atkOrigX;
		const dy = tgtOrigY - atkOrigY;
		const dist = Math.hypot(dx, dy);
		// Evitar división por cero; si están en la misma posición (caso raro), no mover atacante
		const dirX = dist > 0 ? dx / dist : 0;
		const dirY = dist > 0 ? dy / dist : 0;

		// Parámetros de animación; ajusta a tu gusto
		const advanceDistance = 10; // px que avanza el atacante hacia el enemigo
		const advanceDuration = 100; // ms para avanzar
		const retreatDuration = 100; // ms para volver
		const shakeMagnitude = 5; // px máximo de shake en cada dirección
		const shakeTimes = 4; // número de oscilaciones de shake
		const shakeDurationPer = 50; // ms por cada pequeño movimiento de shake

		// 1) Animar avance del atacante
		//    Con Tween, podemos animar directamente atkSprite.x / atkSprite.y hacia la posición avanzada:
		const advanceTween = new Tween(atkSprite)
			.to(
				{
					x: atkOrigX + dirX * advanceDistance,
					y: atkOrigY + dirY * advanceDistance,
				},
				advanceDuration
			)
			.easing(Easing.Quadratic.Out);

		// 2) Al completar avance, lanzar shake del objetivo y luego retroceso del atacante
		advanceTween.onComplete(() => {
			// Iniciar shake en el objetivo
			this.shakeSprite(tgtSprite, shakeMagnitude, shakeTimes, shakeDurationPer, () => {
				// Al completar shake, nada más; la posición del objetivo ya se restauró dentro de shakeSprite.

				// Ahora retrocedemos al atacante a su posición original
				const retreatTween = new Tween(atkSprite).to({ x: atkOrigX, y: atkOrigY }, retreatDuration).easing(Easing.Quadratic.In);

				retreatTween.onComplete(() => {
					// Toda la animación de ataque/retroceso y shake completada
					onComplete();
				});
				retreatTween.start();
			});
		});

		// Start advance tween
		advanceTween.start();
	}

	/**
	 * Aplica shake a un sprite: desplaza repetidamente la posición local en rangos [-magnitude, +magnitude],
	 * varias veces, y finalmente restaura la posición original.
	 * @param sprite El Sprite a sacudir.
	 * @param magnitude Máximo desplazamiento en px en cada eje.
	 * @param times Número de oscilaciones (ida y vuelta cuentan dentro de este número).
	 * @param durationPer Duración en ms de cada pequeño movimiento.
	 * @param onComplete Callback al finalizar todo el shake.
	 */
	private shakeSprite(sprite: Sprite, magnitude: number, times: number, durationPer: number, onComplete: () => void): void {
		const origX = sprite.x;
		const origY = sprite.y;
		let count = 0;

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const doShakeStep = () => {
			if (count >= times) {
				// Restaurar posición original con un tween rápido para evitar glitch
				const restoreTween = new Tween(sprite).to({ x: origX, y: origY }, durationPer).easing(Easing.Quadratic.Out);
				restoreTween.onComplete(() => {
					onComplete();
				});
				restoreTween.start();
				return;
			}
			// Generar un desplazamiento aleatorio en [-magnitude, +magnitude]
			const offsetX = (Math.random() * 2 - 1) * magnitude;
			const offsetY = (Math.random() * 2 - 1) * magnitude;
			// Tween desde la posición actual (que debería estar restaurada o en orig) a la nueva posición desplazada
			const shakeTween = new Tween(sprite).to({ x: origX + offsetX, y: origY + offsetY }, durationPer).easing(Easing.Quadratic.InOut);
			shakeTween.onComplete(() => {
				// Después de moverse, incrementamos contador y volvemos a iniciar otra oscilación
				count++;
				doShakeStep();
			});
			shakeTween.start();
		};

		// Iniciar primera oscilación
		doShakeStep();
	}
	/** Saltar ataque */
	private skipAttack(): void {
		console.log("Salto fase de ataque");
		this.endAction();
	}

	/** Finaliza acción de la unidad: marca hasActed y pasa a END */
	private endAction(): void {
		if (this.selectedUnit) {
			this.selectedUnit.hasActed = true;
		}
		// Limpiar highlights de ataque:
		this.clearAttackRange();
		this.gamePhase = GamePhase.END;
		console.log("Fase END: presiona Enter para continuar");
	}

	/** Reset al inicio de siguiente turno o siguiente unidad */
	private resetForNextTurn(): void {
		// Limpiar si quedara algo
		this.clearAttackRange();
		// Por ahora, si solo tienes una unidad, reiniciamos su hasActed para un nuevo turno:
		for (const u of this.playerUnits) {
			u.hasActed = false;
		}
		this.selectedUnit = null;
		// Reiniciar selector a la primera unidad o a (0,0)
		const first = this.playerUnits[0];
		this.selectorPos.set(first.gridX, first.gridY);
		this.updateSelectorPosition();
		this.gamePhase = GamePhase.SELECT;
		console.log("Nueva fase SELECT: mueve selector y presiona Enter sobre unidad");
	}

	/** Dibuja background de grilla usando Graphics. Adaptar según tu mapa real. */
	private createBackground(): void {
		for (let i = 0; i < this.grid.length; i++) {
			for (let j = 0; j < this.grid[i].length; j++) {
				const tile = new Graphics();
				const alpha = 0.01;
				let color = 0x0000ff;
				if (this.grid[i][j] === 1) {
					color = 0xff0000;
				} else if (this.grid[i][j] === 2) {
					color = 0x44ffff;
				}
				tile.beginFill(color, alpha)
					.drawRect(i * this.tileSize, j * this.tileSize, this.tileSize, this.tileSize)
					.endFill();
				this.worldContainer.addChild(tile);
				this.tiles.push({ tile, i, j });
			}
		}
	}

	private createGrid(): number[][] {
		const rows = 12,
			cols = 8;
		const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
		// ... tu lógica de dibujar muros y zonas ...
		/* Ejemplo simplificado (deja tu propio):
		this.drawV(grid, 0, cols, 0, 2);
		this.drawV(grid, 0, cols, rows - 2, 2);
		this.drawH(grid, 0, 0, rows, 2);
		this.drawH(grid, cols - 1, 0, rows, 1);
		etc.
		*/

		return grid;
	}

	public drawH(grid: number[][], x: number, y0: number, y1: number, thickness = 1): void {
		for (let tx = 0; tx < thickness; tx++) {
			for (let y = y0; y < y1; y++) {
				grid[y][x + tx] = 1;
			}
		}
	}
	public drawV(grid: number[][], x0: number, x1: number, y: number, thickness = 1): void {
		for (let ty = 0; ty < thickness; ty++) {
			for (let x = x0; x < x1; x++) {
				grid[y + ty][x] = 1;
			}
		}
	}
	public drawZoneH(grid: number[][], x: number, y0: number, y1: number, thickness = 1): void {
		for (let tx = 0; tx < thickness; tx++) {
			for (let y = y0; y < y1; y++) {
				grid[y][x + tx] = 2;
			}
		}
	}
	public drawZoneV(grid: number[][], x0: number, x1: number, y: number, thickness = 1): void {
		for (let ty = 0; ty < thickness; ty++) {
			for (let x = x0; x < x1; x++) {
				grid[y + ty][x] = 2;
			}
		}
	}

	/** Cámara centrada: por defecto centrar en selector o en unidad seleccionada */
	public updateCamera(_dt: number): void {
		// Centrar la vista en el selector
		const targetGridX = this.selectorPos.x,
			targetGridY = this.selectorPos.y;
		const worldX = targetGridX * this.tileSize + this.tileSize / 2;
		const worldY = targetGridY * this.tileSize + this.tileSize / 2;
		const offsetX = this.viewWidth / 2;
		const offsetY = this.viewHeight / 2;
		const scaleX = this.worldContainer.worldTransform.a;
		const scaleY = this.worldContainer.worldTransform.d;
		const desiredX = offsetX - worldX * scaleX + (this.tileSize * scaleX) / 2;
		const desiredY = offsetY - worldY * scaleY + (this.tileSize * scaleY) / 2;
		// Ajuste directo (puedes interpolar si quieres suavizar)
		this.worldContainer.scale.set(this.zoom, this.zoom);
		this.worldContainer.x = desiredX;
		this.worldContainer.y = desiredY;
	}

	/** Zoom suave */
	public setZoom(factor: number): void {
		const newZoom = Math.max(0.2, Math.min(6, factor));
		const oldZoom = this.zoom;
		this.zoom = newZoom;
		const proxy = { z: oldZoom };
		new Tween(proxy)
			.to({ z: newZoom }, 500)
			.easing(Easing.Quadratic.Out)
			.onUpdate(() => {
				this.worldContainer.scale.set(proxy.z, proxy.z);
			})
			.start();
	}

	public override onResize(w: number, h: number): void {
		this.viewWidth = w;
		this.viewHeight = h;
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 700, 520, ScaleHelper.FIT);
		this.worldContainer.x = w / 2;
		this.worldContainer.y = h / 2;
		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiContainer.x = 0;
		this.uiContainer.y = 0;
		// this.worldContainer.scale.set(this.zoom, this.zoom);
		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiRightContainer.x = w;
		this.uiRightContainer.y = 0;
		ScaleHelper.setScaleRelativeToIdeal(this.uiCenterContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiCenterContainer.x = w * 0.5;
		this.uiCenterContainer.y = 0;
		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;
		ScaleHelper.setScaleRelativeToIdeal(this.pauseContainer, w, h, 1536, 1200, ScaleHelper.FIT);
		this.pauseContainer.x = w / 2;
		this.pauseContainer.y = h / 2;
	}
}
