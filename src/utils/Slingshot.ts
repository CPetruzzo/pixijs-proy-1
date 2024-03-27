// import { Container } from "@pixi/display";
// import { Sprite } from "@pixi/sprite";
// import type { Cheems } from "./Characters/Cheems";
// import { Point } from "@pixi/core";
// import { MAX_SLINGSHOT_CHARGE } from "../utils/Constants";
// import type { FederatedPointerEvent } from "@pixi/events/lib/FederatedPointerEvent";
// import type { GhostCheems } from "./Characters/GhostCheems";
// import { clampCharge } from "../utils/FunctionUtils";

// export class Slingshot extends Container {
// 	private sprite: Sprite;
// 	private readonly cheemsReference: Cheems;
// 	private readonly ghostReference: GhostCheems;
// 	private slingshotInitChargePos: Point;
// 	private maxCharge: number;
// 	private initPointerPos: Point;
// 	private charging: boolean = false;
// 	public currentCharge: { x: number; y: number; clamped: boolean };
// 	public rightLaunch: boolean = true;

// 	constructor(cheemsReference: Cheems, ghostReference: GhostCheems, containerScale: number) {
// 		super();
// 		this.sprite = Sprite.from("placeholders/target.png");
// 		this.sprite.scale.set(0.1);
// 		this.sprite.anchor.set(0.5);
// 		this.sprite.position.set(500, 150);
// 		this.sprite.eventMode = "static";
// 		this.sprite.alpha = 0.01;
// 		this.addChild(this.sprite);

// 		this.cheemsReference = cheemsReference;
// 		this.ghostReference = ghostReference;
// 		this.slingshotInitChargePos = new Point(0, 0);
// 		this.maxCharge = MAX_SLINGSHOT_CHARGE;
// 		this.initPointerPos = new Point(NaN, NaN);
// 		this.currentCharge = { x: 0, y: 0, clamped: false };

// 		this.sprite.on("pointerdown", (e: FederatedPointerEvent) => {
// 			if (!this.cheemsReference.flying || this.cheemsReference.onMovable) {
// 				this.charging = true;
// 				this.sprite.alpha = 1;
// 				if (Number.isNaN(this.initPointerPos.x) && Number.isNaN(this.initPointerPos.y)) {
// 					this.initPointerPos.copyFrom(e.getLocalPosition(this.cheemsReference));
// 				}
// 			}
// 		});
// 		this.sprite.on("pointerup", () => {
// 			if (this.sprite.y > this.cheemsReference.y) {
// 				this.cheemsReference.shootHim(this.currentCharge);
// 			}
// 			this.resetSlingshot();
// 			this.ghostReference.destroyTrajectory();
// 			this.ghostReference.released = true;
// 		});
// 		this.sprite.on("pointerupoutside", () => {
// 			if (this.sprite.y > this.cheemsReference.y) {
// 				this.cheemsReference.shootHim(this.currentCharge);
// 			}
// 			this.resetSlingshot();
// 			this.ghostReference.destroyTrajectory();
// 			this.ghostReference.released = true;
// 		});
// 		this.sprite.on("globalpointermove", (e: FederatedPointerEvent) => {
// 			if (this.charging) {
// 				// this.ghostReference.trajectory.clearLine();
// 				const currentPos = e.getLocalPosition(this.cheemsReference);
// 				const difference = { x: currentPos.x - this.initPointerPos.x, y: currentPos.y - this.initPointerPos.y };
// 				this.sprite.x = this.slingshotInitChargePos.x + difference.x * (1 / containerScale);
// 				this.sprite.y = this.slingshotInitChargePos.y + difference.y * (1 / containerScale);
// 				if (difference.x >= 0) {
// 					this.currentCharge.x = difference.x > this.maxCharge ? this.maxCharge : difference.x;
// 				} else {
// 					this.currentCharge.x = difference.x < -this.maxCharge ? -this.maxCharge : difference.x;
// 				}
// 				if (difference.y >= 0) {
// 					this.currentCharge.y = difference.y > this.maxCharge ? this.maxCharge : difference.y;
// 				} else {
// 					this.currentCharge.y = difference.y < -this.maxCharge ? -this.maxCharge : difference.y;
// 				}
// 				this.rightLaunch = this.sprite.x < this.cheemsReference.x;
// 				this.currentCharge = clampCharge(this.currentCharge);
// 				if (this.sprite.y > this.cheemsReference.y) {
// 					this.ghostReference.position.copyFrom(this.cheemsReference.position);
// 					this.ghostReference.shootHim(this.currentCharge);
// 				}
// 			}
// 		});
// 	}

// 	public resetSlingshot(): void {
// 		this.sprite.alpha = 0.01;
// 		this.charging = false;
// 		this.initPointerPos = new Point(NaN, NaN);
// 		this.updateSpritePos();
// 		this.slingshotInitChargePos.copyFrom(this.sprite.position);
// 		this.currentCharge = { x: 0, y: 0, clamped: false };
// 	}

// 	public updateSpritePos(): void {
// 		if (!this.charging) {
// 			this.sprite.position.set(this.cheemsReference.x, this.cheemsReference.y);
// 		}
// 	}
// }
