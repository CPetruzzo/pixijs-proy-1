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
import { DodgeScene } from "./project/scenes/RunFall/DodgeScene";

settings.RENDER_OPTIONS.hello = false;

DEFAULTS.safetyCheckFunction = (obj: any) => !obj?.destroyed;

const pixiSettings = {
	backgroundColor: 0x0,
	width: ScaleHelper.IDEAL_WIDTH,
	resolution: window.devicePixelRatio || 1,
	autoDensity: true,
	height: ScaleHelper.IDEAL_HEIGHT,
	autoStart: false,
	view: document.getElementById("pixi-canvas") as HTMLCanvasElement,
	interactionTestsAllScenes: true,
};

document.getElementById("pixi-content").style.background = "#" + "000000"; // app.renderer.backgroundColor.toString(16);
document.getElementById("pixi-content").appendChild(pixiSettings.view);

preventDrag(); // prevents scrolling by dragging.
preventKeys(); // prevents scrolling by keyboard keys. (usually required for latam)
forceFocus();
// registerWorker(); // registers the service worker for pwa

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Manager = new SceneManager(new PixiRenderer(pixiSettings));
export const cameraControl = new CameraOrbitControl(pixiSettings.view);

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

window.addEventListener("resize", () => {
	const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	Manager.resize(w, h, window.devicePixelRatio || 1);
});

window.dispatchEvent(new Event("resize"));

const initializeCb = function (): void {
	// Manager.changeScene(import(/* webpackPrefetch: true */ "./project/scenes/LoaderScene"));
	// Manager.changeScene(LDTKMapScene, { transitionClass: CircularLoadingTransition });
	Manager.changeScene(DodgeScene, { transitionClass: CircularLoadingTransition });
};

if (ALL_FLAGS.USE_BOX2D) {
	Box2DHelper.initialize().then(() => initializeCb());
} else {
	initializeCb();
}
