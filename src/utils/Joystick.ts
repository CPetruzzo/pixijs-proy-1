import { Sprite } from "@pixi/sprite";
import { Container } from "@pixi/display";
import { Point } from "@pixi/core";

import { isMobile } from "..";
import { joystickComponentX, joystickComponentY } from "./FunctionUtils";
import { ScaleHelper } from "../engine/utils/ScaleHelper";
import { JOYSTICK_MAXPOWER } from "./constants";

export interface JoystickParams {
	inner: Sprite;
	outer: Sprite;
	movementButton?: Sprite;
	movementPosition?: Point;
	rockButton: Sprite;
	rockPosition: Point;
	power: number;
	angle: number;
	distance: number;
	startPos: Point;
	currentPos: Point;
	isAnchored: boolean; // sets the joystick anchored in a position or it moves with the character
}

export enum JoystickEmits {
	MOBILE = "MOBILE",
	JOYSTICKUP = "JOYSTICKUP",
	JOYSTICKDOWN = "JOYSTICKDOWN",
	JOYSTICKMOVE = "JOYSTICKMOVE",
	WALK = "WALK",
	ROCK_THROW = "ROCK_THROW",
	AIM = "AIM",
	STOPAIM = "STOPAIM",
}

export class Joystick extends Container {
	private clickZone: Sprite;
	private joystick: Sprite;
	private joystickBG: Sprite;
	private joystickButtonMovement: Sprite;
	private rockButton: Sprite;
	private joystickStartPos: Point;
	public joystickCurrentPos: Point;
	public joystickAngle: number;
	public joystickPower: number;
	private player: any;
	public isJoystickDown: boolean = false;
	public isAnchored: boolean;
	public canJump: boolean = false;
	public canThrow: boolean = false;
	public joystickParams: JoystickParams = {
		inner: Sprite.from("package-1/joystick-handle.png"),
		outer: Sprite.from("package-1/joystick.png"),
		movementButton: Sprite.from("package-1/joystick-handle.png"),
		rockButton: Sprite.from("package-1/joystick-handle.png"),
		power: 0,
		angle: 0,
		distance: 0,
		movementPosition: new Point(ScaleHelper.IDEAL_WIDTH * 0.49, ScaleHelper.IDEAL_HEIGHT * 0.17),
		rockPosition: new Point(ScaleHelper.IDEAL_WIDTH * 0.42, ScaleHelper.IDEAL_HEIGHT * 0.3),
		startPos: new Point(ScaleHelper.IDEAL_WIDTH * 0.09, ScaleHelper.IDEAL_HEIGHT * 0.3),
		currentPos: new Point(0, 0),
		isAnchored: isMobile, // if true then joysticks displays, if false slingshot is enabled
	};

	public clickContainer: Container = new Container();

