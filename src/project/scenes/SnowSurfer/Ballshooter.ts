import { Graphics } from "@pixi/graphics";
import { ObjectPool } from "../../../engine/objectpool/ObjectPool";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import type { RigidBody } from "@dimforge/rapier2d";
import { ColliderDesc, RigidBodyDesc, RigidBodyType, World } from "@dimforge/rapier2d";
import { Color, Point } from "@pixi/core";
import { Container } from "@pixi/display";
import { Sprite } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

interface Bubble {
	rigidBody: RigidBody;
	sprite: Sprite;
	landed?: boolean;
	bounceCount?: number;
	lastVelX?: number;
}

interface WaveBall {
	body: RigidBody;
	sprite: Sprite;
	rowIndex: number;
	colIndex: number;
}

export class BubbleShooterGame extends PixiScene {
	public static readonly BUNDLES = ["img", "basquet"];
	private world: World;
	private worldContainer: Container = new Container();
	private static readonly METER_TO_PIXEL = 10.0;
	// Disparador: ubicado en (40,60) en unidades físicas
	private shooterPosition: Point = new Point(40, 60);
	private shooterSprite: Sprite;
	// Array de burbujas disparadas
	private bubbles: Bubble[] = [];

	private debugGraphicsPool = new ObjectPool({
		creator: () => new Graphics(),
		cleaner: (g) => {
			g.clear();
			g.parent?.removeChild(g);
		},
		destroyer: (g) => g.destroy(),
		validator: (g) => !g.destroyed,
	});
	private usedDebugGraphics: Graphics[] = [];

	private static BOARD_WIDTH: number = 40;
	private static BOARD_HEIGHT: number = 60;

	// --- PROPIEDADES PARA LA MIRA Y EL CARRUSEL ---
	private crosshair: Graphics = new Graphics();
	private aimCarousel: Container = new Container();
	private aimCarouselBackground: Graphics = new Graphics();
	private carouselOffset: number = 0;
	private carouselSpeed: number = 0.02; // velocidad del carrusel (en píxeles por segundo)
	private carouselSpacing: number = 5; // separación entre imágenes (constante)
	private carouselItemWidth: number = 20;
	private carouselItems: Sprite[] = [];
	private currentAimOrigin: Point = new Point(0, 0);
	private currentAimDir: Point = new Point(1, 0);
	private currentAimLength: number = 0;
	private isAiming: boolean = false;
	private static ITEM_AMOUNT: number = 30;
	// ------------------------------

	// --- PROPIEDADES PARA LA OLEADA DE PELOTITAS ---
	private waveContainer: Container = new Container();
	private waveBalls: WaveBall[] = [];
	private turnAdvanced: boolean = false;
	private numWaveBalls: number = 10; // cantidad de pelotitas por fila
	private waveMargin: number = 5; // margen izquierdo y derecho (unidades físicas)
	private waveAdvanceAmount: number = 2; // cuánto se mueve la oleada hacia abajo cada turno (unidades físicas)
	// ------------------------------

	// Mecanismo de oleadas

	// Posición fija de la primera fila (anclada al techo)
	private topRowY: number = -BubbleShooterGame.BOARD_HEIGHT + 5; // La posición física de la fila superior
	private rowSpacing: number = 7; // Espaciado vertical entre filas (en unidades físicas)
	private currentWaveRows: number = 0; // Cantidad actual de filas en pantalla

