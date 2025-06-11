/* eslint-disable @typescript-eslint/naming-convention */
import { Texture, Container, Sprite, Graphics, BlurFilter, ColorMatrixFilter } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Background } from "./Background";
import { GlitchFilter } from "@pixi/filter-glitch";
import { CRTFilter } from "@pixi/filter-crt";
import { AHPlayer } from "./classes/Player";
import { InventoryController } from "./game/InventoryController";
import { UI } from "./UI";
import type { ProgressBar } from "@pixi/ui";
import type { PausePopUp } from "./game/PausePopUp";
import { GameStateManager } from "./game/GameStateManager";
import { Timer } from "../../../engine/tweens/Timer";
import { Manager, pixiRenderer } from "../../..";
import { CameraAStarScene } from "../Tutorial/TutorialAStarScene";
import { OverlayScene } from "./OverlayScene";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Trigger } from "./classes/Trigger";

export class AHOldClockScene extends PixiScene {
	private gameContainer = new Container();
	private frontLayerContainer = new Container();
	private pauseContainer = new Container();
	private uiRightContainer = new Container();
	private uiCenterContainer = new Container();
	private uiLeftContainer = new Container();

	public static readonly BUNDLES = ["abandonedhouse"];

	private pendulum: Sprite;
	private clock: Sprite;
	private mainNeedle: Sprite;
	private secondaryNeedle: Sprite;
	public background: Background;

	// Tiempo interno en minutos (0–719)
	private currentTimeMin = 0; // empieza a las 0:00

	private glitchFilter: GlitchFilter;
	private crtFilter: CRTFilter;
	private ghostMirror: Sprite;
	private originalGhostTex: Texture;
	private chairs: Sprite;
	private originalChairsY: number;
	private candles: Sprite;
	private player!: AHPlayer;
	private weaponSprite!: Sprite;
	private inventoryCtrl = new InventoryController();
	public ui: UI;
	private batteryBars: Sprite[] = [];
	private hpBar: ProgressBar;
	private lightCone!: Sprite;
	private state = GameStateManager.instance;

	private pausePopUp: PausePopUp | null = null;
	private activeIcon!: Sprite | null;

	private overlay: OverlayScene;

	private cluesSpr: Sprite;
	private cluesSprVisible: boolean;

	// --- Nuevos atributos para el drag de las manecillas ---
	private draggingNeedle: Sprite | null = null;
	private dragData: any | null = null;
	private trigger: Trigger;
	private clockBig: Sprite;
	private mainNeedleBig: Sprite;
	private secondaryNeedleBig: Sprite;
	// … dentro de AHOldClockScene, tras las demás propiedades privadas …
	private handPointer: Sprite;
	private screenBlur!: Graphics;
	private clockBigIsOpen = false;
	constructor() {
		super();
		// capas
		this.addChild(this.gameContainer);
		this.gameContainer.sortableChildren = true;
		this.addChild(this.frontLayerContainer);
		this.frontLayerContainer.visible = false; // ocultamos la capa de efectos
		this.addChild(this.pauseContainer);
		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiCenterContainer);
		this.addChild(this.uiRightContainer);

		// fondo
		this.background = new Background("AH_pendulumClockSceneBG", this.gameContainer, this.frontLayerContainer);

		// Más agresivo:
		this.glitchFilter = new GlitchFilter({
			offset: 30, // de 10 a 30
			slices: 12, // de 6 a 12
			fillMode: 0,
			direction: 0,
		});

		this.crtFilter = new CRTFilter({
			lineWidth: 10, // de 1 a 2
			lineContrast: 3, // de 0.2 a 1.5
			vignetting: 0.5, // agrega viñeteo
			vignettingAlpha: 0.7, // intensidad del viñeteo
			seed: 0.9,
		});

		this.background.background.filters = [];

		// reloj vacío
		this.clock = Sprite.from("pendulum-clock-empty");
		this.clock.scale.set(0.36, 0.45);
		this.clock.anchor.set(0.5);
		this.clock.x = 560;
		this.clock.y = 50;
		this.clock.alpha = 0.65;

		// --- Aquí: dibujamos un marcador en el centro del reloj ---
		//    Este Graphics se añadirá como hijo de `this.clock` en su (0,0) local,
		//    y por tanto mostrará el punto exacto desde donde se calcula atan2().
		const centerMarker = new Graphics();
		centerMarker.beginFill(0xff0000); // color rojo
		centerMarker.drawCircle(0, 0, 5); // círculo de radio 5px
		centerMarker.endFill();
		// Opcional: un contorno blanco para asegurarlo sobre cualquier fondo
		centerMarker.lineStyle(1, 0xffffff);
		centerMarker.drawCircle(0, 0, 6);
		centerMarker.endFill();
		// this.clock.addChild(centerMarker);

