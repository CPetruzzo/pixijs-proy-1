import { Container, Sprite, Texture } from "pixi.js";
import { PausePopUp } from "./game/PausePopUp";
import { ProgressBar } from "@pixi/ui";
import type { GameStateManager } from "./game/GameStateManager";
import { Tween } from "tweedle.js";

export class UI extends Container {
	public uiRightContainer: Container;
	public batteryBars: Sprite[];
	public activeIcon: Sprite;
	public uiCenterContainer: Container;
	public pausePopUp: PausePopUp;
	public pauseContainer: Container;
	public hpBar: ProgressBar;
	public uiLeftContainer: Container;
	public state: GameStateManager;
	public weaponSprite: Sprite;
	public lightCone: any;

	constructor(
		uiRightContainer: Container,
		batteryBars: Sprite[],
		activeIcon: Sprite,
		uiCenterContainer: Container,
		pausePopUp: PausePopUp,
		pauseContainer: Container,
		hpBar: ProgressBar,
		uiLeftContainer: Container,
		state: GameStateManager,
		weaponSprite: Sprite,
		lightCone: any
	) {
		super();
		this.uiRightContainer = uiRightContainer;
		this.batteryBars = batteryBars;
		this.activeIcon = activeIcon;

		this.uiCenterContainer = uiCenterContainer;
		this.pausePopUp = pausePopUp;
		this.pauseContainer = pauseContainer;
		this.hpBar = hpBar;
		this.uiLeftContainer = uiLeftContainer;
		this.state = state;

		this.lightCone = lightCone;
		this.weaponSprite = weaponSprite;

		this.createUI();
	}

	public createUI(): void {
		const batteryBG = Sprite.from("battery0");
		batteryBG.x = -batteryBG.width - 50;
		batteryBG.y = 50;

		this.uiRightContainer.addChild(batteryBG);

		const spacing = 10;
		const texKeys = ["batteryIndicator", "batteryIndicator", "batteryIndicator"];
		for (let i = 0; i < texKeys.length; i++) {
			const bar = new Sprite(Texture.from(texKeys[i]));
			bar.anchor.set(0, 0);
			bar.x = i * (bar.width + spacing) + 23;
			bar.y = 22;
			batteryBG.addChild(bar);
			this.batteryBars.push(bar);
		}

		const cellFrame = Sprite.from("cellFrame");
		cellFrame.scale.set(0.25);
		cellFrame.y = cellFrame.height / 2 + 5;
		cellFrame.anchor.set(0.5);
		this.uiCenterContainer.addChild(cellFrame);

		this.activeIcon = Sprite.from(Texture.EMPTY);
		this.activeIcon.x = cellFrame.x;
		this.activeIcon.y = cellFrame.y;
		this.activeIcon.anchor.set(0.5);
		this.activeIcon.width = cellFrame.width * 0.6;
		this.activeIcon.height = cellFrame.height * 0.6;

		this.activeIcon.scale.set(0.5);
		this.uiCenterContainer.addChild(this.activeIcon);

		const backpack = Sprite.from("AH_bag");
		backpack.x = 130;
		backpack.y = cellFrame.y;
		backpack.anchor.set(0.5);
		backpack.scale.set(0.25);
		this.uiCenterContainer.addChild(backpack);

		const keyU = Sprite.from("KeyU");
		keyU.anchor.set(0.5);
		keyU.scale.set(0.8);
		keyU.x = cellFrame.x + 45;
		keyU.y = backpack.y + 55;
		this.uiCenterContainer.addChild(keyU);

		backpack.eventMode = "static";
		backpack.on("pointerdown", () => {
			if (!this.pausePopUp) {
				this.pausePopUp = new PausePopUp();
				this.pauseContainer.addChild(this.pausePopUp);
			} else {
				this.pausePopUp.close();
				this.pausePopUp = null;
			}
		});
		const config = Sprite.from("AH_config");
		config.x = -120;
		config.y = cellFrame.y + 5;
		config.scale.set(0.25);
		config.anchor.set(0.5);

		this.uiCenterContainer.addChild(config);

		this.hpBar = new ProgressBar({
			bg: "AH_bar",
			fill: "AH_barcenter",
			progress: this.state.healthPoints,
		});
		this.hpBar.position.set(this.hpBar.width * 0.2, 50);
		this.uiLeftContainer.addChild(this.hpBar);
	}

	public animateBatteryDrain(oldLevel: number): void {
		if (!this.pausePopUp) {
			const idx = oldLevel - 1;
			const bar = this.batteryBars[idx];
			new Tween(bar).to({ alpha: 0 }, 500).start();
			new Tween(this.lightCone).to({ alpha: 0.3 }, 100).yoyo(true).repeat(3).start();
		}
	}

	public syncFlashlightUI(): void {
		const { batteryLevel, flashlightOn } = this.state;

		if (this.lightCone) {
			if (batteryLevel <= 0) {
				this.lightCone.alpha = 0;
			} else {
				this.lightCone.alpha = flashlightOn ? 0.3 : 0;
			}
		}

		this.batteryBars.forEach((b, i) => (b.alpha = i < batteryLevel ? 1 : 0));
	}

	public syncActiveIcon(): void {
		const { activeItem } = this.state;
		if (!activeItem) {
			this.activeIcon.texture = Texture.EMPTY;
		} else {
			this.activeIcon.texture = Texture.from(`AH_${activeItem}icon`);
		}
	}

	public syncEquippedItem(): void {
		const { activeItem } = this.state;
		// si es la pistola sagrada, la mostramos; si no, la ocultamos
		this.weaponSprite.visible = activeItem === "sacredgun";
	}

	public updateHP(): void {
		let { healthPoints } = this.state;

		if (!this.pausePopUp) {
			if (healthPoints <= 0) {
			} else {
				healthPoints -= 8;
			}
		}
		this.state.setHP(healthPoints);
		this.hpBar.progress = this.state.healthPoints;
	}
}
