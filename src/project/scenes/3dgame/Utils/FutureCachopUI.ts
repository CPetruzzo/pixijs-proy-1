import { Container, Graphics, Sprite } from "pixi.js";
import type { PhysicsContainer3d } from "../3DPhysicsContainer";

export class FutureCachopUI extends Container {
	public healthBarContainer: Container = new Container();
	public bottomRightContainer: Container = new Container();
	public aimContainer: Container = new Container();
	public pointerShotFired: boolean = false;
	private aiming: boolean = false; // Nuevo flag para el estado aim

	constructor() {
		super();

		this.createLocalUI();
		this.createShootingButton();
		this.createAimButton();
	}

	private onPointerTap(): void {
		// Cuando se detecta un pointertap, se activa la bandera
		this.pointerShotFired = true;
	}

	private createAimButton(): void {
		this.addChild(this.aimContainer);
		const button = Sprite.from("aimbutton");
		button.anchor.set(0.5);
		button.alpha = 0.5;
		this.aimContainer.interactive = true;
		this.aimContainer.eventMode = "static";
		this.aimContainer.addChild(button);

		this.aimContainer.zIndex = 2000;
		// Al hacer click, se alterna el estado de aim y se emite un evento personalizado.
		this.aimContainer.on("pointerdown", () => {
			this.aiming = !this.aiming;
			// Emitir un evento "aimToggled" con el estado actual
			this.emit("aimToggled", this.aiming);
		});
	}

	private createShootingButton(): void {
		// UI SHOOTING CONTAINER
		this.addChild(this.bottomRightContainer);
		const button = Sprite.from("shootbutton");
		button.anchor.set(0.5);
		button.alpha = 0.5;
		this.bottomRightContainer.interactive = true;
		this.bottomRightContainer.addChild(button);
		this.bottomRightContainer.eventMode = "static";
		this.bottomRightContainer.on("pointerdown", this.onPointerTap.bind(this));
	}

	private createLocalUI(): void {
		this.addChild(this.healthBarContainer);
		// UI HEALTH BAR CONTAINER
		const bgBar = new Graphics();
		bgBar.beginFill(0x555555);
		bgBar.drawRect(0, 0, 100, 20);
		bgBar.endFill();
		this.healthBarContainer.addChild(bgBar);

		const healthBar = new Graphics();
		healthBar.name = "healthBar";
		healthBar.beginFill(0x00ff00);
		healthBar.drawRect(0, 0, 100, 20);
		healthBar.endFill();
		this.healthBarContainer.addChild(healthBar);
	}

	public updateLocalUI(player: PhysicsContainer3d & { hp?: number }): void {
		// Busca la barra de salud dentro de healthBarContainer
		const healthBar: Graphics = this.healthBarContainer.getChildByName("healthBar");
		if (healthBar) {
			const newWidth = Math.max(0, player.hp ?? 0);
			// console.log(`Actualizando barra de vida: ${newWidth} HP`);
			healthBar.clear();
			healthBar.beginFill(0x00ff00);
			healthBar.drawRect(0, 0, newWidth, 20);
			healthBar.endFill();
		}
	}
}
