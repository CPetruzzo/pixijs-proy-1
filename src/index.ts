import "./pixi";
import { SceneManager } from "./engine/scenemanager/SceneManager";
import { DataManager } from "./engine/datamanager/DataManager";
import { DEBUG, SAVEDATA_VERSION } from "./flags";
import * as ALL_FLAGS from "./flags";
import { forceFocus, preventDrag, preventKeys } from "./engine/utils/browserFunctions";
import { ScaleHelper } from "./engine/utils/ScaleHelper";
import { ForagePersistanceProvider } from "./engine/datamanager/ForagePersistanceProvider";
import { PixiRenderer } from "./engine/scenemanager/renderers/PixiRenderer";
import { settings } from "pixi.js";
import { DEFAULTS } from "tweedle.js";
import { Box2DHelper } from "./engine/utils/Box2DHelper";
import { CameraOrbitControl } from "pixi3d/pixi7";
import { CircularLoadingTransition } from "./engine/scenemanager/transitions/CircularLoadingTransition";
import { JoystickEmits } from "./utils/Joystick";

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { ENV_FIREBASE } from "./env";
import { CameraOrbitControlAim } from "./project/scenes/3dgame/Camera/CameraOrbitControlAim";
import { MenuScene } from "./project/scenes/RunFall/Scenes/MenuScene";

settings.RENDER_OPTIONS.hello = false;

DEFAULTS.safetyCheckFunction = (obj: any) => !obj?.destroyed;

export const pixiSettings = {
	backgroundColor: 0x0,
	width: ScaleHelper.IDEAL_WIDTH,
	resolution: window.devicePixelRatio || 1,
	autoDensity: true,
	height: ScaleHelper.IDEAL_HEIGHT,
	autoStart: false,
	view: document.getElementById("pixi-canvas") as HTMLCanvasElement,
	interactionTestsAllScenes: true,
};

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: ENV_FIREBASE.FIREBASE_API_KEY,
	authDomain: ENV_FIREBASE.FIREBASE_AUTH_DOMAIN,
	databaseURL: ENV_FIREBASE.FIREBASE_DATABASE_URL,
	projectId: ENV_FIREBASE.FIREBASE_PROJECT_ID,
	storageBucket: ENV_FIREBASE.FIREBASE_STORAGE_BUCKET,
	messagingSenderId: ENV_FIREBASE.FIREBASE_MESSAGING_SENDER_ID,
	appId: ENV_FIREBASE.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Inicialización de Firestore
export const db = getDatabase(app);

document.getElementById("pixi-content").style.background = "#" + "000000"; // app.renderer.backgroundColor.toString(16);
document.getElementById("pixi-content").appendChild(pixiSettings.view);

preventDrag(); // prevents scrolling by dragging.
preventKeys(); // prevents scrolling by keyboard keys. (usually required for latam)
forceFocus();
// registerWorker(); // registers the service worker for pwa

export const pixiRenderer = new PixiRenderer(pixiSettings);
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Manager = new SceneManager(pixiRenderer);

export const cameraControl = new CameraOrbitControl(pixiSettings.view);

// Suponiendo que 'element' es el HTMLElement donde capturas los eventos y 'camera' es tu objeto Camera.
export const aimControl = new CameraOrbitControlAim(pixiSettings.view, cameraControl.camera);

export const isMobile: boolean = DataManager.getValue(JoystickEmits.MOBILE);

DataManager.initialize(new ForagePersistanceProvider(), SAVEDATA_VERSION);
if (navigator.userAgent.includes("Mobile")) {
	DataManager.setValue(JoystickEmits.MOBILE, true);
	console.log("Estás accediendo desde un dispositivo móvil.");
} else {
	DataManager.setValue(JoystickEmits.MOBILE, false);
	console.log("Estás accediendo desde una computadora.");
}
DataManager.save();
DataManager.load();

if (DEBUG) {
	console.group("DEBUG MODE ENABLED:");
	for (const flag in ALL_FLAGS) {
		console.log(`${flag} =`, (ALL_FLAGS as any)[flag]);
	}
	console.groupEnd();
}
// Manager.setRotateScene("portrait", SimpleLockScene, ["rotateDevice"]);

window.addEventListener("resize", () => {
	const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	Manager.resize(w, h, window.devicePixelRatio || 1);
});

window.dispatchEvent(new Event("resize"));
window.addEventListener("contextmenu", (e) => {
	e.preventDefault();
	window.dispatchEvent(new CustomEvent("rightClick", { detail: "Clic derecho detectado" }));
});

const initializeCb = function (): void {
	// Manager.changeScene(import(/* webpackPrefetch: true */ "./project/scenes/LoaderScene"));
	Manager.changeScene(MenuScene, { transitionClass: CircularLoadingTransition });
};

if (ALL_FLAGS.USE_BOX2D) {
	Box2DHelper.initialize().then(() => initializeCb());
} else {
	initializeCb();
}

export function vibrateMobileDevice(): void {
	if ("vibrate" in navigator) {
		navigator.vibrate(500);
		console.log("Vibrando.");
	} else {
		console.log("La vibración no es compatible con este dispositivo.");
	}
}
