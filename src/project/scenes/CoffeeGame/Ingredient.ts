import { Sprite, Point, Graphics, Text, TextStyle } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { Station } from "./Station";

export class Ingredient extends Sprite {
	private dragging = false;
	private dragData: any;
	private homePos: Point;
	private hoverIndicator: Graphics;
	private isNearStation = false;
	private currentNearStation: Station | null = null;

	// Nuevas propiedades de seguridad alimentaria
	private temperature = 4; // °C (refrigerado)
	private requiresRefrigeration: boolean;
	private outOfFridgeTime = 0; // tiempo fuera del refrigerador
	private isSpoiled = false;
	private tempIndicator: Text;
	private warningIcon: Graphics;

	// Tiempos seguros (en segundos)
	private readonly MAX_OUT_TIME = 15; // 15 segundos máximo fuera
	private readonly DANGER_TEMP = 20; // °C zona peligro

	constructor(public key: string, x: number, y: number) {
		super(Sprite.from(`ing-${key}`).texture);
		this.anchor.set(0.5);
		this.position.set(x, y);
		this.homePos = new Point(x, y);
		this.eventMode = "static";
		this.scale.set(0.3);
		this.interactive = true;

		// Determinar si requiere refrigeración
		this.requiresRefrigeration = ["jamon", "queso", "leche"].includes(key);

		// Indicador de temperatura
		const style = new TextStyle({
			fill: "#FFFFFF",
			fontSize: 16,
			fontWeight: "bold",
			stroke: "#000000",
			strokeThickness: 3,
		});
		this.tempIndicator = new Text("", style);
		this.tempIndicator.anchor.set(0.5);
		this.tempIndicator.y = -50;
		this.tempIndicator.visible = this.requiresRefrigeration;
		this.addChild(this.tempIndicator);
		this.updateTempIndicator();

		// Icono de advertencia
		this.warningIcon = new Graphics();
		this.warningIcon.beginFill(0xff0000);
		this.warningIcon.moveTo(0, -15);
		this.warningIcon.lineTo(-13, 10);
		this.warningIcon.lineTo(13, 10);
		this.warningIcon.closePath();
		this.warningIcon.endFill();
		this.warningIcon.beginFill(0xffffff);
		this.warningIcon.drawCircle(0, 0, 3);
		this.warningIcon.endFill();
		this.warningIcon.y = 50;
		this.warningIcon.visible = false;
		this.addChild(this.warningIcon);

		// Indicador de proximidad
		this.hoverIndicator = new Graphics();
		this.hoverIndicator.beginFill(0x00ff00, 0.3);
		this.hoverIndicator.drawCircle(0, 0, 60);
		this.hoverIndicator.endFill();
		this.hoverIndicator.visible = false;
		this.addChild(this.hoverIndicator);

		this.on("pointerdown", (e) => {
			this.dragging = true;
			this.dragData = e.data;
		});
		this.on("pointerup", () => this.onDrop());
		this.on("pointerupoutside", () => this.onDrop());
	}

	private onDrop(): void {
		if (!this.dragging) {
			return;
		}
		this.dragging = false;
		this.resetVisualEffects();

		const parent = this.parent;

		for (const child of parent.children) {
			if (child instanceof Station) {
				const dx = this.position.x - child.position.x;
				const dy = this.position.y - child.position.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < 100) {
					// Verificar higiene de la estación
					if (!child.canUse()) {
						this.emit("hygieneviolation", "station-dirty");
						break;
					}

					// Verificar si el ingrediente está en mal estado
					if (this.isSpoiled) {
						this.emit("hygieneviolation", "ingredient-spoiled");
						break;
					}

					// Verificar temperatura si requiere refrigeración
					if (this.requiresRefrigeration && this.temperature > this.DANGER_TEMP) {
						this.emit("hygieneviolation", "temperature-abuse");
						break;
					}

					// Todo OK, usar la estación
					child.use();
					this.emit("served", child.type);
					break;
				}
			}
		}