	constructor(player: any) {
		super();

		this.player = player;
		this.joystickStartPos = this.joystickParams.startPos;

		this.isAnchored = this.joystickParams.isAnchored !== undefined ? this.joystickParams.isAnchored : true; // if it's undefined then it's true;

		this.joystickBG = this.joystickParams.outer;
		this.addChild(this.joystickBG);
		this.initSprite(this.joystickBG, this.joystickStartPos);

		this.joystick = this.joystickParams.inner;
		this.addChild(this.joystick);
		this.initSprite(this.joystick, this.joystickStartPos);

		this.joystickCurrentPos = this.joystickParams.startPos;
		// FOR MOBILE
		this.joystickButtonMovement = this.joystickParams.movementButton;
		this.addChild(this.joystickButtonMovement);
		this.initSprite(this.joystickButtonMovement, this.joystickParams.movementPosition);

		this.rockButton = this.joystickParams.rockButton;
		this.addChild(this.rockButton);
		this.initSprite(this.rockButton, this.joystickParams.rockPosition);

		this.clickContainer = new Container();
		this.clickZone = Sprite.from("img/big_placeholder/background-1.jpg");
		this.clickZone.scale.set(1.1, 0.6);
		this.clickZone.alpha = 0;
		this.clickZone.interactive = true;

		if (!this.joystickParams.isAnchored) {
			this.addChild(this.clickContainer);
			this.clickContainer.pivot.set(this.clickContainer.width / 2, this.clickContainer.height / 2);
			this.clickContainer.addChild(this.clickZone);

			this.rockButton.visible = false;
			this.joystickButtonMovement.visible = false;
			this.joystick.alpha = 0;
			this.joystickBG.alpha = 0;
		}

		// events
		this.joystick.on("pointerdown", this.onJoystickDown);
		this.joystick.on("pointermove", this.onJoystickMove);
		this.joystick.on("pointerup", this.onJoystickUp);
		this.joystick.on("pointerupoutside", this.onJoystickUp);
		this.joystickButtonMovement.on("pointerdown", () => this.onJoystickCanJump(true));
		this.joystickButtonMovement.on("pointerup", () => this.onJoystickCanJump(false));
		this.joystickButtonMovement.on("pointerupoutside", () => this.onJoystickCanJump(false));
		this.rockButton.on("pointerdown", () => this.onJoystickRockThrow(true));
		this.rockButton.on("pointerup", () => this.onJoystickRockThrow(false));
		this.rockButton.on("pointerupoutside", () => this.onJoystickRockThrow(false));

		// PC
		this.clickZone.on("pointerdown", this.onPointerDown);
		this.clickZone.on("pointermove", this.onPointerMove);
		this.clickZone.on("pointerup", this.onPointerUp);
		this.clickZone.on("pointerupoutside", this.onPointerUp);

		// activates canthrow when clicking with right click
		this.onrightdown = () => {
			this.canThrow = true;
			console.log("this.canThrow", this.canThrow);
			this.emit(JoystickEmits.AIM);
		};
		// PRESS W TO WALK WITH JOYSTICK
		this.on(JoystickEmits.WALK, () => {
			this.player.walkWithJoystickDirections({ power: this.joystickPower, angle: this.joystickAngle });
		});

		this.on(JoystickEmits.JOYSTICKUP, this.handleJoystickUp);

		this.resetJoystickPosition();
	}

	/** function to position a sprite and make it interactive */
	private initSprite(sprite: Sprite, position: Point): void {
		sprite.anchor.set(0.5);
		sprite.x = position.x;
		sprite.y = position.y;
		sprite.interactive = true;
	}

	// mobile functions to change buttons colors
	/** mobile: this tint's the jump button and sets the can jump to true */
	private onJoystickCanJump(canJump: boolean): void {
		this.canJump = canJump;
		this.setButtonTint(this.joystickButtonMovement, canJump);
	}

	/** mobile: this tint's the rock button and sets the throw rock to true */
	private onJoystickRockThrow(canThrow: boolean): void {
		this.canThrow = canThrow;
		this.setButtonTint(this.rockButton, canThrow);
	}

	/** mobile: this is the tint function */
	private setButtonTint(button: Sprite, condition: boolean): void {
		button.tint = condition ? 0x00ffff : 0xffffff;
	}

