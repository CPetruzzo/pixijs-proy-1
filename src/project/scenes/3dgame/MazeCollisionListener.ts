import { Event } from "./EventManager";

export class MazeCollisionListener {
	notify(event: Event) {
		console.log(`Se ha producido una colisión en el laberinto: ${event.name}`);
	}
}
