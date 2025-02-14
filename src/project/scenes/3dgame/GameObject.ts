/* eslint-disable prettier/prettier */
import { PhysicsContainer3d } from "./3DPhysicsContainer";

export class GameObject extends PhysicsContainer3d {
	constructor(_name: string, asset: string) {
		super(asset);
	}
}

export class Player extends GameObject { }

export class Enemy extends GameObject { }

export class City extends GameObject { }

export class Fire extends GameObject { }

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

	public static createCity(): City {
		return new City("City", "cyberpunk_city");
	}

	public static createFire(): Fire {
		return new Fire("Fire", "fire");
	}
}

// Uso
// const player = GameObjectFactory.createPlayer();
// const enemy = GameObjectFactory.createEnemy();
