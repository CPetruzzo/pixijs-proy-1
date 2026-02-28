import { Manager } from "../..";
import { CircularLoadingTransition } from "../../engine/scenemanager/transitions/CircularLoadingTransition";
import { DungeonScene } from "./DungeonKeeper/DungeonScene";
import { IsometricHouseScene } from "./DungeonKeeper/IsometricHouseScene";
// import { SpaceNavigationScene } from "./Rapier3D/SpaceScene";
// import { VoxelWorldScene } from "./Rapier3D/VoxelWorldScene";
// import { WaveScene } from "./Rapier3D/WaveScene1";

// import { SceneKey, SceneRegistry } from "../../scenes";

export function setInitialScene(): void {
	// Manager.changeScene(SceneRegistry[SceneKey.TOWER_DefenseScene](), { transitionClass: CircularLoadingTransition });
	Manager.changeScene(IsometricHouseScene, { transitionClass: CircularLoadingTransition });
}
