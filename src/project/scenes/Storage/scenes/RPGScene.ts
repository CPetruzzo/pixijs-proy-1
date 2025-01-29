import { Manager } from "../../../..";
import { PixiScene } from "../../../../engine/scenemanager/scenes/PixiScene";
import { StorageScene } from "../StorageScene";

export class RPGScene extends PixiScene {
	constructor() {
		super();

		Manager.changeScene(StorageScene);
	}
}