	constructor() {
		super();
		this.name = "BubbleShooterGameScene";

		this.worldContainer.name = "PHYSICS WORLD CONTAINER";
		this.addChild(this.worldContainer);

		// Fondo
		const lightBackground = new Graphics();
		this.worldContainer.addChild(lightBackground);
		lightBackground.beginFill(0xffffff);
		lightBackground.drawRect(0, -600, 800, 1200);
		lightBackground.endFill();

		// Contenedor de la oleada
		this.worldContainer.addChild(this.waveContainer);

		// Contenedor de la mira y carrusel
		this.worldContainer.addChild(this.crosshair);
		this.worldContainer.addChild(this.aimCarouselBackground);
		this.worldContainer.addChild(this.aimCarousel);

		// Mundo físico sin gravedad
		this.world = new World({ x: 0, y: 0 });

		this.createColliders();

		// Disparador
		this.shooterSprite = Sprite.from("img/sky.png");
		this.shooterSprite.anchor.set(0.5, 1);
		this.shooterSprite.scale.set(0.5);
		this.shooterSprite.x = this.shooterPosition.x * BubbleShooterGame.METER_TO_PIXEL;
		this.shooterSprite.y = this.shooterPosition.y * BubbleShooterGame.METER_TO_PIXEL;
		this.worldContainer.addChild(this.shooterSprite);

		// Eventos puntero
		this.interactive = true;
		this.on("pointertap", this.onPointerDown, this);
		this.on("pointerdown", this.onAimStart, this);
		this.on("pointermove", this.onAimUpdate, this);
		this.on("pointerup", this.onAimEnd, this);
		this.on("pointerupoutside", this.onAimEnd, this);

		this.pivot.set(this.width * 0.5, 0);

		// Carrusel
		for (let i = 0; i < BubbleShooterGame.ITEM_AMOUNT; i++) {
			const item = Sprite.from("img/invertedV.png");
			item.anchor.set(0.5);
			item.scale.set(0.25);
			this.aimCarousel.addChild(item);
			this.carouselItems.push(item);
		}

		// Generamos varias filas iniciales
		for (let i = 0; i < 1; i++) {
			this.advanceWave();
		}
	}

	// Colliders de paredes, techo y suelo
	private createColliders(): void {
		const groundCollider = ColliderDesc.cuboid(BubbleShooterGame.BOARD_WIDTH, 1).setRestitution(-20);
		this.world.createCollider(groundCollider).setTranslation({ x: BubbleShooterGame.BOARD_WIDTH, y: BubbleShooterGame.BOARD_HEIGHT });
		const roofCollider = ColliderDesc.cuboid(BubbleShooterGame.BOARD_WIDTH, 1).setRestitution(1);
		this.world.createCollider(roofCollider).setTranslation({ x: BubbleShooterGame.BOARD_WIDTH, y: -BubbleShooterGame.BOARD_HEIGHT });
		const leftWallCollider = ColliderDesc.cuboid(1, BubbleShooterGame.BOARD_HEIGHT).setRestitution(0.8);
		this.world.createCollider(leftWallCollider).setTranslation({ x: 0.0, y: 0.0 });
		const rightWallCollider = ColliderDesc.cuboid(1, BubbleShooterGame.BOARD_HEIGHT).setRestitution(0.8);
		this.world.createCollider(rightWallCollider).setTranslation({ x: BubbleShooterGame.BOARD_WIDTH * 2, y: 0.0 });
	}

	public override update(dt: number): void {
		this.world.integrationParameters.dt = dt / 1000;
		this.world.step();

		// Actualizamos burbujas disparadas
		for (const bubble of this.bubbles) {
			const pos = bubble.rigidBody.translation();
			bubble.sprite.x = pos.x * BubbleShooterGame.METER_TO_PIXEL;
			bubble.sprite.y = pos.y * BubbleShooterGame.METER_TO_PIXEL;

			const currentVel = bubble.rigidBody.linvel();
			if (bubble.lastVelX !== undefined) {
				if (Math.abs(bubble.lastVelX) > 0.1 && Math.sign(bubble.lastVelX) !== Math.sign(currentVel.x)) {
					bubble.bounceCount = (bubble.bounceCount || 0) + 1;
				}
			}
			bubble.lastVelX = currentVel.x;

			if (Math.abs(currentVel.y) <= 5 && currentVel.y >= -1) {
				const newVel = new Point(currentVel.x, currentVel.y + 80);
				bubble.rigidBody.setLinvel(newVel, true);
			}

			// Si aterriza en el suelo
			if (!bubble.landed && pos.y >= BubbleShooterGame.BOARD_HEIGHT - 2) {
				bubble.landed = true;
				bubble.rigidBody.setBodyType(RigidBodyType.Fixed, true);
				bubble.rigidBody.setLinvel(new Point(0, 0), true);
				this.shooterPosition.x = pos.x;
				this.shooterPosition.y = pos.y;
				this.shooterSprite.x = pos.x * BubbleShooterGame.METER_TO_PIXEL;
				this.shooterSprite.y = pos.y * BubbleShooterGame.METER_TO_PIXEL - 5;
				this.world.removeRigidBody(bubble.rigidBody);
				this.worldContainer.removeChild(bubble.sprite);
				bubble.sprite.destroy();
				this.bubbles = this.bubbles.filter((b) => b !== bubble);

				// Avanzar la oleada solo una vez por turno
				if (!this.turnAdvanced) {
					this.advanceWave();
					this.turnAdvanced = true;
				}
			}
		}

		// Actualizar el carrusel si se está apuntando
		if (this.isAiming && this.currentAimLength > 0) {
			this.updateAimCarousel(dt);
		}

		this.debugDraw();
	}

