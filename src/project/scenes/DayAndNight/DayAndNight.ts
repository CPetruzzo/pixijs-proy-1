import { Sprite, Container, Graphics, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../..";
import { GlowFilter } from "@pixi/filter-glow";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Easing, Tween } from "tweedle.js";

interface ShootingStar {
	star: Graphics;
	life: number;
	maxLife: number;
	vx: number;
	vy: number;
}

export class DayAndNight extends PixiScene {
	private gameContainer: Container;
	private background: Sprite;
	private illuminationContainer: Container;
	private sun: Sprite;
	private moon: Sprite;
	private character: Graphics;
	private telescope: Graphics;
	private house: Sprite;
	private elapsed: number = 0;
	private cycleDuration: number = 2000000;
	private shootingStars: ShootingStar[] = [];
	private illuminationFilter: ColorMatrixFilter;
	public static readonly BUNDLES = ["skystar"];
	public grassGlowFilter: GlowFilter;

	private characterSelected: boolean = false;
	private selectionFilter: GlowFilter;

	private uiContainer: Container;
	private telescopeUIButton?: any;

	constructor() {
		super();
		this.gameContainer = new Container();
		this.gameContainer.sortableChildren = true;
		this.addChild(this.gameContainer);

		SoundLib.playMusic("skyBGM", { volume: 0.05, loop: true });

		this.createBackground();
		this.createSunAndMoon();
		this.createIlluminationContainer();
		this.createMountain();
		this.createGrass();
		// this.createCharacter();
		// this.createTelescope();
		// this.createUI();

		this.gameContainer.pivot.set(this.gameContainer.width * 0.5, this.gameContainer.height * 0.5);
	}

	public createSprite(
		texture: string,
		options: {
			x?: number;
			y?: number;
			anchor?: number;
			scale?: number;
			filters?: any[];
		} = {}
	): Sprite {
		const sprite = Sprite.from(texture);
		if (options.anchor !== undefined) {
			sprite.anchor.set(options.anchor);
		}
		if (options.x !== undefined) {
			sprite.x = options.x;
		}
		if (options.y !== undefined) {
			sprite.y = options.y;
		}
		if (options.scale !== undefined) {
			sprite.scale.set(options.scale);
		}
		if (options.filters) {
			sprite.filters = options.filters;
		}
		return sprite;
	}

	private createCircleSprite(radius: number, color: number, options: { filters?: any[] } = {}): Sprite {
		const gfx = new Graphics();
		gfx.beginFill(color);
		gfx.drawCircle(0, 0, radius);
		gfx.endFill();
		if (options.filters) {
			gfx.filters = options.filters;
		}
		return gfx as unknown as Sprite;
	}

	private createBackground(): void {
		this.background = Sprite.from("bluesky");
		this.background.tint = 0x001848;
		this.gameContainer.addChild(this.background);
	}

	private createIlluminationContainer(): void {
		this.illuminationContainer = new Container();
		this.illuminationFilter = new ColorMatrixFilter();
		this.illuminationContainer.filters = [this.illuminationFilter];
		this.illuminationContainer.zIndex = 2;
		this.background.addChild(this.illuminationContainer);
	}

	private createSunAndMoon(): void {
		this.sun = this.createCircleSprite(40, 0xffff00, {
			filters: [
				new GlowFilter({
					distance: 25,
					outerStrength: 15,
					innerStrength: 1,
					color: 0xffff00,
					quality: 0.3,
				}),
			],
		});
		this.moon = this.createCircleSprite(30, 0xcccccc, {
			filters: [
				new GlowFilter({
					distance: 12,
					outerStrength: 1.5,
					innerStrength: 1,
					color: 0xffffff,
					quality: 0.3,
				}),
			],
		});
		this.sun.zIndex = 1;
		this.moon.zIndex = 1;
		this.background.addChild(this.sun, this.moon);
	}

	private createMountain(): void {
		const mountain = Sprite.from("mountain");
		mountain.y = 100;
		const mountainInverted = Sprite.from("mountain");
		mountainInverted.x = mountainInverted.width;
		mountainInverted.y = 50;
		mountainInverted.scale.set(-1, 1);
		const mountainAlpha = Sprite.from("mountainalpha");
		mountainAlpha.y = 150;

		mountain.filters = [this.illuminationFilter];
		mountainInverted.filters = [this.illuminationFilter];
		mountainAlpha.filters = [this.illuminationFilter];

		this.illuminationContainer.addChild(mountain, mountainAlpha, mountainInverted);
	}

