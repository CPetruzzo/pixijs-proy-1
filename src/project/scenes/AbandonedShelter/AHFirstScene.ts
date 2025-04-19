import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { Text } from "pixi.js";
import { BlurFilter, Sprite, Texture, Graphics, Container, BLEND_MODES } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Tween } from "tweedle.js";
import { ColorMatrixFilter } from "pixi.js";
import { Manager } from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { HitPoly } from "../../../engine/collision/HitPoly";
import type { IHitable } from "../../../engine/collision/IHitable";

export class AbandonedShelterScene extends PixiScene {
	private gameContainer: Container;
	private uiRightContainer: Container;
	private uiLeftContainer: Container = new Container();
	private background!: Sprite;
	private player!: StateMachineAnimator;
	private darknessMask!: Graphics;

	private lightContainer!: Container;
	private lightCone!: Sprite;
	private coneMask!: Graphics;

	private enemyBase!: Sprite;
	private enemyLit!: Sprite;

	// Battery UI
	private batteryLevel = 3;
	private batteryBars: Sprite[] = [];
	private batteryInterval = 5000;
	private batteryElapsed = 0;
	private flashOn = true;
	private wasTogglePressed = false;

	// Cone parameters
	private readonly coneRadius = 1024;
	private readonly halfConeAngle = Math.PI / 6;
	private readonly baseOffsetX = 80;
	private readonly baseOffsetY = -45;

	public static readonly BUNDLES = ["abandonedhouse"];
	private isWalking: boolean = false;
	private batteryDepleted = false;

	private triggerZone!: Graphics;
	private triggerText!: Text;
	private isInTrigger = false;
	private hitbox: Graphics & IHitable;

	constructor() {
		super();

		SoundLib.playMusic("abandonedhouse", { volume: 0.3, loop: true });
		this.gameContainer = new Container();
		this.gameContainer.name = "GameContainer";
		this.addChild(this.gameContainer);

		this.uiRightContainer = new Container();
		this.uiRightContainer.name = "UIContainer";
		this.addChild(this.uiRightContainer);

		this.uiLeftContainer.name = "UILeftContainer";
		this.addChild(this.uiLeftContainer);

		this.createBackground();
		this.createPlayer();
		this.createEnemy();
		this.createDarknessMask();
		this.createLightCone();
		this.createUI();
		this.createBatteryUI();
		this.createTrigger();

		this.darknessMask.filters = [new BlurFilter(8)];
	}

	private createBackground(): void {
		this.background = Sprite.from("houseBG");
		this.background.anchor.set(0.5);
		this.background.name = "Background";
		this.gameContainer.addChildAt(this.background, 0);
	}

	private createTrigger(): void {
		// 3a) Dibujamos el área del trigger (rectángulo 40×40 en x=0, y=150)
		this.triggerZone = new Graphics().beginFill(0xff0000, 0.001).drawRect(-125, -20, 150, 40).endFill();
		this.triggerZone.x = -500;
		this.triggerZone.y = 100;
		this.gameContainer.addChild(this.triggerZone);

		// 3b) Creamos el texto “E”, oculto por defecto
		this.triggerText = new Text("E", {
			fill: "#ffffff",
			fontSize: 48,
		});
		this.triggerText.anchor.set(0.5);
		this.triggerText.x = this.triggerZone.x - this.triggerZone.width / 2 + 30;
		this.triggerText.y = this.triggerZone.y - 30;
		this.triggerText.visible = true;
		this.gameContainer.addChild(this.triggerText);
	}

