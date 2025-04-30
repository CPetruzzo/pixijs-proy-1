import type { Point } from "pixi.js";
import { Container, Sprite, Texture, Graphics, BlurFilter, BLEND_MODES } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import type { GameStateManager } from "../game/GameStateManager";

export interface FlashLightOptions {
	radius?: number; // alcance del cono
	angle?: number; // ángulo total en radianes
	intensity?: number; // alpha máximo
	blurSize?: number; // cantidad de blur en bordes
	blinkDuration?: number; // duración de un parpadeo individual (ms)
	blinkRepeats?: number; // cuántas veces repite el parpadeo
}

export class FlashLight extends Container {
	private state: GameStateManager;
	private radius: number;
	private halfAngle: number;
	private intensity: number;
	private blurSize: number;
	private blinkDuration: number;
	private blinkRepeats: number;

	private coneSprite: Sprite;
	private coneMask: Graphics;

	constructor(state: GameStateManager, options: FlashLightOptions = {}) {
		super();
		this.state = state;

		// Valores por defecto
		this.radius = options.radius ?? 1024;
		this.halfAngle = (options.angle ?? Math.PI / 3) / 2; // p.ej. 60° total
		this.intensity = options.intensity ?? 1;
		this.blurSize = options.blurSize ?? 8;
		this.blinkDuration = options.blinkDuration ?? 100;
		this.blinkRepeats = options.blinkRepeats ?? 3;

		// Creamos el sprite del cono de luz
		this.coneSprite = this.createConeSprite();
		this.addChild(this.coneSprite);

		// Mask para iluminar enemigos, etc.
		this.coneMask = new Graphics();
		this.addChild(this.coneMask);
	}

	/** Construye el Sprite del cono con degradado y blur */
	private createConeSprite(): Sprite {
		const size = this.radius + this.blurSize;
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size * 2;
		const ctx = canvas.getContext("2d")!;
		const cx = size,
			cy = size;

		// dibujamos el cono
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + this.radius * Math.cos(-this.halfAngle), cy + this.radius * Math.sin(-this.halfAngle));
		ctx.arc(cx, cy, this.radius, -this.halfAngle, this.halfAngle);
		ctx.closePath();

		// degradado radial
		const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.radius);
		grad.addColorStop(0, `rgba(255,255,200,${this.intensity})`);
		grad.addColorStop(1, "rgba(255,255,200,0)");
		ctx.fillStyle = grad;
		ctx.fill();

		const tex = Texture.from(canvas);
		const sprite = new Sprite(tex);
		sprite.anchor.set(0.5);
		sprite.blendMode = BLEND_MODES.ADD;
		sprite.filters = [new BlurFilter(this.blurSize)];
		return sprite;
	}

	/** Llama este método cada frame en tu escena */
	public update(_dt: number, playerGlobalPos: Point, facingAngle: number): void {
		// posicionamos el cono en la punta del player + offset
		this.position.copyFrom(playerGlobalPos);
		this.rotation = facingAngle;

		// si la linterna está apagada o sin batería, alpha = 0
		const battery = this.state.batteryLevel;
		if (battery <= 0 || !this.state.flashlightOn) {
			this.coneSprite.alpha = 0;
		} else {
			this.coneSprite.alpha = this.intensity;
		}

		// actualizamos máscara
		this.redrawMask();
	}

	/** Redibuja el Graphics que sirve como mask para iluminar objetos */
	private redrawMask(): void {
		const g = this.coneMask;
		g.clear();
		g.beginFill(0xffffff);
		g.moveTo(0, 0);
		g.lineTo(this.radius * Math.cos(-this.halfAngle), this.radius * Math.sin(-this.halfAngle));
		g.arc(0, 0, this.radius, -this.halfAngle, this.halfAngle);
		g.closePath();
		g.endFill();
		this.coneSprite.mask = g;
	}

	/** Parpadea la linterna (simula uso de energía) */
	public blink(): void {
		new Tween(this.coneSprite)
			.to({ alpha: this.intensity * 0.3 }, this.blinkDuration)
			.yoyo(true)
			.repeat(this.blinkRepeats)
			.easing(Easing.Quadratic.InOut)
			.onComplete(() => {
				// restaurar alpha de acuerdo al estado actual
				this.coneSprite.alpha = this.state.flashlightOn && this.state.batteryLevel > 0 ? this.intensity : 0;
			})
			.start();
	}

	/** Ajusta dinámicamente los parámetros de la linterna */
	public setParameters(params: Partial<FlashLightOptions>): void {
		if (params.radius != null) {
			this.radius = params.radius;
		}
		if (params.angle != null) {
			this.halfAngle = params.angle / 2;
		}
		if (params.intensity != null) {
			this.intensity = params.intensity;
		}
		if (params.blurSize != null) {
			this.blurSize = params.blurSize;
		}
		if (params.blinkDuration != null) {
			this.blinkDuration = params.blinkDuration;
		}
		if (params.blinkRepeats != null) {
			this.blinkRepeats = params.blinkRepeats;
		}

		// reconstruir el sprite si cambia tamaño o blur
		this.removeChild(this.coneSprite);
		this.coneSprite.destroy({ texture: true, baseTexture: false });
		this.coneSprite = this.createConeSprite();
		this.addChildAt(this.coneSprite, 0);
	}
}
