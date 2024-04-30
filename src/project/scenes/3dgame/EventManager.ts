export interface Event {
	name: string;
}

export class EventManager {
	private listeners: { [eventName: string]: Function[] } = {};

	public subscribe(event_name: string, listener: Function) {
		if (!this.listeners[event_name]) {
			this.listeners[event_name] = [];
		}
		this.listeners[event_name].push(listener);
	}

	public notify(event: Event) {
		const event_name = event.name;
		if (this.listeners[event_name]) {
			this.listeners[event_name].forEach(listener => {
				listener(event);
			});
		}
	}
}

// Uso
// const eventManager = new EventManager();
// const collisionListener = new MazeCollisionListener();
// eventManager.subscribe("collision", collisionListener.notify.bind(collisionListener));
// eventManager.notify({ name: "collision" });
