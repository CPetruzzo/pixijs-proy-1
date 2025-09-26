// InitialScene.ts
import { Manager } from "../..";
import { CircularLoadingTransition } from "../../engine/scenemanager/transitions/CircularLoadingTransition";
import { MotoRunnerScene } from "./Stone/Stone";

/**
 * Setea la escena inicial. Llamar desde index.ts con:
 *   setInitialScene(Manager);
 */
export function setInitialScene(): void {
	Manager.changeScene(MotoRunnerScene, { transitionClass: CircularLoadingTransition });
}
