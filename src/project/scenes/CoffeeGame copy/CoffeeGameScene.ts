import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { Ingredient } from "./Ingredient";
import { OrderManager } from "./OrderManager";
import { Station } from "./Station";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { addGoToMenuButton } from "../../../utils/GoToMenuButton";
import { DEBUG } from "../../../flags";

export class CoffeeShopScene extends PixiScene {
	private gameContainer = new Container();
	private uiTopRightContainer = new Container();

	private orderMgr: OrderManager;
	private stations: Station[] = [];
	private ingredients: Ingredient[] = [];

	private scoreText: Text;
	private timeText: Text;
	private timeLeft = 600; // segundos, por ejemplo
	public static readonly BUNDLES = ["coffee"];
	private deliverBtn: Sprite;

	constructor() {
		super();
		this.addChild(this.gameContainer);
		this.addChild(this.uiTopRightContainer);

		const bg = Sprite.from("mock-up");
		bg.anchor.set(0.5);
		this.gameContainer.addChild(bg);
		// así garantizas que NUNCA capture eventos de puntero:
		bg.interactive = false;
		bg.eventMode = "none";
		// 1) Instanciamos el OrderManager
		this.orderMgr = new OrderManager(this.uiTopRightContainer);

		// 2) escucho completado de pedido
		this.orderMgr.on("orderComplete", (_type: string) => {
			// aquí ya sé que el pedido quedó 100% servido
			this.score += 10;
			this.scoreText.text = `Puntaje: ${this.score}`;
		});
		this.orderMgr.on("orderReady", (type: string) => {
			// por ejemplo, habilitar un botón “Entregar” o
			// hacer que el cliente parpadee, etc.
			console.log(`Pedido de ${type} listo para entregar`);
		});

		// 2) Creamos estaciones
		const coffeeStation = new Station("café", 240, 220);
		const sandwichStation = new Station("sandwich", 480, 230);
		this.stations.push(coffeeStation, sandwichStation);
		this.stations.forEach((s) => this.gameContainer.addChild(s));

		// 3) Creamos ingredientes en el banco
		const ingKeys = ["jamon", "pan", "agua", "granos"];
		ingKeys.forEach((key, i) => {
			const ing = new Ingredient(key, -300 + i * 180, 400);
			this.ingredients.push(ing);
			this.gameContainer.addChild(ing);
			ing.on("served", (stationType: string) => {
				console.log(`Evento 'served' recibido: ${key} -> ${stationType}`);
				if (this.orderMgr.tryServe(stationType, key)) {
					console.log(`✅ Punto sumado! Puntaje: ${this.score + 10}`);
					this.score += 10;
				} else {
					console.log(`❌ Punto restado! Puntaje: ${this.score - 5}`);
					this.score -= 5;
				}
				// ¡Actualizo la UI!
				this.scoreText.text = `Puntaje: ${this.score}`;
			});
		});

		// 4) UI: puntaje y tiempo
		const style = new TextStyle({
			fill: "#f4e4c2",
			fontFamily: '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
			fontSize: 36,
			fontWeight: "bolder",
			stroke: "#3f2b1d",
			strokeThickness: 4,
		});

		this.scoreText = new Text("Puntaje: 0", style);
		this.scoreText.anchor.set(0, 0.5);
		this.scoreText.position.set(-700, -450);

		this.timeText = new Text("Tiempo: 300", style);
		this.timeText.anchor.set(0, 0.5);
		this.timeText.position.set(-700, -375);
		this.gameContainer.addChild(this.scoreText, this.timeText);

		// Botón “Entregar”
		this.deliverBtn = Sprite.from("ready"); // tu asset
		this.deliverBtn.anchor.set(0.5);
		this.deliverBtn.scale.set(0.2);
		this.deliverBtn.x = 600;
		this.deliverBtn.y = -360;
		this.deliverBtn.interactive = true;
		this.deliverBtn.cursor = "pointer";
		this.deliverBtn.on("pointerdown", () => {
			this.orderMgr.deliverReady(); // este método debe llamar internamente a removeOrder(0) y emitir orderComplete
		});
		this.uiTopRightContainer.addChild(this.deliverBtn);

		if (DEBUG) {
			addGoToMenuButton(this);
		}
	}

	private score = 0;

	public override update(dt: number): void {
		// Restar tiempo
		this.timeLeft -= dt / 1000;
		this.timeText.text = `Tiempo: ${Math.max(0, Math.floor(this.timeLeft))}`;
		// Generar nuevos pedidos
		this.orderMgr.update(dt);

		// Actualizar ingredientes (drag & drop)
		this.ingredients.forEach((ing) => ing.update(dt));

		// Fin de partida
		if (this.timeLeft <= 0) {
			// mostrar “Game Over” o cambiar escena
			console.log("¡Se acabó el tiempo! Puntaje final:", this.score);
		}

		super.update(dt);
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.gameContainer, _newW, _newH, 1536, 1024, ScaleHelper.FIT);
		this.gameContainer.x = _newW * 0.5;
		this.gameContainer.y = _newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.uiTopRightContainer, _newW, _newH, 1536, 1024, ScaleHelper.FIT);
		this.uiTopRightContainer.x = _newW * 0.5;
		this.uiTopRightContainer.y = _newH * 0.5;
	}
}
