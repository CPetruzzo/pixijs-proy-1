/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Manager } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Personaje } from "./AuroraPlayer";

export class GameScene extends PixiScene {
	private heroe: Personaje;
	private enemigo: Personaje;
	public static readonly BUNDLES = ["fallrungame", "sfx"];

	constructor() {
		super();
		this.createScene();
	}

	private createScene(): void {
		// Crear al héroe
		this.heroe = new Personaje("Héroe", "Guerrero", 100, 15, 10, 5, 3, 1);
		console.log("this.heroe", this.heroe);
		this.heroe.x = Manager.width * 0.3; // Posicionar en un lugar de la pantalla
		this.heroe.y = Manager.height * 0.5;
		this.addChild(this.heroe);

		// Crear al enemigo
		this.enemigo = new Personaje("Enemigo", "Orco", 80, 12, 8, 4, 3, 1);
		console.log("this.enemigo", this.enemigo);
		this.enemigo.x = Manager.width * 0.7; // Posicionar en otro lugar
		this.enemigo.y = Manager.height * 0.5;
		this.addChild(this.enemigo);
	}

	public override update(_dt: number): void {
		// Aquí se puede manejar la lógica de actualización, por ejemplo, movimiento o ataques
		// Si quisieras que los personajes se muevan en cada frame podrías aplicar lógica aquí

		// Ejemplo de lógica básica para mover al héroe hacia el enemigo (dependiendo de condiciones)
		if (this.heroe.canMove) {
			// Aquí podrías implementar lógica de IA o movimiento
			// Por ejemplo, mover al héroe hacia el enemigo
			const distancia = this.heroe.calcularDistancia(this.enemigo);

			if (distancia > this.heroe.rangoAtaque) {
				// Si el enemigo está fuera del rango de ataque, mover el héroe
				this.heroe.mover(this.heroe.x + 1, this.heroe.y); // Mueve al héroe en el eje X
			} else {
				// Si el enemigo está en rango, atacar
				this.heroe.atacar(this.enemigo);
			}
		}
	}
}
