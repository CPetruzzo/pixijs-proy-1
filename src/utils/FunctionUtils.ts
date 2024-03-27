import { JOYSTICK_MAXPOWER, JOYSTICK_STRENGTH_FACTOR } from "./constants";

/** returns strength (a number) of joystick vector component x */
export function joystickComponentX(joystickData: { power: number; angle: number }): number {
	return ((joystickData.power * JOYSTICK_STRENGTH_FACTOR) / JOYSTICK_MAXPOWER) * Math.cos(joystickData.angle);
}

/** returns strength (a number) of joystick vector component y */
export function joystickComponentY(joystickData: { power: number; angle: number }): number {
	return ((joystickData.power * JOYSTICK_STRENGTH_FACTOR) / (JOYSTICK_MAXPOWER - 20)) * Math.sin(joystickData.angle);
}