	// for PC gameplay
	private onPointerDown = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		this.joystick.alpha = 1;
		this.joystickBG.alpha = 1;
		const { x, y } = event.data.getLocalPosition(this.parent);
		this.centerJoystick({ data: { getLocalPosition: () => new Point(x, y) } });
		this.onJoystickDown({ data: { getLocalPosition: () => new Point(x, y) } });
		this.canJump = true;
	};
	private onPointerMove = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		const { x, y } = event.data.getLocalPosition(this.parent);
		this.onJoystickMove({ data: { getLocalPosition: () => new Point(x, y) } });
		if (!this.isJoystickDown) {
			this.emit(JoystickEmits.STOPAIM);
		}

		// BURSTMODE (?)
		// if (this.canThrow) {
		// 	this.emit(JoystickEmits.ROCK_THROW);
		// }
	};
	private onPointerUp = (): void => {
		this.isJoystickDown = false;

		this.onrightclick = () => {
			this.canJump = false;
			this.emit(JoystickEmits.STOPAIM);
		};
		this.emit(JoystickEmits.JOYSTICKUP, {
			power: this.joystickPower,
			angle: this.joystickAngle,
		});

		this.joystick.alpha = 0;
		this.joystickBG.alpha = 0;
	};

	/** sets the isJoystickDown to true and emits the JOYSTICKDOWN event  */
	private onJoystickDown = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		const { x, y } = event.data.getLocalPosition(this.parent);
		this.setJoystickPosition(x, y);
		this.isJoystickDown = true;
		this.joystickBG.alpha = 1;
		this.emit(JoystickEmits.JOYSTICKDOWN);
	};
	/** checks that isJoystickDown is true, if it is receives joystick positioning data and emits the actual event (WALK OR JOYSTICKMOVE) */
	private onJoystickMove = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		if (this.isJoystickDown) {
			const { x, y } = event.data.getLocalPosition(this.joystick.parent);
			this.joystick.x = x;
			this.joystick.y = y;
			if (this.canJump) {
				// JUMP
				this.emit(JoystickEmits.JOYSTICKMOVE);
				this.emit(JoystickEmits.AIM);
			} else if (this.canThrow) {
				// THROW ROCK and don't move
				// what's below it's for a throw burster
				// this.emit(JoystickEmits.ROCK_THROW);
			} else if (!this.isAnchored) {
				this.emit(JoystickEmits.JOYSTICKMOVE);
			} else {
				this.player.walkWithJoystickDirections({ power: this.joystickPower, angle: this.joystickAngle });
			}
		}
	};
	/** releases joystick and launches or stops walking depending on what it was doing before, sets isJoystickDown to false and resets it's position */
	private onJoystickUp = (): void => {
		this.isJoystickDown = false;
		this.resetJoystickPosition();
		if (this.canJump || this.canThrow) {
			// JUMP RELEASE
			this.emit(JoystickEmits.JOYSTICKUP, {
				power: this.joystickPower,
				angle: this.joystickAngle,
			});
		} else {
			this.player.speed.x = 0;
		}
	};

	/** To change anchored state
	 * @param isAnchored boolean value of what it was
	 */
	public setAnchored(isAnchored: boolean): void {
		this.isAnchored = isAnchored;
	}

	// what happens on event: joystickUp
	public handleJoystickUp = (joystickData: { power: number; angle: number }): void => {
		this.emit(JoystickEmits.STOPAIM);
		if (joystickData.power > JOYSTICK_MAXPOWER) {
			joystickData.power = JOYSTICK_MAXPOWER;
		}
		if (!this.player.flying) {
			if (!this.isAnchored) {
				// jump on right click
				if (this.canThrow) {
					// puede disparar? si
					this.onrightclick = () => {
						// entonces si puede tirar la piedra cuando hace click derecho y ese click derecho hace pointertap entonces que emita que disparo la roca
						this.clickZone.on("pointertap", () => {
							this.emit(JoystickEmits.ROCK_THROW);
						});
					};
					this.canThrow = false;
					this.emit(JoystickEmits.STOPAIM);
				} else {
					// si no salta
					this.player.shootHim({
						x: joystickComponentX(joystickData),
						y: joystickComponentY(joystickData),
					});
					this.canJump = false;
					this.clickZone.off("pointertap");
					this.emit(JoystickEmits.STOPAIM);
				}
			} else {
				if (this.canThrow) {
					this.emit(JoystickEmits.ROCK_THROW);
				} else {
					this.player.shootHim({
						x: joystickComponentX(joystickData),
						y: joystickComponentY(joystickData),
					});
				}
			}
		}
	};

	/** Resets joystick on top of the aux/graphics */
	public resetJoystickPosition(_timeToResetPosition?: number): void {
		this.setJoystickPosition(this.joystickStartPos.x, this.joystickStartPos.y);
	}

	/** this centers the joystick wherever it's clicked on screen */
	private centerJoystick = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		const { x, y } = event.data.getLocalPosition(this.parent);

		this.setJoystickPosition(x, y);

		if (this.isAnchored) {
			this.resetJoystickPosition();
		}
	};

	/** updates joystick angle and power both in x and y */
	public updateJoystick(): void {
		const dx = this.joystick.x - this.joystickBG.x;
		const dy = this.joystick.y - this.joystickBG.y;
		this.joystickAngle = Math.atan2(dy, dx);
		const distance = 2 * Math.min(500, Math.sqrt(dx * dx + dy * dy));
		this.joystickPower = distance;
	}

	/** sets back joystick and its BG to a defined position */
	private setJoystickPosition(x: number, y: number): void {
		this.joystick.x = x;
		this.joystick.y = y;
		this.joystickBG.x = x;
		this.joystickBG.y = y;
	}
}
