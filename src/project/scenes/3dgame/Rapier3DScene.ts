// PhysicsDemoScene.ts
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Mesh3D } from "pixi3d/pixi7";
import { World, RigidBodyDesc, ColliderDesc } from "@dimforge/rapier3d";
import * as PIXI from "pixi.js";

// Ejemplo de escena que integra Pixi3D y Rapier3D
export class PhysicsDemoScene extends PixiScene {
	// Mundo físico de Rapier
	private world: World;
	// Cuerpo rígido dinámico (la caja)
	private dynamicBody: any;
	// Mesh3D para visualizar la caja dinámica
	private boxMesh: Mesh3D;
	// Opcional: Mesh3D para el suelo visual
	private groundMesh: Mesh3D;
	// Graphics para dibujar el debug render de Rapier
	private debugGraphics: PIXI.Graphics;

	constructor() {
		super();

		// --- Configuración del mundo físico con Rapier 3D ---
		// Usamos gravedad negativa en Y para que los objetos caigan.
		const gravity = { x: 0, y: -9.81, z: 0 };
		this.world = new World(gravity);

		// Crear un colisionador para el suelo (estático)
		const groundColliderDesc = ColliderDesc.cuboid(10.0, 0.1, 10.0);
		this.world.createCollider(groundColliderDesc);

		// Crear un cuerpo rígido dinámico para la caja
		const rigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(0, 5, 0);
		this.dynamicBody = this.world.createRigidBody(rigidBodyDesc);
		// Añadir un colisionador de cubo al cuerpo
		const colliderDesc = ColliderDesc.cuboid(0.5, 0.5, 0.5);
		this.world.createCollider(colliderDesc, this.dynamicBody);

		// --- Creación de objetos visuales con Pixi3D ---
		// Crear la caja visual
		this.boxMesh = Mesh3D.createCube();
		this.boxMesh.scale.set(1, 1, 1);
		// Agregar la caja a la escena
		this.addChild(this.boxMesh);

		// Crear un suelo visual (usando un plano)
		this.groundMesh = Mesh3D.createPlane();
		this.groundMesh.scale.set(20, 1, 20);
		// Mover el plano para que coincida con el suelo del mundo físico
		this.groundMesh.y = -0.1;
		this.addChild(this.groundMesh);

		// --- Debug graphics ---
		this.debugGraphics = new PIXI.Graphics();
		// Agregarlo encima (por ejemplo, sin transformación 3D)
		this.addChild(this.debugGraphics);
	}

	// Se llama en cada frame (_delta se asume en milisegundos)
	public override update(_delta: number): void {
		if (!this.world) {
			return;
		}

		// Avanza la simulación de física
		this.world.step();

		// Sincronizar el Mesh3D de la caja con el cuerpo rígido de Rapier
		const translation = this.dynamicBody.translation();
		this.boxMesh.position.set(translation.x, translation.y, translation.z);
		// Si se tiene acceso a la rotación en forma de cuaternión:
		const rotation = this.dynamicBody.rotation();
		if (this.boxMesh.rotationQuaternion && rotation) {
			this.boxMesh.rotationQuaternion.copyFrom(rotation);
		}
	}
}
