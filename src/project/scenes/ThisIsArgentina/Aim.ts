import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { Tween } from "tweedle.js";
import { joystickComponentX, joystickComponentY } from "../../../utils/FunctionUtils";
import { AIM_ANIMATION_DURATION, JOYSTICK_MAXPOWER, NORMAL_ACCELERATION, TRAJECTORY_AVERAGE_DT, TRAJECTORY_POINTS } from "../../../utils/constants";

/** it has to be addChilded to the player in scene */
export class Aim extends Container {
	private points: Sprite[];
	private currentSpeedValues: { x: number; y: number; acceleration: number };
	public initialPos: { x: number; y: number };
	public finalPos: { x: number; y: number };
	private animationDuration: number = AIM_ANIMATION_DURATION;

	constructor() {
		super();
		this.points = [];
		this.initialPos = { x: 0, y: 0 };
		this.finalPos = { x: 0, y: 0 };
	}

	/** updates aim points based on joystickdata: { power , angle }
	 * @abstract draws each point predicting trayectory
	 * calculates initial pos and final pos
	 */
	public updateAim(joystickData: { power: number; angle: number }): void {
		this.removePoints();

		if (joystickData.power > JOYSTICK_MAXPOWER) {
			joystickData.power = JOYSTICK_MAXPOWER;
		}

		const AIM_STRENGTH = Math.round(((joystickData.power * TRAJECTORY_POINTS) / JOYSTICK_MAXPOWER) * 3);

		this.currentSpeedValues = {
			x: joystickComponentX(joystickData),
			y: joystickComponentY(joystickData),
			acceleration: NORMAL_ACCELERATION,
		};

		for (let i = 1; i <= AIM_STRENGTH; i++) {
			// distance between dots
			if (i % 250 != 0) {
				continue;
			}
			const point = Sprite.from("collectable");
			point.scale.set(0.2);
			point.anchor.set(0.5);
			const posX = -this.currentSpeedValues.x * TRAJECTORY_AVERAGE_DT * i;
			const posY = -this.currentSpeedValues.y * TRAJECTORY_AVERAGE_DT * i + (this.currentSpeedValues.acceleration * Math.pow(TRAJECTORY_AVERAGE_DT * i, 2)) / 2;
			point.position.set(posX, posY);
			this.points.push(point);
			this.addChild(point);
		}

		// calculates initial position and final position useful for animatePoints()
		if (this.points.length > 0) {
			this.initialPos = {
				x: this.points[0].position.x,
				y: this.points[0].position.y,
			};
			this.finalPos = {
				x: this.points[this.points.length - 1].position.x,
				y: this.points[this.points.length - 1].position.y,
			};
			this.animatePoints();
		}
	}

	/** function for advancetweening points */
	private animatePoints(): void {
		const totalPoints = this.points.length;
		this.points.forEach((point, i) => {
			if (i < this.points.length - 1) {
				const nextIndex = (i + 1) % totalPoints;
				const nextPoint = this.points[nextIndex];
				const targetX = nextPoint.position.x;
				const targetY = nextPoint.position.y;
				new Tween(point.position)
					.to({ x: targetX, y: targetY }, this.animationDuration)
					.onComplete(() => {
						this.animatePoints();
					})
					.repeat(Infinity)
					.start();
			} else {
				point.alpha = 0.5;
				point.scale.set(0.4);
			}
		});
	}

	/** removes points before update */
	public removePoints(): void {
		this.points.forEach((point) => {
			this.removeChild(point);
			point.destroy();
		});
		this.points = [];
	}

	/** update aim trajectory - does nothing special right now but if you need something it's already separated from updateAim */
	public updateTrajectory(joystickData: { power: number; angle: number }): void {
		this.updateAim({
			power: joystickData.power,
			angle: joystickData.angle,
		});
	}
}
