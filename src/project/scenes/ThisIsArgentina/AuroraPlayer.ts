import { Graphics, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { Timer } from "../../../engine/tweens/Timer";

export class Personaje extends StateMachineAnimator {
	public nombre: string;
	public clase: string;
	public hp: number;
	public hpMax: number;
	public fuerza: number;
	public defensa: number;
	public velocidad: number;
	public movimiento: number;
	public rangoAtaque: number;
	public canMove: boolean = true;
	public accionesRestantes: number;
	public aux: Graphics;
	public static readonly BUNDLES = ["fallrungame", "sfx"];

	constructor(nombre: string, clase: string, hpMax: number, fuerza: number, defensa: number, velocidad: number, movimiento: number, rangoAtaque: number) {
		super();

		this.nombre = nombre;
		this.clase = clase;
		this.hpMax = hpMax;
		this.hp = hpMax;
		this.fuerza = fuerza;
		this.defensa = defensa;
		this.velocidad = velocidad;
		this.movimiento = movimiento;
		this.rangoAtaque = rangoAtaque;
		this.accionesRestantes = 1;

		// Inicializa animaciones del personaje
		this.addState("idle", [Texture.from("player1"), Texture.from("player2")], 0.2, true);
		this.addState("move", [Texture.from("player2"), Texture.from("player3")], 0.2, true);
		this.playState("idle");

		// Crear área auxiliar de hitbox (por ejemplo)
		this.aux = new Graphics();
		this.aux.beginFill(0x0000ff, 0.05);
		this.aux.drawRect(-35, 50, 70, 100);
		this.aux.endFill();
		this.addChild(this.aux);
	}

	// Método para mover al personaje
	public mover(x: number, y: number): void {
		if (this.canMove && this.accionesRestantes > 0) {
			// Logica para mover la posición en el tablero
			this.position.set(x * 64, y * 64); // Ajustando la posición en píxeles, suponiendo celdas de 64x64
			this.playState("move");
			this.accionesRestantes -= 1; // Consume una acción al moverse

			// Luego de moverse, vuelve a idle
			new Timer()
				.to(500) // Espera 500ms antes de volver a idle
				.start()
				.onComplete(() => {
					this.playState("idle");
				});
		}
	}

	// Método para atacar a otro personaje
	public atacar(objetivo: Personaje): void {
		if (this.canMove && this.accionesRestantes > 0) {
			const distancia = this.calcularDistancia(objetivo);
			if (distancia <= this.rangoAtaque) {
				const danio = Math.max(0, this.fuerza - objetivo.defensa); // Calcular daño básico
				objetivo.recibirDanio(danio);
				this.accionesRestantes -= 1; // Consume una acción al atacar
			}
		}
	}

	// Método para recibir daño
	public recibirDanio(danio: number): void {
		this.hp = Math.max(0, this.hp - danio);
		if (this.hp === 0) {
			this.morir();
		}
	}

	// Método para manejar la muerte
	public morir(): void {
		this.playState("dead"); // Suponiendo que haya un estado de animación "dead"
		this.canMove = false; // Deshabilitar movimiento
	}

	// Método para calcular distancia con otro personaje
	public calcularDistancia(objetivo: Personaje): number {
		const dx = Math.abs(this.position.x - objetivo.position.x) / 64;
		const dy = Math.abs(this.position.y - objetivo.position.y) / 64;
		return dx + dy;
	}

	// Método para resetear acciones al finalizar el turno
	public terminarTurno(): void {
		this.accionesRestantes = 1;
	}

	// Método para detener el movimiento temporalmente (stun)
	public detenerMovimiento(): void {
		this.canMove = false;
		new Timer()
			.to(1000) // Tiempo de stun (1 segundo)
			.start()
			.onComplete(() => {
				this.canMove = true;
			});
	}
}
