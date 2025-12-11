import { Manager } from "../..";
import { CircularLoadingTransition } from "../../engine/scenemanager/transitions/CircularLoadingTransition";

import { SceneKey, SceneRegistry } from "../../scenes";

export function setInitialScene(): void {
	Manager.changeScene(SceneRegistry[SceneKey.TopDownProtoScene](), { transitionClass: CircularLoadingTransition });
}
