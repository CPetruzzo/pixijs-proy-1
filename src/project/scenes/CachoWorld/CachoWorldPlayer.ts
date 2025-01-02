import { Vector2 } from "@dimforge/rapier2d";
import { Sprite, Text, TextStyle, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import type { Room } from "./Room";

export type Player = {
	playerId: string;
	username: string;
	seenMessages: Set<string>; // Usamos un Set para almacenar los mensajes vistos (usamos el contenido del mensaje como clave)
	showMessageAbove: (message: string) => void; // Método para mostrar el mensaje flotante
	removeMessage: () => void; // Método para eliminar el mensaje flotante
};

export class CachoWorldPlayer extends Sprite {
	public id: string;
	public speed: number = 0; // Propiedad adicional ejemplo
	public direction: number = 0; // Dirección de movimiento
	public animator: StateMachineAnimator; // StateMachineAnimator agregado
	private messageText: Text | null = null; // Texto para mostrar el mensaje
	private shownMessages: Set<string> = new Set();
	public seenMessages: any;
	public currentRoom: Room | null = null; // Add this property

	constructor(id: string, x: number, y: number) {
		super(Sprite.from(Texture.WHITE).texture);
		this.id = id;
		this.anchor.set(0.5); // Configura el punto de anclaje al centro
		this.x = x;
		this.y = y;

		this.seenMessages = new Set();

		// Crear instancia del StateMachineAnimator y configurarlo
		this.animator = new StateMachineAnimator();
		this.animator.addState(
			"idle",
			[Texture.from("idle0"), Texture.from("idle1"), Texture.from("idle2"), Texture.from("idle3"), Texture.from("idle4"), Texture.from("idle5")],
			0.1,
			true
		);
		this.animator.addState(
			"bouncing",
			[
				Texture.from("bouncing0"),
				Texture.from("bouncing1"),
				Texture.from("bouncing2"),
				Texture.from("bouncing3"),
				Texture.from("bouncing4"),
				Texture.from("bouncing5"),
				Texture.from("bouncing6"),
			],
			0.2,
			true
		);

		this.animator.playState("idle");
		this.animator.anchor.set(0.5);
		this.animator.scale.set(5);
		this.addChild(this.animator); // Agregar el animator como hijo del sprite
	}

	public shootHim(charge: { x: number; y: number }): void {
		const force = new Vector2(charge.x * 10, charge.y * 10);
		console.log(`Force applied: (${force.x}, ${force.y})`);
		this.x += force.x;
		this.y += force.y;

		this.animator.playState("bouncing");
	}

	public move(speed: number, angle: number): void {
		const dx = speed * Math.cos(angle);
		const dy = speed * Math.sin(angle);
		this.x += dx;
		this.y += dy;

		if (speed > 0 && this.animator.currentStateName !== "bouncing") {
			this.animator.playState("bouncing");
		} else if (speed === 0 && this.animator.currentStateName !== "idle") {
			this.animator.playState("idle");
		}
	}

	public update(_dt: number): void {
		this.animator.update(_dt * 5);
	}

	public showMessageAbove(message: string): void {
		if (this.seenMessages.has(message)) {
			console.log("Message already seen, not showing again.");
			return;
		}

		if (this.messageText) {
			this.removeChild(this.messageText);
			this.messageText.destroy();
		}

		const textStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 50,
			fill: "white",
		});

		this.messageText = new Text(message, textStyle);
		this.messageText.anchor.set(0.5);
		this.messageText.y = -50;
		this.addChild(this.messageText);

		this.seenMessages.add(message);

		setTimeout(() => {
			if (this.messageText) {
				this.removeChild(this.messageText);
				this.messageText.destroy();
				this.messageText = null;
			}
		}, 3000);
	}

	public removeMessage(): void {
		if (this.messageText) {
			this.removeChild(this.messageText);
			this.messageText.destroy();
			this.messageText = null;
		}
	}

	public clearShownMessages(): void {
		this.shownMessages.clear();
	}
}
