import type { Sprite } from "pixi.js";

export class CollisionManager {
	private colliders: Sprite[] = [];

	public addCollider(sprite: Sprite): void {
		this.colliders.push(sprite);
	}

	public checkCollisions(player: Sprite): void {
		this.colliders.forEach((collider) => {
			if (this.isColliding(player, collider)) {
				console.log("Collision detected!");
			}
		});
	}

	private isColliding(a: Sprite, b: Sprite): boolean {
		const ab = a.getBounds();
		const bb = b.getBounds();
		return ab.x + ab.width > bb.x && ab.x < bb.x + bb.width && ab.y + ab.height > bb.y && ab.y < bb.y + bb.height;
	}
}
