// import type { Point3D } from "pixi3d/pixi7";
// import { Color, Mesh3D, StandardMaterial } from "pixi3d/pixi7";
// import { Tween } from "tweedle.js";

// export class Explosion extends Mesh3D {
// 	constructor(position: Point3D) {
// 		super();
// 		this.material = new StandardMaterial();
// 		this.addChild(Mesh3D.createSphere()); // Crear esfera de explosión
// 		this.scale.set(1);
// 		this.position.copyFrom(position);

// 		// Animación de expansión y desaparición
// 		new Tween(this.scale)
// 			.to({ x: 5, y: 5, z: 5 }, 500) // Aumenta de tamaño
// 			.onComplete(() => this.destroy()) // Se destruye al finalizar
// 			.start();
// 	}
// }
