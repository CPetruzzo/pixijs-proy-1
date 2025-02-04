import { Mesh3D } from "pixi3d/pixi7";
import { Torch } from "./Torch";

export class WorldBuilding {
	public torches: Torch[] = [];

	constructor(container: any) {
		this.createWorld(container);
	}

	private createWorld(container: any): void {
		// CREATE GROUND
		const ground = container.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(200, 15, 200);

		// CREATE WALLS
		const wall1 = container.addChild(Mesh3D.createCube());
		wall1.y = 0;
		wall1.rotationQuaternion.setEulerAngles(0, 45, 0);
		wall1.scale.set(2, 25, 50);

		const wall2 = container.addChild(Mesh3D.createCube());
		wall2.y = 0;
		wall2.rotationQuaternion.setEulerAngles(0, -45, 0);
		wall2.scale.set(2, 25, 50);

		const wall3 = container.addChild(Mesh3D.createCube());
		wall3.y = 0;
		wall3.x = 68;
		wall3.rotationQuaternion.setEulerAngles(0, 135, 0);
		wall3.scale.set(2, 25, 50);

		const wall4 = container.addChild(Mesh3D.createCube());
		wall4.y = 0;
		wall4.x = -68;
		wall4.rotationQuaternion.setEulerAngles(0, -135, 0);
		wall4.scale.set(2, 25, 50);

		const wall5 = container.addChild(Mesh3D.createCube());
		wall5.y = 0;
		wall5.z = 68;
		wall5.rotationQuaternion.setEulerAngles(0, 45, 0);
		wall5.scale.set(2, 25, 50);

		// CREATE TORCHES
		const torch1 = new Torch(container, 68, 50);
		torch1.name = "torch1";
		const torch2 = new Torch(container, 18, 70);
		torch2.name = "torch2";
		const torch3 = new Torch(container, -18, 70);
		torch3.name = "torch3";
		const torch4 = new Torch(container, -68, 50);
		torch4.name = "torch4";
		const torch5 = new Torch(container, 68, -50);
		torch5.name = "torch5";
		this.torches.push(torch1, torch2, torch3, torch4, torch5);
	}
}
