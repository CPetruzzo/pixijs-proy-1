// TurnDisplay.ts
import { Container, Text, TextStyle, Graphics } from "pixi.js";
import { TurnSide } from "../Managers/TurnManager";

export class TurnDisplay extends Container {
	private text: Text;
	private bg: Graphics;

	constructor() {
		super();
		// Crear fondo semitransparente:
		this.bg = new Graphics();
		// Tamaño provisional; puedes ajustarlo o bien redimensionar dinámicamente
		this.bg.beginFill(0x000000, 0.5).drawRect(0, 0, 200, 30).endFill();
		this.addChild(this.bg);

		// Texto:
		const style = new TextStyle({
			fill: "#ffffff",
			fontSize: 18,
			fontWeight: "bold",
		});
		this.text = new Text("", style);
		// Lo colocamos con un pequeño padding
		this.text.x = 10;
		this.text.y = 5;
		this.addChild(this.text);

		// Por defecto oculto o vacío:
		this.update(TurnSide.ALLY);
	}

	/**
	 * Actualiza el texto según el lado actual.
	 * @param side TurnSide.ALLY o TurnSide.ENEMY
	 */
	public update(side: TurnSide): void {
		if (side === TurnSide.ALLY) {
			this.text.text = "Turno Aliado";
		} else {
			this.text.text = "Turno Enemigo";
		}
		// Ajustar ancho del fondo al ancho del texto + padding:
		const padding = 20;
		const w = this.text.width + padding;
		const h = this.bg.height; // 30, como definido
		this.bg.clear();
		this.bg.beginFill(0x000000, 0.5).drawRect(0, 0, w, h).endFill();
	}
}
