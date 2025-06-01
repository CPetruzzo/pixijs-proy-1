/* eslint-disable @typescript-eslint/naming-convention */
import { Assets, Sprite } from "pixi.js";
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";

interface Star {
	sprite: Sprite;
	x: number;
	y: number;
	z: number;
}

export class SpaceScene extends PixiScene {
	public static readonly BUNDLES: string[] = []; // sin bundles externos

	private stars: Star[] = [];
	private readonly STAR_COUNT = 1000;
	private cameraZ = 0;
	private readonly fov = 20;
	private readonly baseSpeed = 0.025;
	private speed = 0;
	private warpSpeed = 0;
	private readonly starStretch = 5;
	private readonly starBaseSize = 0.05;

	constructor() {
		super();

		// 1) Carga la textura de la estrella y crea los sprites
		Assets.load("https://pixijs.com/assets/star.png").then((tex) => {
			for (let i = 0; i < this.STAR_COUNT; i++) {
				const sprite = new Sprite(tex);
				sprite.anchor.set(0.5, 0.7);
				const star: Star = { sprite, x: 0, y: 0, z: 0 };
				this.randomizeStar(star, true);
				this.stars.push(star);
				this.addChild(sprite);
			}
		});

		// 2) Cada 5 s alternamos “warpSpeed” para el efecto de aceleración
		setInterval(() => {
			this.warpSpeed = this.warpSpeed > 0 ? 0 : 1;
		}, 5000);
	}

	/** Sitúa una estrella con coordenadas radiales aleatorias */
	private randomizeStar(star: Star, initial = false): void {
		star.z = initial ? Math.random() * 2000 : this.cameraZ + Math.random() * 1000 + 2000;

		const deg = Math.random() * Math.PI * 2;
		const distance = Math.random() * 50 + 1;
		star.x = Math.cos(deg) * distance;
		star.y = Math.sin(deg) * distance;
	}

	/** Se llama cada frame con `_dt` = ms transcurridos desde el último update */
	public override update(_dt: number): void {
		// easing simple de velocidad
		this.speed += (this.warpSpeed - this.speed) / 20;
		this.cameraZ += _dt * 10 * (this.speed + this.baseSpeed);

		const w2 = this.width / 2;
		const h2 = this.height / 2;

		for (const star of this.stars) {
			// si la estrella “cruza” la cámara, la reubicamos atrás
			if (star.z < this.cameraZ) {
				this.randomizeStar(star);
			}

			// proyección 3D→2D
			const dz = star.z - this.cameraZ;
			const proj = this.fov / dz;
			star.sprite.x = star.x * proj * this.width + w2;
			star.sprite.y = star.y * proj * this.width + h2;

			// escalado y rotación en función de la distancia al centro
			const dxC = star.sprite.x - w2;
			const dyC = star.sprite.y - h2;
			const distC = Math.sqrt(dxC * dxC + dyC * dyC);
			const scaleFactor = Math.max(0, (2000 - dz) / 2000);

			star.sprite.scale.x = scaleFactor * this.starBaseSize;
			star.sprite.scale.y = scaleFactor * this.starBaseSize + (scaleFactor * this.speed * this.starStretch * distC) / this.width;
			star.sprite.rotation = Math.atan2(dyC, dxC) + Math.PI / 2;
		}

		super.update(_dt);
	}

	public override onResize(newW: number, newH: number): void {
		// actualizar width/height internos de PixiScene
		super.onResize(newW, newH);
	}
}
