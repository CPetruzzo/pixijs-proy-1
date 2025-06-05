/* eslint-disable @typescript-eslint/naming-convention */
import { Texture } from "pixi.js";
import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
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
import { Manager } from "../../..";
import { CameraAStarScene } from "../Tutorial/TutorialAStarScene";
import { OverlayScene } from "./OverlayScene";
import { Keyboard } from "../../../engine/input/Keyboard";

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

	// Botones
	private btnPlus: Container;
	private btnMinus: Container;
	private btnConfirm: Container;

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

	constructor() {
		super();
		// capas
		this.addChild(this.gameContainer);
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

		// péndulo
		this.pendulum = Sprite.from("pendulum-clock-manecilla");
		this.pendulum.anchor.set(0.5, 0);
		this.pendulum.y = -200;

		// manecillas
		this.mainNeedle = Sprite.from("pendulum-clock-needle"); // hora
		this.mainNeedle.anchor.set(1, 0);
		this.mainNeedle.y = -465;

		this.secondaryNeedle = Sprite.from("pendulum-clock-needle"); // minutos
		this.secondaryNeedle.anchor.set(1, 0);
		this.secondaryNeedle.y = -465;

		this.gameContainer.addChild(this.clock);
		this.clock.addChild(this.pendulum, this.mainNeedle, this.secondaryNeedle);

		new Tween(this.pendulum).from({ angle: -15 }).to({ angle: 15 }, 1000).easing(Easing.Quadratic.InOut).repeat(Infinity).yoyo(true).start();
		SoundLib.playMusic("clockticking", { loop: true, volume: 0.1, speed: 0.94, end: 1.95 });

		this.createTimeButtons();
		this.createConfirmButton();

		this.updateNeedles();

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
		new Timer().to(1000).onComplete(() => {
			this.overlay.visible = false;
		});
	}

	/** Crea dos botones +5 y -5 minutos */
	private createTimeButtons(): void {
		const style = new TextStyle({ fill: "#ffffff", fontSize: 24, fontWeight: "bold" });

		// contenedor comunes
		const makeBtn = (label: string): Container => {
			const c = new Container();
			const g = new Graphics().beginFill(0x333333).lineStyle(2, 0xffffff).drawRoundedRect(-50, -20, 100, 40, 8).endFill();
			const t = new Text(label, style);
			t.anchor.set(0.5);
			c.addChild(g, t);
			c.interactive = true;
			return c;
		};

		// botón +5
		this.btnPlus = makeBtn("+5");
		this.btnPlus.x = this.clock.x + 100;
		this.btnPlus.y = 250;
		this.btnPlus.on("pointerdown", () => {
			this.changeTime(5);
		});
		this.gameContainer.addChild(this.btnPlus);

		// botón -5
		this.btnMinus = makeBtn("-5");
		this.btnMinus.x = this.clock.x - 100;
		this.btnMinus.y = 250;
		this.btnMinus.on("pointerdown", () => {
			this.changeTime(-5);
		});
		this.gameContainer.addChild(this.btnMinus);
	}

	/** Crea el botón de “Confirmar” debajo de +5/–5  ◀– NUEVO */
	private createConfirmButton(): void {
		const style = new TextStyle({ fill: "#ffffff", fontSize: 24, fontWeight: "bold" });
		// reuso el mismo helper de antes:
		const g = new Graphics().beginFill(0x005500).lineStyle(2, 0xffffff).drawRoundedRect(-60, -20, 120, 40, 8).endFill();
		const txt = new Text("Confirmar", style);
		txt.anchor.set(0.5);

		this.btnConfirm = new Container();
		this.btnConfirm.addChild(g, txt);
		this.btnConfirm.interactive = true;

		// posición justo debajo
		this.btnConfirm.x = this.clock.x;
		this.btnConfirm.y = 320;

		this.btnConfirm.on("pointerdown", () => this.onConfirm());

		this.gameContainer.addChild(this.btnConfirm);
	}

	private createPlayer(): void {
		// en createPlayer o constructor:
		this.player = new AHPlayer({ x: -510, y: 170, speed: 200 });
		this.gameContainer.addChild(this.player);

		this.weaponSprite = Sprite.from("AH_sacredgunicon");
		this.weaponSprite.anchor.set(0.5);
		this.weaponSprite.x = 100;
		this.weaponSprite.y = 50;
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

		// ** NUEVO: efecto poseído a las 0:15 **
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
		this.updateNeedles();

		// log en formato H:MM
		const h = Math.floor(this.currentTimeMin / 60);
		const m = this.currentTimeMin % 60;
		console.log(`Nueva hora: ${h}:${m.toString().padStart(2, "0")}`);
	}

	/** Pone la rotación de las agujas según `currentTimeMin`. */
	private updateNeedles(): void {
		// ángulo minutos = min/60 * 2π
		const angleMin = (this.currentTimeMin / 60) * Math.PI * 2 + 90.1;
		// ángulo horas = (h + m/60)/12 * 2π
		const hour = Math.floor(this.currentTimeMin / 60);
		const frac = (this.currentTimeMin % 60) / 60;
		const angleHour = ((hour + frac) / 12) * Math.PI * 2 + 90.1;

		// Tween suave
		new Tween(this.secondaryNeedle).to({ rotation: angleMin }, 300).easing(Easing.Quadratic.Out).start();
		new Tween(this.mainNeedle).to({ rotation: angleHour }, 300).easing(Easing.Quadratic.Out).start();
	}

	public override update(_dt: number): void {
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

		this.checkUsedItem();
		if (Keyboard.shared.justPressed("KeyC") && this.cluesSprVisible) {
			this.cluesSprVisible = false;
			this.gameContainer.removeChild(this.cluesSpr);
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
