import { Manager } from "../..";
import { CircularLoadingTransition } from "../../engine/scenemanager/transitions/CircularLoadingTransition";
import { KartRaceScene } from "./3dgame/CarGameScene";

// crnaturales@hcdn.gob.ar PONENCIA

// import { SceneKey, SceneRegistry } from "../../scenes";

export function setInitialScene(): void {
	// Manager.changeScene(SceneRegistry[SceneKey.TOWER_DefenseScene](), { transitionClass: CircularLoadingTransition });
	Manager.changeScene(KartRaceScene, { transitionClass: CircularLoadingTransition });
}
