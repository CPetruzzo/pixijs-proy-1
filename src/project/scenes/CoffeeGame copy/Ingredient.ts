import { Sprite, Point, Graphics } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { Station } from "./Station";

export class Ingredient extends Sprite {
	private dragging = false;
	private dragData: any;
	private homePos: Point;
	private hoverIndicator: Graphics; // Indicador visual
	private isNearStation = false;
	private currentNearStation: Station | null = null;

	constructor(public key: string, x: number, y: number) {
		super(Sprite.from(`ing-${key}`).texture);
		this.anchor.set(0.5);
		this.position.set(x, y);
		this.homePos = new Point(x, y);
		this.eventMode = "static";
		this.scale.set(0.3);
		this.interactive = true;

		// Crear indicador visual (círculo verde que aparece cuando está cerca)
		this.hoverIndicator = new Graphics();
		this.hoverIndicator.beginFill(0x00ff00, 0.3); // Verde semi-transparente
		this.hoverIndicator.drawCircle(0, 0, 60); // Radio de 60px
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

		// Resetear efectos visuales
		this.resetVisualEffects();

		const parent = this.parent;
		for (const child of parent.children) {
			if (child instanceof Station) {
				const dx = this.position.x - child.position.x;
				const dy = this.position.y - child.position.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < 100) {
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
					// Un poco más de rango para el feedback
					nearAnyStation = true;
					if (distance < minDistance) {
						minDistance = distance;
						closestStation = child;
					}
				}
			}
		}

		// Actualizar efectos visuales basado en proximidad
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

		// Mostrar indicador circular
		this.hoverIndicator.visible = true;

		// Efecto de escala en el ingrediente
		new Tween(this.scale).to({ x: 0.35, y: 0.35 }, 200).easing(Easing.Quadratic.Out).start();

		// Efecto de brillo/tinte
		this.tint = 0xffff99; // Amarillo claro

		// Opcional: Efecto en la estación también
		if (station.bg.tint === 0xffffff) {
			// Solo si no tiene tinte ya
			station.bg.tint = 0x99ff99; // Verde claro
		}
	}

	private hideNearStationEffect(): void {
		this.isNearStation = false;

		// Restaurar estación anterior si existe
		if (this.currentNearStation && this.currentNearStation.bg.tint === 0x99ff99) {
			this.currentNearStation.bg.tint = 0xffffff;
		}
		this.currentNearStation = null;

		// Ocultar indicador
		this.hoverIndicator.visible = false;

		// Restaurar escala normal
		new Tween(this.scale).to({ x: 0.3, y: 0.3 }, 200).easing(Easing.Quadratic.Out).start();

		// Restaurar color normal
		this.tint = 0xffffff;
	}

	private resetVisualEffects(): void {
		// Limpiar todos los efectos cuando se suelta
		this.hideNearStationEffect();

		// Restaurar escala inmediatamente (sin animación)
		this.scale.set(0.3);
		this.tint = 0xffffff;
	}

	public update(_dt: number): void {
		if (this.dragging && this.dragData) {
			const newPos = this.dragData.getLocalPosition(this.parent);
			this.position.set(newPos.x, newPos.y);

			// Verificar proximidad mientras arrastramos
			this.checkProximityToStations();
		}
	}
}
