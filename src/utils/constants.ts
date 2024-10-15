import { Texture } from "pixi.js";

export const RIVER_TEXTURE: Texture = Texture.from("./img/water.png");
export const GRASS_TEXTURE: Texture = Texture.from("./img/grass.png");
export const HILL_TEXTURE: Texture = Texture.from("./img/mountain.png");

// LOLI GAME
export const HAND_MOVEMENT_AMPLITUDE = 0.05;
export const HAND_MOVEMENT_FREQUENCY = 0.005;
export const CAMERA_MOVE_SPEED = 0.2;
export const DRAGON_SPEED = 1.2;
export const VEHICULE_SPEED = 0.2;
export const CAMERA_ROTATION_SPEED = 0.01;
export const GRAVITY = 200;

export const MINIMAP_WIDTH = 300;
export const MINIMAP_HEIGHT = 300;

// Physics
export const NORMAL_ACCELERATION = 0.0017;
export const MAX_SPEED_X = 0.65;
export const MAX_SPEED_Y = 1.1;
export const WALK_MOVE_SPEED = 0.3;

// Slingshot/Joystick
export const SUBSTEP_COUNT = 16;
export const MAX_SLINGSHOT_CHARGE = 300;
export const SPEED_DIVISOR = MAX_SLINGSHOT_CHARGE * 0.75;
export const JOYSTICK_MAXPOWER = 130; // used in joystickShoot
export const JOYSTICK_STRENGTH_FACTOR = 0.8; // used to change shoot strength (if higher --> stronger, and viceversa)
export const DEADZONERANGE = 0.5; // limits walk mobile movement until you surpass this percentage
export const TRAJECTORY_POINTS = 3500;
export const TRAJECTORY_AVERAGE_DT = 0.1005;
export const AIM_ANIMATION_DURATION = 350;

// change this to change level from ldtk
export const CURRENT_LEVEL: number = 0;
export const PLAYER_WALK_SPEED: number = 0.05;
export const PLAYER_SCALE: number = 0.09;

export const PLAYER_SPEED: number = 0.5;
export const OBJECT_SPEED: number = 0.5;

export const BLUR_TIME: number = 1500;
export const STUN_TIME: number = 2000;
