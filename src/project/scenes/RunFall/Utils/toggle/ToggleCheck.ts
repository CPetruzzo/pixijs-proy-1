import { Toggle } from "./Toggle";
import { Easing, Tween } from "tweedle.js";
import { Container } from "@pixi/display";
import { ObservablePoint, Rectangle } from "@pixi/math";
import { Sprite } from "@pixi/sprite";
import { Texture } from "@pixi/core";

export class ToggleCheck extends Toggle {
	public onToggle: (currentValue: boolean) => void;
	public onToggleOn: () => void;
	public onToggleOff: () => void;
	public locked: boolean;
	private _value: boolean;
	public get value(): boolean {
		return this._value;
	}
	public set value(value: boolean) {
		if (this.locked) {
			return;
		}

		const shouldfireCallback = this._value !== value;
		this._value = value;
		this.switchState();
		if (shouldfireCallback) {
			// prevent stupid callbacks
			this.fireCallbacks();
		}
	}

	private content: Container;
	private button: Sprite;
	private check: Sprite;
	private _anchor: ObservablePoint;
	private tween: Tween<any>;

	public get anchor(): ObservablePoint {
		return this._anchor;
	}
	public set anchor(value: ObservablePoint) {
		this._anchor.copyFrom(value);
	}

	constructor(options: ToggleCheckOptions) {
		super();
		this.content = new Container();

		this.button = Sprite.from(options.buttonTexture);
		this.button.anchor.set(0.5);
		this.check = Sprite.from(options.checkTexture ?? Texture.EMPTY);
		this.check.anchor.set(0.5);
		this.content.addChild(this.button);
		this.content.addChild(this.check);
		this._anchor = new ObservablePoint(this.fixAlign, this, options.anchorX, options.anchorY); // important to set the private one here

		this.addChild(this.content);

		this.content.interactive = true;
		this.content.hitArea = new Rectangle(-this.button.width / 2, -this.button.height / 2, this.button.width, this.button.height);
		this.content.on("pointertap", this.onPointerClickCallback, this);

		this.onToggle = options.onToggle;
		this.onToggleOn = options.onToggleOn;
		this.onToggleOff = options.onToggleOff;

		this.fixAlign();
		this.value = Boolean(options.startingValue);

		this.locked = options.locked ? true : false;

		this.check.scale.x = this.check.scale.y = this.value ? 1 : 0;
	}

	private onPointerClickCallback(): void {
		this.value = !this.value;
	}

	private switchState(): void {
		this.tween?.stop();
		if (this.value) {
			this.tween = new Tween(this.check.scale).to({ x: 1, y: 1 }, 250).easing(Easing.Elastic.Out);
		} else {
			this.tween = new Tween(this.check.scale).to({ x: 0, y: 0 }, 150).easing(Easing.Cubic.Out);
		}
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

interface ToggleCheckOptions {
	buttonTexture: string;
	checkTexture?: string;
	onToggle?: (currentValue: boolean) => void;
	onToggleOn?: () => void;
	onToggleOff?: () => void;
	startingValue?: boolean;
	anchorX?: number;
	anchorY?: number;
	locked?: boolean;
}
