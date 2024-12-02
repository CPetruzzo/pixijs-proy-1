import { Graphics, Container } from "pixi.js";

export class Guitar extends Container {
	public strings: Graphics[];
	private frets: Graphics[];
	public stringWidth: number;
	public fretHeight: number;
	private gameContainer: Container = new Container();

	constructor() {
		super();
		this.strings = [];
		this.frets = [];
		this.stringWidth = 8;  // Ancho de cada cuerda
		this.fretHeight = 20; // Altura de cada traste
		this.createGuitar();
		this.addChild(this.gameContainer);
	}

	private createGuitar(): void {
		// Crea las cuerdas de la guitarra
		const numStrings = 6;  // La guitarra tiene 6 cuerdas
		for (let i = 0; i < numStrings; i++) {
			const string = new Graphics();
			string.beginFill(0x000000);  // Cuerda negra
			string.drawRect(0, i * 30, this.stringWidth, 2);  // Dibuja una línea representando la cuerda
			string.endFill();
			this.strings.push(string);
			this.gameContainer.addChild(string);
		}

		// Crea los trastes en el mástil de la guitarra
		const numFrets = 12;  // 12 trastes típicos en una guitarra
		for (let i = 1; i <= numFrets; i++) {
			const fret = new Graphics();
			fret.lineStyle(2, 0x000000, 1);  // Línea de traste
			fret.moveTo(i * 40, 0);  // Dibuja el traste en la posición correcta
			fret.lineTo(i * 40, 180);  // Longitud del traste
			this.frets.push(fret);
			this.gameContainer.addChild(fret);
		}
	}

	public touchString(stringIndex: number): void {
		// Lógica para detectar qué cuerda ha sido tocada
		if (stringIndex >= 0 && stringIndex < this.strings.length) {
			const string = this.strings[stringIndex];
			console.log(`Touched string: ${stringIndex + 1}`);
			// Aquí puedes agregar la lógica para hacer sonar la cuerda o cualquier otra interacción
			// Por ejemplo, puedes cambiar el color de la cuerda al ser tocada:
			string.beginFill(0xFF0000); // Cambia el color de la cuerda a rojo cuando se toca
			string.drawRect(0, stringIndex * 30, this.stringWidth, 2); // Redibuja la cuerda con el nuevo color
			string.endFill();
		}
	}

	public onResize(_newW: number, _newH: number): void {
		// Reajustamos el tamaño del mástil y las cuerdas al redimensionar la pantalla
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;

		const containerBounds = this.gameContainer.getLocalBounds();
		this.gameContainer.pivot.set(containerBounds.width * 0.5, containerBounds.height * 0.5);

		// Redimensionamos las cuerdas y trastes
		for (let i = 0; i < this.strings.length; i++) {
			this.strings[i].x = _newW * 0.1;
		}

		for (let i = 0; i < this.frets.length; i++) {
			this.frets[i].x = _newW * 0.1;
		}
	}
}
