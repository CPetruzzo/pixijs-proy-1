import { Container, AnimatedSprite, Texture } from 'pixi.js';

export enum CitizenTypes {
	POLITICO = "POLITICO",
	CIUDADANO_MODERNO = "CIUDADANO_MODERNO",
	ABORIGEN = "ABORIGEN",
	MILITAR = "MILITAR",
	SOLDADO = "SOLDADO",
	REVOLUCIONARIO = "REVOLUCIONARIO"
	// PONELE DE EJEMPLO 
}

export class Citizen extends Container {
	private animatedSprite: AnimatedSprite;
	private _health: number;
	private _isInteractiveChar: boolean;

	constructor(texturePaths: string[], health: number, isInteractiveChar: boolean) {
		super();

		// Cargar las texturas para la animación
		const textures = texturePaths.map(path => Texture.from(path));

		// Crear el AnimatedSprite con las texturas
		this.animatedSprite = new AnimatedSprite(textures);

		this._health = health;
		this._isInteractiveChar = isInteractiveChar;

		// Agregar el AnimatedSprite al contenedor del personaje
		this.addChild(this.animatedSprite);

		// Configurar propiedades iniciales
		this.animatedSprite.anchor.set(0.5);
		this.animatedSprite.x = 0;
		this.animatedSprite.y = 0;
		this.animatedSprite.animationSpeed = 0.1; // Ajusta la velocidad de la animación

		if (this._isInteractiveChar) {
			this.setupInteractions();
		}

		// Iniciar la animación (puedes cambiar esto a una animación específica)
		this.animatedSprite.play();
	}

	// Mover el personaje a una posición específica
	moveTo(x: number, y: number): void {
		this.animatedSprite.x = x;
		this.animatedSprite.y = y;
	}

	// Obtener y establecer la salud del personaje
	get health(): number {
		return this._health;
	}

	set health(value: number) {
		this._health = value;
	}

	// Verificar si el personaje es interactivo
	get isInteractiveChar(): boolean {
		return this._isInteractiveChar;
	}

	set isInteractiveChar(value: boolean) {
		this._isInteractiveChar = value;
		if (value) {
			this.setupInteractions();
		} else {
			this.removeInteractions();
		}
	}

	// Configurar interacciones (clicks, etc.)
	private setupInteractions(): void {
		this.animatedSprite.interactive = true;
		this.animatedSprite.on('pointerdown', this.onInteract, this);
	}

	// Eliminar interacciones
	public removeInteractions(): void {
		this.animatedSprite.interactive = false;
		this.animatedSprite.off('pointerdown', this.onInteract, this);
	}

	// Manejar interacciones
	private onInteract(): void {
		console.log("Character interacted!");
		this.speak(); // Llama al método para hablar
	}

	// Método para hablar
	speak(): void {
		console.log("Character says: Hello!");
	}

	// Método para recibir daño
	takeDamage(amount: number): void {
		this._health -= amount;
		if (this._health <= 0) {
			this.die();
		}
	}

	// Método para manejar la muerte del personaje
	private die(): void {
		console.log("Character has died!");
		// Aquí podrías agregar lógica para eliminar al personaje, reproducir una animación de muerte, etc.
	}

	// Cambiar la animación a una animación específica
	changeAnimation(texturePaths: string[]): void {
		const textures = texturePaths.map(path => Texture.from(path));
		this.animatedSprite.textures = textures;
		this.animatedSprite.play();
	}
}