	private createPlayer(): void {
		this.player = new StateMachineAnimator();
		this.player.name = "Player";
		this.player.anchor.set(0.5);
		this.player.x = -510;
		this.player.y = 150;
		this.player.addState("idle", [Texture.from("AH_idle")], 4, true);
		this.player.addState("walk", [Texture.from("AH_walk1"), Texture.from("AH_walk2")], 4, true);
		this.player.playState("idle");
		this.gameContainer.addChild(this.player);

		this.hitbox = HitPoly.makeBox(-25, -50, 50, 100, false);
		this.player.addChild(this.hitbox);
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

	private createDarknessMask(): void {
		this.darknessMask = new Graphics();
		this.gameContainer.addChild(this.darknessMask);
	}

	private createUI(): void {
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
	}

	private createLightCone(): void {
		// Container to hold gradient and mask, follows player
		this.lightContainer = new Container();
		this.lightContainer.alpha = 0.3;
		this.lightContainer.position.set(this.baseOffsetX, this.baseOffsetY);
		this.player.addChild(this.lightContainer);

		// Gradient sprite
		const size = this.coneRadius;
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext("2d")!;
		const center = size / 2;
		// Draw wedge gradient
		ctx.beginPath();
		ctx.moveTo(center, center);
		ctx.arc(center, center, center, -this.halfConeAngle, this.halfConeAngle);
		ctx.closePath();
		ctx.clip();
		const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
		grad.addColorStop(0, "rgba(255,255,200,0.8)");
		grad.addColorStop(1, "rgba(255,255,200,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, size, size);

		this.lightCone = Sprite.from(Texture.from(canvas));
		this.lightCone.anchor.set(0.5);
		this.lightCone.blendMode = BLEND_MODES.ADD;
		this.lightCone.filters = [new BlurFilter(8)];
		this.lightContainer.addChild(this.lightCone);

		// Solid mask for enemyLit
		this.coneMask = new Graphics();
		this.lightContainer.addChild(this.coneMask);
		this.enemyLit.mask = this.coneMask;
	}

	// 2) createBatteryUI usando 3 texturas distintas:
	private createBatteryUI(): void {
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
	}

	private depleteBattery(): void {
		if (this.batteryLevel <= 0) {
			return;
		}

		const idx = this.batteryLevel - 1;
		const bar = this.batteryBars[idx];

		// Animamos la desaparición de la barra
		new Tween(bar).to({ alpha: 0 }, 500).start();

		if (this.batteryLevel > 0) {
			// Pequeño parpadeo de la linterna
			new Tween(this.lightCone).to({ alpha: 0.3 }, 100).yoyo(true).repeat(3).start();
		}

		this.batteryLevel--;

		if (this.batteryLevel === 0 && this.flashOn) {
			this.flashOn = false;
			this.batteryDepleted = true;
			this.resetMasks();
			new Tween(this.lightCone).to({ alpha: 0 }, 300).start();

			this.updateDarknessMask();
			console.log("🔋 Batería agotada. Linterna apagada.");
		}
	}

	private resetMasks(): void {
		this.coneMask.clear();
		this.enemyLit.visible = false;
		this.updateDarknessMask();
	}

	private updateDarknessMask(): void {
		this.darknessMask.clear();

		// 1) Dibujo el fondo oscuro
		this.darknessMask.beginFill(0x000000, 1).drawRect(-Manager.width / 2, -Manager.height / 2, Manager.width, Manager.height);

		if (this.flashOn) {
			const cx = this.player.x + this.baseOffsetX;
			const cy = this.player.y + this.baseOffsetY;
			const start = -this.halfConeAngle;
			const end = this.halfConeAngle;

			// 2) Abro un "hueco" en forma de cono
			this.darknessMask
				.beginHole()
				.moveTo(cx, cy)
				.lineTo(cx + this.coneRadius * Math.cos(start), cy + this.coneRadius * Math.sin(start))
				.arc(cx, cy, this.coneRadius, start, end)
				.lineTo(cx, cy)
				.endHole();
		}

		// 3) Cierro relleno
		this.darknessMask.endFill();
	}

	private updateLight(): void {
		this.coneMask.clear();
		this.coneMask
			.beginFill(0xffffff)
			.moveTo(0, 0)
			.lineTo(this.coneRadius * Math.cos(-this.halfConeAngle), this.coneRadius * Math.sin(-this.halfConeAngle))
			.arc(0, 0, this.coneRadius, -this.halfConeAngle, this.halfConeAngle)
			.lineTo(0, 0)
			.endFill();
	}

	private updateEnemyLit(): void {
		const dx = this.enemyBase.x - this.player.x;
		const dy = this.enemyBase.y - this.player.y;
		const distSq = dx * dx + dy * dy;
		let lit = false;
		if (distSq <= this.coneRadius * this.coneRadius) {
			const angleToEnemy = Math.atan2(dy, dx);
			const facing = this.player.scale.x >= 0 ? 0 : Math.PI;
			let delta = angleToEnemy - facing;
			delta = Math.atan2(Math.sin(delta), Math.cos(delta));
			lit = Math.abs(delta) <= this.halfConeAngle;
		}
		this.enemyLit.visible = lit;
	}

	public override update(dt: number): void {
		// ———————— Trigger overlap & input ————————
		// 1) Bounds del hitbox vs triggerZone
		const pb = this.hitbox.getBounds();
		const tb = this.triggerZone.getBounds();
		this.isInTrigger = pb.x + pb.width > tb.x && pb.x < tb.x + tb.width && pb.y + pb.height > tb.y && pb.y < tb.y + tb.height;

		// 2) Mostrar/ocultar la “E”
		this.triggerText.visible = this.isInTrigger;

		// 3) Disparar al soltar la tecla
		if (this.isInTrigger && Keyboard.shared.justReleased("KeyE")) {
			console.log("Trigger activated");
			Manager.changeScene(AbandonedShelterScene, { transitionClass: FadeColorTransition });
		}
		// ————————————————————————————————————————

		// Toggle flashlight
		const togglePressed = Keyboard.shared.isDown("Space");
		if (togglePressed && !this.wasTogglePressed && this.batteryLevel > 0 && !this.batteryDepleted) {
			this.flashOn = !this.flashOn;
			if (!this.flashOn) {
				this.resetMasks();
			}
			new Tween(this.lightCone).to({ alpha: this.flashOn ? 1 : 0 }, 300).start();
			SoundLib.playSound("switch", { volume: 0.1, speed: 3 });
		}
		this.wasTogglePressed = togglePressed;

		if (Keyboard.shared.justReleased("KeyR")) {
			this.flashOn = !this.flashOn;
			this.lightCone.alpha = this.flashOn ? 1 : 0;

			if (!this.flashOn) {
				this.resetMasks();
			}

			this.lightContainer.alpha = 0.3;
			this.batteryLevel = 3;
			this.batteryBars.forEach((b) => (b.alpha = 1));
			this.batteryDepleted = false;
			console.log("🔌 Batería recargada.");
		}

		// Movement
		const left = Keyboard.shared.isDown("ArrowLeft");
		const right = Keyboard.shared.isDown("ArrowRight");
		if (left || right) {
			if (!this.isWalking) {
				this.player.playState("walk");
				this.isWalking = true;
			}
			const speed = 200;
			this.player.x += (right ? 1 : -1) * speed * (dt / 1000);
			this.player.scale.x = right ? 1 : -1;
		} else if (this.isWalking) {
			this.player.playState("idle");
			this.isWalking = false;
		}

		// Battery
		if (this.flashOn && this.batteryLevel > 0) {
			this.batteryElapsed += dt;
			if (this.batteryElapsed >= this.batteryInterval) {
				this.batteryElapsed -= this.batteryInterval;
				this.depleteBattery();
			}

			this.updateDarknessMask();
			this.updateLight();
			if (this.batteryLevel === 0) {
				this.batteryDepleted = true;
				this.flashOn = false;
				this.batteryBars.forEach((b) => (b.alpha = 0));
				this.resetMasks();

				new Tween(this.lightContainer).to({ alpha: 0 }, 300).start();
			}

			this.updateEnemyLit();
		}
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
