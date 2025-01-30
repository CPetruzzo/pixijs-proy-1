/* eslint-disable prettier/prettier */
import { PhysicsContainer3d } from "./3DPhysicsContainer";

export class GameObject extends PhysicsContainer3d {
	constructor(_name: string, asset: string) {
		super(asset);
	}
}
export class Player extends GameObject { }

export class Enemy extends GameObject { }

export class GameObjectFactory {
	public static createPlayer(name?: string): Player {
		switch (name) {
			case "futurecop":
				return new Player("Player", "futurecop");
			case "hands":
				return new Player("Player", "firstperson");
			default:
				return new Player("Player", "firstperson");
		}
	}

	public static createEnemy(): Enemy {
		return new Enemy("Enemy", "firstperson");
	}
}

// Uso
// const player = GameObjectFactory.createPlayer();
// const enemy = GameObjectFactory.createEnemy();