		// péndulo
		this.pendulum = Sprite.from("pendulum-clock-manecilla");
		this.pendulum.anchor.set(0.5, 0);
		this.pendulum.y = -200;

		// manecillas
		this.mainNeedle = Sprite.from("mainNeedle"); // hora
		this.mainNeedle.anchor.set(0.5, 0.15);
		this.mainNeedle.scale.set(0.2);
		this.mainNeedle.tint = 0x000000;
		this.mainNeedle.y = -465;
		// Hacemos interactive para que pueda arrastrarse
		this.mainNeedle.eventMode = "dynamic";
		this.mainNeedle.interactive = true;
		// posición inicial a las 12
		this.mainNeedle.rotation = Math.PI / 2;

		this.secondaryNeedle = Sprite.from("secondaryNeedle"); // minutos
		this.secondaryNeedle.anchor.set(0.5, 0.2);
		this.secondaryNeedle.scale.set(0.2);
		this.secondaryNeedle.y = -465;
		this.secondaryNeedle.tint = 0x000000;

		this.secondaryNeedle.eventMode = "dynamic";
		this.secondaryNeedle.interactive = true;

		// posición inicial a las 12
		this.secondaryNeedle.rotation = Math.PI / 2;

		this.gameContainer.addChild(this.clock);
		this.clock.addChild(this.pendulum, this.mainNeedle, this.secondaryNeedle);

		// animación del péndulo
		new Tween(this.pendulum).from({ angle: -15 }).to({ angle: 15 }, 1000).easing(Easing.Quadratic.InOut).repeat(Infinity).yoyo(true).start();
		SoundLib.playMusic("clockticking", { loop: true, volume: 0.1, speed: 0.94, end: 1.95 });

		// Registramos los eventos de drag en las manecillas
		// this.mainNeedle.on("pointerdown", this.onDragStart.bind(this));
		// this.secondaryNeedle.on("pointerdown", this.onDragStart.bind(this));

		// Mientras movemos el puntero, revisamos si estamos arrastrando algo
		this.eventMode = "dynamic"; // para que pueda recibir eventos de puntero
		this.on("pointermove", this.onDragMove.bind(this));
		this.on("pointerup", this.onDragEnd.bind(this));
		this.on("pointerupoutside", this.onDragEnd.bind(this));

		// this.createTimeButtons();
		// this.createConfirmButton();

		this.ghostMirror = Sprite.from("AH_ghost_mirror");
		this.ghostMirror.anchor.set(0.5);
		this.ghostMirror.scale.set(0.1);
		this.ghostMirror.x = -522;
		this.ghostMirror.y = -175;
		this.gameContainer.addChild(this.ghostMirror);

		this.createPlayer();

		// guardamos la textura original
		this.originalGhostTex = this.ghostMirror.texture;

		this.chairs = Sprite.from("AH_chairs");
		this.chairs.anchor.set(0.5);
		this.chairs.y = 230;
		this.chairs.x = -50;
		this.gameContainer.addChild(this.chairs);
		this.originalChairsY = this.chairs.y;

		this.candles = Sprite.from("AH_candle");
		this.candles.anchor.set(0.5);
		this.candles.y = -250;
		this.gameContainer.addChild(this.candles);

		this.ui = new UI(
			this.uiRightContainer,
			this.batteryBars,
			this.activeIcon,
			this.uiCenterContainer,
			this.pausePopUp,
			this.pauseContainer,
			this.hpBar,
			this.uiLeftContainer,
			this.state,
			this.weaponSprite,
			this.lightCone
		);
		this.inventoryCtrl.on("picked", (id) => this.inventoryCtrl.showNewItem(id, this.gameContainer));

		this.overlay = new OverlayScene();
		this.overlay.typeText("Un reloj... Qué afortunado sería si tuviera una pista de qué hora es", "pista", "red", 20);
		this.gameContainer.addChild(this.overlay);
		new Timer()
			.to(4000)
			.onComplete(() => {
				this.overlay.visible = false;
			})
			.start();

		this.trigger = new Trigger();
		this.trigger.createTrigger(this.gameContainer);
		this.trigger.triggerZone.x = this.trigger.triggerZone.x + 1100;
		this.trigger.triggerZone.y = this.trigger.triggerZone.y + 100;
		this.trigger.triggerText.x = this.trigger.triggerZone.x - 50;

