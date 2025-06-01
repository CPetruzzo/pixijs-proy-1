import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Sprite, Texture, Graphics, Container, BLEND_MODES, BlurFilter, Point, AnimatedSprite } from "pixi.js";
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
import { AHHintRoom } from "./AHHintRoom";
import type { ProgressBar } from "@pixi/ui";
import type { PausePopUp } from "./game/PausePopUp";
import { AHAltarRoom } from "./AHAltarRoom";
import { Background } from "./Background";
import { UI } from "./UI";
import { OverlayScene } from "./OverlayScene";
import { Timer } from "../../../engine/tweens/Timer";
import { CRTFilter } from "@pixi/filter-crt";
// import { FlashLight } from "./classes/FlashLight";

export class AbandonedShelterScene extends PixiScene {
	private gameContainer = new Container();
	private frontLayerContainer = new Container();
	private pauseContainer = new Container();
	private uiRightContainer = new Container();
	private uiCenterContainer = new Container();
	private uiLeftContainer = new Container();

	// World
	public background!: Background;

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
	private altarTrigger: Trigger;

	private hpBar: ProgressBar;

	private pausePopUp: PausePopUp | null = null;
	private activeIcon!: Sprite | null;
	private weaponSprite!: Sprite;

	private bullets: { sprite: Sprite; vx: number; vy: number }[] = [];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	private BULLET_SPEED = 2500; // px/s
	public ui: UI;
	private overlay: OverlayScene;
	private tutorial: boolean = true;
	private crt: CRTFilter;
	// private flashlight: FlashLight;

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

		// build
		this.background = new Background("houseBG", this.gameContainer, this.frontLayerContainer);
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

		this.altarTrigger = new Trigger();
		this.altarTrigger.createTrigger(this.gameContainer);
		this.altarTrigger.triggerZone.x += 1100;
		this.altarTrigger.triggerText.x += 1100;

		this.flashlightCtrl.on("changed", (state) => {
			if (state.batteryLevel < this.previousBattery) {
				this.ui.animateBatteryDrain(this.previousBattery);

				this.flashlightBlink();
			} else {
				this.ui.syncFlashlightUI();
				this.resetMasks();
			}

			this.previousBattery = state.batteryLevel;
		});

		this.inventoryCtrl.on("picked", (id) => this.inventoryCtrl.showNewItem(id, this.gameContainer));

		this.ui.syncFlashlightUI();

		// apply blur filter
		this.darknessMask.filters = [new BlurFilter(50)];

		this.overlay = new OverlayScene();

		if (!this.state.gunGrabbed) {
			if (this.tutorial) {
				this.overlay.typeText(
					"Hace frío aquí... qué es eso delante de mi? Quizás pueda ver mejor si apunto la linterna hacia lo que sea que eso sea. \nCon qué se encendía? Ah! Presiona Space para probar la linterna.",
					"Space",
					"red",
					30
				);
			}
		} else {
			if (!this.state.enemyDefeated) {
				this.overlay.typeText("Quizás esa pistola que agarré sirva para algo. Equipala desde la mochila y presiona U para usarla.", "pistola", "red", 50);
			} else {
				this.overlay.visible = false;
			}
		}
		this.gameContainer.addChild(this.overlay);

		this.crt = new CRTFilter({
			vignetting: 1,
			vignettingAlpha: 0.95,
		});