	private createGrass(): void {
		this.grassGlowFilter = new GlowFilter({
			distance: 12,
			outerStrength: 0.5,
			innerStrength: 0.5,
			color: 0xffffff,
			quality: 0.3,
		});

		const frontLayer = Sprite.from("mountainFrontLayer");
		frontLayer.y = 580;
		frontLayer.scale.y = 0.5;
		this.background.addChild(frontLayer);

		this.house = Sprite.from("house");
		this.house.anchor.set(0.5);
		this.house.x = 300;
		this.house.y = 870;
		this.house.scale.set(0.2);
		this.house.filters = [this.grassGlowFilter];
		this.house.interactive = true;

		this.house.on("pointerdown", () => {
			this.moveCharacterTo(this.house.x, this.house.y, () => {
				console.log("El personaje volvió a la casa");
			});
		});
		this.background.addChild(this.house);
	}

	public createCharacter(): void {
		this.character = new Graphics();
		this.character.beginFill(0x0000ff);
		this.character.drawCircle(0, 0, 25);
		this.character.endFill();
		this.character.x = 400;
		this.character.y = 950;
		this.character.interactive = true;
		this.character.on("pointerdown", () => {
			this.characterSelected = !this.characterSelected;
			if (this.characterSelected) {
				this.selectionFilter = new GlowFilter({
					distance: 10,
					outerStrength: 2,
					innerStrength: 1,
					color: 0x00ff00,
					quality: 0.5,
				});
				this.character.filters = [this.selectionFilter];
				console.log("Personaje seleccionado");
			} else {
				this.character.filters = [];
				console.log("Personaje deseleccionado");
			}
		});
		this.gameContainer.addChild(this.character);
	}

	public createTelescope(): void {
		this.telescope = new Graphics();
		this.telescope.beginFill(0xff00ff);
		this.telescope.drawRect(0, 0, 50, 20);
		this.telescope.endFill();
		this.telescope.x = 1200;
		this.telescope.y = 950;
		this.telescope.interactive = true;
		this.telescope.on("pointerdown", () => {
			if (this.characterSelected) {
				this.moveCharacterTo(this.telescope.x, this.telescope.y, () => {
					console.log("Personaje llegó al telescopio");
					this.showTelescopeUIButton();
				});
			}
		});
		this.gameContainer.addChild(this.telescope);
	}

	public createUI(): void {
		this.uiContainer = new Container();
		this.uiContainer.zIndex = 10;
		this.gameContainer.addChild(this.uiContainer);
	}

	private moveCharacterTo(targetX: number, targetY: number, onComplete: () => void): void {
		new Tween(this.character.position)
			.to({ x: targetX, y: targetY }, 1000)
			.easing(Easing.Quadratic.InOut)
			.onComplete(() => {
				onComplete();
				this.characterSelected = false;
				this.character.filters = [];
			})
			.start();
	}

