import { Container } from "@pixi/display";
import type { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";
import { Tween } from "tweedle.js";
import { Point } from "@pixi/core";
import { HitPoly } from "../engine/collision/HitPoly";
import type { IHitable } from "../engine/collision/IHitable";
import { Timer } from "../engine/tweens/Timer";

// TODO a switch for sprites in platformtypes
export class Platform extends Container {
	private visuals: Sprite;
	public hitbox: Graphics & IHitable;
	public className: string;
	public isComplete: boolean = false;
	constructor(width: number, height: number, className: string, rotation?: number) {
		super();
		this.visuals = Sprite.from("armanda/cube.png");

		switch (className) {
			case "platform":
				this.visuals = Sprite.from("armanda/cube.png");
				break;
			case "movable":
				this.visuals = Sprite.from("armanda/movable.png");
				break;
			case "cloaked":
				this.visuals = Sprite.from("armanda/cloaked.png");
				break;

			default:
				break;
		}

		this.width = width;
		this.height = height;
		this.className = className;
		this.angle = rotation;
		this.visible = true;
		this.hitbox = HitPoly.makeBox(this.visuals.x, this.visuals.y, width, height);
		this.addChild(this.visuals, this.hitbox);
	}

	public moveOnPoint(toOnX: number, toOnY: number, movingTime: number): void {
		new Tween(this).from({ x: this.position.x, y: this.position.y }).to({ x: toOnX, y: toOnY }, movingTime).yoyo(true).repeat(Infinity).start();
	}
	public moveOnTrail(toOnX: number, toOnY: number, movingTime: number): void {
		new Tween(this).from({ x: this.position.x, y: this.position.y }).to({ x: toOnX, y: toOnY }, movingTime).start();
	}

	public moveWithPolyline(start: Platform, nodes: Array<Point>): void {
		const originPoint = new Point(nodes[0].x + start.x, nodes[0].y + start.y);
		const startMoves = new Tween(start)
			.to({}, 2000)
			.start()
			.onComplete(() => {
				for (let i = 0; i < nodes.length; i++) {
					new Tween(start)
						.to({}, 2000 * i)
						.onComplete(() => {
							this.moveOnTrail(originPoint.x + nodes[i].x, originPoint.y + nodes[i].y, 2000);
							if (i === nodes.length - 1) {
								for (let i = nodes.length - 1; i >= 0; i--) {
									new Tween(start)
										.delay(3500)
										.to({}, 1500 * (nodes.length - 1 - i))
										.onComplete(() => {
											this.moveOnTrail(originPoint.x + nodes[i].x, originPoint.y + nodes[i].y, 2000);
											if (i === 0) {
												console.log("end here");
												i = 0;
												new Timer()
													.duration(2000)
													.start()
													.onComplete(() => {
														startMoves.start();
														console.log(i);
													});
											}
										})
										.start();
								}
							}
						})
						.start();
				}
			});
	}

	public cloaked(): void {
		// WIP
		let isOn: boolean = true;

		const cloakTween = new Tween(this)
			.to({ alpha: 0 }, 2500)
			.yoyo(true)
			.repeat(Infinity)
			.start()
			.onRepeat(() => {
				cloakTween.pause();
				if (isOn) {
					isOn = false;
					this.removeChild(this.visuals, this.hitbox);
					new Timer()
						.duration(2500)
						.start()
						.onComplete(() => {
							cloakTween.resume();
						});
				} else {
					isOn = true;
					this.addChild(this.visuals, this.hitbox);
					new Timer()
						.duration(2500)
						.start()
						.onComplete(() => {
							cloakTween.resume();
						});
				}
			});
	}
}