		this.clockBig = Sprite.from("pendulum-clock-empty-close");
		this.clockBig.scale.set(1.3);
		this.clockBig.anchor.set(0.5);
		const clockBigFilter = new ColorMatrixFilter();
		clockBigFilter.brightness(2, false);
		this.clockBig.filters = [clockBigFilter];
		// this.gameContainer.addChild(this.clockBig);
		// manecillas
		this.mainNeedleBig = Sprite.from("mainNeedle"); // hora
		this.mainNeedleBig.anchor.set(0.5, 0.15);
		this.mainNeedleBig.scale.set(0.2);

		// Hacemos interactive para que pueda arrastrarse
		this.mainNeedleBig.eventMode = "dynamic";
		this.mainNeedleBig.interactive = true;
		// posición inicial a las 12
		this.mainNeedleBig.rotation = Math.PI / 2;
		this.mainNeedleBig.tint = 0x000000;

		this.secondaryNeedleBig = Sprite.from("secondaryNeedle"); // minutos
		this.secondaryNeedleBig.anchor.set(0.5, 0.2);
		this.secondaryNeedleBig.scale.set(0.2);
		this.secondaryNeedleBig.eventMode = "dynamic";
		this.secondaryNeedleBig.interactive = true;
		// posición inicial a las 12
		this.secondaryNeedleBig.tint = 0x000000;

		this.secondaryNeedleBig.rotation = Math.PI / 2;
		this.clockBig.addChild(this.mainNeedleBig, this.secondaryNeedleBig);

		this.updateNeedles(true);

		const keyC = Sprite.from("KeyC");
		keyC.anchor.set(0.5);
		keyC.y = 210;
		this.clockBig.addChild(keyC);
		this.mainNeedleBig.on("pointerdown", this.onDragStart.bind(this));
		this.secondaryNeedleBig.on("pointerdown", this.onDragStart.bind(this));

		// ------------- Agregar el sprite de “handPointer” -------------
		this.handPointer = Sprite.from("handPointer");
		this.handPointer.scale.set(0.2);
		this.handPointer.anchor.set(1, 0.11);
		this.handPointer.interactive = false; // ¡Muy importante! Desactiva la interactividad.
		this.handPointer.eventMode = "none"; // Asegura que no capture ningún evento.
		this.addChild(this.handPointer); // Lo ponemos encima de todos

		const aux = new Graphics();
		aux.beginFill(0x00fff, 1);
		aux.drawCircle(0, 0, 25);
		aux.endFill();
		// this.handPointer.addChild(aux);

		// Creamos el Graphics para el blur en toda la pantalla:
		this.screenBlur = new Graphics()
			.beginFill(0x000000, 0.5) // semitransparente
			.drawRect(0, 0, Manager.width, Manager.height)
			.endFill();
		// Aplico un BlurFilter fuerte:
		this.screenBlur.filters = [new BlurFilter(8)];
		// Al principio no lo montamos:
		this.screenBlur.visible = false;
		this.gameContainer.addChild(this.screenBlur);

