import { Easing, Tween } from "tweedle.js";
import { Sprite } from "@pixi/sprite";
import { Graphics } from "@pixi/graphics";
import { TransitionBase } from "../../../../engine/scenemanager/transitions/TransitionBase";
import { Manager } from "../../../..";
import type { ResolveOverride } from "../../../../engine/scenemanager/ITransition";
import { Timer } from "../../../../engine/tweens/Timer";

export class CurtainsTransition extends TransitionBase {
	private readonly fadeInTime: number;
	private readonly fadeOutTime: number;
	public static readonly BUNDLES = ["fallrungame"];

	private curtainLeft: Sprite;
	private curtainRight: Sprite;
	private curtainOpenedFactor: number;
	private overlay: Graphics;

	private _leftOriginalWidth: number;
	private _leftOriginalHeight: number;
	private _rightOriginalWidth: number;
	private _rightOriginalHeight: number;

	constructor(fadeInTime: number = 1000, fadeOutTime: number = 1000) {
		super();
		this.fadeInTime = fadeInTime;
		this.fadeOutTime = fadeOutTime;
		this.interactive = false;

		this.overlay = new Graphics();
		this.overlay.beginFill(0x000000);
		this.overlay.drawRect(0, 0, Manager.width, Manager.height);
		this.overlay.endFill();
		this.overlay.alpha = 0;
		this.addChild(this.overlay);

		this.curtainLeft = Sprite.from("puerta_izq");
		this.curtainRight = Sprite.from("puerta_der");

		this.curtainLeft.anchor.set(1, 0);

		this._leftOriginalWidth = this.curtainLeft.texture.orig?.width ?? this.curtainLeft.width;
		this._leftOriginalHeight = this.curtainLeft.texture.orig?.height ?? this.curtainLeft.height;
		this._rightOriginalWidth = this.curtainRight.texture.orig?.width ?? this.curtainRight.width;
		this._rightOriginalHeight = this.curtainRight.texture.orig?.height ?? this.curtainRight.height;

		const leftScale = Manager.height / this._leftOriginalHeight;
		this.curtainLeft.width = this._leftOriginalWidth * leftScale;
		this.curtainLeft.height = Manager.height;

		const rightScale = Manager.height / this._rightOriginalHeight;
		this.curtainRight.width = this._rightOriginalWidth * rightScale;
		this.curtainRight.height = Manager.height;

		this.curtainOpenedFactor = 1;

		this.updatePositions(Manager.width);

		this.addChild(this.curtainLeft);
		this.addChild(this.curtainRight);
	}

	private updatePositions(w: number): void {
		const center = w / 2;
		const overlap = this.curtainLeft.width * 0.2;

		const leftClosedX = center + overlap / 2;
		const rightClosedX = center - overlap / 2;

		const leftOpenX = -this.curtainLeft.width;
		const rightOpenX = w + this.curtainRight.width;

		this.curtainLeft.x = leftClosedX + (leftOpenX - leftClosedX) * this.curtainOpenedFactor;
		this.curtainRight.x = rightClosedX + (rightOpenX - rightClosedX) * this.curtainOpenedFactor;

		this.overlay.alpha = 0.5 * (1 - this.curtainOpenedFactor);
	}

	public override startCovering(): Promise<void> {
		return new Promise((resolve) => {
			new Tween(this)
				.to({ curtainOpenedFactor: 0.05 }, this.fadeInTime * 0.2)
				.easing(Easing.Linear.None)
				.onUpdate(() => {
					this.updatePositions(Manager.width);
				})
				.chain(
					new Tween(this)
						.to({ curtainOpenedFactor: 0 }, this.fadeInTime * 0.4)
						.easing(Easing.Bounce.Out)
						.onUpdate(() => {
							this.updatePositions(Manager.width);
						})
						.onComplete(() => {
							new Timer()
								.to(500)
								.onComplete(() => resolve())
								.start();
						})
				)
				.start();
		});
	}

	public override startResolving(): Promise<ResolveOverride> {
		return Promise.resolve(undefined as unknown as ResolveOverride);
	}

	public override startUncovering(): Promise<void> {
		return new Promise((resolve) => {
			new Tween(this)
				.to({ curtainOpenedFactor: 0.015 }, this.fadeOutTime * 0.4)
				.easing(Easing.Linear.None)
				.onUpdate(() => {
					this.updatePositions(Manager.width);
				})
				.onComplete(() => {
					new Timer()
						.to(500)
						.onComplete(() => {
							new Tween(this)
								.to({ curtainOpenedFactor: 1 }, this.fadeOutTime)
								.easing(Easing.Linear.None)
								.onUpdate(() => {
									this.updatePositions(Manager.width);
								})
								.onComplete(() => resolve())
								.start();
						})
						.start();
				})
				.start();
		});
	}

	public override onResize(w: number, h: number): void {
		const leftScale = h / this._leftOriginalHeight;
		this.curtainLeft.width = this._leftOriginalWidth * leftScale;
		this.curtainLeft.height = h;

		const rightScale = h / this._rightOriginalHeight;
		this.curtainRight.width = this._rightOriginalWidth * rightScale;
		this.curtainRight.height = h;

		this.updatePositions(w);

		this.overlay.clear();
		this.overlay.beginFill(0x000000);
		this.overlay.drawRect(0, 0, w, h);
		this.overlay.endFill();
	}
}