		// Volver a casa
		new Tween(this).to({ x: this.homePos.x, y: this.homePos.y }, 300).easing(Easing.Quadratic.Out).start();
	}

	private checkProximityToStations(): void {
		if (!this.dragging) {
			return;
		}

		const parent = this.parent;
		let nearAnyStation = false;
		let closestStation: Station | null = null;
		let minDistance = Infinity;

		for (const child of parent.children) {
			if (child instanceof Station) {
				const dx = this.position.x - child.position.x;
				const dy = this.position.y - child.position.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < 120) {
					nearAnyStation = true;
					if (distance < minDistance) {
						minDistance = distance;
						closestStation = child;
					}
				}
			}
		}

		if (nearAnyStation && closestStation) {
			if (!this.isNearStation || this.currentNearStation !== closestStation) {
				this.showNearStationEffect(closestStation);
			}
		} else {
			if (this.isNearStation) {
				this.hideNearStationEffect();
			}
		}
	}

	private showNearStationEffect(station: Station): void {
		this.isNearStation = true;
		this.currentNearStation = station;

		// Color según el estado de la estación
		let color = 0x00ff00; // Verde por defecto
		if (!station.canUse()) {
			color = 0xff0000; // Rojo si está sucia
		} else if (!station.isHygienic()) {
			color = 0xffaa00; // Naranja si necesita limpieza pronto
		}

		this.hoverIndicator.clear();
		this.hoverIndicator.beginFill(color, 0.3);
		this.hoverIndicator.drawCircle(0, 0, 60);
		this.hoverIndicator.endFill();
		this.hoverIndicator.visible = true;

		new Tween(this.scale).to({ x: 0.35, y: 0.35 }, 200).easing(Easing.Quadratic.Out).start();

		// Tinte según estado
		if (!station.canUse() || this.isSpoiled) {
			this.tint = 0xff9999; // Rojo claro = problema
		} else {
			this.tint = 0xffff99; // Amarillo = OK
		}

		if (station.bg.tint === 0xffffff && station.canUse()) {
			station.bg.tint = 0x99ff99;
		}
	}

	private hideNearStationEffect(): void {
		this.isNearStation = false;

		if (this.currentNearStation && this.currentNearStation.bg.tint === 0x99ff99) {
			this.currentNearStation.bg.tint = 0xffffff;
		}
		this.currentNearStation = null;

		this.hoverIndicator.visible = false;
		new Tween(this.scale).to({ x: 0.3, y: 0.3 }, 200).easing(Easing.Quadratic.Out).start();
		this.tint = 0xffffff;
	}

	private resetVisualEffects(): void {
		this.hideNearStationEffect();
		this.scale.set(0.3);
		this.tint = 0xffffff;
	}

	private updateTempIndicator(): void {
		if (!this.requiresRefrigeration) {
			return;
		}

		this.tempIndicator.text = `${Math.round(this.temperature)}°C`;

		// Color según temperatura
		if (this.temperature <= 4) {
			this.tempIndicator.style.fill = "#00AAFF"; // Azul = frío
		} else if (this.temperature <= this.DANGER_TEMP) {
			this.tempIndicator.style.fill = "#FFAA00"; // Naranja = zona de riesgo
		} else {
			this.tempIndicator.style.fill = "#FF0000"; // Rojo = peligro
		}
	}

	public update(dt: number): void {
		if (this.dragging && this.dragData) {
			const newPos = this.dragData.getLocalPosition(this.parent);
			this.position.set(newPos.x, newPos.y);
			this.checkProximityToStations();

			// Aumentar temperatura si requiere refrigeración
			if (this.requiresRefrigeration) {
				this.outOfFridgeTime += dt / 1000;
				// Subir temperatura gradualmente
				this.temperature = Math.min(25, 4 + this.outOfFridgeTime * 1.5);
				this.updateTempIndicator();

				// Advertencia si pasa mucho tiempo
				if (this.outOfFridgeTime > this.MAX_OUT_TIME / 2) {
					this.warningIcon.visible = true;
					new Tween(this.warningIcon).to({ alpha: 0.3 }, 500).yoyo(true).repeat(Infinity).start();
				}

				// Marcar como echado a perder
				if (this.outOfFridgeTime > this.MAX_OUT_TIME) {
					this.isSpoiled = true;
					this.tint = 0x888888; // Gris = echado a perder
				}
			}
		} else if (this.requiresRefrigeration && !this.dragging) {
			// Enfriar cuando está en casa
			if (this.temperature > 4) {
				this.temperature = Math.max(4, this.temperature - dt / 500);
				this.updateTempIndicator();
			}

			// Resetear tiempo fuera
			if (this.outOfFridgeTime > 0) {
				this.outOfFridgeTime = Math.max(0, this.outOfFridgeTime - dt / 1000);
			}

			// Quitar advertencia
			if (this.outOfFridgeTime < this.MAX_OUT_TIME / 2) {
				this.warningIcon.visible = false;
			}
		}
	}

	public getIsSpoiled(): boolean {
		return this.isSpoiled;
	}

	public reset(): void {
		this.isSpoiled = false;
		this.temperature = 4;
		this.outOfFridgeTime = 0;
		this.warningIcon.visible = false;
		this.tint = 0xffffff;
		this.updateTempIndicator();
	}
}
