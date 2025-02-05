import { Mesh3D } from "pixi3d/pixi7";
import { Torch } from "./Torch";
import { StandardMaterial } from "pixi3d/pixi7";
import { Assets } from "pixi.js";
import { Gate } from "./Gate";
import { Trigger } from "./Trigger";

export class WorldBuilding {
	public torches: Torch[] = [];
	private gate: Gate;
	public trigger: Trigger;
	public walls: Mesh3D[] = []; // Arreglo para las paredes

	constructor(container: any) {
		this.createWorld(container);
	}

	private createWorld(container: any): void {
		// Crear el suelo (ground)
		const ground = container.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(200, 15, 200);

		// Crear un material para las paredes
		const wallMaterial = new StandardMaterial();
		const texture = Assets.get("wallTexture");
		texture.baseTexture.wrapMode = 10497; // PIXI.WRAP_MODES.REPEAT
		wallMaterial.baseColorTexture = texture;
		wallMaterial.metallicRoughnessTexture = texture;
		wallMaterial.roughness = 1;
		wallMaterial.metallic = 1;

		// === Agregar paredes externas ===
		// Pared Izquierda (X = -101)
		const leftWall: Mesh3D = container.addChild(Mesh3D.createCube());
		leftWall.position.set(-200, 12.5, 0); // Y=12.5 para que la base esté en Y=0 (asumiendo centro en el medio)
		leftWall.scale.set(2, 25, 200);
		leftWall.material = wallMaterial;
		this.walls.push(leftWall);
		console.log("leftWall.geometry", leftWall.geometry);
		console.log("Left wall positions:", leftWall.geometry.positions);
		leftWall.updateTransform();
		const box = leftWall.getBoundingBox();
		console.log("Bounding box:", box);

		// Pared Derecha (X = 101)
		const rightWall = container.addChild(Mesh3D.createCube());
		rightWall.position.set(200, 12.5, 0);
		rightWall.scale.set(2, 25, 200);
		rightWall.material = wallMaterial;
		this.walls.push(rightWall);

		// Pared Superior (Z = 101)
		const topWall = container.addChild(Mesh3D.createCube());
		topWall.position.set(0, 12.5, 200);
		topWall.scale.set(200, 25, 2);
		topWall.material = wallMaterial;
		this.walls.push(topWall);

		// Pared Inferior (Z = -101)
		const bottomWall = container.addChild(Mesh3D.createCube());
		bottomWall.position.set(0, 12.5, -200);
		bottomWall.scale.set(200, 25, 2);
		bottomWall.material = wallMaterial;
		this.walls.push(bottomWall);

		// === Paredes adicionales (si querés alguna interna, puedes mantener las que ya tenías) ===

		const wall2 = container.addChild(Mesh3D.createCube());
		wall2.y = 12.5;
		wall2.x = 110;
		wall2.rotationQuaternion.setEulerAngles(0, -90, 0);
		wall2.scale.set(2, 25, 90);
		wall2.material = wallMaterial;

		const wall3 = container.addChild(Mesh3D.createCube());
		wall3.y = 12.5;
		wall3.x = -110;
		wall3.rotationQuaternion.setEulerAngles(0, -90, 0);
		wall3.scale.set(2, 25, 90);
		wall3.material = wallMaterial;

		// Creamos la puerta (Gate) en, por ejemplo, el centro del muro superior
		this.gate = new Gate(container, { x: 0, y: 12.5, z: 0 }, { x: 19.5, y: 25, z: 2 });

		// Creamos el trigger, por ejemplo, justo enfrente del muro (dentro del área del jugador)
		// Ajustá la posición y escala según tu diseño.
		this.trigger = new Trigger(container, this.gate, { x: 0, y: 0, z: 15 }, { x: 5, y: 1, z: 5 });

		// Crear torches
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