	private showTelescopeUIButton(): void {
		if (this.telescopeUIButton) {
			return;
		}

		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 24,
			fill: ["#ffffff"],
			stroke: "#000000",
			strokeThickness: 3,
		});
		const buttonText = new Text("Ver con telescopio", style);
		buttonText.anchor.set(0.5);

		const button = new Graphics();
		button.beginFill(0x000000, 0.7);
		button.drawRoundedRect(0, 0, buttonText.width + 20, buttonText.height + 10, 5);
		button.endFill();
		button.x = (Manager.width - button.width) / 2;
		button.y = Manager.height - button.height - 50;
		button.interactive = true;

		button.addChild(buttonText);
		buttonText.x = button.width / 2;
		buttonText.y = button.height / 2;
		button.on("pointerdown", () => {
			console.log("Abriendo vista de telescopio");
			this.openTelescopeOverlay();
		});
		this.uiContainer.addChild(button);
		this.telescopeUIButton = button;
	}

	private openTelescopeOverlay(): void {
		const overlay = new Container();
		overlay.interactive = true;
		overlay.sortableChildren = true;
		overlay.zIndex = 100;

		const bg = new Graphics();
		bg.beginFill(0x000000, 0.8);
		bg.drawRect(0, 0, Manager.width, Manager.height);
		bg.endFill();
		overlay.addChild(bg);

		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 48,
			fill: ["#ffffff"],
			stroke: "#000000",
			strokeThickness: 4,
		});
		const overlayText = new Text("Vista del Cielo Nocturno", style);
		overlayText.anchor.set(0.5);
		overlayText.x = Manager.width / 2;
		overlayText.y = Manager.height / 2;
		overlay.addChild(overlayText);

		this.gameContainer.addChild(overlay);
	}

	public override update(dt: number): void {
		this.elapsed += dt * (1000 / 60);
		const t = (this.elapsed % this.cycleDuration) / this.cycleDuration;

		const nightColor = 0x001848;
		const dayColor = 0x87ceeb;
		const sunsetColor = 0xff8c00;
		const sunAngle = -Math.PI + 2 * Math.PI * t;
		const moonAngle = sunAngle + Math.PI;
		const normalizedSun = (sunAngle + 2 * Math.PI) % (2 * Math.PI);

		const morningStart = Math.PI;
		const dayStart = (3 * Math.PI) / 2;
		const offsetDusk = Math.PI / 6;
		const atardecerStart = dayStart + offsetDusk;
		const atardecerSpan = Math.PI / 12;
		const finalTransitionSpan = 2 * Math.PI - (atardecerStart + atardecerSpan);

		let bgColor: number;
		if (normalizedSun < morningStart) {
			bgColor = nightColor;
		} else if (normalizedSun < dayStart) {
			const tMorning = (normalizedSun - morningStart) / (dayStart - morningStart);
			bgColor = this.lerpColor(nightColor, dayColor, tMorning);
		} else if (normalizedSun < atardecerStart) {
			bgColor = dayColor;
		} else if (normalizedSun < atardecerStart + atardecerSpan) {
			const tDusk = (normalizedSun - atardecerStart) / atardecerSpan;
			bgColor = this.lerpColor(dayColor, sunsetColor, tDusk);
		} else {
			const tFinal = (normalizedSun - (atardecerStart + atardecerSpan)) / finalTransitionSpan;
			bgColor = this.lerpColor(sunsetColor, nightColor, tFinal);
		}
		this.background.tint = bgColor;

		const w = 1520,
			h = 800;
		const r = Math.min(w, h) * 0.87;
		this.sun.position.set(w / 2 + r * Math.cos(sunAngle), h / 2 + r * Math.sin(sunAngle) + 400);
		this.moon.position.set(w / 2 + r * Math.cos(moonAngle), h / 2 + r * Math.sin(moonAngle) + 400);

		this.updateIllumination(sunAngle);

		const isNight = normalizedSun >= 0 && normalizedSun < Math.PI;
		if (isNight && Math.random() < 0.01) {
			this.spawnShootingStar();
		} else if (!isNight) {
			this.clearShootingStars();
		}
		for (let i = this.shootingStars.length - 1; i >= 0; i--) {
			const starData = this.shootingStars[i];
			starData.star.position.x += starData.vx * dt;
			starData.star.position.y += starData.vy * dt;
			starData.life -= dt;
			starData.star.alpha = starData.life / starData.maxLife;
			if (starData.life <= 0) {
				this.background.removeChild(starData.star);
				this.shootingStars.splice(i, 1);
			}
		}
	}

	private updateIllumination(sunAngle: number): void {
		const sunFactor = Math.max(0, Math.sin(sunAngle + Math.PI / 4));
		const brightnessValue = 0.7 - 0.4 * sunFactor;
		this.illuminationFilter.brightness(brightnessValue, false);
	}

	private spawnShootingStar(): void {
		const star = new Graphics();
		const baseAngleDeg = 135;
		const angleVariation = Math.random() * 30 - 15;
		const angleDeg = baseAngleDeg + angleVariation;
		const angle = (angleDeg * Math.PI) / 180;
		const tailLength = 10;
		const tailX = -Math.cos(angle) * tailLength;
		const tailY = -Math.sin(angle) * tailLength;

		star.lineStyle(4, 0xffffff, 1);
		star.moveTo(0, 0);
		star.lineTo(tailX, tailY);
		star.endFill();

		const startX = Manager.width * (0.5 + Math.random() * 0.5);
		const startY = Math.random() * (Manager.height / 2);
		star.position.set(startX, startY);

		const speed = Math.random() * 3;
		const vx = Math.cos(angle) * speed;
		const vy = Math.sin(angle) * speed;

		this.background.addChild(star);
		this.shootingStars.push({
			star,
			life: 60,
			maxLife: 60,
			vx,
			vy,
		});
	}

	private clearShootingStars(): void {
		for (const starData of this.shootingStars) {
			this.background.removeChild(starData.star);
		}
		this.shootingStars = [];
	}

	private lerpColor(c1: number, c2: number, t: number): number {
		const r1 = (c1 >> 16) & 0xff,
			g1 = (c1 >> 8) & 0xff,
			b1 = c1 & 0xff;
		const r2 = (c2 >> 16) & 0xff,
			g2 = (c2 >> 8) & 0xff,
			b2 = c2 & 0xff;
		const r = Math.round(r1 * (1 - t) + r2 * t),
			g = Math.round(g1 * (1 - t) + g2 * t),
			b = Math.round(b1 * (1 - t) + b2 * t);
		return (r << 16) | (g << 8) | b;
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 1600, 900, ScaleHelper.FIT);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;
	}
}
