import { Manager } from "../..";
import { CircularLoadingTransition } from "../../engine/scenemanager/transitions/CircularLoadingTransition";

import { DungeonScene3D } from "./Rapier3D/DungeonScene3D";

export function setInitialScene(): void {
	Manager.changeScene(DungeonScene3D, { transitionClass: CircularLoadingTransition });
}
