import { CRTFilter } from "@pixi/filter-crt";
import { GlitchFilter } from "@pixi/filter-glitch";

import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import type { Text } from "pixi.js";
import { Sprite, Texture, Graphics, Container, BLEND_MODES, BlurFilter, Point } from "pixi.js";
import { ColorMatrixFilter } from "pixi.js";
import { Manager } from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";

// Controllers & State
import { InventoryController } from "./game/InventoryController";
import { GameStateManager } from "./game/GameStateManager";
import { FlashlightController } from "./game/FlashLightController";
import { AHPlayer } from "./classes/Player";
import { Easing, Tween } from "tweedle.js";
import { Trigger } from "./classes/Trigger";
import Random from "../../../engine/random/Random";
import type { ProgressBar } from "@pixi/ui";
import type { PausePopUp } from "./game/PausePopUp";
import { Timer } from "../../../engine/tweens/Timer";
import { OverlayScene } from "./OverlayScene";
import { AbandonedShelterScene } from "./AbandonedShelterScene";
import { UI } from "./UI";

export class AHHintRoom extends PixiScene {
	private gameContainer = new Container();
	private frontLayerContainer = new Container();
	private uiRightContainer = new Container();
	private uiCenterContainer = new Container();
	private uiLeftContainer = new Container();
	private pauseContainer = new Container();

	// World
	private background!: Sprite;

	// Light & enemy
	private darknessMask!: Graphics;
	private lightContainer!: Container;
	private lightCone!: Sprite;
	private coneMask!: Graphics;
	private enemyBase!: Sprite;
	private enemyLit!: Sprite;

	// Battery UI
	private batteryBars: Sprite[] = [];

	// Controllers & state
	private flashlightCtrl = new FlashlightController();
	private inventoryCtrl = new InventoryController();
	private state = GameStateManager.instance;
	public static readonly BUNDLES = ["abandonedhouse"];
	private player!: AHPlayer;

	private previousBattery = this.state.batteryLevel;
	private trigger: Trigger;
	private glitch: GlitchFilter;
	private drawerTrigger: Trigger;
	private crt: CRTFilter;

	private drawerOpened: boolean = false;

	private drawer: Sprite;
	private batteryIcon: Sprite;
	private holywater: Sprite;
	private drawerCloseText: Text | Sprite;
	private hpBar: ProgressBar;

	// dentro de AHHintRoom
	private batteryTrigger!: Trigger;
	private holywaterTrigger!: Trigger;

	private pausePopUp: PausePopUp | null = null;
	private activeIcon!: Sprite | null;

	private sacredgun: Sprite;
	private sacredgunTrigger!: Trigger;

	private weaponSprite!: Sprite;

	private bullets: { sprite: Sprite; vx: number; vy: number }[] = [];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	private BULLET_SPEED = 2500; // px/s
	private overlay: OverlayScene;
	private clues!: Sprite;
	private cluesTrigger!: Trigger;
	private cluesSpr: Sprite;
	private cluesSprVisible: boolean;
	private ui: UI;

	constructor() {
		super();
		this.addChild(this.gameContainer);
		this.addChild(this.frontLayerContainer);
		this.addChild(this.pauseContainer);
		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiCenterContainer);
		this.addChild(this.uiRightContainer);

		console.log("this it's the new scene");
		console.log(this.state.pickedItems);

		SoundLib.playMusic("abandonedhouse", { volume: 0.1, loop: true });

		new Timer()
			.duration(1500)
			.start()
			.onComplete(() => {
				SoundLib.playSound("possessed-laugh", { volume: 0.05 });
				this.overlay = new OverlayScene();
				this.gameContainer.addChild(this.overlay);
				this.overlay.typeText("HA ha hA ha haaaAaAa...", "haaaAaAa", "red", 30);
			});
		// build
		this.createBackground();
		this.createPlayer();
		this.createEnemy();
		this.createLightMask();
		this.createLightCone();
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
		this.trigger = new Trigger();
		this.trigger.createTrigger(this.gameContainer);
		this.trigger.triggerZone.x = this.trigger.triggerZone.x - 150;
		this.trigger.triggerZone.y = this.trigger.triggerZone.y + 150;
		this.trigger.triggerText.x = this.trigger.triggerZone.x;

