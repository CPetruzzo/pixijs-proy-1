import { Sprite, Container, Graphics } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../..";
import { GlowFilter } from "@pixi/filter-glow";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";

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
	private sun: Sprite;
	private moon: Sprite;
	private elapsed: number = 0;
	private cycleDuration: number = 2000000;
	private shootingStars: ShootingStar[] = [];
	private mountain: Sprite;
	private mountainFilter: ColorMatrixFilter;
	public static readonly BUNDLES = ["skystar"];
	private grassGlowFilter: GlowFilter;

	// Para evitar recalcular el pulso cada frame, almacena el valor y actualízalo cada X ms
	private lastPulseUpdate: number = 0;
	private currentPulse: number = 0;

	constructor() {
		super();
		this.gameContainer = new Container();
		this.addChild(this.gameContainer);

		SoundLib.playMusic("skyBGM", { volume: 0.05, loop: true });
		this.createBackground();
		this.createSunAndMoon();
		this.createMountain();
		this.createGrass();
		this.gameContainer.pivot.set(this.gameContainer.width * 0.5, this.gameContainer.height * 0.5);
	}

	private createGrass(): void {
		const grassPositions = [{ x: 770, y: 600 }];

		// Reducimos la calidad para mejorar el rendimiento
		this.grassGlowFilter = new GlowFilter({
			distance: 12, // Se redujo un poco la distancia
			outerStrength: 0.5,
			innerStrength: 0.5,
			color: 0x00ff00,
			quality: 0.3, // Menor calidad puede ser suficiente visualmente
		});

		for (const pos of grassPositions) {
			const grass = Sprite.from("grass");
			grass.anchor.set(0.5);
			grass.x = pos.x;
			grass.y = pos.y;
			// Usa un único filtro compartido (ya se aplica a todos)
			grass.filters = [this.grassGlowFilter];
			this.background.addChild(grass);
		}
	}

	private createBackground(): void {
		this.background = Sprite.from("bluesky");
		this.background.tint = 0x001848;
		this.gameContainer.addChild(this.background);
	}

	private createSunAndMoon(): void {
		// Usar parámetros menos intensos para mejorar el rendimiento
		this.sun = new Graphics().beginFill(0xffff00).drawCircle(0, 0, 40).endFill() as unknown as Sprite;

		const sunGlowFilter = new GlowFilter({
			distance: 25, // Reduce la distancia si es posible
			outerStrength: 15, // Reduce la intensidad
			innerStrength: 1,
			color: 0xffff00,
			quality: 0.3, // Calidad menor para rendir mejor
		});
		this.sun.filters = [sunGlowFilter];

		this.moon = new Graphics().beginFill(0xcccccc).drawCircle(0, 0, 30).endFill() as unknown as Sprite;

		const moonGlowFilter = new GlowFilter({
			distance: 12,
			outerStrength: 1.5,
			innerStrength: 1,
			color: 0xffffff,
			quality: 0.3,
		});
		this.moon.filters = [moonGlowFilter];

		this.background.addChild(this.sun, this.moon);
	}

	private createMountain(): void {
		this.mountain = Sprite.from("mountain");
		this.mountain.y = 100;

		const mountaininverted = Sprite.from("mountain");
		mountaininverted.x = mountaininverted.width;
		mountaininverted.y = 50;
		mountaininverted.scale.set(-1, 1);

		const mountain2 = Sprite.from("mountainalpha");
		mountain2.y = 150;

		this.mountainFilter = new ColorMatrixFilter();
		this.mountain.filters = [this.mountainFilter];
		mountain2.filters = [this.mountainFilter];
		mountaininverted.filters = [this.mountainFilter];

		this.background.addChild(this.mountain, mountain2, mountaininverted);
	}

	public override update(dt: number): void {
		this.elapsed += dt * (1000 / 60);
		const t = (this.elapsed % this.cycleDuration) / this.cycleDuration;

		// Cálculo de colores para el fondo
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

		// Actualizar iluminación de la montaña (puedes ajustar la fórmula si es necesario)
		const sunFactor = Math.max(0, Math.sin(sunAngle + Math.PI / 4));
		const brightnessValue = 0.7 - 0.4 * sunFactor;
		this.mountainFilter.brightness(brightnessValue, false);

		// Actualizar y generar estrellas fugaces
		const isNight = normalizedSun >= 0 && normalizedSun < Math.PI;
		if (isNight && Math.random() < 0.01) {
			this.spawnShootingStar();
		} else if (!isNight) {
			this.clearShootingStars();
		}

		// Actualizar estrellas fugaces
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

		// Actualización del pulso del pasto solo cada 16ms (o lo que consideres adecuado)
		if (this.elapsed - this.lastPulseUpdate > 16) {
			this.currentPulse = 0.5 + 0.5 * Math.abs(Math.sin(this.elapsed * 0.0001));
			this.grassGlowFilter.outerStrength = this.currentPulse;
			this.grassGlowFilter.innerStrength = this.currentPulse;
			this.lastPulseUpdate = this.elapsed;
		}
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
			star: star,
			life: 200,
			maxLife: 60,
			vx: vx,
			vy: vy,
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
