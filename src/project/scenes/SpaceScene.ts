/* eslint-disable @typescript-eslint/naming-convention */
import { Texture, Sprite, Graphics } from "pixi.js";
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";

interface Star {
	sprite: Sprite;
	x: number; // Posición base X en el "cilindro"
	y: number; // Posición base Y en el "cilindro"
	z: number; // Profundidad absoluta
}

export class SpaceScene extends PixiScene {
	// Configuración exacta del ejemplo de referencia
	private readonly STAR_AMOUNT = 1000;
	private readonly FOV = 20;
	private readonly BASE_SPEED = 0.001;
	private readonly STAR_STRETCH = 5;
	private readonly STAR_BASE_SIZE = 0.05;

	private stars: Star[] = [];
	private cameraZ = 0;
	private speed = 0;
	private warpSpeed = 0;
	private warpTimer = 0; // Para simular el setInterval

	// Fondo negro para evitar estelas
	private background: Graphics;

	constructor() {
		super();

		// 1. Fondo negro (Importante en Pixi para limpiar el frame anterior visualmente)
		this.background = new Graphics();
		this.background.beginFill(0x000000);
		this.background.drawRect(0, 0, 4000, 4000); // Tamaño arbitrario grande
		this.background.endFill();
		this.addChild(this.background);

		this.initializeStars();

		// Inicializamos el timer del warp
		this.warpTimer = 0;
	}

	private initializeStars(): void {
		for (let i = 0; i < this.STAR_AMOUNT; i++) {
			const sprite = Sprite.from(Texture.WHITE);
			sprite.tint = 0xffffff;

			// Configuración del ancla exacta del ejemplo
			sprite.anchor.set(0.5, 0.7);

			const star: Star = {
				sprite,
				x: 0,
				y: 0,
				z: 0,
			};

			this.randomizeStar(star, true);
			this.addChild(sprite);
			this.stars.push(star);
		}
	}

	private randomizeStar(star: Star, initial = false): void {
		// Lógica de Z exacta del ejemplo
		star.z = initial ? Math.random() * 2000 : this.cameraZ + Math.random() * 1000 + 2000;

		// Lógica de posición radial exacta del ejemplo.
		// ESTO es lo que evita el parpadeo central.
		// El '+ 1' asegura que ninguna estrella esté en el centro exacto (0,0).
		const deg = Math.random() * Math.PI * 2;
		const distance = Math.random() * 50 + 1;

		star.x = Math.cos(deg) * distance;
		star.y = Math.sin(deg) * distance;
	}

	public override update(_dt: number): void {
		if (this.stars.length === 0) {
			return;
		}

		// En el ejemplo usan app.renderer.screen.width/height.
		// En PixiScene, esto suele ser this.width / this.height.
		const width = this.width || 1920;
		const height = this.height || 1080;
		const cx = width / 2;
		const cy = height / 2;

		// Convertir delta time a la escala que usa el ejemplo.
		// El ejemplo usa time.deltaTime que suele ser frames si se usa app.ticker.
		// Asumiremos que _dt son milisegundos, así que lo normalizamos.
		const delta = _dt / 16.66;

		// Simulación del setInterval(() => warpSpeed = ... , 5000)
		this.warpTimer += _dt;
		if (this.warpTimer > 5000) {
			this.warpSpeed = this.warpSpeed > 0 ? 0 : 1;
			this.warpTimer = 0;
		}

		// Lerp de velocidad
		this.speed += (this.warpSpeed - this.speed) / 2000;
		console.log("this.speed", this.speed);

		// Mover la cámara
		this.cameraZ += delta * (this.speed + this.BASE_SPEED);
		console.log("this.cameraZ", this.cameraZ);
		console.log("delta", delta);

		for (const star of this.stars) {
			// Chequeo de reinicio
			if (star.z < this.cameraZ) {
				this.randomizeStar(star);
			}

			// Proyección 3D simple
			const z = star.z - this.cameraZ;

			// Coordenadas en pantalla
			// NOTA: El ejemplo original usa 'width' para AMBOS ejes (X e Y)
			// en la multiplicación para mantener la relación de aspecto cuadrada.
			star.sprite.x = star.x * (this.FOV / z) * width + cx;
			star.sprite.y = star.y * (this.FOV / z) * width + cy;

			// Cálculos de Escala y Rotación
			const dxCenter = star.sprite.x - cx;
			const dyCenter = star.sprite.y - cy;

			const distanceCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);

			// Fade-in basado en profundidad (2000 es el rango máx del ejemplo)
			const distanceScale = Math.max(0, (2000 - z) / 2000);

			star.sprite.scale.x = distanceScale * this.STAR_BASE_SIZE;

			// Estiramiento en Y basado en velocidad y distancia al centro
			star.sprite.scale.y = distanceScale * this.STAR_BASE_SIZE + (distanceScale * this.speed * this.STAR_STRETCH * distanceCenter) / width;

			star.sprite.rotation = Math.atan2(dyCenter, dxCenter) + Math.PI / 2;
		}
	}

	public override onResize(newW: number, newH: number): void {
		super.onResize(newW, newH);
		if (this.background) {
			this.background.clear();
			this.background.beginFill(0x000000);
			this.background.drawRect(0, 0, newW, newH);
			this.background.endFill();
		}
	}
}