		this.drawerTrigger = new Trigger();
		this.drawerTrigger.createTrigger(this.gameContainer);
		this.drawerTrigger.triggerZone.x = this.drawerTrigger.triggerZone.x + 520;
		this.drawerTrigger.triggerZone.y = this.drawerTrigger.triggerZone.y + 150;
		this.drawerTrigger.triggerText.x = this.drawerTrigger.triggerZone.x;
		this.drawerTrigger.triggerText.y = this.drawerTrigger.triggerZone.y - 50;

		this.flashlightCtrl.on("changed", (state) => {
			if (state.batteryLevel < this.previousBattery) {
				this.animateBatteryDrain(this.previousBattery);
				this.flashlightBlink();
			} else {
				this.syncFlashlightUI();
				this.resetMasks();
			}

			this.previousBattery = state.batteryLevel;
		});

		this.inventoryCtrl.on("picked", (id) => this.inventoryCtrl.showNewItem(id, this.gameContainer));

		// initial sync
		this.syncFlashlightUI();

		// apply blur filter
		this.darknessMask.filters = [new BlurFilter(8)];

		new Timer()
			.to(4000)
			.start()
			.onComplete(() => {
				this.overlay.typeText(
					"Qué fueron esas voces?!!! Esta casa está muy mal... Pero bueno, menos mal que tengo una linterna. Espero que no se me acabe la batería...",
					"batería",
					"red",
					20
				);
			});
	}

	private createBackground(): void {
		this.background = Sprite.from("AH_hintroom");
		this.background.anchor.set(0.5);
		this.gameContainer.addChildAt(this.background, 0);
	}

	private createPlayer(): void {
		// en createPlayer o constructor:
		this.player = new AHPlayer({ x: -510, y: 150, speed: 200 });
		this.player.y = this.player.y + 40;
		this.gameContainer.addChild(this.player);

		this.weaponSprite = Sprite.from("AH_sacredgunicon");
		this.weaponSprite.anchor.set(0.5);
		this.weaponSprite.x = 100;
		this.weaponSprite.y = -35;
		this.weaponSprite.scale.set(0.25);
		this.weaponSprite.visible = false;

		this.player.addChild(this.weaponSprite);

		this.player.setHorizontalBounds(-700, +700);
	}

	private createEnemy(): void {
		this.enemyBase = Sprite.from("AH_ghost");
		this.enemyBase.anchor.set(0.5);
		this.enemyBase.scale.set(0.85);
		this.enemyBase.position.set(600, 150 + this.enemyBase.height * 0.5);
		this.gameContainer.addChild(this.enemyBase);
		this.enemyBase.alpha = 0.001;

		const applyBreathingTweenAndFloat = (creature: Sprite): void => {
			const baseScaleY = creature.scale.y;
			const targetScaleY = baseScaleY * 1.015;
			const duration = 1500 + (Math.random() * 100 - 50);
			new Tween(creature.scale).to({ y: targetScaleY }, duration).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start();
		};

		this.enemyLit = Sprite.from("AH_ghost");
		this.enemyLit.anchor.set(0.5, 1);
		this.enemyLit.scale.set(0.85);
		this.enemyLit.position.copyFrom(this.enemyBase.position);

		const cm = new ColorMatrixFilter();
		cm.brightness(4, false);
		cm.blackAndWhite(true);
		const cmbase = new ColorMatrixFilter();
		cmbase.contrast(4, false);
		this.enemyBase.filters = [cmbase];

		// 1) Creamos los filtros CRT + Glitch
		this.crt = new CRTFilter({
			lineWidth: 2, // grosor de scanlines
			lineContrast: 0.3, // contraste de líneas
			vignetting: 0.5,
			vignettingAlpha: 0.3,
		});
		this.glitch = new GlitchFilter({
			slices: 20,
			offset: 10,
			fillMode: 1, // 1 => repeat
		});

		// 2) Asignamos al ghost “lit” (la versión brillante)
		this.enemyLit.filters = [cm, this.crt, this.glitch];

		this.enemyLit.visible = false;

		applyBreathingTweenAndFloat(this.enemyBase);
		applyBreathingTweenAndFloat(this.enemyLit);

		this.gameContainer.addChild(this.enemyLit);
	}

	private createLightMask(): void {
		this.darknessMask = new Graphics();
		this.addChildAt(this.darknessMask, 1);
	}

	private createLightCone(): void {
		// attach light to player
		const halfAngle = Math.PI / 6;
		const radius = 1024;

		// container follows player
		this.lightContainer = new Container();
		this.lightContainer.position.set(80, -45);
		this.player.addChild(this.lightContainer);

		// gradient canvas
		const size = radius;
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext("2d")!;
		const c = size / 2;
		ctx.beginPath();
		ctx.moveTo(c, c);
		ctx.arc(c, c, c, -halfAngle, halfAngle);
		ctx.closePath();
		ctx.clip();
		const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
		grad.addColorStop(0, "rgba(255,255,200,0.8)");
		grad.addColorStop(1, "rgba(255,255,200,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, size, size);

		// sprite & mask
		this.lightCone = Sprite.from(Texture.from(canvas));
		this.lightCone.anchor.set(0.5);
		this.lightCone.filters = [new BlurFilter(8)];
		this.lightCone.blendMode = BLEND_MODES.ADD;
		this.lightContainer.addChild(this.lightCone);

		this.coneMask = new Graphics();
		this.lightContainer.addChild(this.coneMask);
		this.enemyLit.mask = this.coneMask;
	}

	private animateBatteryDrain(oldLevel: number): void {
		const idx = oldLevel - 1;
		const bar = this.batteryBars[idx];
		// barra desaparece
		new Tween(bar).to({ alpha: 0 }, 500).start();
		// parpadeo de la luz
		new Tween(this.lightCone).to({ alpha: 0.3 }, 100).yoyo(true).repeat(3).start();
	}

	private syncFlashlightUI(): void {
		const { batteryLevel, flashlightOn } = this.state;

		// Apagá la luz si no hay batería
		if (batteryLevel <= 0) {
			this.lightCone.alpha = 0;
		} else {
			// Si hay batería, seguí el estado de encendido/apagado
			this.lightCone.alpha = flashlightOn ? 0.3 : 0;
		}

		this.batteryBars.forEach((b, i) => (b.alpha = i < batteryLevel ? 1 : 0));
	}

	private flashlightBlink(): void {
		console.log("blink called");
		new Tween(this.lightContainer)
			.to({ alpha: 0.1 }, 200)
			.yoyo(true)
			.repeat(3)
			.onUpdate(() => console.log("blinking...", this.lightContainer.alpha))
			.onComplete(() => {
				console.log("blink done");
				this.syncFlashlightUI();
			})
			.start();
	}

	private resetMasks(): void {
		this.coneMask.clear();
		this.enemyLit.visible = false;
		this.updateDarknessMask();
	}

	private updateDarknessMask(): void {
		const w = Manager.width;
		const h = Manager.height;
		const half = Math.PI / 6;
		const r = 1024;

		// 1) limpio y pinto el overlay
		this.darknessMask.clear();
		this.darknessMask.beginFill(0xff0000, 0.001).drawRect(0, 0, w, h); // Rojo fuerte para testear

		// 2) si la linterna está on, borro el cono
		if (this.state.flashlightOn && this.state.batteryLevel > 0) {
			// convierto el punto local (player + offset) a global (pantalla)
			const localPoint = new Point(this.player.x + this.lightContainer.x, this.player.y + this.lightContainer.y);
			const globalPoint = this.gameContainer.toGlobal(localPoint);

			const cx = globalPoint.x;
			const cy = globalPoint.y;

			// calculo facing
			const facing = this.player.scale.x >= 0 ? 0 : Math.PI;
			const start = facing - half;
			const end = facing + half;

			this.darknessMask
				.beginHole()
				.moveTo(cx, cy)
				.lineTo(cx + r * Math.cos(start), cy + r * Math.sin(start))
				.arc(cx, cy, r, start, end)
				.lineTo(cx, cy)
				.endHole();
		}

		this.darknessMask.endFill();
	}

	private updateLight(): void {
		const half = Math.PI / 6;
		const r = 1024;
		const facing = this.player.scale.x >= 0 ? 0 : Math.PI;
		const start = facing - half;
		const end = facing + half;

		this.coneMask.clear();
		this.coneMask
			.beginFill(0xffffff)
			.moveTo(0, 0)
			.lineTo(r * Math.cos(start), r * Math.sin(start))
			.arc(0, 0, r, start, end)
			.lineTo(0, 0)
			.endFill();
	}

	private updateEnemyLit(): void {
		// 0) Si la linterna está apagada o sin batería, no ilumines nunca
		if (!this.state.flashlightOn || this.state.batteryLevel <= 0) {
			this.enemyLit.visible = false;
			return;
		}

		// 1) vector del jugador al enemigo
		const dx = this.enemyBase.x - this.player.x;
		const dy = this.enemyBase.y - this.player.y;
		const distSq = dx * dx + dy * dy;

		// parámetros de cono
		const half = Math.PI / 6;
		const r = 1024;
		let lit = false;

		// 2) dentro de radio
		if (distSq <= r * r) {
			const angleToEnemy = Math.atan2(dy, dx);
			const facing = this.player.scale.x >= 0 ? 0 : Math.PI;
			let delta = angleToEnemy - facing;
			delta = Math.atan2(Math.sin(delta), Math.cos(delta));
			lit = Math.abs(delta) <= half;
		}

		this.enemyLit.visible = lit;
	}

	public override update(dt: number): void {
		if (this.pausePopUp !== null) {
			if (this.pausePopUp.popupOpened) {
				return;
			}
		}
		if (Keyboard.shared.justReleased("KeyR")) {
			SoundLib.playSound("reload", { volume: 0.2 });
			this.state.reset();
		}

		if (this.overlay) {
			if (this.overlay.visible) {
				if (Keyboard.shared.justReleased("Enter")) {
					this.overlay.visible = false;
				}
			}
		}

		// cada frame variamos un poco el desplazamiento horizontal
		this.glitch.seed = Math.random();
		this.glitch.offset = 2 + Math.random() * 10;
		// a veces activamos un slice extra
		this.glitch.slices = Math.random() < 0.1 ? 10 : 5;

		this.crt.noise = Random.shared.random(0, 1);
		// Player movement
		this.player.update(dt);

		// Flashlight input
		if (Keyboard.shared.justReleased("Space")) {
			this.flashlightCtrl.toggle();
			SoundLib.playSound("switch", { volume: 0.05 });
		}
		this.flashlightCtrl.update(dt);
		this.ui.syncFlashlightUI();
		this.ui.syncActiveIcon();
		this.ui.syncEquippedItem();

		// player hitbox bounds
		const pb = this.player.hitbox.getBounds();
		// Trigger overlap & input
		const tb = this.trigger.triggerZone.getBounds();
		const inTrig = pb.x + pb.width > tb.x && pb.x < tb.x + tb.width && pb.y + pb.height > tb.y && pb.y < tb.y + tb.height;
		this.trigger.triggerText.visible = inTrig;
		if (inTrig && Keyboard.shared.justReleased("KeyE")) {
			SoundLib.playMusic("creakingDoor", { volume: 0.3, speed: 2, loop: false, end: 3 });
			console.log("Trigger activated");
			Manager.changeScene(AbandonedShelterScene, { transitionClass: FadeColorTransition });
		}

		// DrawerTrigger overlap & input
		const drawertb = this.drawerTrigger.triggerZone.getBounds();
		const drawerinTrig = pb.x + pb.width > drawertb.x && pb.x < drawertb.x + drawertb.width && pb.y + pb.height > drawertb.y && pb.y < drawertb.y + drawertb.height;
		this.drawerTrigger.triggerText.visible = drawerinTrig;

		if (drawerinTrig && Keyboard.shared.justPressed("KeyC") && this.drawerOpened) {
			this.drawerOpened = false;
			SoundLib.playSound("drawer", { volume: 0.3, speed: 2, loop: false });
			this.drawer.removeChildren();
			new Tween(this.drawer)
				.to({ alpha: 0, y: -1000 }, 500)
				.start()
				.onComplete(() => {
					this.gameContainer.removeChild(this.drawer);
				});
		}

		if (Keyboard.shared.justPressed("KeyC") && this.cluesSprVisible) {
			this.cluesSprVisible = false;
			this.gameContainer.removeChild(this.cluesSpr);
		}

		if (drawerinTrig && Keyboard.shared.justReleased("KeyE") && !this.drawerOpened) {
			SoundLib.playSound("drawer", { volume: 0.3, speed: 2, loop: false });
			console.log("Trigger activated");
			new Tween(this.drawerTrigger.triggerText).to({ alpha: 0 }, 500).start();

			this.drawer = Sprite.from("AH_drawer");
			this.drawer.anchor.set(0.5);
			this.drawer.scale.set(0.5);
			this.drawer.alpha = 0;
			this.gameContainer.addChild(this.drawer);
			new Tween(this.drawer).from({ y: -1000 }).to({ y: 0, alpha: 1 }, 500).start();

			this.drawerOpened = true;

			if (!this.state.pickedItems.has("battery")) {
				this.batteryIcon = Sprite.from("AH_batteryicon");
				this.batteryIcon.scale.set(0.5);
				this.batteryIcon.anchor.set(0.5);
				this.drawer.addChild(this.batteryIcon);

				this.batteryTrigger = new Trigger();
				this.batteryTrigger.createPointerTrigger(this.drawer, this.batteryIcon.x, this.batteryIcon.y, () => {
					SoundLib.playSound("AH_grab", { start: 0.2, end: 1, volume: 0.5 });
					this.inventoryCtrl.pick("battery");
					this.drawer.removeChild(this.batteryIcon);
					this.batteryTrigger.triggerZone.destroy();
					this.batteryTrigger.triggerText.destroy();
				});
			}

			if (!this.state.pickedItems.has("holywater")) {
				this.holywater = Sprite.from("AH_holywatericon");
				this.holywater.scale.set(0.45);
				this.holywater.rotation = 90;
				this.holywater.anchor.set(0.5);
				this.holywater.y = -10;
				this.holywater.x = -250;
				this.drawer.addChild(this.holywater);

				this.holywaterTrigger = new Trigger();
				this.holywaterTrigger.createPointerTrigger(this.drawer, this.holywater.x, this.holywater.y, () => {
					SoundLib.playSound("AH_grab", { start: 0.2, end: 1, volume: 0.5 });
					this.inventoryCtrl.pick("holywater");
					this.drawer.removeChild(this.holywater);
					this.holywaterTrigger.triggerZone.destroy();
					this.holywaterTrigger.triggerText.destroy();
				});
			}

			if (!this.state.pickedItems.has("clues")) {
				this.clues = Sprite.from("AH_cluesicon");
				this.clues.scale.set(0.18);
				this.clues.rotation = 180;
				this.clues.anchor.set(0.5);
				this.clues.y = -250;
				this.clues.x = -250;
				this.drawer.addChild(this.clues);

				this.cluesTrigger = new Trigger();
				this.cluesTrigger.createPointerTrigger(this.drawer, this.clues.x, this.clues.y, () => {
					SoundLib.playSound("AH_grab", { start: 0.2, end: 1, volume: 0.5 });
					this.inventoryCtrl.pick("clues");
					this.drawer.removeChild(this.clues);
					this.cluesTrigger.triggerZone.destroy();
					this.cluesTrigger.triggerText.destroy();
				});
			}

			if (!this.state.pickedItems.has("sacredgun")) {
				this.sacredgun = Sprite.from("AH_sacredgunicon");
				this.sacredgun.scale.set(0.45);
				this.sacredgun.rotation = 90;
				this.sacredgun.anchor.set(0.5);
				this.sacredgun.y = -10;
				this.sacredgun.x = 250;
				this.drawer.addChild(this.sacredgun);

				this.sacredgunTrigger = new Trigger();
				this.sacredgunTrigger.createPointerTrigger(this.drawer, this.sacredgun.x, this.sacredgun.y, () => {
					SoundLib.playSound("AH_grab", { start: 0.2, end: 1, volume: 0.5 });
					this.inventoryCtrl.pick("sacredgun");
					this.drawer.removeChild(this.sacredgun);
					this.state.gunGrabbed = true;
					this.sacredgunTrigger.triggerZone.destroy();
					this.sacredgunTrigger.triggerText.destroy();
				});
			}

			// this.drawerCloseText = new Text("C", { fill: "#fff", fontSize: 96 });
			this.drawerCloseText = Sprite.from("KeyC");
			this.drawerCloseText.position.y = 350;
			this.drawerCloseText.scale.set(2.5);
			this.drawerCloseText.anchor.set(0.5);
			this.drawer.addChild(this.drawerCloseText);
		}

		this.checkUsedItem();
		this.updateBullets(dt / 1000); // dt en segundos

		this.updateDarknessMask();
		this.updateLight();
		this.updateEnemyLit();

		super.update(dt);
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
				if (state.activeItem === "clues" && !this.cluesSprVisible) {
					SoundLib.playSound("bookPage", { volume: 0.2, start: 0.5, end: 2, speed: 1.3 });
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
				if (state.activeItem === "sacredgun") {
					SoundLib.playSound("gun", { volume: 0.2, start: 0.6, end: 3 });
					this.fireBullet();
				}
			}
		}
	}

	private updateBullets(deltaSec: number): void {
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			const { sprite, vx, vy } = this.bullets[i];
			sprite.x += vx * deltaSec;
			sprite.y += vy * deltaSec;

			// 3a) Fuera de pantalla → eliminar
			if (sprite.x < -750 || sprite.x > Manager.width + 100 || sprite.y < -100 || sprite.y > Manager.height + 100) {
				sprite.destroy();
				console.log("se gue");
				this.bullets.splice(i, 1);
				continue;
			}

			// 3b) Colisión con el enemigo
			if (sprite.getBounds().intersects(this.enemyBase.getBounds())) {
				// lo iluminamos y hacemos desaparecer la bala
				this.enemyLit.visible = true;
				console.log("le dio al enemigo");
				SoundLib.playSound("witch-laugh", { volume: 0.1, singleInstance: true });
				this.overlay.visible = true;
				this.overlay.typeText(
					"Y si! No sé qué pensé que iba a pasar... o sea... un fantasma, una bala... realmente pensé que podía impactar? dejá no má...",
					"fantasma",
					"red",
					15
				);
			}
		}
	}

	// 2) Método para crear y disparar la bala
	private fireBullet(): void {
		// 1) crea la bala
		const bullet = Sprite.from("AH_batteryicon"); // reemplazá por tu textura
		bullet.anchor.set(0.5);
		bullet.scale.set(0.1);

		// 2) calculamos la punta del arma en global
		const halfW = (this.weaponSprite.width * this.weaponSprite.scale.x) / 2;
		const localTip = new Point(halfW, 0);
		const globalTip = this.weaponSprite.toGlobal(localTip);

		// 3) convertimos ese punto global a coords de gameContainer
		const localInGame = this.gameContainer.toLocal(globalTip);
		bullet.position.set(localInGame.x + 5, localInGame.y - 15);

		// 4) lo añadimos y le damos velocidad
		this.gameContainer.addChild(bullet);
		const dir = this.player.scale.x >= 0 ? +1 : -1;
		this.bullets.push({ sprite: bullet, vx: dir * this.BULLET_SPEED, vy: 0 });
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.gameContainer.x = newW / 2;
		this.gameContainer.y = newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.uiRightContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.uiRightContainer.x = newW;
		this.uiRightContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.frontLayerContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.frontLayerContainer.x = newW / 2;
		this.frontLayerContainer.y = newH / 2;

		ScaleHelper.setScaleRelativeToIdeal(this.uiCenterContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.uiCenterContainer.x = newW * 0.5;
		this.uiCenterContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, newW, newH, 1536, 1024, ScaleHelper.FIT);
		this.uiLeftContainer.x = 0;
		this.uiLeftContainer.y = 0;

		ScaleHelper.setScaleRelativeToIdeal(this.pauseContainer, newW, newH, 1536, 1200, ScaleHelper.FIT);
		this.pauseContainer.x = newW / 2;
		this.pauseContainer.y = newH / 2;
	}
}
