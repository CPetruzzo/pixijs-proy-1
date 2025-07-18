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
// import { CameraOrbitControlAim } from "./project/scenes/3dgame/Camera/CameraOrbitControlAim";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import { NavigationBar } from "@hugotomazi/capacitor-navigation-bar";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { App } from "@capacitor/app";
import { AdMob } from "@capacitor-community/admob";
import { SoundLib } from "./engine/sound/SoundLib";
import { Sounds } from "./project/scenes/RunFall/Managers/SoundManager";
import { MultiplayerCachoWorldGameScene } from "./project/scenes/CachoWorld/Scenes/MultiplayerCachoWorldGameScene";

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
document.getElementById("pixi-content").style.cursor = "pointer";

preventDrag(); // prevents scrolling by dragging.
preventKeys(); // prevents scrolling by keyboard keys. (usually required for latam)
forceFocus();
// registerWorker(); // registers the service worker for pwa

export const pixiRenderer = new PixiRenderer(pixiSettings);

// asegúrate de que la ruta al .png sea accesible desde el CSS
// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
const skullCursor = `url('/skull.png}') 0 0, auto`;
// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
const skullHover = `url('/skull.png}') 0 0, auto`;

// 1) asigna tu cursor por defecto (fuera de cualquier escena)
pixiRenderer.pixiRenderer.view.style.cursor = skullCursor;

// 2) registra los estilos de cursor en el InteractionPlugin de PIXI
const interaction = pixiRenderer.pixiRenderer.plugins.interaction;
interaction.cursorStyles.default = skullCursor;
interaction.cursorStyles.pointer = skullCursor; // cuándo devuelva "pointer"
interaction.cursorStyles.hover = skullHover; // si quieres un “hover” específico

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Manager = new SceneManager(pixiRenderer);
console.log("Manager", Manager);

export const mousePosition = Manager.sceneRenderer.pixiRenderer.events.pointer.global;

export const cameraControl = new CameraOrbitControl(pixiSettings.view);

// Suponiendo que 'element' es el HTMLElement donde capturas los eventos y 'camera' es tu objeto Camera.
// export const aimControl = new CameraOrbitControlAim(pixiSettings.view, cameraControl.camera);

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
	// Manager.changeScene(import(/* webpackPrefetch: true */ "./project/scenes/LoaderScene"));  }

	Manager.changeScene(MultiplayerCachoWorldGameScene, { transitionClass: CircularLoadingTransition });
};

if (ALL_FLAGS.USE_BOX2D) {
	Box2DHelper.initialize().then(() => initializeCb());
} else {
	initializeCb();
}

if (Capacitor.isNativePlatform()) {
	StatusBar.hide();
	NavigationBar.hide();
	KeepAwake.keepAwake();
	App.addListener("appStateChange", (e) => {
		if (e.isActive) {
			SoundLib.resumeMusic(Sounds.BG_MUSIC);
			// resumo el juego
		} else {
			SoundLib.pauseMusic(Sounds.BG_MUSIC);
			// pauso el juego
		}
	});

	AdMob.initialize(); // Inicializa AdMob cuando arranca la app
}

export function vibrateMobileDevice(): void {
	if ("vibrate" in navigator) {
		navigator.vibrate(500);
		console.log("Vibrando.");
	} else {
		console.log("La vibración no es compatible con este dispositivo.");
	}
}
