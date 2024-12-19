import { Container, Point, Sprite } from "pixi.js";
import type { CachoWorldPlayer } from "./CachoWorldPlayer";
import { isMobile } from "../../..";

export enum JoystickEmits {
	JOYSTICKUP = "joystickUp",
	JOYSTICKDOWN = "joystickDown",
	JOYSTICKMOVE = "joystickMove",
	ROCK_THROW = "ROCK_THROW",
	AIM = "AIM",
	STOPAIM = "STOPAIM",
}

export interface JoystickParams {
	inner: Sprite;
	outer: Sprite;
	rockButton: Sprite;
	power: number;
	angle: number;
	isAnchored: boolean;
	clickZone: Sprite;
}

export class JoystickMultiplayerCachoWorld extends Container {
	private player: CachoWorldPlayer;
	public joystickParams: JoystickParams;

	private joystickBG: Sprite;
	private joystickHandle: Sprite;
	private clickZone: Sprite;

	private joystickStartPos: Point = new Point(100, 300);
	private isJoystickDown: boolean = false;
	public canThrow: boolean = false;

	public joystickPower: number = 0;
	public joystickAngle: number = 0;
	public clickContainer: Container = new Container();
	public moveDirection: Point | null = null; // Para almacenar la dirección de movimiento

	constructor(player: CachoWorldPlayer) {
		super();
		this.player = player;
		this.joystickParams = this.createDefaultParams();
		this.joystickStartPos = new Point(100, 300); // Example position, adjust as needed

		this.clickZone = this.joystickParams.clickZone;
		this.joystickBG = this.joystickParams.outer;
		this.joystickBG.anchor.set(0.5);
		this.joystickHandle = this.joystickParams.inner;
		this.joystickHandle.anchor.set(0.5);
		this.setupClickContainer();
		this.setupJoystick();

		this.setupEventListeners();
		this.setupClickZone();
		this.setupEventListeners();
		this.resetJoystickPosition();

		this.on(JoystickEmits.JOYSTICKUP as any, this.handleJoystickUp);
	}

	/** Set up the joystick sprites and add to the container */
	private setupJoystick(): void {
		this.clickContainer.addChild(this.clickZone);
		this.addChild(this.joystickBG);
		this.addChild(this.joystickHandle);

		this.positionSprite(this.joystickBG, this.joystickStartPos);
		this.positionSprite(this.joystickHandle, this.joystickStartPos);
	}

	/** Helper to initialize and position sprites */
	private positionSprite(sprite: Sprite, position: Point): void {
		sprite.anchor.set(0.5);
		sprite.position.copyFrom(position);
		sprite.interactive = true;
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

	/** Configura la zona clickeable */
	private setupClickZone(): void {
		this.clickZone.alpha = 0;
		this.addChild(this.clickZone, this.joystickBG, this.joystickHandle);
	}

	/** Set up event listeners for joystick and rock button */
	private setupEventListeners(): void {
		this.joystickHandle.on("pointerdown", this.onJoystickDown);
		this.joystickHandle.on("pointermove", this.onJoystickMove);
		this.joystickHandle.on("pointerup", this.onJoystickUp);
		this.joystickHandle.on("pointerupoutside", this.onJoystickUp);

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

		// Calculamos la dirección del movimiento al presionar
		const dx = x - this.joystickBG.x;
		const dy = y - this.joystickBG.y;
		this.moveDirection = new Point(dx, dy);

		// Llama a la lógica de movimiento si el joystick ya está presionado
		this.updateJoystick(); // Actualiza el ángulo y la potencia
		this.updatePlayerPosition(this.player.x + this.joystickPower * Math.cos(this.joystickAngle), this.player.y + this.joystickPower * Math.sin(this.joystickAngle));

		// Emite eventos de movimiento del joystick
		this.emit(JoystickEmits.JOYSTICKDOWN as any);
		this.emit(JoystickEmits.JOYSTICKMOVE as any, {
			power: this.joystickParams.power,
			angle: this.joystickParams.angle,
		});
		this.emit(JoystickEmits.AIM);

		// Si es necesario, centra el joystick con el movimiento del jugador
		this.centerJoystick({ data: { getLocalPosition: () => new Point(x, y) } });
	};

	/** Handler for joystick move */
	private onJoystickMove = (event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		if (this.isJoystickDown) {
			const { x, y } = event.data.getLocalPosition(this.parent);

			// Calcula la dirección del movimiento
			const dx = x - this.joystickBG.x;
			const dy = y - this.joystickBG.y;

			// Normaliza el vector de dirección y aplica una velocidad constante
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance > 0) {
				const speed = 2; // Define la velocidad constante
				const normalizedX = (dx / distance) * speed;
				const normalizedY = (dy / distance) * speed;

				// Mueve al jugador a la nueva posición según el movimiento del joystick
				this.updatePlayerPosition(this.player.x + normalizedX, this.player.y + normalizedY);

				// Centra el joystick sobre el jugador mientras se mueve
				this.joystickHandle.x = this.player.x; // Centrado con el jugador
				this.joystickHandle.y = this.player.y;
			}

			// Actualiza el ángulo y la potencia del joystick
			this.updateJoystick();

			// Emite eventos de movimiento del joystick
			this.emit(JoystickEmits.JOYSTICKMOVE as any, {
				power: this.joystickParams.power,
				angle: this.joystickParams.angle,
			});
			this.emit(JoystickEmits.AIM);
			this.resetJoystickPosition();
		}
	};

	/** Handler for joystick up */
	private onJoystickUp = (): void => {
		this.isJoystickDown = false;
		this.emit(JoystickEmits.JOYSTICKUP as any, {
			power: this.joystickPower,
			angle: this.joystickAngle,
		});
		this.joystickHandle.alpha = 0; // Hide joystick handle when released
		this.joystickBG.alpha = 0; // Hide joystick background when released
	};

	private centerJoystick = (_event: { data: { getLocalPosition: (arg0: any) => Point } }): void => {
		const playerPosition = this.player.position;
		this.setJoystickPosition(playerPosition.x, playerPosition.y);
	};

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

	/** Update player position based on joystick movement */
	public updatePlayerPosition(x: number, y: number): void {
		this.player.position.set(x, y);
	}

	public resetJoystickPosition(_timeToResetPosition?: number): void {
		this.setJoystickPosition(this.player.position.x, this.player.position.y);
		this.joystickBG.alpha = 0;
		this.joystickHandle.alpha = 0;
	}

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

	public handleJoystickUp = (_joystickData: { power: number; angle: number }): void => {
		this.emit(JoystickEmits.STOPAIM);
		this.resetJoystickPosition();
	};
}
