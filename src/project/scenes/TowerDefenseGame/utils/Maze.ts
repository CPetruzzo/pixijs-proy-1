import type { Container } from "pixi.js";
import { Sprite } from "pixi.js";

export class Maze {
	// Dibuja el laberinto usando sprites en lugar de gráficos
	public static drawMazeWithSprites(grid: number[][], tileSize: number, container: Container): void {
		grid.forEach((row, y) => {
			row.forEach((cell, x) => {
				// Crear un sprite para la celda correspondiente
				let sprite: Sprite;

				if (cell === 1) {
					// Si es un obstáculo (1), usar la textura de la pared
					sprite = Sprite.from("path_to_wall_sprite"); // Reemplaza con el path a tu sprite de pared
				} else {
					// Si es un camino (0), usar la textura del camino
					sprite = Sprite.from("path_to_floor_sprite"); // Reemplaza con el path a tu sprite de camino
				}

				// Ajustar el tamaño y posición del sprite
				sprite.width = tileSize;
				sprite.height = tileSize;
				sprite.x = x * tileSize; // Colocamos el sprite en la posición correcta del grid
				sprite.y = y * tileSize;

				// Añadir el sprite al contenedor
				container.addChild(sprite);
			});
		});
	}
}