		this.background.background.filters = [this.crt];
		this.enemyBase.filters = [this.crt];
		this.player.filters = [this.crt];
	}

	private createPlayer(): void {
		// en createPlayer o constructor:
		this.player = new AHPlayer({ x: -510, y: 150, speed: 200 });
		this.gameContainer.addChild(this.player);

		this.weaponSprite = Sprite.from("AH_sacredgunicon");
		this.weaponSprite.anchor.set(0.5);
		this.weaponSprite.x = 100;
		this.weaponSprite.y = -35;
		this.weaponSprite.scale.set(0.25);
		this.weaponSprite.visible = false;

		this.player.addChild(this.weaponSprite);
	}

	private createEnemy(): void {
		this.enemyBase = Sprite.from("AH_enemy");
		this.enemyBase.anchor.set(0.5, 1);
		this.enemyBase.scale.set(0.85);
		this.enemyBase.position.set(600, 150 + this.enemyBase.height * 0.5);

		if (!this.state.enemyDefeated) {
			this.gameContainer.addChild(this.enemyBase);
		}
		this.enemyBase.alpha = 0.3;

		const applyBreathingTween = (creature: Sprite): void => {
			const baseScaleY = creature.scale.y;
			const targetScaleY = baseScaleY * 1.015;
			const duration = 1500 + (Math.random() * 100 - 50);

			new Tween(creature.scale).to({ y: targetScaleY }, duration).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start();
		};

		this.enemyLit = Sprite.from("AH_enemy");
		this.enemyLit.anchor.set(0.5, 1);
		this.enemyLit.scale.set(0.85);
		this.enemyLit.position.copyFrom(this.enemyBase.position);

		const cm = new ColorMatrixFilter();
		cm.brightness(1.3, false);
		// cm.blackAndWhite(true);
		const cmbase = new ColorMatrixFilter();
		cmbase.contrast(50, false);
		cmbase.desaturate();
		this.enemyBase.filters = [cmbase];
		this.enemyLit.filters = [cm];
		this.enemyLit.visible = false;

		applyBreathingTween(this.enemyBase);
		applyBreathingTween(this.enemyLit);

		if (!this.state.enemyDefeated) {
			this.gameContainer.addChild(this.enemyLit);
		}
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

	private flashlightBlink(): void {
		console.log("blink called");
		new Tween(this.lightContainer)
			.to({ alpha: 0.1 }, 200)
			.yoyo(true)
			.repeat(3)
			.onUpdate(() => console.log("blinking...", this.lightContainer.alpha))
			.onComplete(() => {
				console.log("blink done");
				this.ui.syncFlashlightUI();
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
		if (this.ui.pausePopUp !== null) {
			if (this.ui.pausePopUp.popupOpened) {
				return;
			}
		}
		if (Keyboard.shared.justReleased("KeyR")) {
			SoundLib.playSound("reload", { volume: 0.2 });
			this.state.reset();
		}

		if (this.overlay.visible) {
			if (Keyboard.shared.justReleased("Enter")) {
				this.overlay.visible = false;
			}
		}

		// // pasamos la posición global del jugador y su orientación
		// const playerPos = this.player.getGlobalPosition(new Point());
		// const facingAngle = this.player.scale.x >= 0 ? 0 : Math.PI;
		// this.flashlight.update(dt, playerPos, facingAngle);

		// Player movement
		this.player.update(dt);

		// Flashlight input
		if (Keyboard.shared.justReleased("Space")) {
			if (this.tutorial) {
				this.tutorial = false;
				new Tween(this.crt)
					.to({ vignetting: 0 }, 1000)
					.easing(Easing.Quadratic.InOut)
					.start()
					.onComplete(() => {
						this.background.background.filters = [];
					});
			}
			this.flashlightCtrl.toggle();
			SoundLib.playSound("switch", { volume: 0.05 });
		}

		this.flashlightCtrl.update(dt);
		this.ui.syncFlashlightUI();
		this.ui.syncActiveIcon();
		this.ui.syncEquippedItem();

		// Trigger overlap & input
		const pb = this.player.hitbox.getBounds();
		const tb = this.trigger.triggerZone.getBounds();
		const inTrig = pb.x + pb.width > tb.x && pb.x < tb.x + tb.width && pb.y + pb.height > tb.y && pb.y < tb.y + tb.height;
		this.trigger.triggerText.visible = inTrig;
		if (inTrig && Keyboard.shared.justReleased("KeyE")) {
			SoundLib.playMusic("creakingDoor", { volume: 0.3, speed: 2, loop: false, end: 3 });
			console.log("Trigger activated");
			Manager.changeScene(AHHintRoom, { transitionClass: FadeColorTransition });
		}

		this.ui.updateHP();

		if (this.state.enemyDefeated) {
			const altb = this.altarTrigger.triggerZone.getBounds();
			const altInTrig = pb.x + pb.width > altb.x && pb.x < altb.x + altb.width && pb.y + pb.height > altb.y && pb.y < altb.y + altb.height;
			this.altarTrigger.triggerText.visible = altInTrig;
			if (altInTrig && Keyboard.shared.justReleased("KeyE")) {
				SoundLib.playMusic("creakingDoor", { volume: 0.3, speed: 2, loop: false, end: 3 });
				console.log("Trigger activated");
				Manager.changeScene(AHAltarRoom, { transitionClass: FadeColorTransition, sceneParams: ["shelter"] });
			}
		}

		this.checkUsedItem();
		this.updateBullets(dt / 1000); // dt en segundos

		this.updateDarknessMask();
		this.updateLight();
		this.updateEnemyLit();

		super.update(dt);
	}

	private updateBullets(deltaSec: number): void {
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			const { sprite, vx, vy } = this.bullets[i];
			sprite.x += vx * deltaSec;
			sprite.y += vy * deltaSec;

			// 3a) Fuera de pantalla → eliminar
			if (sprite.x < -750 || sprite.x > Manager.width + 100 || sprite.y < -100 || sprite.y > Manager.height + 100) {
				sprite.destroy();
				this.bullets.splice(i, 1);
				continue;
			}

			// 3b) Colisión con el enemigo
			if (sprite.getBounds().intersects(this.enemyBase.getBounds())) {
				// 1) Haz visible la versión iluminada
				this.enemyLit.visible = true;
				SoundLib.playSound("monster-roars", { volume: 0.1, singleInstance: true, start: 0.3, end: 2 });

				// 2) Crea el AnimatedSprite de la desintegración
				const fadeFrames = [Texture.from("AH_enemyfade2"), Texture.from("AH_enemyfade3"), Texture.from("AH_enemyfade4")];
				const explosion = new AnimatedSprite(fadeFrames);
				explosion.animationSpeed = 0.15; // Ajusta la velocidad a tu gusto
				explosion.loop = false; // Sólo una pasada
				explosion.anchor.set(0.5, 1); // igual que enemy sprite
				explosion.scale.set(0.9);
				explosion.x = this.enemyBase.x;
				explosion.y = this.enemyBase.y;
				this.gameContainer.addChild(explosion);

				// 3) Cuando termine la animación, límpialo y remueve al enemigo
				explosion.onComplete = () => {
					explosion.destroy();
					this.gameContainer.removeChild(this.enemyBase);
					this.gameContainer.removeChild(this.enemyLit);
					this.state.enemyDefeated = true;
				};
				explosion.play();

				// 4) Destruye la bala y la referencia
				sprite.destroy();
				this.bullets.splice(i, 1);

				new Timer()
					.to(800)
					.start()
					.onComplete(() => {
						this.overlay.typeText("Funcionó! Menos mal...!", "Funcionó", "red", 50);
					});
			}
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
				}
				if (state.activeItem === "holywater") {
					SoundLib.playSound("reload", { volume: 0.2 });
					this.state.fullHealth();
				}
				if (state.activeItem === "sacredgun") {
					SoundLib.playSound("gun", { volume: 0.2, start: 0.6, end: 3 });
					this.fireBullet();
				}
				if (state.activeItem !== "sacredgun") {
					state.pickedItems.delete(state.activeItem);
					state.activeItem = null;
					this.ui.syncActiveIcon();
				}
			}
		}
	}

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
