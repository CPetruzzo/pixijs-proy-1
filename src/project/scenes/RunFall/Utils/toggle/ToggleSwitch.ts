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
	public onToggle: (currentValue: boolean) => void;
	public onToggleOn: () => void;
	public onToggleOff: () => void;
	private _value: boolean;
	public get value(): boolean {
		return this._value;
	}
	public set value(value: boolean) {
		const shouldfireCallback = this._value !== value;
		this._value = value;
		this.moveKnob();
		if (shouldfireCallback) {
			// prevent stupid callbacks
			this.fireCallbacks();
		}
	}

	private content: Container;
	private knob: Sprite;
	private middle: Sprite;
	private background: Sprite;
	private distance: number;
	private sizeRetainer: Graphics;
	private tweenDuration: number;
	private tween: Tween<any>;
	private _anchor: ObservablePoint;
	private dragLastPos: Point;
	private wasDrag: boolean;

	public get anchor(): ObservablePoint {
		return this._anchor;
	}
	public set anchor(value: ObservablePoint) {
		this._anchor.copyFrom(value);
	}

	constructor(options: ToggleSwitchOptions) {
		super();
		this.content = new Container();
		this.knob = Sprite.from(options.knobTexture);
		this.knob.anchor.set(0.5);
		this.background = Sprite.from(options.backgroundTexture ?? Texture.EMPTY);
		this.background.anchor.set(0.5);
		this.middle = Sprite.from(options.middleTexture ?? Texture.EMPTY);
		this.middle.anchor.set(0.5);
		this.distance = options.travelDistance;
		this.sizeRetainer = GraphicsHelper.rectangle(-this.distance / 2, -this.knob.height / 2, this.distance, this.knob.height, 0xff00ff, 0);
		this.content.addChild(this.sizeRetainer);
		this.content.addChild(this.background);
		this.content.addChild(this.middle);
		this.content.addChild(this.knob);
		this.tweenDuration = options.tweenDuration ?? 0;
		this._anchor = new ObservablePoint(this.fixAlign, this, options.anchorX, options.anchorY); // important to set the private one here

		this.addChild(this.content);

		this.content.interactive = true;
		this.content.hitArea = new Rectangle(-this.distance / 2, -this.knob.height / 2, this.distance, this.knob.height);
		this.content.on("pointertap", this.onPointerClickCallback, this);

		this.knob.interactive = true;
		this.knob.on("pointerup", this.onPointerUpCallback, this);
		this.knob.on("pointerdown", this.onPointerDownCallback, this);
		this.content.on("pointerupoutside", this.onPointerOutCallback, this);
		this.knob.on("pointermove", this.onDragMoveCallback, this);

		this.onToggle = options.onToggle;
		this.onToggleOn = options.onToggleOn;
		this.onToggleOff = options.onToggleOff;

		this.fixAlign();
		this.value = Boolean(options.startingValue);
	}
	private onPointerClickCallback(): void {
		if (this.wasDrag) {
			this.wasDrag = false;
			this.dragLastPos = null;
			this.value = this.knob.x > 0;
			return;
		}
		this.value = !this.value;
	}

	private onPointerUpCallback(): void {
		this.dragLastPos = null;
		this.value = this.knob.x > 0;
	}
	private onPointerOutCallback(): void {
		this.wasDrag = false;
		this.onPointerUpCallback();
	}
	private onPointerDownCallback(event: FederatedPointerEvent): void {
		// ignore drags during tween
		if (this.tween.isPlaying()) {
			return;
		}
		this.dragLastPos = event.data.getLocalPosition(this.content);
	}
	private onDragMoveCallback(moveEvent: FederatedPointerEvent): void {
		if (this.dragLastPos) {
			const nowPos = moveEvent.data.getLocalPosition(this.content);
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

	private moveKnob(): void {
		this.tween?.stop();
		if (this.value) {
			const duration = Math.abs((this.tweenDuration * (this.knob.x - (this.distance - this.knob.width) / 2)) / this.distance);
			this.tween = new Tween(this.knob.position).to({ x: (this.distance - this.knob.width) / 2 }, duration);
		} else {
			const duration = Math.abs((this.tweenDuration * (this.knob.x - (-this.distance + this.knob.width) / 2)) / this.distance);
			this.tween = new Tween(this.knob.position).to({ x: (-this.distance + this.knob.width) / 2 }, duration);
		}
		this.tween.easing(Easing.Quadratic.Out);
		this.tween.start();
	}

	private fireCallbacks(): void {
		if (this.onToggle) {
			this.onToggle(this.value);
		}
		if (this.value) {
			if (this.onToggleOn) {
				this.onToggleOn();
			}
		} else {
			if (this.onToggleOff) {
				this.onToggleOff();
			}
		}
	}

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
	 * The knob texture will stop when the edge touches the end of the distance.
	 * Usually using the width of the background will yield good results
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