		const backgroundFilter = new ColorMatrixFilter();
		backgroundFilter.brightness(3, false);
		this.clock.filters = [clockBigFilter];
		this.candles.filters = [backgroundFilter];
		this.chairs.filters = [backgroundFilter];
	}

	/** Muestra clockBig con un fondo difuminado */
	private showClockBig(): void {
		// 1) activamos el blur
		this.screenBlur.visible = true;
		this.screenBlur.zIndex = -1;
		// 2) nos aseguramos de que cubra toda la pantalla (por si cambió de tamaño)
		this.screenBlur.clear().beginFill(0x000000, 0.5).drawRect(0, 0, Manager.width, Manager.height).endFill();
		// 3) subimos el z‑order de screenBlur
		// this.setChildIndex(this.screenBlur, this.children.length - 1);
		// 4) montamos clockBig encima
		this.clockBig.y = 600;
		this.gameContainer.addChild(this.clockBig);
		new Tween(this.clockBig).from({ y: 100, alpha: 0 }).to({ y: 0, alpha: 1 }, 1000).start().easing(Easing.Exponential.Out);
		this.clockBigIsOpen = true;
	}

	/** Oculta clockBig y el fondo difuminado */
	private hideClockBig(): void {
		this.clockBigIsOpen = false;
		// 1) quitamos clockBig
		if (this.clockBig.parent) {
			new Tween(this.clockBig)
				.from({ y: 0, alpha: 1 })
				.to({ y: 100, alpha: 0 }, 500)
				.start()
				.easing(Easing.Exponential.In)
				.onComplete(() => {
					this.clockBig.parent.removeChild(this.clockBig);
				});
		}
		// 2) desactivamos el blur
		this.screenBlur.visible = false;
	}

	/** Crea dos botones +5 y -5 minutos */
	public createTimeButtons(): void {
		const fiveMinus = Sprite.from("5minus");
		const fivePlus = Sprite.from("5plus");
		const oneMinus = Sprite.from("1minus");
		const onePlus = Sprite.from("1plus");

		fiveMinus.scale.set(0.2);
		fivePlus.scale.set(0.2);
		oneMinus.scale.set(0.2);
		onePlus.scale.set(0.2);

		fiveMinus.anchor.set(0.5);
		fiveMinus.x = this.clock.x - 100;
		fiveMinus.y = 250;
		fiveMinus.eventMode = "static"; // para evitar problemas de eventos
		fiveMinus.on("pointerdown", () => {
			this.changeTime(-5);
		});

		oneMinus.anchor.set(0.5);
		oneMinus.x = this.clock.x - 100;
		oneMinus.y = 400;
		oneMinus.eventMode = "static"; // para evitar problemas de eventos
		oneMinus.on("pointerdown", () => {
			this.changeTime(-60);
		});

		fivePlus.anchor.set(0.5);
		fivePlus.x = this.clock.x + 100;
		fivePlus.y = 250;
		fivePlus.eventMode = "static"; // para evitar problemas de eventos
		fivePlus.on("pointerdown", () => {
			this.changeTime(5);
		});

		onePlus.anchor.set(0.5);
		onePlus.x = this.clock.x + 100;
		onePlus.y = 400;
		onePlus.eventMode = "static"; // para evitar problemas de eventos
		onePlus.on("pointerdown", () => {
			this.changeTime(60);
		});

		this.gameContainer.addChild(fiveMinus, fivePlus, oneMinus, onePlus);
	}

	/** Crea el botón de “Confirmar” debajo de +5/–5  ◀– NUEVO */
	public createConfirmButton(): void {
		const confirm = Sprite.from("confirm");
		confirm.anchor.set(0.5);
		confirm.scale.set(0.2);
		confirm.eventMode = "static"; // para evitar problemas de eventos
		confirm.cursor = "pointer"; // para que se vea el cursor de mano
		// posición justo debajo
		confirm.x = this.clock.x;
		confirm.y = 320;

		confirm.on("pointerdown", () => this.onConfirm());

		this.gameContainer.addChild(confirm);
	}

	private createPlayer(): void {
		// en createPlayer o constructor:
		this.player = new AHPlayer({ x: -510, y: 180, speed: 200 });
		this.gameContainer.addChild(this.player);

		this.weaponSprite = Sprite.from("AH_sacredgunicon");
		this.weaponSprite.anchor.set(0.5);
		this.weaponSprite.x = 100;
		this.weaponSprite.y = 55;
		this.weaponSprite.scale.set(0.25);
		this.weaponSprite.visible = false;

		this.player.addChild(this.weaponSprite);

		this.player.setHorizontalBounds(-700, +700);
	}

	/** Aquí colgá tu lógica para cuando el usuario confirme la hora  ◀– NUEVO */
	private onConfirm(): void {
		const h = Math.floor(this.currentTimeMin / 60);
		const m = this.currentTimeMin % 60;
		console.log(`⏰ Hora confirmada: ${h}:${m.toString().padStart(2, "0")}`);

		if (h === 0 && m === 0) {
			this.swapGhostTexture("AH_slenderman", 3000);
			SoundLib.playSound("witch-laugh", { volume: 0.3 });
		}

		if (h === 2 && m === 5) {
			this.ghostMirror.filters = [this.glitchFilter, this.crtFilter];
			this.background.background.filters = [this.glitchFilter, this.crtFilter];
			this.glitchFilter.seed = Math.random();

			SoundLib.playSound("witch-laugh", { end: 3, volume: 0.3 });
			// 1) cambio de textura del espejo
			this.swapGhostTexture("AH_skeleton", 3000);
			setTimeout(() => {
				this.ghostMirror.filters = [];
				this.background.background.filters = [];
			}, 3000);
		}

		// ** NUEVO: efecto poseído a las 0:15 **
		if (h === 0 && m === 25) {
			this.possessTable(3000);
			SoundLib.playSound("possessed-laugh", { volume: 0.3 });
		}

		// ** NUEVO: efecto poseído a las 5:20 **
		if (h === 5 && m === 20) {
			this.inventoryCtrl.pick("papiro");
			this.state.skullPicked = true;
			this.state.pickedItems.add("papiro");
			this.ui.syncActiveIcon();
			this.ui.syncEquippedItem();

			new Timer()
				.duration(1000)
				.onComplete(() => {
					SoundLib.stopAllMusic();
					Manager.changeScene(CameraAStarScene);
				})
				.start();
		}
	}

	/**
	 * Hace flotar y tambalear la sprite `chairs` durante `duration` ms,
	 * como si estuviera poseída.
	 */
	private possessTable(duration: number): void {
		// animación de subida/bajada
		new Tween(this.chairs)
			.to({ y: this.originalChairsY - 60 }, duration / 2)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true)
			.repeat(1)
			.start();

		// animación de rotación oscilante
		new Tween(this.chairs)
			.to({ rotation: 0.1 }, duration / 4)
			.easing(Easing.Quadratic.InOut)
			.yoyo(true)
			.repeat(3)
			.start()
			.onComplete(() => {
				// asegurarnos de resetear
				this.chairs.rotation = 0;
				this.chairs.y = this.originalChairsY;
			});
	}

	/**
	 * Cambia la textura de `ghostMirror` por `key` durante `duration` ms,
	 * y luego vuelve a la original.
	 */
	private swapGhostTexture(key: string, duration: number): void {
		this.ghostMirror.texture = Texture.from(key);

		setTimeout(() => {
			this.ghostMirror.texture = this.originalGhostTex;
		}, duration);
	}

	/**
	 * Ajusta la hora en `deltaMin` minutos (puede ser negativo),
	 * recalcula rotaciones de manecillas y loggea la nueva hora.
	 */
	private changeTime(deltaMin: number): void {
		SoundLib.playSound("clockset", { volume: 0.2, end: 0.3 });
		// actualizamos y envolvemos en [0,720)
		this.currentTimeMin = (this.currentTimeMin + deltaMin + 720) % 720;
		this.updateNeedles(false);

		// log en formato H:MM
		const h = Math.floor(this.currentTimeMin / 60);
		const m = this.currentTimeMin % 60;
		console.log(`Nueva hora: ${h}:${m.toString().padStart(2, "0")}`);
	}

	/**
	 * Métodos para manejar el drag de las manecillas:
	 * onDragStart: inicia el arrastre
	 * onDragMove: rota la manecilla mientras se arrastra
	 * onDragEnd: detiene el arrastre, actualiza currentTimeMin y dispara eventos
	 */
	private onDragStart(event: any): void {
		const target = event.currentTarget as Sprite;
		this.draggingNeedle = target;
		this.dragData = event.data;
		// Feedback visual
		target.alpha = 0.7;
		SoundLib.playSound("clockset", { volume: 0.2, end: 0.3 });
	}

	/**
	 * === onDragMove ===
	 * Durante el arrastre, calculamos el ángulo con el mismo offset +π que en updateNeedles().
	 */
	private onDragMove(): void {
		if (!this.draggingNeedle || !this.dragData) {
			return;
		}

		// 1) Obtenemos la posición del puntero en coords LOCALES de `clockBig`:
		const pointerPos = this.dragData.getLocalPosition(this.clockBig);

		// 2) Restamos el “centro” en Y = -465 (igual que en updateNeedles):
		const pivotX = this.draggingNeedle.x; // suele ser 0
		const pivotY = this.draggingNeedle.y; // suele ser -465
		const dx = pointerPos.x - pivotX;
		const dy = pointerPos.y - pivotY;

		// 3) Calculamos el ángulo crudo con atan2(dy, dx):
		let angle = Math.atan2(dy, dx);

		// 4) Le sumamos +π para alinear con updateNeedles (que usa +π):
		angle += (3 * Math.PI) / 2;

		// 5) Asignamos la rotación directamente a la aguja que arrastramos:
		this.draggingNeedle.rotation = angle;
	}

	/**
	 * === onDragEnd ===
	 * Al soltar, restamos el mismo +π antes de convertir rotación→minutos/horas.
	 */
	private onDragEnd(): void {
		if (!this.draggingNeedle || !this.dragData) {
			return;
		}

		// (1) Restauramos alpha y dejamos de arrastrar
		this.draggingNeedle.alpha = 1;
		const releasedNeedle = this.draggingNeedle;
		this.draggingNeedle = null;
		this.dragData = null;

		// Función para normalizar ángulo en [0, 2π)
		const normalize = (ang: number): number => {
			let a = ang % (2 * Math.PI);
			if (a < 0) {
				a += 2 * Math.PI;
			}
			return a;
		};

		// Definimos el offset que aplicamos en updateNeedles (que es +π)
		const ANGLE_OFFSET = Math.PI;

		if (releasedNeedle === this.mainNeedleBig) {
			// ——————————————————————————————
			// El usuario soltó la AGUJA DE HORAS
			// ——————————————————————————————

			// 1) Leemos la rotación “cruda” de esa aguja, restando ANTES el offset +π:
			const rawRotHour = normalize(this.mainNeedleBig.rotation - ANGLE_OFFSET);

			// 2) Convertimos rawRotHour→“minutos continuos de hora”:
			//    (2π en la aguja de horas equivale a 12h = 720 min)
			const horasContinuas = (rawRotHour / (2 * Math.PI)) * 720; // valor en [0..720)

			// 3) Extraemos la hora entera y los minutos parciales de esa fracción:
			const hourEntera = Math.floor(horasContinuas / 60) % 12; // 0..11
			const fracHor = horasContinuas / 60 - hourEntera; // fracción en [0,1)
			const minutesFromHourFrac = fracHor * 60; // en [0..60)

			// 4) Sacamos los minutos que ya estaban en this.currentTimeMin
			const minutosPrevios = this.currentTimeMin % 60;

			// 5) Construimos un “total continuo” en minutos y lo redondeamos a múltiplos de 5:
			const totalContinuo = hourEntera * 60 + minutesFromHourFrac + minutosPrevios;
			const snappedTotal = Math.round(totalContinuo / 5) * 5;

			this.currentTimeMin = snappedTotal % 720;
		} else {
			// ——————————————————————————————
			// El usuario soltó la AGUJA DE MINUTOS
			// ——————————————————————————————

			// 1) Leemos la rotación “cruda” de la aguja de minutos, restando +π:
			const rawRotMin = normalize(this.secondaryNeedleBig.rotation - ANGLE_OFFSET);

			// 2) Convertimos rawRotMin → “minutos continuos”:
			//    (2π en la aguja de minutos equivale a 60 min)
			const minutosContinuos = (rawRotMin / (2 * Math.PI)) * 60; // valor en [0..60)

			// 3) Tomamos la hora entera previa:
			const horasEnterasPrevias = Math.floor(this.currentTimeMin / 60); // 0..11

			// 4) Construimos total en minutos y redondeamos a múltiplos de 5:
			const totalMinutos = horasEnterasPrevias * 60 + minutosContinuos;
			const snappedTotal = Math.round(totalMinutos / 5) * 5;

			this.currentTimeMin = snappedTotal % 720;
		}

		// 6) Finalmente, animamos ambas agujas EXACTAS según currentTimeMin:
		this.updateNeedles(false, releasedNeedle);

		// 7) (Opcional) Log de la hora final:
		{
			const h = Math.floor(this.currentTimeMin / 60);
			const m = this.currentTimeMin % 60;
			console.log(`Hora tras drag (redondeada a 5): ${h}:${m.toString().padStart(2, "0")}`);
		}

		// 8) Disparamos eventos “mágicos” si corresponde:
		const h = Math.floor(this.currentTimeMin / 60);
		const m = this.currentTimeMin % 60;
		this.checkDragTimeEvents(h, m);
	}

	/**
	 * === updateNeedles ===
	 * Ahora, como las agujas arrancan apuntando “arriba” para las 0:00 / 12:00,
	 * debemos añadir +π para que la rotación 0 rad sea “abajo” y +π sea “arriba”.
	 */
	private updateNeedles(constructor: boolean, releasedNeedle?: Sprite): void {
		if (constructor) {
			// ángulo minutos = (m/60)*2π  + π
			const angleMin = (this.currentTimeMin / 60) * Math.PI * 2 + Math.PI;
			// ángulo horas = ((h + m/60)/12)*2π + π
			const hour = Math.floor(this.currentTimeMin / 60);
			const frac = (this.currentTimeMin % 60) / 60;
			const angleHour = ((hour + frac) / 12) * Math.PI * 2 + Math.PI;

			// Tween suave de ambas agujas (grandes y pequeñas si las tienes):
			new Tween(this.secondaryNeedle).to({ rotation: angleMin }, 300).easing(Easing.Quadratic.Out).start();
			new Tween(this.mainNeedle).to({ rotation: angleHour }, 300).easing(Easing.Quadratic.Out).start();
			new Tween(this.secondaryNeedleBig).to({ rotation: angleMin }, 300).easing(Easing.Quadratic.Out).start();
			new Tween(this.mainNeedleBig).to({ rotation: angleHour }, 300).easing(Easing.Quadratic.Out).start();
			return;
		}

		if (releasedNeedle === this.mainNeedleBig) {
			this.updateHourNeedles();
		} else {
			this.updateMinuteNeedles();
		}
	}

	// … dentro de tu clase AHOldClockScene …

	/**
	 * Anima sólo la aguja de minutos (grande y pequeña) al ángulo que corresponda
	 * según currentTimeMin, tomando el camino angular más corto.
	 */
	private updateMinuteNeedles(): void {
		const angleMin = (this.currentTimeMin / 60) * Math.PI * 2 + Math.PI;

		// Función que ajusta el destino para tomar el camino más corto
		const getShortestAngle = (from: number, to: number): number => {
			let delta = to - from;
			while (delta > Math.PI) {
				delta -= 2 * Math.PI;
			}
			while (delta < -Math.PI) {
				delta += 2 * Math.PI;
			}
			return from + delta;
		};

		// aguja chica
		const currentSmall = this.secondaryNeedle.rotation;
		const adjustedSmall = getShortestAngle(currentSmall, angleMin);
		new Tween(this.secondaryNeedle).to({ rotation: adjustedSmall }, 300).easing(Easing.Quadratic.Out).start();

		// aguja grande
		const currentBig = this.secondaryNeedleBig.rotation;
		const adjustedBig = getShortestAngle(currentBig, angleMin);
		new Tween(this.secondaryNeedleBig).to({ rotation: adjustedBig }, 300).easing(Easing.Quadratic.Out).start();
	}

	/**
	 * Anima sólo la aguja de horas (grande y pequeña) al ángulo que corresponda
	 * según currentTimeMin, tomando el camino angular más corto.
	 */
	private updateHourNeedles(): void {
		const hour = Math.floor(this.currentTimeMin / 60);
		const frac = (this.currentTimeMin % 60) / 60;
		const targetAngle = ((hour + frac) / 12) * Math.PI * 2 + Math.PI;

		// Función que ajusta el destino para tomar el camino más corto
		const getShortestAngle = (from: number, to: number): number => {
			let delta = to - from;
			while (delta > Math.PI) {
				delta -= 2 * Math.PI;
			}
			while (delta < -Math.PI) {
				delta += 2 * Math.PI;
			}
			return from + delta;
		};

		// aguja chica
		const currentSmall = this.mainNeedle.rotation;
		const adjustedSmall = getShortestAngle(currentSmall, targetAngle);
		new Tween(this.mainNeedle).to({ rotation: adjustedSmall }, 300).easing(Easing.Quadratic.Out).start();

		// aguja grande
		const currentBig = this.mainNeedleBig.rotation;
		const adjustedBig = getShortestAngle(currentBig, targetAngle);
		new Tween(this.mainNeedleBig).to({ rotation: adjustedBig }, 300).easing(Easing.Quadratic.Out).start();
	}

	/**
	 * Revisa si la hora (h:m) coincide con algún evento especial.
	 * Se invoca al soltar la manecilla.
	 */
	private checkDragTimeEvents(h: number, m: number): void {
		if (h === 0 && m === 0) {
			this.hideClockBig();
			this.swapGhostTexture("AH_slenderman", 3000);
			SoundLib.playSound("witch-laugh", { volume: 0.3 });
		}

		if (h === 2 && m === 5) {
			this.hideClockBig();
			this.ghostMirror.filters = [this.glitchFilter, this.crtFilter];
			this.background.background.filters = [this.glitchFilter, this.crtFilter];
			this.glitchFilter.seed = Math.random();

			SoundLib.playSound("witch-laugh", { end: 3, volume: 0.3 });
			this.swapGhostTexture("AH_skeleton", 3000);
			setTimeout(() => {
				this.ghostMirror.filters = [];
				this.background.background.filters = [];
			}, 3000);
		}

		if (h === 0 && m === 25) {
			this.hideClockBig();
			this.possessTable(3000);
			SoundLib.playSound("possessed-laugh", { volume: 0.3 });
		}

		if (h === 5 && m === 20) {
			this.hideClockBig();
			this.inventoryCtrl.pick("papiro");
			this.state.skullPicked = true;
			this.state.pickedItems.add("papiro");
			this.ui.syncActiveIcon();
			this.ui.syncEquippedItem();

			new Timer()
				.duration(1000)
				.onComplete(() => {
					SoundLib.stopAllMusic();
					Manager.changeScene(CameraAStarScene);
				})
				.start();
		}
	}

	public override update(_dt: number): void {
		// 1) Determinar si estamos mostrando clockBig
		const relojVisible = this.clockBig.parent !== undefined && this.clockBig.parent !== null;

		if (relojVisible) {
			// a) Ocultamos el cursor del sistema
			pixiRenderer.pixiRenderer.view.style.cursor = "none";

			// b) Obtenemos la posición global del puntero desde renderer.events.pointer.global
			const globalPos = pixiRenderer.pixiRenderer.events.pointer.global;
			this.handPointer.visible = true;
			this.handPointer.position.set(globalPos.x, globalPos.y);
		} else {
			// Restauramos cursor normal y ocultamos handPointer
			pixiRenderer.pixiRenderer.view.style.cursor = "";
			this.handPointer.visible = false;
		}

		// Player movement
		this.player.update(_dt);
		// Si el CRTFilter está activo, avanzamos su animación
		if (this.background.background.filters?.includes(this.crtFilter)) {
			// seed aleatorio para glitch
			this.glitchFilter.seed = Math.random();
			// avanzamos tiempo en CRT para mover las líneas
			this.crtFilter.time += 0.05;
		}

		if (this.overlay) {
			if (this.overlay.visible) {
				if (Keyboard.shared.justReleased("Enter")) {
					this.overlay.visible = false;
				}
			}
		}

		this.ui.syncFlashlightUI();
		this.ui.syncActiveIcon();
		this.ui.syncEquippedItem();

		// Trigger overlap & input
		const pb = this.player.hitbox.getBounds();
		const tb = this.trigger.triggerZone.getBounds();
		const inTrig = pb.x + pb.width > tb.x && pb.x < tb.x + tb.width && pb.y + pb.height > tb.y && pb.y < tb.y + tb.height;
		this.trigger.triggerText.visible = inTrig;

		if (inTrig && Keyboard.shared.justReleased("KeyE")) {
			if (!this.clockBigIsOpen) {
				this.showClockBig();
			}
		}

		this.checkUsedItem();
		if (Keyboard.shared.justPressed("KeyC") && this.cluesSprVisible) {
			this.cluesSprVisible = false;
			this.gameContainer.removeChild(this.cluesSpr);
		}

		if (Keyboard.shared.justPressed("KeyC") && relojVisible) {
			this.hideClockBig();
		}
	}

	private checkUsedItem(): void {
		if (Keyboard.shared.justReleased("KeyU")) {
			const state = this.state;
			if (state.activeItem) {
				console.log("Usaste el ítem:", state.activeItem);
				if (state.activeItem === "battery") {
					SoundLib.playSound("reload", { volume: 0.2 });
					this.state.reset();
					state.pickedItems.delete(state.activeItem);
					state.activeItem = null;
					this.ui.syncActiveIcon();
				}
				if (state.activeItem === "holywater") {
					SoundLib.playSound("reload", { volume: 0.2 });
					this.state.fullHealth();
					state.pickedItems.delete(state.activeItem);
					state.activeItem = null;
					this.ui.syncActiveIcon();
				}
				if (state.activeItem === "clues") {
					console.log("clues");
					SoundLib.playSound("reload", { volume: 0.2 });
					this.cluesSpr = Sprite.from("AH_cluesicon");
					this.cluesSprVisible = true;

					// this.drawerCloseText = new Text("C", { fill: "#fff", fontSize: 96 });
					const drawerCloseText = Sprite.from("KeyC");
					drawerCloseText.position.y = 350;
					drawerCloseText.scale.set(2.5);
					drawerCloseText.anchor.set(0.5);
					this.cluesSpr.addChild(drawerCloseText);

					this.gameContainer.addChild(this.cluesSpr);
					this.cluesSpr.anchor.set(0.5);
				}
			}
		}
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.gameContainer.x = newW / 2;
		this.gameContainer.y = newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.frontLayerContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.frontLayerContainer.x = newW / 2;
		this.frontLayerContainer.y = newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.pauseContainer, newW, newH, 1536, 1200, ScaleHelper.FIT);
		this.pauseContainer.x = newW / 2;
		this.pauseContainer.y = newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.uiRightContainer.x = newW;
		this.uiRightContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiCenterContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.uiCenterContainer.x = newW * 0.5;
		this.uiCenterContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;
	}
}
