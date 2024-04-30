// import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
// import type * as RAPIER from "@dimforge/rapier2d";

// export class RapierScene extends PixiScene {
// 	public static readonly BUNDLES = ["package-1"];

// 	private gravity: { x: number; y: number };
// 	private world: RAPIER.World;
// 	private groundColliderDesc: RAPIER.ColliderDesc;
// 	private rigidBodyDesc: RAPIER.RigidBodyDesc;
// 	private rigidBody: any;
// 	private colliderDesc: RAPIER.ColliderDesc;
// 	public collider: any;

// 	constructor() {
// 		super();
// 		this.initRapier();
// 	}

// 	private async initRapier() {
// 		const RAPIER = await import("@dimforge/rapier2d");
// 		this.gravity = { x: 0.0, y: -9.81 };
// 		this.world = new RAPIER.World(this.gravity);

// 		this.groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1);
// 		this.world.createCollider(this.groundColliderDesc);

// 		this.rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0.0, 1.0);
// 		this.rigidBody = this.world.createRigidBody(this.rigidBodyDesc);

// 		this.colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5);
// 		this.collider = this.world.createCollider(this.colliderDesc, this.rigidBody);

// 		this.runTestbed(RAPIER);
// 	}

// 	private runTestbed(RAPIER: typeof import("@dimforge/rapier2d")) {
// 		const builders = new Map([
// 			["collision groups", this.initCollisionGroups],
// 			// Agrega más builders según tus necesidades aquí
// 		]);

// 		const testbed = new Testbed(RAPIER, builders);
// 		testbed.run();
// 	}

// 	private initCollisionGroups(RAPIER: typeof import("@dimforge/rapier2d"), testbed: Testbed) {
// 		// Lógica de inicialización para el demo de collision groups
// 		// Puedes adaptar esta función según tus necesidades específicas
// 	}
// }
