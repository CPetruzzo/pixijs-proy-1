import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Sprite, Texture, Graphics, Container, BLEND_MODES, BlurFilter, Point } from "pixi.js";
import { ColorMatrixFilter } from "pixi.js";
import { HitPoly } from "../../../engine/collision/HitPoly";
import type { IHitable } from "../../../engine/collision/IHitable";
import { Manager } from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";

// Controllers & State
import { InventoryController } from "./game/InventoryController";
import { GameStateManager } from "./game/GameStateManager";
import { FlashlightController } from "./game/FlashLightController";
import { AHPlayer } from "./classes/Player";
import { Tween } from "tweedle.js";
import { Trigger } from "./classes/Trigger";

export class AbandonedShelterScene extends PixiScene {
	private gameContainer = new Container();
	private uiRightContainer = new Container();
	private uiLeftContainer = new Container();

	// World
	private background!: Sprite;
	private playerHitbox!: Graphics & IHitable;

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

	constructor() {
		super();
		this.addChild(this.gameContainer);
		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiRightContainer);

		console.log("this it's the new scene");
		SoundLib.playMusic("abandonedhouse", { volume: 0.1, loop: true });

		// build
		this.createBackground();
		this.createPlayer();
		this.createEnemy();
		this.createLightMask();
		this.createLightCone();
		this.createUI();

		this.trigger = new Trigger();
		this.trigger.createTrigger(this.gameContainer);

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

		this.inventoryCtrl.on("picked", (id) => this.showNewItem(id));

		// initial sync
		this.syncFlashlightUI();

		// apply blur filter
		this.darknessMask.filters = [new BlurFilter(8)];
	}

	private createBackground(): void {
		this.background = Sprite.from("houseBG");
		this.background.anchor.set(0.5);
		this.gameContainer.addChildAt(this.background, 0);
	}

	private createPlayer(): void {
		// en createPlayer o constructor:
		this.player = new AHPlayer({ x: -510, y: 150, speed: 200 });
		this.gameContainer.addChild(this.player);

		// hitbox centered on player
		this.playerHitbox = HitPoly.makeBox(-25, -50, 50, 100);
		this.player.addChild(this.playerHitbox);
	}

	private createEnemy(): void {
		this.enemyBase = Sprite.from("AH_enemy");
		this.enemyBase.anchor.set(0.5);
		this.enemyBase.scale.set(0.85);
		this.enemyBase.position.set(600, 150);
		this.gameContainer.addChild(this.enemyBase);

		this.enemyLit = Sprite.from("AH_enemy");
		this.enemyLit.anchor.set(0.5);
		this.enemyLit.scale.set(0.85);
		this.enemyLit.position.copyFrom(this.enemyBase.position);

		const cm = new ColorMatrixFilter();
		cm.brightness(1.5, false);
		this.enemyLit.filters = [cm];
		this.enemyLit.visible = false;

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

	private createUI(): void {
		const batteryBG = Sprite.from("battery0");
		batteryBG.x = -5;
		this.uiRightContainer.addChild(batteryBG);

		const spacing = 10;
		// Array con los keys de las tres texturas
		const texKeys = ["batteryIndicator", "batteryIndicator", "batteryIndicator"];
		for (let i = 0; i < texKeys.length; i++) {
			// Creamos un sprite con la textura correspondiente
			const bar = new Sprite(Texture.from(texKeys[i]));
			bar.anchor.set(0, 0);
			// Lo posicionamos con un pequeño espacio
			bar.x = i * (bar.width + spacing) + 23;
			bar.y = 22;
			batteryBG.addChild(bar);
			this.batteryBars.push(bar);
		}

		const cellFrame = Sprite.from("cellFrame");
		cellFrame.y = 10;
		cellFrame.scale.set(0.25);
		this.uiLeftContainer.addChild(cellFrame);

		const backpack = Sprite.from("AH_bag");
		backpack.x = 130;
		backpack.y = 10;
		backpack.scale.set(0.25);
		this.uiLeftContainer.addChild(backpack);

		backpack.eventMode = "static";
		backpack.on("pointerdown", () => {
			console.log("Backpack clicked");
		});

		const config = Sprite.from("AH_config");
		config.x = -120;
		config.y = 15;
		config.scale.set(0.25);
		this.uiLeftContainer.addChild(config);

		// other UI elements (cellFrame, backpack, etc.)
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

	private showNewItem(id: string): void {
		console.log("Item picked:", id);
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
		if (Keyboard.shared.justReleased("KeyR")) {
			this.state.reset();
		}

		// Player movement
		this.player.update(dt);

		// Flashlight input
		if (Keyboard.shared.justReleased("Space")) {
			this.flashlightCtrl.toggle();
			SoundLib.playSound("switch", { volume: 0.1 });
		}
		this.flashlightCtrl.update(dt);
		this.syncFlashlightUI();

		// Trigger overlap & input
		const pb = this.player.hitbox.getBounds();
		const tb = this.trigger.triggerZone.getBounds();
		const inTrig = pb.x + pb.width > tb.x && pb.x < tb.x + tb.width && pb.y + pb.height > tb.y && pb.y < tb.y + tb.height;
		this.trigger.triggerText.visible = inTrig;
		if (inTrig && Keyboard.shared.justReleased("KeyE")) {
			console.log("Trigger activated");
			Manager.changeScene(AbandonedShelterScene, { transitionClass: FadeColorTransition });
		}

		// justo aquí pon:
		this.updateDarknessMask();
		this.updateLight();
		this.updateEnemyLit();

		super.update(dt);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, newW, newH, 900, 900, ScaleHelper.FIT);
		this.gameContainer.x = newW / 2;
		this.gameContainer.y = newH / 2;

		const margin = 20;
		const totalW = 3 * 30 + 2 * 5;
		this.uiRightContainer.x = newW - margin - totalW;
		this.uiRightContainer.y = margin;

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, newW, newH, 900, 900, ScaleHelper.FIT);
		this.uiLeftContainer.x = newW * 0.5;
		this.uiLeftContainer.y = 0;
	}
}
