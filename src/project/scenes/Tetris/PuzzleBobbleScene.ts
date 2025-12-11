/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable prettier/prettier */
import { Container, Graphics, Point, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

// Interfaz mejorada para incluir la referencia visual
interface Bubble {
	gridRow: number; // Fila lógica
	gridCol: number; // Columna lógica
	x: number;
	y: number;
	radius: number;
	color: string;
	active: boolean;
	view: Graphics; // Referencia al objeto visual para no recrearlo
	processed?: boolean;
}

export class PuzzleBobbleScene extends PixiScene {
	// --- NUEVAS DIMENSIONES FIJAS DEL ÁREA DE JUEGO ---
	private readonly GAME_WIDTH = 400;
	private readonly GAME_HEIGHT = 700;

	private readonly GRID_SIZE = 40;
	private readonly BUBBLE_RADIUS = 19;
	private readonly WALL_SIZE = 10;
	private readonly TARGET_FPS = 60; // Constante para la conversión de dt a segundos

	// --- CONSTANTES DEL JUEGO ---
	private readonly WAVE_INTERVAL_SECONDS = 35; // Tiempo entre avances de cuadrícula
	private readonly SHAKE_WARNING_SECONDS = 5; // Tiempo de aviso de temblor antes de avanzar
	private readonly SHAKE_DURATION_SECONDS = 3.5; // Duración del efecto de shake (al avanzar)

	// Configuración de colores
	private colors = ["red", "orange", "green", "yellow", "blue"];
	private colorMap: Record<string, string> = { R: "red", G: "green", B: "blue", Y: "yellow", O: "orange" };

	// Nivel de prueba
	private level1 = [
		["R", "R", "Y", "Y", "B", "B", "G", "G"],
		["R", "R", "Y", "Y", "B", "B", "G"],
		["B", "B", "G", "G", "R", "R", "Y", "Y"],
		["B", "G", "G", "R", "R", "Y", "Y"],
	];

	private bubbles: Bubble[] = [];
	private particles: Bubble[] = [];

	// --- ESTADO DEL JUEGO ---
	private score: number = 0;
	private wave: number = 1;
	private waveTimer: number = this.WAVE_INTERVAL_SECONDS; // Tiempo hasta que la cuadrícula avanza
	private isShaking: boolean = false;
	private shakeTimer: number = 0; // Temporizador interno para el shake

	// Shooter
	private shooterBase: Point = new Point();
	private arrow: Graphics = new Graphics();
	private currentBubbleView: Graphics = new Graphics();

	// Estado del disparo
	private shootState: "AIMING" | "SHOOTING" = "AIMING";
	private projectile = { x: 0, y: 0, dx: 0, dy: 0, color: "red", radius: 0, active: false };
	private shootAngle = 0;
	private aimDirection = 0;

	// Contenedores
	private mainContainer = new Container(); // Contenedor principal que se centrará
	private gameLayer = new Container(); // Contiene la cuadrícula, burbujas y proyectil (sufrirá shake)
	private uiLayer = new Container(); // Contiene la flecha/UI (NO sufrirá shake)

	// --- UI Text Objects ---
	private scoreText: Text;
	private waveText: Text;

	constructor() {
		super();

		// Configuración de estilo de texto
		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 16,
			fill: 0xffffff,
			fontWeight: "bold",
			stroke: 0x000000,
			strokeThickness: 2,
		});
		this.scoreText = new Text("", textStyle);
		this.waveText = new Text("", textStyle);

		// Agregar capas al contenedor principal
		this.mainContainer.addChild(this.gameLayer);
		this.mainContainer.addChild(this.uiLayer);

		// Agregar el contenedor principal a la escena
		this.addChild(this.mainContainer);

		this.createShooterUI();
		this.setupGrid();

		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
	}

	private updateUIText(): void {
		this.scoreText.text = `Puntaje: ${this.score}`;

		// Mostrar la wave y el tiempo restante
		const timerDisplay = Math.max(0, Math.ceil(this.waveTimer));
		this.waveText.text = `Wave ${this.wave} (${timerDisplay}s)`;
	}

	private createShooterUI(): void {
		const w = this.GAME_WIDTH; // Usar el ancho fijo
		const h = this.GAME_HEIGHT; // Usar el alto fijo

		// La base del tirador se centra en el área de juego fija
		this.shooterBase.set(w / 2, h - 100);

		// Dibujar flecha (Solo una vez)
		this.arrow.lineStyle(4, 0xffffff).moveTo(0, 0).lineTo(0, -100).moveTo(0, -100).lineTo(-10, -80).moveTo(0, -100).lineTo(10, -80);
		this.arrow.position.copyFrom(this.shooterBase);
		this.uiLayer.addChild(this.arrow);

		// Preparar visual del proyectil
		this.gameLayer.addChild(this.currentBubbleView);
		this.loadNextProjectile();

		// Paredes (dibujadas según el ancho y alto fijo)
		const walls = new Graphics()
			.beginFill(0x333333)
			.drawRect(0, 0, this.WALL_SIZE, h) // Izq
			.drawRect(w - this.WALL_SIZE, 0, this.WALL_SIZE, h) // Der
			.drawRect(0, 0, w, this.WALL_SIZE) // Techo
			.endFill();
		this.gameLayer.addChildAt(walls, 0);

		// --- UI para Score y Wave ---
		this.scoreText.anchor.set(0, 0.5);
		this.scoreText.position.set(this.WALL_SIZE + 10, h - 30);
		this.uiLayer.addChild(this.scoreText);

		this.waveText.anchor.set(1, 0.5); // Align right
		this.waveText.position.set(w - this.WALL_SIZE - 10, h - 30);
		this.uiLayer.addChild(this.waveText);

		this.updateUIText(); // Inicializar texto
	}

	// Calcula posición X/Y basada en Fila/Columna (Hexagonal)
	private getGridPosition(row: number, col: number): Point {
		const isEvenRow = row % 2 === 0;

		// La columna máxima es 7 para filas pares (8 burbujas) y 6 para impares (7 burbujas).
		const maxCol = isEvenRow ? 7 : 6;

		// CRÍTICO: Si la burbuja se mueve a una columna 7 en una fila impar (que solo tiene 7 slots), 
		// forzamos visualmente la columna a 6 para evitar que se salga del muro.
		// Esto crea un solapamiento visual con la burbuja en la columna 6, pero respeta el "no eliminar".
		const effectiveCol = Math.min(col, maxCol);

		const offsetX = isEvenRow ? 0 : this.GRID_SIZE / 2;
		// La posición se calcula a partir del muro izquierdo (this.WALL_SIZE)
		const x = this.WALL_SIZE + effectiveCol * this.GRID_SIZE + offsetX + this.GRID_SIZE / 2;
		const y = this.WALL_SIZE + row * (this.GRID_SIZE * 0.85) + this.GRID_SIZE / 2;
		return new Point(x, y);
	}

	private setupGrid(): void {
		const rows = this.level1.length;
		for (let r = 0; r < rows; r++) {
			const cols = this.level1[r].length;
			for (let c = 0; c < cols; c++) {
				const char = this.level1[r][c];
				if (char && this.colorMap[char]) {
					this.addBubbleToGrid(r, c, this.colorMap[char]);
				}
			}
		}
	}

	private addBubbleToGrid(row: number, col: number, color: string): Bubble {
		const pos = this.getGridPosition(row, col);

		// Crear Gráfico persistente
		const view = new Graphics().beginFill(color).lineStyle(1, 0x000000, 0.2).drawCircle(0, 0, this.BUBBLE_RADIUS).endFill();

		view.x = pos.x;
		view.y = pos.y;
		this.gameLayer.addChild(view);

		const bubble: Bubble = {
			gridRow: row,
			gridCol: col,
			x: pos.x,
			y: pos.y,
			radius: this.BUBBLE_RADIUS,
			color: color,
			active: true,
			view: view,
		};
		this.bubbles.push(bubble);
		return bubble;
	}

	private loadNextProjectile(): void {
		const existingColors = [...new Set(this.bubbles.map((b) => b.color))];
		const color = existingColors.length > 0 ? existingColors[Math.floor(Math.random() * existingColors.length)] : this.colors[Math.floor(Math.random() * this.colors.length)];

		this.projectile.color = color;
		this.projectile.radius = this.BUBBLE_RADIUS;
		this.projectile.x = this.shooterBase.x;
		this.projectile.y = this.shooterBase.y;
		this.projectile.active = true;

		this.currentBubbleView.clear().beginFill(color).drawCircle(0, 0, this.BUBBLE_RADIUS).endFill();
		this.currentBubbleView.position.set(this.projectile.x, this.projectile.y);
		this.currentBubbleView.visible = true;
	}

	// Método para iniciar el temblor
	private startShake(): void {
		this.isShaking = true;
		this.shakeTimer = 0;
	}

	// Helper para generar una nueva fila aleatoria
	private generateNewRow(): string[] {
		// La longitud de la fila 0 siempre es 8 (fila par)
		const rowLength = 8;
		const newRow: string[] = [];
		for (let i = 0; i < rowLength; i++) {
			newRow.push(this.colors[Math.floor(Math.random() * this.colors.length)]);
		}
		return newRow;
	}

	private advanceGrid(): void {
		let gameOver = false;

		// 1. Mover burbujas existentes hacia abajo
		const bubblesToProcess = this.bubbles;
		this.bubbles = []; // Resetear la lista principal

		for (const b of bubblesToProcess) {
			b.gridRow += 1; // Fila lógica: ¡SOLO BAJA!

			// Recalcular la posición usando el nuevo gridRow y el gridCol original.
			// La función getGridPosition se encarga de aplicar el desplazamiento y la corrección visual.
			const newPos = this.getGridPosition(b.gridRow, b.gridCol);

			b.x = newPos.x;
			b.y = newPos.y;

			b.view.x = b.x; // Actualizar la vista X
			b.view.y = b.y; // Actualizar la vista Y

			this.bubbles.push(b); // Añadir a la nueva lista de burbujas activas

			// 2. Verificar Game Over (la línea del shooter está en h-100)
			if (b.y > this.shooterBase.y - this.BUBBLE_RADIUS) {
				gameOver = true;
			}
		}

		if (gameOver) {
			console.log(`¡GAME OVER! Tu puntaje final es: ${this.score}`);
			// Implementación simple de Game Over: detiene el temporizador y el juego
			this.waveTimer = Infinity;
			this.isShaking = false;
			this.gameLayer.x = 0;
			this.gameLayer.y = 0;
			return;
		}

		// 3. Crear nueva fila en la parte superior (row 0)
		const newRowData = this.generateNewRow();
		newRowData.forEach((color, index) => {
			if (color) {
				// Las burbujas recién creadas se insertan en la fila 0
				this.addBubbleToGrid(0, index, color);
			}
		});

		this.waveTimer = this.WAVE_INTERVAL_SECONDS; // Resetear timer
		this.wave += 1; // Incrementar wave
		this.startShake(); // Pequeño shake al avanzar
		this.updateUIText();
	}

	public override update(dt: number): void {
		// CORRECCIÓN: Usar dt para calcular el tiempo real en segundos.
		const dtSeconds = dt / this.TARGET_FPS;

		// El delta factor para velocidad constante se mantiene como el usuario lo definió
		const delta = dt * 0.06;

		// 1. Lógica de Apuntado
		if (this.shootState === "AIMING") {
			if (this.aimDirection !== 0) {
				this.shootAngle += this.aimDirection * 0.05 * delta;
				const maxAngle = Math.PI / 2.5;
				this.shootAngle = Math.max(-maxAngle, Math.min(maxAngle, this.shootAngle));
				this.arrow.rotation = this.shootAngle;
			}
		}

		// 2. Lógica de Disparo
		if (this.shootState === "SHOOTING") {
			const speed = 15 * delta;
			this.projectile.x += this.projectile.dx * speed;
			this.projectile.y += this.projectile.dy * speed;

			// Actualizar vista
			this.currentBubbleView.x = this.projectile.x;
			this.currentBubbleView.y = this.projectile.y;

			// Rebote Paredes (usando GAME_WIDTH como límite)
			if (this.projectile.x < this.WALL_SIZE + this.BUBBLE_RADIUS) {
				this.projectile.x = this.WALL_SIZE + this.BUBBLE_RADIUS;
				this.projectile.dx *= -1;
			} else if (this.projectile.x > this.GAME_WIDTH - this.WALL_SIZE - this.BUBBLE_RADIUS) {
				this.projectile.x = this.GAME_WIDTH - this.WALL_SIZE - this.BUBBLE_RADIUS;
				this.projectile.dx *= -1;
			}

			// Colisión con Techo (usando el límite superior)
			if (this.projectile.y < this.WALL_SIZE + this.BUBBLE_RADIUS) {
				this.snapProjectile();
				return;
			}

			// Colisión con Burbujas
			for (const b of this.bubbles) {
				const dx = this.projectile.x - b.x;
				const dy = this.projectile.y - b.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < this.BUBBLE_RADIUS * 2 - 4) {
					this.snapProjectile();
					return;
				}
			}
		}

		// 3. Partículas cayendo (usando GAME_HEIGHT como límite)
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.view.y += 10 * delta;
			p.view.rotation += 0.1;
			if (p.view.y > this.GAME_HEIGHT) {
				this.gameLayer.removeChild(p.view);
				this.particles.splice(i, 1);
			}
		}

		// 4. Lógica de avance de cuadrícula (Timer)
		if (this.waveTimer !== Infinity) {
			// Solo si el juego no ha terminado
			this.waveTimer -= dtSeconds; // CORRECTO: Restar tiempo real
			this.updateUIText();

			// Manejar el aviso de "shake"
			// El temblor se activa cuando el tiempo restante es menor al aviso y no está en curso.
			if (this.waveTimer <= this.SHAKE_WARNING_SECONDS && this.waveTimer > 0 && !this.isShaking) {
				this.startShake();
			}

			if (this.waveTimer <= 0) {
				this.advanceGrid();
			}
		}

		// 5. Manejar el efecto "shake"
		if (this.isShaking) {
			this.shakeTimer += dtSeconds; // Usar tiempo real para el shake
			// El temblor de advertencia dura 3 segundos. El temblor post-avance dura 0.5 segundos.
			const currentShakeDuration = this.waveTimer > 0 ? this.SHAKE_WARNING_SECONDS : this.SHAKE_DURATION_SECONDS;

			if (this.shakeTimer < currentShakeDuration) {
				// Aplicar un temblor de advertencia (más suave y largo) o un temblor de avance (más corto y brusco)
				const magnitude = this.waveTimer > 0 ? 2 : 4;
				this.gameLayer.x = Math.random() * magnitude - magnitude / 2;
				this.gameLayer.y = Math.random() * magnitude - magnitude / 2;
			} else {
				this.isShaking = false;
				this.gameLayer.x = 0; // Resetear posición
				this.gameLayer.y = 0;
			}
		}
	}

	// Encuentra la celda más cercana vacía y coloca la burbuja
	private snapProjectile(): void {
		this.shootState = "AIMING";

		// Algoritmo simple: encontrar la celda de grilla ideal basada en la posición XY
		const approxRow = Math.round((this.projectile.y - this.WALL_SIZE - this.GRID_SIZE / 2) / (this.GRID_SIZE * 0.85));

		const isEvenRow = approxRow % 2 === 0;
		const offsetX = isEvenRow ? 0 : this.GRID_SIZE / 2;
		const approxCol = Math.round((this.projectile.x - this.WALL_SIZE - offsetX - this.GRID_SIZE / 2) / this.GRID_SIZE);

		const newBubble = this.addBubbleToGrid(approxRow, approxCol, this.projectile.color);
		this.currentBubbleView.visible = false;

		// Procesar Matches
		this.handleMatches(newBubble);
		this.loadNextProjectile();
	}

	private handleMatches(startNode: Bubble): void {
		const matches = this.findMatches(startNode);

		if (matches.length >= 3) {
			// Eliminar Matches
			matches.forEach((b) => this.removeBubble(b));

			// Eliminar islas flotantes
			this.dropFloatingBubbles();
		}
	}

	private findMatches(start: Bubble): Bubble[] {
		const toProcess = [start];
		const matched: Bubble[] = [];
		const checked = new Set<Bubble>();

		matched.push(start);
		checked.add(start);

		// Flood fill por color
		while (toProcess.length > 0) {
			const current = toProcess.pop()!;
			const neighbors = this.getNeighbors(current);

			for (const n of neighbors) {
				if (!checked.has(n) && n.color === start.color) {
					checked.add(n);
					matched.push(n);
					toProcess.push(n);
				}
			}
		}
		return matched;
	}

	private getNeighbors(b: Bubble): Bubble[] {
		const isEven = b.gridRow % 2 === 0;
		const offsets = isEven
			? [
				[-1, -1],
				[-1, 0],
				[0, -1],
				[0, 1],
				[1, -1],
				[1, 0],
			] // Fila Par (row % 2 === 0)
			: [
				[-1, 0],
				[-1, 1],
				[0, -1],
				[0, 1],
				[1, 0],
				[1, 1],
			]; // Fila Impar (row % 2 !== 0)

		const neighbors: Bubble[] = [];

		for (const o of offsets) {
			const nRow = b.gridRow + o[0];
			const nCol = b.gridCol + o[1];

			// La verificación de columna debe tener en cuenta el índice real de la burbuja, 
			// no el índice efectivo que usamos para el cálculo de posición.
			// Si una burbuja tiene gridCol=7 en una fila impar, la lógica de vecino fallará
			// porque no existen las columnas 7 en filas impares para los vecinos.
			const maxCol = nRow % 2 === 0 ? 7 : 6;

			// Si la columna está fuera de rango para esa fila, saltar.
			if (nCol < 0 || nCol > maxCol) {
				continue;
			}

			const found = this.bubbles.find((bub) => bub.gridRow === nRow && bub.gridCol === nCol);
			if (found) {
				neighbors.push(found);
			}
		}
		return neighbors;
	}

	private removeBubble(b: Bubble): void {
		b.active = false;
		this.gameLayer.removeChild(b.view);
		this.bubbles = this.bubbles.filter((bub) => bub !== b);
		this.score += 10; // Añadir puntuación
	}

	private dropFloatingBubbles(): void {
		// 1. Marcar todas las burbujas conectadas al techo
		const rooted = new Set<Bubble>();
		const toCheck = this.bubbles.filter((b) => b.gridRow === 0);

		toCheck.forEach((b) => rooted.add(b));

		let index = 0;
		while (index < toCheck.length) {
			const current = toCheck[index];
			index++;
			const neighbors = this.getNeighbors(current);
			for (const n of neighbors) {
				if (!rooted.has(n)) {
					rooted.add(n);
					toCheck.push(n);
				}
			}
		}

		// 2. Las que no están en "rooted" caen
		const floating = this.bubbles.filter((b) => !rooted.has(b));
		floating.forEach((b) => {
			this.bubbles = this.bubbles.filter((bub) => bub !== b);
			this.particles.push(b); // Mover al array de partículas para animación de caída
			this.score += 20; // Puntuación extra por burbujas caídas
		});
	}

	// --- LÓGICA DE ESCALADO Y CENTRADO ACTUALIZADA ---
	public override onResize(newW: number, newH: number): void {
		// 1. Escalar el contenedor principal (mainContainer)
		ScaleHelper.setScaleRelativeToIdeal(this.mainContainer, newW, newH, this.GAME_WIDTH, this.GAME_HEIGHT, ScaleHelper.FIT);

		// 2. Centrar el contenedor en la pantalla.
		this.mainContainer.x = (newW - this.mainContainer.width) / 2;
		this.mainContainer.y = (newH - this.mainContainer.height) / 2;
	}

	private onKeyDown = (e: KeyboardEvent): void => {
		if (e.code === "ArrowLeft") {
			this.aimDirection = -1;
		}
		if (e.code === "ArrowRight") {
			this.aimDirection = 1;
		}

		if (e.code === "Space" && this.shootState === "AIMING") {
			this.shootState = "SHOOTING";
			// Cálculo de la velocidad basado en el ángulo
			this.projectile.dx = Math.sin(this.shootAngle);
			this.projectile.dy = -Math.cos(this.shootAngle);
			// Si el jugador dispara, cancelamos el temblor de advertencia para que no interfiera
			if (this.waveTimer < this.SHAKE_WARNING_SECONDS) {
				this.isShaking = false;
				this.gameLayer.x = 0;
				this.gameLayer.y = 0;
			}
		}
	};

	private onKeyUp = (e: KeyboardEvent): void => {
		if ((e.code === "ArrowLeft" && this.aimDirection === -1) || (e.code === "ArrowRight" && this.aimDirection === 1)) {
			this.aimDirection = 0;
		}
	};

	public override destroy(_opts?: any): void {
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		super.destroy();
	}
}