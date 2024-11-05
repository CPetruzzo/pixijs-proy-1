import type { Graphics } from "pixi.js";
import { Sprite, Container, Point } from "pixi.js";
import { isMobile } from "../../..";
import { joystickComponentX, joystickComponentY } from "../../../utils/FunctionUtils";
import { JOYSTICK_MAXPOWER } from "../../../utils/constants";
import type { JoystickBasquetBallPlayer } from "./JoystickBasquetBallPlayer";

export interface JoystickParams {
	inner: Sprite;
	outer: Sprite;
	rockButton: Sprite;
	power: number;
	angle: number;
	isAnchored: boolean;
	clickZone: Sprite;
}

export enum JoystickEmits {
	MOBILE = "MOBILE",
	JOYSTICKUP = "joystickUp",
	JOYSTICKDOWN = "joystickDown",
	JOYSTICKMOVE = "joystickMove",
	WALK = "walk",
	ROCK_THROW = "ROCK_THROW",
	AIM = "AIM",
	STOPAIM = "STOPAIM",
	HOOK = "HOOK",
}

export class BasquetBallJoystick extends Container {
	private player: Graphics | any;
	private joystickBG: Sprite;
	private joystickHandle: Sprite;
	private rockButton: Sprite;

	public joystickParams: JoystickParams;
	private joystickStartPos: Point;
	private isJoystickDown: boolean = false;
	public canThrow: boolean = false;
	public joystickPower: number;
	public joystickAngle: number;
	public static readonly BUNDLES = ["joystick"];

	public clickContainer: Container = new Container();
	private clickZone: Sprite;
	private isAnchored: boolean;

	constructor(player: JoystickBasquetBallPlayer | Graphics | any) {
		super();
		this.player = player;
		this.joystickParams = this.createDefaultParams();
		this.joystickStartPos = new Point(100, 300); // Example position, adjust as needed
		this.isAnchored = this.joystickParams.isAnchored !== undefined ? this.joystickParams.isAnchored : true; // if it's undefined then it's true;

		this.clickZone = this.joystickParams.clickZone;
		this.joystickBG = this.joystickParams.outer;
		this.joystickBG.anchor.set(0.5);
		this.joystickHandle = this.joystickParams.inner;
		this.joystickHandle.anchor.set(0.5);
		this.setupClickContainer();

		this.rockButton = this.joystickParams.rockButton;

		this.setupJoystick();
		this.setupEventListeners();

		this.on(JoystickEmits.JOYSTICKUP as any, this.handleJoystickUp);
	}

	private setupClickContainer(): void {
		this.clickContainer = new Container();
		this.addChild(this.clickContainer);
		this.clickZone.scale.set(4, 4);
		this.clickZone.alpha = 0;
		this.clickZone.interactive = true;

		this.clickContainer.pivot.set(this.clickContainer.width / 2, this.clickContainer.height / 2);
		this.clickContainer.addChild(this.clickZone);

		this.joystickHandle.alpha = 0;
		this.joystickBG.alpha = 0;
	}

	/** Set up the joystick sprites and add to the container */
	private setupJoystick(): void {
		this.clickContainer.addChild(this.clickZone);
		this.addChild(this.joystickBG);
		this.addChild(this.joystickHandle);
		// this.addChild(this.rockButton);

		this.positionSprite(this.joystickBG, this.joystickStartPos);
		this.positionSprite(this.joystickHandle, this.joystickStartPos);
		// this.positionSprite(this.rockButton, new Point(200, 300)); // Example position
	}

	/** Helper to initialize and position sprites */
	private positionSprite(sprite: Sprite, position: Point): void {
		sprite.anchor.set(0.5);
		sprite.position.copyFrom(position);
		sprite.interactive = true;
	}

	/** Set up event listeners for joystick and rock button */
	private setupEventListeners(): void {
		this.joystickHandle.on("pointerdown", this.onJoystickDown);
		this.joystickHandle.on("pointermove", this.onJoystickMove);
		this.joystickHandle.on("pointerup", this.onJoystickUp);
		this.joystickHandle.on("pointerupoutside", this.onJoystickUp);

		this.rockButton.on("pointerdown", () => this.handleRockThrow(true));
		this.rockButton.on("pointerup", () => this.handleRockThrow(false));

		// Eventos para clickZone
		this.clickZone.on("pointerdown", this.onJoystickDown);
		this.clickZone.on("pointermove", this.onJoystickMove);
		this.clickZone.on("pointerup", this.onJoystickUp);
		this.clickZone.on("pointerupoutside", this.onJoystickUp);

		// activates canthrow when clicking with right click
		this.onrightdown = () => {
			this.canThrow = true;
			this.emit(JoystickEmits.AIM);
		};
	}

	/** Handler for joystick down */
	private onJoystickDown = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		const { x, y } = event.data.getLocalPosition(this.parent);
		this.setJoystickPosition(x, y);
		this.isJoystickDown = true;
		this.joystickHandle.alpha = 1;
		this.joystickBG.alpha = 1;
		this.emit(JoystickEmits.JOYSTICKDOWN as any);
		this.centerJoystick({ data: { getLocalPosition: () => new Point(x, y) } });
	};

	/** Handler for joystick move */
	private onJoystickMove = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		if (this.isJoystickDown) {
			const { x, y } = event.data.getLocalPosition(this.parent);
			// this.setJoystickPosition(x, y);
			this.joystickHandle.x = x;
			this.joystickHandle.y = y;
			this.emit(JoystickEmits.JOYSTICKMOVE as any, { power: this.joystickParams.power, angle: this.joystickParams.angle });
			this.emit(JoystickEmits.AIM);
			// this.updatePlayerPosition(x, y);
		}
	};

	/** Handler for joystick up */
	private onJoystickUp = (): void => {
		this.isJoystickDown = false;
		this.resetJoystickPosition();
		this.emit(JoystickEmits.JOYSTICKUP as any, {
			power: this.joystickPower,
			angle: this.joystickAngle,
		});
	};

	/** Update player position based on joystick movement */
	public updatePlayerPosition(x: number, y: number): void {
		this.player.position.set(x, y); // Move player to the new position
	}

	/** Handle rock throw button actions */
	private handleRockThrow(isThrowing: boolean): void {
		this.canThrow = isThrowing;
		this.rockButton.tint = isThrowing ? 0x00ffff : 0xffffff; // Highlight rock button
		if (isThrowing) {
			this.emit(JoystickEmits.ROCK_THROW);
		}
	}

	public resetJoystickPosition(_timeToResetPosition?: number): void {
		this.setJoystickPosition(this.joystickStartPos.x, this.joystickStartPos.y);
		this.joystickBG.alpha = 0;
		this.joystickHandle.alpha = 0;
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
		const dx = this.joystickHandle.x - this.joystickBG.x;
		const dy = this.joystickHandle.y - this.joystickBG.y;
		this.joystickAngle = Math.atan2(dy, dx);
		const distance = 2 * Math.min(500, Math.sqrt(dx * dx + dy * dy));
		this.joystickPower = distance;
	}

	/** sets back joystick and its BG to a defined position */
	private setJoystickPosition(x: number, y: number): void {
		this.joystickHandle.x = x;
		this.joystickHandle.y = y;
		this.joystickBG.x = x;
		this.joystickBG.y = y;
	}

	/** Create default joystick parameters */
	private createDefaultParams(): JoystickParams {
		return {
			inner: Sprite.from("inner"),
			outer: Sprite.from("outer"),
			clickZone: Sprite.from("big_background"),
			rockButton: Sprite.from("inner"),
			power: 0,
			angle: 0,
			isAnchored: isMobile,
		};
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
}
