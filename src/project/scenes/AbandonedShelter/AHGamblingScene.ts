import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Sprite, Container, Point } from "pixi.js";
import { Manager } from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";

// Controllers & State
import { InventoryController } from "./game/InventoryController";
import { GameStateManager } from "./game/GameStateManager";
import { FlashlightController } from "./game/FlashLightController";
import { AHPlayer } from "./classes/Player";
import { Tween } from "tweedle.js";
import { Trigger } from "./classes/Trigger";
import type { ProgressBar } from "@pixi/ui";
import type { PausePopUp } from "./game/PausePopUp";
import { Background } from "./Background";
import { UI } from "./UI";
import { OverlayScene } from "./OverlayScene";
import { SlotMachineScene } from "./game/SlotBase";
import { AHAltarRoom } from "./AHAltarRoom";

export class AHGamblingScene extends PixiScene {
	private gameContainer = new Container();
	private frontLayerContainer = new Container();
	private pauseContainer = new Container();
	private uiRightContainer = new Container();
	private uiCenterContainer = new Container();
	private uiLeftContainer = new Container();
	private slotContainer = new Container();

	// World
	public background!: Background;

	// Light & enemy
	private lightContainer!: Container;
	private lightCone!: Sprite;

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
	private slotTrigger: Trigger;

	private hpBar: ProgressBar;

	private pausePopUp: PausePopUp | null = null;
	private activeIcon!: Sprite | null;
	private weaponSprite!: Sprite;

	private bullets: { sprite: Sprite; vx: number; vy: number }[] = [];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	private BULLET_SPEED = 2500; // px/s
	public ui: UI;
	private overlay: OverlayScene;
	private slotOpened: boolean = false;
	private slotLeaveText: Sprite;

	private slotScene: SlotMachineScene;
	private cluesSpr: Sprite;
	private cluesSprVisible: boolean;
	constructor() {
		super();
		this.addChild(this.gameContainer);
		this.addChild(this.frontLayerContainer);
		this.frontLayerContainer.visible = false;
		this.addChild(this.pauseContainer);
		this.addChild(this.uiLeftContainer);
		this.addChild(this.uiCenterContainer);
		this.addChild(this.uiRightContainer);

		console.log("this it's the new scene");
		console.log(this.state.pickedItems);
		SoundLib.playMusic("abandonedhouse", { volume: 0.1, loop: true });

		// build
		this.background = new Background("AH_gamblingroom", this.gameContainer, this.frontLayerContainer);
		this.createPlayer();
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

		const chairs = Sprite.from("OVERLAY_AH_gamblingroom");
		chairs.anchor.set(0.5);

		this.trigger = new Trigger();
		this.trigger.createTrigger(this.gameContainer);
		this.trigger.triggerZone.x = this.trigger.triggerZone.x - 100;
		this.trigger.triggerText.x = this.trigger.triggerZone.x - 50;
		this.trigger.triggerText.y = this.trigger.triggerZone.y - 150;

		this.slotTrigger = new Trigger();
		this.slotTrigger.createTrigger(this.gameContainer);
		this.slotTrigger.triggerZone.x += 1000;
		this.slotTrigger.triggerText.x += 1000;
		this.slotTrigger.triggerText.y -= 100;
		this.flashlightCtrl.on("changed", (state) => {
			if (state.batteryLevel < this.previousBattery) {
				this.ui.animateBatteryDrain(this.previousBattery);

				this.flashlightBlink();
			} else {
				this.ui.syncFlashlightUI();
			}

			this.previousBattery = state.batteryLevel;
		});

		this.inventoryCtrl.on("picked", (id) => this.inventoryCtrl.showNewItem(id, this.gameContainer));

		this.ui.syncFlashlightUI();

		this.slotScene = new SlotMachineScene();
		this.slotContainer.addChild(this.slotScene);
		this.slotScene.scale.set(0.62);
		this.slotScene.y = 65;
		this.slotScene.visible = false;

		// *** NOS SUSCRIBIMOS AL NUEVO EVENTO "curse" ***
		this.slotScene.on("curse", () => {
			if (!this.state.skullPicked) {
				// Creamos un OverlayScene con el texto deseado
				const curseOverlay = new OverlayScene();
				curseOverlay.typeText("¡Maldita máquina dame algo!", "dame algo", "red", 20);
				this.gameContainer.addChild(curseOverlay);

				// Opcional: después de unos segundos, podemos desvaneCerlo
				// (dependiendo de cómo quieras que desaparezca;
				// OverlayScene no se auto‐oculta, así que lo quitamos manualmente)
				setTimeout(() => {
					if (curseOverlay.parent) {
						curseOverlay.destroy();
					}
				}, 2000); // 2 s antes de eliminarlo
			}
		});

		this.overlay = new OverlayScene();
		this.overlay.typeText(
			"Una sala de juegos? Ahora si estamos hablando mi idioma! Esa tragamonedas parece estar encendida y funcional. Quizás pueda usarla para conseguir algo útil...",
			"tragamonedas",
			"red",
			20
		);
		this.gameContainer.addChild(chairs);
		this.gameContainer.addChild(this.slotContainer);
		this.gameContainer.addChild(this.overlay);

		if (!this.state.skullPicked) {
			this.slotScene.on("winAHSlot", () => {
				this.inventoryCtrl.pick("skull");
				this.state.skullPicked = true;
				this.state.altarAvailable = true;
				SoundLib.playSound("AH_grab", { start: 0.2, end: 1, volume: 0.5 });
				this.state.pickedItems.add("skull");
				this.ui.syncActiveIcon();
				this.ui.syncEquippedItem();
			});
		}
	}

