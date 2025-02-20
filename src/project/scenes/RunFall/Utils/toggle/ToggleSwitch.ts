import { Toggle } from "./Toggle";
import { Easing, Tween } from "tweedle.js";
import { Container } from "@pixi/display";
import type { Graphics } from "@pixi/graphics";
import type { Point } from "@pixi/math";
import { ObservablePoint, Rectangle } from "@pixi/math";
import { Sprite } from "@pixi/sprite";
import { Texture } from "@pixi/core";
import * as MathUtils from "../MathUtils";
import { GraphicsHelper } from "../../../../../engine/utils/GraphicsHelper";
import type { FederatedPointerEvent } from "pixi.js";

export class ToggleSwitch extends Toggle {
	// Callbacks públicos
	public onToggle: (currentValue: boolean) => void;
	public onToggleOn: () => void;
	public onToggleOff: () => void;

	// Propiedad interna con getter y setter
	private _value: boolean;
	public get value(): boolean {
		return this._value;
	}
	public set value(value: boolean) {
		const shouldFireCallback = this._value !== value;
		this._value = value;
		this.moveKnob();
		if (shouldFireCallback) {
			this.fireCallbacks();
		}
	}

	// Elementos visuales
	public knob: Sprite;
	private content: Container;
	private middle: Sprite;
	private background: Sprite;
	private distance: number;
	private sizeRetainer: Graphics;

	// Tweens
	private tweenDuration: number;
	private tween: Tween<any>;
	private knobTween: Tween<any>;

	// Alineación
	private _anchor: ObservablePoint;
	public get anchor(): ObservablePoint {
		return this._anchor;
	}
	public set anchor(value: ObservablePoint) {
		this._anchor.copyFrom(value);
	}

	// Variables para el manejo de eventos
	private dragLastPos: Point;
	private wasDrag: boolean;

	constructor(options: ToggleSwitchOptions) {
		super();

		// Inicialización de contenedores y sprites
		this.content = new Container();
		this.knob = Sprite.from(options.knobTexture);
		this.knob.anchor.set(0.5);

		this.background = Sprite.from(options.backgroundTexture ?? Texture.EMPTY);
		this.background.anchor.set(0.5);

		this.middle = Sprite.from(options.middleTexture ?? Texture.EMPTY);
		this.middle.anchor.set(0.5);

		this.distance = options.travelDistance;
		this.sizeRetainer = GraphicsHelper.rectangle(-this.distance / 2, -this.knob.height / 2, this.distance, this.knob.height, 0xff00ff, 0);

		// Armado de la jerarquía visual
		this.content.addChild(this.sizeRetainer);
		this.content.addChild(this.background);
		this.content.addChild(this.middle);
		this.content.addChild(this.knob);
		this.addChild(this.content);

		// Configuración del tween
		this.tweenDuration = options.tweenDuration ?? 0;

		// Configuración del anclaje
		this._anchor = new ObservablePoint(this.fixAlign, this, options.anchorX, options.anchorY);

		// Hacer interactivo el contenedor y definir el área de impacto
		this.content.interactive = true;
		this.content.hitArea = new Rectangle(-this.distance / 2, -this.knob.height / 2, this.distance, this.knob.height);

		// Eventos para el toggle
		this.content.on("pointertap", this.onPointerClickCallback, this);
		this.knob.interactive = true;
		this.knob.on("pointerdown", this.onPointerDownCallback, this);
		this.knob.on("pointermove", this.onDragMoveCallback, this);
		this.knob.on("pointerup", this.onPointerUpCallback, this);
		this.content.on("pointerupoutside", this.onPointerOutCallback, this);

		// Asignación de callbacks externos
		this.onToggle = options.onToggle;
		this.onToggleOn = options.onToggleOn;
		this.onToggleOff = options.onToggleOff;

		// Alinea y define el valor inicial
		this.fixAlign();
		this.value = Boolean(options.startingValue);
	}

	// Manejadores de eventos
	private onPointerClickCallback(): void {
		if (this.wasDrag) {
			this.wasDrag = false;
			this.dragLastPos = null;
			this.value = this.knob.x > 0;
			return;
		}
		this.value = !this.value;
	}

	private onPointerDownCallback(event: FederatedPointerEvent): void {
		if (this.tween?.isPlaying()) {
			return;
		}
		this.dragLastPos = event.data.getLocalPosition(this.content);
	}

	private onDragMoveCallback(event: FederatedPointerEvent): void {
		if (this.dragLastPos) {
			const nowPos = event.data.getLocalPosition(this.content);
			if (!nowPos.equals(this.dragLastPos)) {
				const deltaX = nowPos.x - this.dragLastPos.x;
				if (Math.abs(deltaX) > this.distance * 0.1 || this.wasDrag) {
					this.wasDrag = true;
					this.knob.x += deltaX;
					this.knob.x = MathUtils.clamp(this.knob.x, (-this.distance + this.knob.width) / 2, (this.distance - this.knob.width) / 2);
					this.dragLastPos = nowPos;
				}
			}
		}
	}

	private onPointerUpCallback(): void {
		this.dragLastPos = null;
		this.value = this.knob.x > 0;
	}

	private onPointerOutCallback(): void {
		this.wasDrag = false;
		this.onPointerUpCallback();
	}

	// Movimiento del knob con animación
	private moveKnob(): void {
		this.tween?.stop();
		this.knobTween?.stop();
		if (this.value) {
			const duration = Math.abs((this.tweenDuration * (this.knob.x - (this.distance - this.knob.width) / 2)) / this.distance);
			this.knobTween = new Tween(this.knob).from({ angle: 180 }).to({ angle: 0 }, 350).start();
			this.tween = new Tween(this.knob.position).to({ x: (this.distance - this.knob.width) / 2 }, duration);
		} else {
			const duration = Math.abs((this.tweenDuration * (this.knob.x - (-this.distance + this.knob.width) / 2)) / this.distance);
			this.knobTween = new Tween(this.knob).from({ angle: 0 }).to({ angle: 180 }, 350).start();
			this.tween = new Tween(this.knob.position).to({ x: (-this.distance + this.knob.width) / 2 }, duration);
		}
		this.tween.easing(Easing.Quadratic.Out);
		this.knobTween.start();
		this.tween.start();
	}

	// Dispara los callbacks asociados al cambio de valor
	private fireCallbacks(): void {
		if (this.onToggle) {
			this.onToggle(this.value);
		}
		// Sólo se dispara el sonido si no se realizó un arrastre
		if (!this.wasDrag) {
			if (this.value && this.onToggleOn) {
				this.onToggleOn();
			} else if (!this.value && this.onToggleOff) {
				this.onToggleOff();
			}
		}
	}

	// Ajusta la alineación del contenido
	private fixAlign(): void {
		this.content.x = -this.content.width * (this.anchor.x - 0.5);
		this.content.y = -this.content.height * (this.anchor.y - 0.5);
	}
}

interface ToggleSwitchOptions {
	knobTexture: string;
	backgroundTexture?: string;
	middleTexture?: string;
	/**
	 * La distancia máxima que recorrerá el knob.
	 * Suele ser la anchura del fondo.
	 */
	travelDistance: number;
	onToggle?: (currentValue: boolean) => void;
	onToggleOn?: () => void;
	onToggleOff?: () => void;
	startingValue?: boolean;
	tweenDuration?: number;
	anchorX?: number;
	anchorY?: number;
}