	// Disparo
	private onPointerDown(event: any): void {
		const pointerPos = event.data.getLocalPosition(this.worldContainer);
		const pointerWorld = new Point(pointerPos.x / BubbleShooterGame.METER_TO_PIXEL, pointerPos.y / BubbleShooterGame.METER_TO_PIXEL);
		const spawnOriginY = this.shooterPosition.y - this.shooterSprite.height / BubbleShooterGame.METER_TO_PIXEL;
		const dx = pointerWorld.x - this.shooterPosition.x;
		const dy = pointerWorld.y - spawnOriginY;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length === 0) {
			return;
		}
		const nx = dx / length;
		const ny = dy / length;
		this.spawnBubble(nx, ny);
		// Reseteamos turnAdvanced
		this.turnAdvanced = false;
	}

	private spawnBubble(nx: number, ny: number): void {
		const spawnOriginY = this.shooterPosition.y - this.shooterSprite.height / BubbleShooterGame.METER_TO_PIXEL;
		const rbDesc = RigidBodyDesc.dynamic().setTranslation(this.shooterPosition.x, spawnOriginY);
		const rb = this.world.createRigidBody(rbDesc);
		const collider = ColliderDesc.ball(1).setRestitution(1);
		this.world.createCollider(collider, rb);

		const bubbleSprite = Sprite.from("basquetball");
		bubbleSprite.anchor.set(0.5);
		bubbleSprite.scale.set(0.03);
		bubbleSprite.x = this.shooterPosition.x * BubbleShooterGame.METER_TO_PIXEL;
		bubbleSprite.y = spawnOriginY * BubbleShooterGame.METER_TO_PIXEL;
		this.worldContainer.addChild(bubbleSprite);

		this.bubbles.push({
			rigidBody: rb,
			sprite: bubbleSprite,
			bounceCount: 0,
			lastVelX: undefined,
		});

		const impulseMagnitude = 1000;
		rb.applyImpulse(new Point(nx * impulseMagnitude, ny * impulseMagnitude), true);
	}

	// Apuntado
	private onAimStart(event: any): void {
		this.isAiming = true;
		if (this.aimCarousel.children.length === 0) {
			this.carouselItems.forEach((item) => {
				this.aimCarousel.addChild(item);
				item.visible = true;
			});
		}
		this.turnAdvanced = false;
		this.updateCrosshair(event);
	}
	private onAimUpdate(event: any): void {
		if (this.isAiming) {
			this.updateCrosshair(event);
		}
	}
	private onAimEnd(_event: any): void {
		this.isAiming = false;
		this.crosshair.clear();
		this.aimCarouselBackground.clear();
		this.aimCarousel.removeChildren();
	}
	private updateCrosshair(event: any): void {
		const pointerPos = event.data.getLocalPosition(this.worldContainer);
		const pointerWorld = new Point(pointerPos.x / BubbleShooterGame.METER_TO_PIXEL, pointerPos.y / BubbleShooterGame.METER_TO_PIXEL);
		const spawnOriginY = this.shooterPosition.y - this.shooterSprite.height / BubbleShooterGame.METER_TO_PIXEL;
		const origin = new Point(this.shooterPosition.x, spawnOriginY);
		const dx = pointerWorld.x - origin.x;
		const dy = pointerWorld.y - origin.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len === 0) {
			return;
		}
		const dir = new Point(dx / len, dy / len);
		this.currentAimOrigin = origin;
		this.currentAimDir = dir;
		const hit = this.getRayIntersection(origin, dir);
		const dxHit = hit.x - origin.x;
		const dyHit = hit.y - origin.y;
		this.currentAimLength = Math.sqrt(dxHit * dxHit + dyHit * dyHit);

		this.crosshair.clear();
		this.crosshair.lineStyle(2, 0xff0000);
		this.crosshair.moveTo(origin.x * BubbleShooterGame.METER_TO_PIXEL, origin.y * BubbleShooterGame.METER_TO_PIXEL);
		this.crosshair.lineTo(hit.x * BubbleShooterGame.METER_TO_PIXEL, hit.y * BubbleShooterGame.METER_TO_PIXEL);
		this.crosshair.beginFill(0xff0000);
		this.crosshair.drawCircle(hit.x * BubbleShooterGame.METER_TO_PIXEL, hit.y * BubbleShooterGame.METER_TO_PIXEL, 5);
		this.crosshair.endFill();

		this.updateAimCarousel(0);
	}
	private getRayIntersection(origin: Point, dir: Point): Point {
		const left = 0;
		const right = BubbleShooterGame.BOARD_WIDTH * 2;
		const top = -BubbleShooterGame.BOARD_HEIGHT;
		const bottom = BubbleShooterGame.BOARD_HEIGHT;
		let tMin = Infinity;
		let hit = origin;
		if (dir.x !== 0) {
			const tLeft = (left - origin.x) / dir.x;
			if (tLeft >= 0) {
				const yLeft = origin.y + tLeft * dir.y;
				if (yLeft >= top && yLeft <= bottom && tLeft < tMin) {
					tMin = tLeft;
					hit = new Point(left, yLeft);
				}
			}
			const tRight = (right - origin.x) / dir.x;
			if (tRight >= 0) {
				const yRight = origin.y + tRight * dir.y;
				if (yRight >= top && yRight <= bottom && tRight < tMin) {
					tMin = tRight;
					hit = new Point(right, yRight);
				}
			}
		}
		if (dir.y !== 0) {
			const tTop = (top - origin.y) / dir.y;
			if (tTop >= 0) {
				const xTop = origin.x + tTop * dir.x;
				if (xTop >= left && xTop <= right && tTop < tMin) {
					tMin = tTop;
					hit = new Point(xTop, top);
				}
			}
			const tBottom = (bottom - origin.y) / dir.y;
			if (tBottom >= 0) {
				const xBottom = origin.x + tBottom * dir.x;
				if (xBottom >= left && xBottom <= right && tBottom < tMin) {
					tMin = tBottom;
					hit = new Point(xBottom, bottom);
				}
			}
		}
		return hit;
	}

	private updateAimCarousel(dt: number): void {
		if (dt > 0) {
			this.carouselOffset += this.carouselSpeed * dt;
			if (this.carouselOffset >= this.carouselSpacing) {
				this.carouselOffset %= this.carouselSpacing;
			}
		}
		const L = this.currentAimLength;
		const angle = Math.atan2(this.currentAimDir.y, this.currentAimDir.x);
		this.carouselItems.forEach((item, index) => {
			const posDist = this.carouselOffset + index * this.carouselSpacing;
			if (posDist > L) {
				item.visible = false;
			} else {
				item.visible = true;
				item.x = (this.currentAimOrigin.x + this.currentAimDir.x * posDist) * BubbleShooterGame.METER_TO_PIXEL;
				item.y = (this.currentAimOrigin.y + this.currentAimDir.y * posDist) * BubbleShooterGame.METER_TO_PIXEL;
				item.rotation = angle + Math.PI / 2;
			}
		});
		this.aimCarouselBackground.clear();
		this.aimCarouselBackground.lineStyle(0);
		this.aimCarouselBackground.beginFill(0x000000, 0.3);
		this.aimCarouselBackground.drawRect(0, -this.carouselItemWidth / 2, L * BubbleShooterGame.METER_TO_PIXEL, this.carouselItemWidth);
		this.aimCarouselBackground.endFill();
		this.aimCarouselBackground.x = this.currentAimOrigin.x * BubbleShooterGame.METER_TO_PIXEL;
		this.aimCarouselBackground.y = this.currentAimOrigin.y * BubbleShooterGame.METER_TO_PIXEL;
		this.aimCarouselBackground.rotation = angle;
	}

	// --- MECÁNICA DE OLEADAS ---

	/**
	 * Genera una fila de pelotitas adheridas al techo, intercaladas tipo panal.
	 * rowIndex = waveRowCount (se va incrementando)
	 */
	private spawnWaveRow(): void {
		// La nueva fila siempre es la 0 (la de arriba)
		const rowIndex = 0;
		const totalWidth = BubbleShooterGame.BOARD_WIDTH * 2;
		const availableWidth = totalWidth - 2 * this.waveMargin;

		// En filas pares (0, 2, 4, ...), se usan todas; en filas impares, se usan numWaveBalls - 1
		const isOdd = this.currentWaveRows % 2 === 1;
		const count = isOdd ? this.numWaveBalls - 1 : this.numWaveBalls;
		// Espaciado horizontal según la cantidad de pelotitas de la fila
		const spacing = availableWidth / (count - 1);

		// Para lograr la intercalación: si la fila es impar, se desplaza horizontalmente medio spacing;
		// como la fila nueva es 0, en este caso no se aplica offset.
		const offsetX = rowIndex % 2 === 1 ? spacing * 0.5 : 0;
		// La posición Y de la fila 0 es topRowY
		const rowY = this.topRowY + rowIndex * this.rowSpacing;

		const colors = [0xff0000, 0x00ff00, 0x0000ff]; // rojo, verde, azul
		for (let i = 0; i < count; i++) {
			const colIndex = i;
			const x = this.waveMargin + offsetX + i * spacing;
			const rbDesc = RigidBodyDesc.fixed().setTranslation(x, rowY);
			const body = this.world.createRigidBody(rbDesc);
			const collider = ColliderDesc.ball(3.8).setRestitution(0.8);
			this.world.createCollider(collider, body);

			// Usar un sprite base blanco para que el tint se note bien
			const ballSprite = Sprite.from("basquetball");
			ballSprite.anchor.set(0.5);
			ballSprite.scale.set(0.1);
			// Asigna un color aleatorio
			const color = colors[Math.floor(Math.random() * colors.length)];
			ballSprite.tint = color;

			ballSprite.x = x * BubbleShooterGame.METER_TO_PIXEL;
			ballSprite.y = rowY * BubbleShooterGame.METER_TO_PIXEL;

			this.waveContainer.addChild(ballSprite);
			this.waveBalls.push({ body, sprite: ballSprite, rowIndex, colIndex });
		}
		// Incrementamos el total de filas en pantalla
		this.currentWaveRows++;
	}

	/**
	 * Avanza todas las filas hacia abajo y genera una nueva fila en la parte superior.
	 */
	private advanceWave(): void {
		const totalWidth = BubbleShooterGame.BOARD_WIDTH * 2;
		const availableWidth = totalWidth - 2 * this.waveMargin;
		const spacing = availableWidth / (this.numWaveBalls - 1);

		// Para cada pelotita existente, incrementamos su índice de fila
		for (const waveBall of this.waveBalls) {
			// Incrementar el rowIndex siempre, de modo que todas se muevan hacia abajo
			waveBall.rowIndex++;
			// Calculamos la posición Y en función del índice de fila
			const newY = this.topRowY + waveBall.rowIndex * this.rowSpacing;
			// Si la fila es impar, aplicamos un offset de media separación
			const offsetX = waveBall.rowIndex % 2 === 1 ? spacing * 0.5 : 0;
			const newX = this.waveMargin + offsetX + waveBall.colIndex * spacing;
			waveBall.body.setTranslation({ x: newX, y: newY }, true);
			waveBall.sprite.x = newX * BubbleShooterGame.METER_TO_PIXEL;
			waveBall.sprite.y = newY * BubbleShooterGame.METER_TO_PIXEL;
		}
		// Generamos una nueva fila en la parte superior con rowIndex = 0
		this.spawnWaveRow();
	}

	// Dibujo de depuración para los cuerpos de Rapier
	private debugDraw(): void {
		this.usedDebugGraphics.forEach((g) => this.debugGraphicsPool.put(g));
		this.usedDebugGraphics = [];
		const { vertices, colors } = this.world.debugRender();
		for (let i = 0; i < vertices.length / 4; i++) {
			const g = this.debugGraphicsPool.get();
			const c = new Color({
				r: colors[i * 4 * 2] * 255,
				g: colors[i * 4 * 2 + 1] * 255,
				b: colors[i * 4 * 2 + 2] * 255,
				a: colors[i * 4 * 2 + 3] * 255,
			});
			g.lineStyle(2, c, 1);
			g.moveTo(vertices[i * 4] * BubbleShooterGame.METER_TO_PIXEL, vertices[i * 4 + 1] * BubbleShooterGame.METER_TO_PIXEL);
			g.lineTo(vertices[i * 4 + 2] * BubbleShooterGame.METER_TO_PIXEL, vertices[i * 4 + 3] * BubbleShooterGame.METER_TO_PIXEL);
			this.usedDebugGraphics.push(g);
			this.worldContainer.addChild(g);
		}
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this, newW, newH, 960, 1440, ScaleHelper.FIT);
		this.x = newW * 0.5;
		this.y = newH * 0.5;
	}
}