	private createPlayer(): void {
		// en createPlayer o constructor:
		this.player = new AHPlayer({ x: -510, y: 100, speed: 200 });
		this.gameContainer.addChild(this.player);

		this.weaponSprite = Sprite.from("AH_sacredgunicon");
		this.weaponSprite.anchor.set(0.5);
		this.weaponSprite.x = 100;
		this.weaponSprite.y = -35;
		this.weaponSprite.scale.set(0.25);
		this.weaponSprite.visible = false;

		this.player.addChild(this.weaponSprite);

		// Colocamos límites horizontales, por ejemplo de -700 a +700
		this.player.setHorizontalBounds(-700, +700);
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

	public override update(dt: number): void {
		if (this.ui.pausePopUp !== null) {
			if (this.ui.pausePopUp.popupOpened) {
				return;
			}
		}
		this.slotScene.update(dt);
		if (Keyboard.shared.justReleased("KeyR")) {
			SoundLib.playSound("reload", { volume: 0.2 });
			this.state.reset();
		}

		if (this.overlay.visible) {
			if (Keyboard.shared.justReleased("Enter")) {
				this.overlay.visible = false;
			}
		}

		// Player movement
		this.player.update(dt);

		this.flashlightCtrl.update(dt);
		this.ui.syncFlashlightUI();
		this.ui.syncActiveIcon();
		this.ui.syncEquippedItem();

		if (Keyboard.shared.justPressed("KeyC") && this.cluesSprVisible) {
			this.cluesSprVisible = false;
			this.gameContainer.removeChild(this.cluesSpr);
		}

		// Trigger overlap & input
		const pb = this.player.hitbox.getBounds();
		const tb = this.trigger.triggerZone.getBounds();
		const inTrig = pb.x + pb.width > tb.x && pb.x < tb.x + tb.width && pb.y + pb.height > tb.y && pb.y < tb.y + tb.height;
		this.trigger.triggerText.visible = inTrig;
		if (inTrig && Keyboard.shared.justReleased("KeyE")) {
			SoundLib.playMusic("creakingDoor", { volume: 0.3, speed: 2, loop: false, end: 3 });
			console.log("Trigger activated");
			Manager.changeScene(AHAltarRoom, { transitionClass: FadeColorTransition, sceneParams: ["gambling"] });
		}

		// Slot machine trigger
		// DrawerTrigger overlap & input
		const drawertb = this.slotTrigger.triggerZone.getBounds();
		const drawerinTrig = pb.x + pb.width > drawertb.x && pb.x < drawertb.x + drawertb.width && pb.y + pb.height > drawertb.y && pb.y < drawertb.y + drawertb.height;
		this.slotTrigger.triggerText.visible = drawerinTrig;

		if (drawerinTrig && Keyboard.shared.justPressed("KeyC") && this.slotOpened) {
			this.slotOpened = false;
			SoundLib.playSound("clickSFX", { volume: 0.3, speed: 2, loop: false });
			this.slotScene.visible = false;
		}

		// ... en algún punto, por ejemplo al presionar una tecla:
		if (Keyboard.shared.justReleased("KeyD") && this.slotOpened) {
			this.slotScene.forceWinAnimated();
		}

		if (drawerinTrig && Keyboard.shared.justReleased("KeyE") && !this.slotOpened) {
			SoundLib.playSound("clickSFX", { volume: 0.3, speed: 2, loop: false });
			console.log("Trigger activated");

			this.slotOpened = true;
			this.slotScene.visible = true;

			this.slotScene.soulToCoin();
			SoundLib.playSound("static", { speed: 0.5, loop: false, end: 1.3 });
			this.slotLeaveText = Sprite.from("KeyC");
			this.slotLeaveText.position.y = 650;
			this.slotLeaveText.scale.set(2.5);
			this.slotLeaveText.anchor.set(0.5);
			this.slotScene.addChild(this.slotLeaveText);

			this.gameContainer.removeChild(this.overlay);
			this.overlay = new OverlayScene();
			this.overlay.typeText("'INSERT SOUL'? No será demasiado? De todos modos no tengo así que no me preocupa. ", "tragamonedas", "red", 20);
			this.gameContainer.addChild(this.overlay);

			// Opcional: después de unos segundos, podemos desvaneCerlo
			// (dependiendo de cómo quieras que desaparezca;
			// OverlayScene no se auto‐oculta, así que lo quitamos manualmente)
			setTimeout(() => {
				if (this.overlay.parent) {
					this.overlay.visible = false;
				}
			}, 4000); // 2 s antes de eliminarlo
		}

		this.checkUsedItem();
		this.ui.syncFlashlightUI();
		this.ui.syncActiveIcon();
		this.ui.syncEquippedItem();
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
				if (state.activeItem === "sacredgun") {
					SoundLib.playSound("gun", { volume: 0.2, start: 0.6, end: 3 });
					this.fireBullet();
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
