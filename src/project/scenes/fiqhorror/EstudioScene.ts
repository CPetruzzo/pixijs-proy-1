/* eslint-disable @typescript-eslint/restrict-plus-operands */
// #region IMPORTS
import { Point } from "pixi.js";
import { Text, TextStyle, Container, Graphics, Sprite, Filter } from "pixi.js"; // Importamos Filter
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { GlowFilter } from "@pixi/filter-glow";
import { pixiRenderer } from "../../..";
import { Tween } from "tweedle.js";

// Código del Fragment Shader corregido para layouts responsivos
const eyeShaderFragment = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uClosure; // 0.0 (abierto del todo) a 1.0 (cerrado del todo)
uniform float uBlur;    // Difuminado del borde del párpado
uniform float uCenterY; // Centro vertical dinámico enviado desde la CPU

void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);
    
    // Distancia del píxel actual al centro de nuestro ojo
    float dist = abs(vTextureCoord.y - uCenterY);
    
    // NUEVO: Buscamos dinámicamente cuál es el borde más lejano (el techo o el piso)
    float maxRange = max(uCenterY, 1.0 - uCenterY);
    
    // Ahora el límite de apertura máxima se adapta perfectamente al centro dinámico
    float maxDist = maxRange * (1.0 - uClosure);
    
    // Aplicamos la interpolación suave para el efecto borroso
    float edge = smoothstep(maxDist, maxDist - uBlur, dist);
    
    gl_FragColor = vec4(color.rgb * edge, color.a);
}
`;
export class EstudioScene extends PixiScene {
	// #region VARIABLES & ESTADOS
	public static readonly BUNDLES = ["estudio-assets", "sfx"];

	// Contenedores principales
	private backgroundContainer = new Container();
	private deskContainer = new Container();
	private uiLeftContainer = new Container();
	private uiRightContainer = new Container();

	// Capa gráfica para simular el parpadeo de luz/oscuridad
	private lightOverlay!: Graphics;
	private flickerTimer = 0;
	private currentFlickerPattern: number[] = [];
	private patternIndex = 0;
	private timeToNextFlicker = Infinity; // Tiempo inicial de espera (ms)

	// --- CONTROL DEL RELOJ ---
	private currentHour = 21; // Hora inicial: 21:00
	private currentMinute = 0;
	private readonly endHour = 6; // Hora límite: 06:00 AM
	private isExamTime = false; // Bandera para frenar el juego al amanecer

	// Temporizadores para el comportamiento del reloj
	private colonTimer = 0;
	private colonVisible = true;
	private passiveTimeTimer = 0;
	// -------------------------

	// --- CONTROL DEL FILTRO DE OJO ---
	private eyeFilter!: Filter;
	private eyePulseTime = 0; // Acumulador para el vaivén del parpadeo
	private currentClosure = 0; // Interpolación del cierre actual
	// ---------------------------------

	// Stats (0 a 100)
	private energia = 52; // Modificado temporalmente a < 15 para probar el efecto
	private estres = 78;
	private ansiedad = 64;

	// Conocimiento de Álgebra (0 a 100)
	private conocimientoAlgebra = {
		matrices: 65,
		determinantes: 40,
		sistemas: 20,
		vectores: 10,
		autovalores: 5,
	};

	// Componentes Visuales / UI
	private clockText!: Container;
	private hoursText!: Text;
	private colonText!: Text;
	private minutesText!: Text;
	private dateText!: Text;

	// Barras de estado gráficas
	private energiaBar = new Graphics();
	private estresBar = new Graphics();
	private ansiedadBar = new Graphics();

	// Lista de textos para el conocimiento
	private conocimientoTexts: Map<string, Text> = new Map();
	// #endregion VARIABLES & ESTADOS
	private handPointer: Sprite;

	// #region CONSTRUCTOR
	constructor() {
		super();

		// 2. Añadir contenedores a la escena
		this.addChild(this.backgroundContainer);
		this.addChild(this.deskContainer);
		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiRightContainer);

		// 3. Inicializar componentes
		this.createBackgroundPlaceholder();
		this.createLeftUI();
		this.createRightUI();

		// Actualizar UI inicial
		this.updateStatusBars();
		this.updateKnowledgeList();

		const glowfilter = new GlowFilter({ outerStrength: 2 });
		const bgspr = Sprite.from("studybg");
		bgspr.anchor.set(0.5);
		this.backgroundContainer.addChild(bgspr);

		// ==========================================
		// 1. CONFIGURACIÓN DEL CUADERNO (BOOK)
		// ==========================================
		const book = Sprite.from("book");
		book.anchor.set(0.5);
		book.angle = -6;
		book.x = -180;
		book.y = 360;
		book.eventMode = "static";

		this.setPixelPerfect(book);

		book.on("pointerover", () => (book.filters = [glowfilter]));
		book.on("pointerout", () => {
			book.filters = [];
		});
		this.backgroundContainer.addChild(book);
		book.on("pointertap", () => this.ejecutarAccion("ESTUDIAR"));

		// ==========================================
		// 2. CONFIGURACIÓN DE LA TAZA DE CAFÉ
		// ==========================================
		const coffee = Sprite.from("coffee");
		coffee.anchor.set(0.5);
		coffee.x = 420;
		coffee.y = 92;
		coffee.eventMode = "static";

		this.setPixelPerfect(coffee);

		coffee.on("pointerover", () => (coffee.filters = [glowfilter]));
		coffee.on("pointerout", () => (coffee.filters = []));
		coffee.on("pointertap", () => {
			new Tween(coffee).to({ skew: { y: 0 } }, 1000).start();
			this.ejecutarAccion("CAFÉ");
		});
		this.backgroundContainer.addChild(coffee);

		// ==========================================
		// 2. CONFIGURACIÓN DE LA TAZA DE CAFÉ
		// ==========================================
		const clock = Sprite.from("clock");
		clock.anchor.set(0.5);
		clock.x = 36;
		clock.y = -80;
		clock.eventMode = "static";

		this.setPixelPerfect(clock);

		clock.on("pointerover", () => (clock.filters = [glowfilter]));
		clock.on("pointerout", () => (clock.filters = []));
		clock.on("pointertap", () => this.ejecutarAccion("CAFÉ"));
		this.backgroundContainer.addChild(clock);

		const tablet2 = Sprite.from("tablet2");
		tablet2.anchor.set(0.5);
		tablet2.scale.set(1.2);
		tablet2.x = -1000;
		tablet2.y = 350;
		// 2. Ángulos de inclinación (skew) basados en tu proporción isométrica
		tablet2.skew.y = 20;
		tablet2.skew.x = -0.95;
		tablet2.angle = -75;
		tablet2.eventMode = "static";

		this.setPixelPerfect(tablet2);

		const uiRight = Sprite.from("uiRight");
		uiRight.anchor.set(0.5, 0);
		uiRight.alpha = 0.5;
		uiRight.eventMode = "static";
		this.uiRightContainer.addChild(uiRight);

		// ==========================================
		// 3. CAPA DE PARPADEO (OVERLAY DE LUZ)
		// ==========================================
		this.lightOverlay = new Graphics();
		this.lightOverlay.beginFill(0x000000).drawRect(-1020, -740, 2040, 1480).endFill();
		this.lightOverlay.alpha = 0;
		this.backgroundContainer.addChild(this.lightOverlay);

		// ------------- Agregar el sprite de “handPointer” -------------
		this.handPointer = Sprite.from("cursorpointer");
		this.handPointer.scale.set(0.7);
		this.handPointer.anchor.set(0.5, 0.11);
		this.handPointer.interactive = false;
		this.handPointer.eventMode = "none";
		this.addChild(this.handPointer);

		// ==========================================
		// 4. ASIGNACIÓN ASSET DEL RELOJ DIGITAL (Separado en piezas fijas)
		// ==========================================
		this.clockText = new Container();

		const clockStyle = { fontFamily: "alarm clock", fill: 0xe91e1e, fontSize: 80 };
		this.hoursText = new Text("21", clockStyle);
		this.colonText = new Text(":", clockStyle);
		this.minutesText = new Text("00", clockStyle);

		this.hoursText.anchor.set(0, 0.5);
		this.colonText.anchor.set(0, 0.5);
		this.minutesText.anchor.set(0, 0.5);

		this.hoursText.x = 0;
		this.colonText.x = this.hoursText.x + this.hoursText.width;
		this.minutesText.x = this.colonText.x + this.colonText.width;

		this.clockText.addChild(this.hoursText, this.colonText, this.minutesText);
		this.clockText.pivot.set(this.clockText.width / 2, 0);

		this.clockText.angle = 4;
		this.clockText.position.set(35, -65);
		this.backgroundContainer.addChild(this.clockText);

		tablet2.on("pointerover", () => (tablet2.filters = [glowfilter]));
		tablet2.on("pointerout", () => (tablet2.filters = []));
		tablet2.on("pointertap", () => {
			new Tween(tablet2).to({ angle: -52, scale: { x: 2.2, y: 2.2 }, x: 0, y: 380, skew: { x: -0.99, y: 19.9 } }, 200).start();
			// this.ejecutarAccion("MÚSICA");
		});
		this.backgroundContainer.addChild(tablet2);

		// ==========================================
		// 5. INICIALIZACIÓN DEL SHADER DEL OJO
		// ==========================================
		this.eyeFilter = new Filter(undefined, eyeShaderFragment, {
			uClosure: 0.0,
			uBlur: 0.12,
			uCenterY: 0.4, // Valor inicial
		});

		// ¡ESTA LÍNEA SOLUCIONA EL MULTIMONITOR!
		// Forzamos a que el espacio del shader sea estrictamente el tamaño de la pantalla
		this.filterArea = pixiRenderer.pixiRenderer.screen;

		// Render inicial
		this.renderClockText();
	}
	// #endregion CONSTRUCTOR

	private setPixelPerfect(sprite: Sprite, alphaThreshold: number = 10): void {
		const baseTex = sprite.texture.baseTexture;
		const canvas = document.createElement("canvas");
		canvas.width = baseTex.width;
		canvas.height = baseTex.height;

		const context = canvas.getContext("2d", { willReadFrequently: true });
		const img = baseTex.resource as any;
		if (img && img.source) {
			context?.drawImage(img.source, 0, 0);
		}

		const imageData = context?.getImageData(0, 0, baseTex.width, baseTex.height);
		const pixels = imageData ? imageData.data : null;

		sprite.containsPoint = function (globalPoint: Point) {
			if (!pixels) {
				return false;
			}
			if (!this.getBounds().contains(globalPoint.x, globalPoint.y)) {
				return false;
			}

			const localPoint = this.toLocal(globalPoint);
			const texX = Math.floor(localPoint.x + this.anchor.x * baseTex.width);
			const texY = Math.floor(localPoint.y + this.anchor.y * baseTex.height);

			if (texX < 0 || texX >= baseTex.width || texY < 0 || texY >= baseTex.height) {
				return false;
			}

			const alphaIndex = (texY * baseTex.width + texX) * 4 + 3;
			return pixels[alphaIndex] > alphaThreshold;
		};
	}

	// #region INICIALIZACIÓN GRÁFICA (PLACEHOLDERS)
	private createBackgroundPlaceholder(): void { }

	private createLeftUI(): void {
		const styleTitle = new TextStyle({ fill: "#ffffff", fontSize: 20, fontWeight: "bold" });
		const styleSub = new TextStyle({ fill: "#aaaaaa", fontSize: 16 });

		this.dateText = new Text("LUNES\nSEMANA 7", new TextStyle({ fill: "#ffffff", fontSize: 28, fontWeight: "bold" }));
		this.dateText.position.set(20, 20);
		this.uiLeftContainer.addChild(this.dateText);

		const tareasTitle = new Text("TAREAS", styleTitle);
		tareasTitle.position.set(20, 120);
		const tareasList = new Text("☐ Estudiar Álgebra\n☐ Clase de consulta\n☐ Comprar apuntes\n☐ Dormir", styleSub);
		tareasList.position.set(20, 150);
		this.uiLeftContainer.addChild(tareasTitle, tareasList);

		const estadoTitle = new Text("ESTADO", styleTitle);
		estadoTitle.position.set(20, 280);
		this.uiLeftContainer.addChild(estadoTitle);

		this.createStatusBar("Energía", 320, this.energiaBar, 0x4caf50);
		this.createStatusBar("Estrés", 380, this.estresBar, 0xf44336);
		this.createStatusBar("Ansiedad", 440, this.ansiedadBar, 0x9c27b0);

		const conocTitle = new Text("CONOCIMIENTO: ÁLGEBRA", styleTitle);
		conocTitle.position.set(20, 520);
		this.uiLeftContainer.addChild(conocTitle);
	}

	private createStatusBar(label: string, yPos: number, barGraphics: Graphics, _color?: number): void {
		const labelText = new Text(label, new TextStyle({ fill: "#ffffff", fontSize: 14 }));
		labelText.position.set(20, yPos);

		const bgBar = new Graphics();
		bgBar
			.beginFill(0x333333)
			.drawRect(20, yPos + 20, 200, 12)
			.endFill();
		barGraphics.position.set(20, yPos + 20);

		this.uiLeftContainer.addChild(labelText, bgBar, barGraphics);
	}

	private createRightUI(): void {
		const opcionesMenu = [
			"ESTUDIAR\n  ↑ Conocimiento",
			"DORMIR\n  ↓ Energía /  Epifanía",
			"CAFÉ / MATE\n  ↑ Energía / ↓ Ansiedad leve",
			"FUMAR\n  ↓ Ansiedad / ↓ Energía futura",
			"CONSULTA\n  Ir a clase de consulta",
			"COMPRAR APUNTES\n  Cajas misteriosas",
		];
		console.log("opcionesMenu", opcionesMenu);

		const menuTitle = new Text("¿QUÉ HACER?", new TextStyle({ fill: "#ffffff", fontSize: 24, fontWeight: "bold" }));
		menuTitle.position.set(1250, 20);
		// this.uiRightContainer.addChild(menuTitle);
	}
	// #endregion INICIALIZACIÓN GRÁFICA

	private updateStatusBars(): void {
		this.drawBar(this.energiaBar, this.energia, 0x4caf50);
		this.drawBar(this.estresBar, this.estres, 0xf44336);
		this.drawBar(this.ansiedadBar, this.ansiedad, 0x9c27b0);
	}

	private drawBar(graphics: Graphics, value: number, color: number): void {
		graphics.clear();
		graphics
			.beginFill(color)
			.drawRect(0, 0, (value / 100) * 200, 12)
			.endFill();
	}

	private updateKnowledgeList(): void {
		this.conocimientoTexts.forEach((txt) => txt.destroy());
		this.conocimientoTexts.clear();

		const style = new TextStyle({ fill: "#aaaaaa", fontSize: 16, fontFamily: "monospace" });
		let currentY = 560;

		Object.entries(this.conocimientoAlgebra).forEach(([tema, porcentaje]) => {
			const label = `${tema.toUpperCase().padEnd(15)} ${porcentaje}%`;
			const txt = new Text(label, style);
			txt.position.set(20, currentY);
			this.uiLeftContainer.addChild(txt);
			this.conocimientoTexts.set(tema, txt);
			currentY += 30;
		});
	}

	public ejecutarAccion(opcion: string): void {
		SoundLib.playSound("immersivecontrol", {});
		if (opcion.includes("ESTUDIAR")) {
			this.pasarTiempo(45);
			this.energia = Math.max(0, this.energia - 15);
			this.estres = Math.min(100, this.estres + 10);
			this.conocimientoAlgebra.matrices = Math.min(100, this.conocimientoAlgebra.matrices + 12);
		} else if (opcion.includes("CAFÉ")) {
			this.pasarTiempo(10);
			this.energia = Math.min(100, this.energia + 25);
			this.ansiedad = Math.min(100, this.ansiedad + 5);
		} else if (opcion.includes("MÚSICA")) {
			SoundLib.playMusic("introSoul", {});
		}
		this.updateStatusBars();
		this.updateKnowledgeList();
	}

	private pasarTiempo(minutos: number): void {
		if (this.isExamTime) {
			return;
		}

		this.currentMinute += minutos;
		if (this.currentMinute >= 60) {
			this.currentHour += Math.floor(this.currentMinute / 60);
			this.currentMinute = this.currentMinute % 60;
		}
		if (this.currentHour >= 24) {
			this.currentHour = this.currentHour % 24;
		}

		if (this.currentHour >= this.endHour && this.currentHour < 21) {
			this.currentHour = this.endHour;
			this.currentMinute = 0;
			this.isExamTime = true;
			this.handleExamTransition();
		}

		this.renderClockText();
	}

	private renderClockText(): void {
		if (!this.clockText) {
			return;
		}

		this.hoursText.text = this.currentHour.toString().padStart(2, "0");
		this.minutesText.text = this.currentMinute.toString().padStart(2, "0");
		this.colonText.visible = this.colonVisible;
	}

	private handleExamTransition(): void {
		console.log("¡Son las 6:00 AM! Se terminó el tiempo de estudio. Directo a rendir a la FIQ.");
	}
	// #endregion LÓGICA & ACTUALIZACIONES

	// #region MANEJO DE FLICKER (LOGICA INTERNA)
	public handleLampFlicker(dt: number): void {
		const msElapsed = dt * 16.66;

		if (this.currentFlickerPattern.length === 0) {
			this.timeToNextFlicker -= msElapsed;

			if (this.timeToNextFlicker <= 0) {
				this.currentFlickerPattern = [0.18, 0.0, 0.25, 0.05, 0.3, 0.0, 0.12, 0.0];
				this.patternIndex = 0;
				this.flickerTimer = 0;
			}
			return;
		}

		this.flickerTimer += msElapsed;
		if (this.flickerTimer >= 45) {
			this.flickerTimer = 0;

			if (this.patternIndex < this.currentFlickerPattern.length) {
				this.lightOverlay.alpha = this.currentFlickerPattern[this.patternIndex];
				this.patternIndex++;
			} else {
				this.lightOverlay.alpha = 0;
				this.currentFlickerPattern = [];
				this.timeToNextFlicker = 50000 + Math.random() * 100000;
			}
		}
	}
	// #endregion MANEJO DE FLICKER

	// #region LIFECYCLE OVERRIDES
	public override update(dt: number): void {
		const msElapsed = dt;

		// 1. Ejecutamos el chequeo de parpadeo de la lámpara ambiental
		this.handleLampFlicker(dt);

		// 2. AVANCE PASIVO DEL RELOJ (Tiempo de juego en tiempo real)
		if (!this.isExamTime) {
			this.passiveTimeTimer += msElapsed;
			if (this.passiveTimeTimer >= 2500) {
				this.passiveTimeTimer = 0;
				this.pasarTiempo(1);
			}
		}

		// 3. TITILEO DE LOS DOS PUNTOS (Cada 500ms commuta el estado)
		this.colonTimer += msElapsed;
		if (this.colonTimer >= 500) {
			this.colonTimer = 0;
			this.colonVisible = !this.colonVisible;
			this.renderClockText();
		}

		// 4. Lógica del Custom Cursor (Hand Pointer)
		pixiRenderer.pixiRenderer.view.style.cursor = "none";
		const globalPos = pixiRenderer.pixiRenderer.events.pointer.global;
		this.handPointer.visible = true;
		this.handPointer.position.set(globalPos.x, globalPos.y);

		// ==========================================
		// 5. EFECTO DE OJO CERRÁNDOSE POR BAJA ENERGÍA (< 15%)
		// ==========================================
		if (this.energia < 15) {
			// --- CÁLCULO DE CENTRADO DINÁMICO ---
			// Definimos un punto de enfoque local en el fondo (ej: Y = 180 es la zona del cuaderno/reloj)
			const puntoEnfoqueLocal = new Point(0, 50);

			// PixiJS hace la magia de convertir ese punto local a píxeles reales de la pantalla
			const puntoEnfoqueGlobal = this.backgroundContainer.toGlobal(puntoEnfoqueLocal);
			const altoPantallaReal = pixiRenderer.pixiRenderer.screen.height;

			// Normalizamos el valor (de 0.0 a 1.0) para que el Shader lo entienda correctamente
			this.eyeFilter.uniforms.uCenterY = puntoEnfoqueGlobal.y / altoPantallaReal;
			// ------------------------------------

			// Acumulamos tiempo para la oscilación del cabeceo
			this.eyePulseTime += msElapsed * 0.0015;

			// Base de cierre: a menor energía, el ojo tiende a cerrarse más
			const baseClosure = 0.35 + (15 - this.energia) * 0.02;
			const pulse = Math.sin(this.eyePulseTime) * 0.15;
			const targetClosure = Math.min(0.8, Math.max(0.1, baseClosure + pulse));

			// Interpolación suave (Lerp)
			this.currentClosure += (targetClosure - this.currentClosure) * 0.05;
			this.eyeFilter.uniforms.uClosure = this.currentClosure;

			if (!this.filters || !this.filters.includes(this.eyeFilter)) {
				this.filters = [...(this.filters || []), this.eyeFilter];
			}
		} else {
			// Si recupera energía (tomando café), abrimos el ojo paulatinamente
			if (this.currentClosure > 0) {
				this.currentClosure -= 0.01 * (msElapsed / 16.66); // Ajustado por frames transcurridos
				if (this.currentClosure < 0) {
					this.currentClosure = 0;
				}
				this.eyeFilter.uniforms.uClosure = this.currentClosure;
			} else if (this.filters && this.filters.includes(this.eyeFilter)) {
				// Quitamos el filtro del array completamente si está abierto del todo para ahorrar GPU
				this.filters = this.filters.filter((f) => f !== this.eyeFilter);
			}
		}
	}

	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.backgroundContainer, w, h, 2040, 1480, ScaleHelper.forceHeight);
		this.backgroundContainer.x = w / 2;
		this.backgroundContainer.y = h / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.deskContainer, w, h, 1536, 1024, ScaleHelper.FIT);

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, w, h, 1536, 1024, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, w, h, 2040, 1480, ScaleHelper.forceHeight);
		this.uiRightContainer.x = w - this.uiRightContainer.width / 2;
		this.uiRightContainer.y = 0;
	}
	// #endregion LIFECYCLE OVERRIDES
}
