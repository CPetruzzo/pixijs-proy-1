import { Manager } from "../..";
import { CircularLoadingTransition } from "../../engine/scenemanager/transitions/CircularLoadingTransition";
import { GameplayScene } from "./ArdeLaPatagonia/GamePlayScene";
// import { PatagoniaIntroScene } from "./ArdeLaPatagonia/PatagoniaIntroScene";
// import { IsometricHouseScene } from "./DungeonKeeper/IsometricHouseScene";
// import { DungeonScene3D } from "./Rapier3D/DungeonScene3D";
// import { MenuScene } from "./RunFall/Scenes/MenuScene";
// import { SpaceNavigationScene } from "./Rapier3D/SpaceScene";
// import { VoxelWorldScene } from "./Rapier3D/VoxelWorldScene";
// import { WaveScene } from "./Rapier3D/WaveScene1";

// import { SceneKey, SceneRegistry } from "../../scenes";

export function setInitialScene(): void {
	// Manager.changeScene(SceneRegistry[SceneKey.TOWER_DefenseScene](), { transitionClass: CircularLoadingTransition });
	Manager.changeScene(GameplayScene, { transitionClass: CircularLoadingTransition });
}
