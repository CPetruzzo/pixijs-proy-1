import { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { MINIMAP_WIDTH, MINIMAP_HEIGHT } from "../../../utils/constants";
import { Point3D } from "pixi3d/*";
import { cameraControl } from "../../..";

export class Minimap extends Container {
	private container: Container;
	private background: Graphics;
	public cameraIndicator: Graphics;

	constructor(container: Container) {
		super();
		this.container = container;
		this.createMinimap();
	}

	public createMinimap(): void {
		// Crear contenedor del minimapa
		this.container.width = MINIMAP_WIDTH;
		this.container.height = MINIMAP_HEIGHT;
		this.container.position.set(500, 500);
		this.container.scale.set(3);
		this.container.removeChildren();

		// Agregar fondo del minimapa
		this.background = new Graphics();
		this.background.beginFill(0xfff, 0.5);
		this.background.drawRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
		this.background.endFill();
		this.background.pivot.set(this.background.width / 2, this.background.height / 2);
		this.container.addChild(this.background);
	}

	/**
	 * Actualiza el minimapa con la posición de los objetos especificados.
	 * @param loliPosiciones Posiciones de los lolis en el minimapa.
	 * @param playerPosición Posición del jugador en el minimapa.
	 * @param dragonPosición Posición del dragón en el minimapa.
	 */
	public updateMiniMap(loliPosiciones: Point3D[], playerPosicion: Point3D, dragonPosicion: Point3D): void {
		// Limpiar el minimapa antes de actualizarlo
		this.container.removeChildren();

		// Volver a agregar el fondo del minimapa
		this.container.addChild(this.background);

		// Agregar marcadores para las lolis
		loliPosiciones.forEach((loliPosicion) => {
			this.addMiniMapMarker(loliPosicion, 0xff0000); // Marcador de loli en rojo
		});

		// Agregar marcador para el dragón
		this.addMiniMapMarker(dragonPosicion, 0x0000ff); // Marcador de dragón en azul

		// Agregar marcador para el jugador
		this.addMiniMapMarker(playerPosicion, 0x00ff00); // Marcador de jugador en verde
	}
	/**
	 * Agrega un marcador al minimapa para un objeto dado.
	 * @param object El objeto para el cual se agregará el marcador.
	 * @param color El color del marcador.
	 */
	private addMiniMapMarker(object: any, color: number): void {
		const marker = new Graphics();
		const objectX = object.x * (MINIMAP_WIDTH / this.container.width);
		const objectY = object.z * (MINIMAP_HEIGHT / this.container.height);

		// Verificar si el objeto está dentro de los límites del fondo del minimapa
		const isInsideBounds =
			objectX >= -this.background.width / 2 && objectX <= this.background.width / 2 && objectY >= -this.background.height / 2 && objectY <= this.background.height / 2;

		if (isInsideBounds) {
			marker.beginFill(color);
			marker.drawCircle(objectX, objectY, 4);
			marker.endFill();
			this.container.addChild(marker);
		}
	}

	public createCameraIndicator(): void {
		this.cameraIndicator = new Graphics();
		this.cameraIndicator.lineStyle(2, 0xffffff);
		this.cameraIndicator.moveTo(0, 0);
		this.cameraIndicator.lineTo(20, 0);
		this.container.addChild(this.cameraIndicator);
	}

	public updateCameraIndicator(): void {
		const rotationSpeed = -Math.PI / 180;

		const cameraDirection = new Point3D(1, 1, 1);

		cameraDirection.normalize();

		const indicatorX = cameraControl.target.x * (MINIMAP_WIDTH / this.container.width);
		const indicatorY = cameraControl.target.z * (MINIMAP_HEIGHT / this.container.height);
		const indicatorLength = 30;

		const indicatorEndX = indicatorX + cameraDirection.x * Math.cos(cameraControl.angles.y * rotationSpeed + Math.PI / 2) * indicatorLength;
		const indicatorEndY = indicatorY + cameraDirection.z * Math.sin(cameraControl.angles.y * rotationSpeed + Math.PI / 2) * indicatorLength;

		console.log("Indicator Coordinates:", indicatorX, indicatorY);
		console.log("Indicator End Coordinates:", indicatorEndX, indicatorEndY);
	}
}
