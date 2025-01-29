import { Sprite, Texture } from "pixi.js";

export class Player {
	public sprite: Sprite;
	private speed: number;

	constructor(x: number, y: number, width: number, height: number) {
		this.sprite = Sprite.from(Texture.from("player.png"));
		this.sprite.x = x;
		this.sprite.y = y;
		this.sprite.width = width;
		this.sprite.height = height;

		this.speed = 3;
		this.initControls();
	}

	private initControls(): void {
		window.addEventListener("keydown", (e) => {
			switch (e.key) {
				case "ArrowUp":
					this.sprite.y -= this.speed;
					break;
				case "ArrowDown":
					this.sprite.y += this.speed;
					break;
				case "ArrowLeft":
					this.sprite.x -= this.speed;
					break;
				case "ArrowRight":
					this.sprite.x += this.speed;
					break;
			}
		});
	}
}
