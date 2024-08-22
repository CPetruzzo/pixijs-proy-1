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
export const JOYSTICK_STRENGTH_FACTOR = 0.44; // used to change shoot strength (if higher --> stronger, and viceversa)
export const DEADZONERANGE = 0.5; // limits walk mobile movement until you surpass this percentage
export const TRAJECTORY_POINTS = 2048;
export const TRAJECTORY_AVERAGE_DT = 0.1005;
export const AIM_ANIMATION_DURATION = 350;
// Character
export const WALK_RIGHT = 1;
export const WALK_LEFT = -1;
export const CHARACTER_WALKING_PAUSE = 750;
export const CHARACTER_WALKING_SPEED = { x: -0.125, y: 0.15, clamped: false };
export const CHARACTER_MAXIMUN_FALL_TIME = 1000;
export const CHARACTER_INITIAL_HEALTH = 5;
export const INVULNERABILITYTIME = 1000;
// ENEMIES
export const BEE_TIME_TO_SHOOT_MS = 3000;

// Timer
export const COUNTER_TIME = 10;
export const COUNTDOWNTIME = 0.02;

// LevelSelector
export const LEVEL_SELECTOR_HEIGHT = 5;
export const LEVEL_SELECTOR_GAP = 1.7;
export const START_LEVEL_INDEX = 1; // set this to allow to play a specific level
export const LEVELS_DEFAULT_STATE: string = "unplayed"; // possible states: "locked" | "unplayed" | "won";
export const UI_BUTTONS_GAP = 10;

export const BREAK_TIME = 200;
export const FALL_BREAK_TIME = 400;
export const BREAK_REAPPEAR_TIME = 2000;

// change this to change level from ldtk
export const CURRENT_LEVEL: number = 0;
export const PLAYER_WALK_SPEED: number = 0.05;
export const LEVEL_SCALE: number = 3.5;
export const PLAYER_SCALE: number = 0.09;

export const PAUSE_OBSTACULE: number = 2000;
export const PLAYER_SPEED: number = 0.5;
export const OBJECT_SPEED: number = 0.5;

export const BLUR_TIME: number = 1500;
