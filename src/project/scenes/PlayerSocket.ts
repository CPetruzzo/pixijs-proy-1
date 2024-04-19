export class Player {
	public socketId: string;
	public speed: number;
	public angleVelocity: number;
	public position: { x: number; y: number }; // Asumiendo que la posición es un objeto con propiedades x e y

	constructor(socketId: string) {
		this.socketId = socketId;
		this.speed = 0;
		this.angleVelocity = 0;
		this.position = { x: 0, y: 0 }; // Inicializar la posición en algún valor por defecto
	}
}
