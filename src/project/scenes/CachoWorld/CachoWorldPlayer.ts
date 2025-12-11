import { Vector2 } from "@dimforge/rapier2d";
import { Sprite, Text, TextStyle, Texture } from "pixi.js";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import type { Room } from "./Classes/Room";
import { PlayerStats } from "./Classes/PlayerStats";

export type Player = {
	playerId: string;
	username: string;
	seenMessages: Set<string>;
	showMessageAbove: (message: string) => void;
	removeMessage: () => void;
};

export class CachoWorldPlayer extends Sprite {
	public id: string;
	public speed: number = 0;
	public direction: number = 0;
	public animator: StateMachineAnimator;
	private messageText: Text | null = null;
	private shownMessages: Set<string> = new Set();
	public seenMessages: any;
	public currentRoom: Room | null = null;
	public stats: PlayerStats; // NEW: Player stats with HP

	constructor(id: string, x: number, y: number) {
		super(Sprite.from(Texture.WHITE).texture);
		this.id = id;
		this.anchor.set(0.5);
		this.x = x;
		this.y = y;

		this.seenMessages = new Set();

		// Initialize player stats
		this.stats = new PlayerStats(id, 10);
		this.addChild(this.stats.getHealthBarContainer());

		// Create animator
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
		this.addChild(this.animator);

		// Make sprite interactive for combat
		this.interactive = true;
		this.cursor = "pointer";
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

	public override destroy(_options?: any): void {
		// Clean up health bar
		if (this.stats) {
			this.removeChild(this.stats.getHealthBarContainer());
		}
		super.destroy(_options);
	}
}
