/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle, Graphics } from "pixi.js";
import { Ingredient } from "./Ingredient";
import { OrderManager } from "./OrderManager";
import { Station } from "./Station";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { addGoToMenuButton } from "../../../utils/GoToMenuButton";
import { DEBUG } from "../../../flags";

export class CoffeeShopScene extends PixiScene {
	private gameContainer = new Container();
	private uiTopRightContainer = new Container();
	private uiLeftContainer = new Container();

	private orderMgr: OrderManager;
	private stations: Station[] = [];
	private ingredients: Ingredient[] = [];

	private scoreText: Text;
	private timeText: Text;
	private hygieneScoreText: Text;
	private violationsText: Text;
	private feedbackText: Text;

	private timeLeft = 10; // 3 minutos
	public static readonly BUNDLES = ["coffee"];
	private deliverBtn: Sprite;

	private score = 0;
	private hygieneScore = 100;
	private violations = 0;
	private gameOver = false;

	private feedbackMessages: Record<string, string> = {
		"station-dirty": "⚠️ ¡Estación sucia! Límpiala antes de usar",
		"ingredient-spoiled": "⚠️ ¡Ingrediente en mal estado! No lo uses",
		"temperature-abuse": "⚠️ ¡Temperatura inadecuada! Mantén refrigerados",
		"order-complete": "✅ ¡Pedido entregado correctamente!",
		"order-expired": "❌ ¡Se venció un pedido!",
	};

	constructor() {
		super();
		this.addChild(this.gameContainer);
		this.addChild(this.uiTopRightContainer);
		this.addChild(this.uiLeftContainer);

		const bg = Sprite.from("mock-up4");
		bg.anchor.set(0.5);
		this.gameContainer.addChild(bg);
		bg.interactive = false;
		bg.eventMode = "none";

		// OrderManager
		this.orderMgr = new OrderManager(this.uiTopRightContainer);

		this.orderMgr.on("orderComplete", (_type: string) => {
			this.score += 10;
			this.scoreText.text = `Puntaje: ${this.score}`;
			this.showFeedback("order-complete");
		});

		this.orderMgr.on("orderReady", (type: string) => {
			console.log(`Pedido de ${type} listo para entregar`);
		});

		this.orderMgr.on("orderExpired", () => {
			this.violations++;
			this.hygieneScore = Math.max(0, this.hygieneScore - 10);
			this.updateHygieneUI();
			this.showFeedback("order-expired");
		});

		// Estaciones
		const coffeeStation = new Station("café", 550, 15);
		const sandwichStation = new Station("sandwich", 480, 230);
		this.stations.push(coffeeStation, sandwichStation);
		this.stations.forEach((s) => this.gameContainer.addChild(s));

		// Ingredientes
		const ingKeys = ["jamon", "pan", "agua", "granos"];
		ingKeys.forEach((key, i) => {
			const ing = new Ingredient(key, -300 + i * 180, 400);
			this.ingredients.push(ing);
			this.gameContainer.addChild(ing);

			// Manejar violaciones de higiene
			ing.on("hygieneviolation", (violationType: string) => {
				console.log(`⚠️ Violación de higiene: ${violationType}`);
				this.violations++;
				this.hygieneScore = Math.max(0, this.hygieneScore - 15);
				this.score = Math.max(0, this.score - 10);
				this.updateHygieneUI();
				this.scoreText.text = `Puntaje: ${this.score}`;
				this.showFeedback(violationType);
			});

			ing.on("served", (stationType: string) => {
				console.log(`Ingrediente servido: ${key} -> ${stationType}`);
				if (this.orderMgr.tryServe(stationType, key)) {
					console.log(`✅ Punto sumado! Puntaje: ${this.score + 10}`);
					this.score += 10;
					// Bonus por buenas prácticas
					if (this.hygieneScore >= 80) {
						this.score += 2;
					}
				} else {
					console.log(`❌ Ingrediente incorrecto`);
					this.score = Math.max(0, this.score - 5);
				}
				this.scoreText.text = `Puntaje: ${this.score}`;
			});
		});

		// UI: estilos
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

		this.timeText = new Text("Tiempo: 180", style);
		this.timeText.anchor.set(0, 0.5);
		this.timeText.position.set(-700, -375);

		this.hygieneScoreText = new Text("Higiene: 100%", { ...style, fill: "#00FF00" });
		this.hygieneScoreText.anchor.set(0, 0.5);
		this.hygieneScoreText.position.set(-700, -300);

		this.violationsText = new Text("Violaciones: 0", style);
		this.violationsText.anchor.set(0, 0.5);
		this.violationsText.position.set(-700, -225);

		this.gameContainer.addChild(this.scoreText, this.timeText, this.hygieneScoreText, this.violationsText);

		// Feedback text
		this.feedbackText = new Text("", {
			...style,
			fontSize: 28,
		});
		this.feedbackText.anchor.set(0.5);
		this.feedbackText.position.set(0, -450);
		this.feedbackText.alpha = 0;
		this.gameContainer.addChild(this.feedbackText);

		// Botón "Entregar"
		this.deliverBtn = Sprite.from("ready");
		this.deliverBtn.anchor.set(0.5);
		this.deliverBtn.scale.set(0.2);
		this.deliverBtn.x = 600;
		this.deliverBtn.y = -360;
		this.deliverBtn.interactive = true;
		this.deliverBtn.cursor = "pointer";
		this.deliverBtn.on("pointerdown", () => {
			this.orderMgr.deliverReady();
		});
		this.uiTopRightContainer.addChild(this.deliverBtn);

		// Panel de instrucciones
		this.createInstructionsPanel();

		if (DEBUG) {
			addGoToMenuButton(this);
		}
	}

	private createInstructionsPanel(): void {
		const panel = new Graphics();
		panel.beginFill(0x000000, 0.7);
		panel.drawRoundedRect(0, 0, 400, 350, 10);
		panel.endFill();
		panel.position.set(-750, 50);
		this.uiLeftContainer.addChild(panel);

		const titleStyle = new TextStyle({
			fill: "#FFD700",
			fontSize: 24,
			fontWeight: "bold",
		});

		const textStyle = new TextStyle({
			fill: "#FFFFFF",
			fontSize: 16,
			wordWrap: true,
			wordWrapWidth: 380,
			lineHeight: 22,
		});

		const title = new Text("📋 BUENAS PRÁCTICAS", titleStyle);
		title.position.set(200, 20);
		title.anchor.set(0.5, 0);
		panel.addChild(title);

		const instructions = new Text(
			"• Mantén las estaciones limpias\n" +
			"• Haz clic en las estaciones para limpiarlas\n" +
			"• Los ingredientes refrigerados se calientan\n" +
			"• No uses ingredientes en mal estado\n" +
			"• Completa pedidos rápido y con higiene\n" +
			"• Bonus: +2 puntos con higiene >80%",
			textStyle
		);
		instructions.position.set(20, 60);
		panel.addChild(instructions);
	}

	private updateHygieneUI(): void {
		this.hygieneScoreText.text = `Higiene: ${this.hygieneScore}%`;
		this.violationsText.text = `Violaciones: ${this.violations}`;

		// Cambiar color según nivel de higiene
		if (this.hygieneScore >= 80) {
			this.hygieneScoreText.style.fill = "#00FF00"; // Verde
		} else if (this.hygieneScore >= 50) {
			this.hygieneScoreText.style.fill = "#FFAA00"; // Naranja
		} else {
			this.hygieneScoreText.style.fill = "#FF0000"; // Rojo
		}

		// Game over por higiene muy baja
		if (this.hygieneScore <= 0) {
			this.endGame("Perdiste por violaciones de higiene");
		}
	}

	private showFeedback(messageType: string): void {
		// @types
		const message = this.feedbackMessages[messageType] || "";
		this.feedbackText.text = message;
		this.feedbackText.alpha = 1;

		// Fade out después de 2 segundos
		setTimeout(() => {
			let alpha = 1;
			const fadeInterval = setInterval(() => {
				alpha -= 0.05;
				this.feedbackText.alpha = alpha;
				if (alpha <= 0) {
					clearInterval(fadeInterval);
				}
			}, 50);
		}, 2000);
	}

	private endGame(reason: string): void {
		if (this.gameOver) {
			return;
		}
		this.gameOver = true;

		// Limpiar todos los pedidos (clientes y burbujas)
		this.orderMgr.clearAllOrders();

		// Bloquear el botón de entregar
		this.deliverBtn.interactive = false;
		this.deliverBtn.alpha = 0.5;

		// Crear overlay sobre el contenedor principal
		const overlay = new Graphics();
		overlay.beginFill(0x000000, 0.8);
		overlay.drawRect(-1000, -1000, 2000, 2000);
		overlay.endFill();
		this.gameContainer.addChild(overlay);

		// Texto de fin de juego
		const endStyle = new TextStyle({
			fill: "#FFFFFF",
			fontSize: 48,
			fontWeight: "bold",
			align: "center",
		});

		const endText = new Text(`${reason}\n\n` + `Puntaje Final: ${this.score}\n` + `Higiene: ${this.hygieneScore}%\n` + `Violaciones: ${this.violations}`, endStyle);
		endText.anchor.set(0.5);
		endText.position.set(0, -100);
		overlay.addChild(endText);

		// Evaluación final
		let grade = "D - Necesitas más práctica";
		if (this.hygieneScore >= 80 && this.violations < 3) {
			grade = "A - ¡Excelente trabajo!";
		} else if (this.hygieneScore >= 60 && this.violations < 5) {
			grade = "B - Buen trabajo";
		} else if (this.hygieneScore >= 40) {
			grade = "C - Regular";
		}

		const gradeText = new Text(grade, { ...endStyle, fontSize: 36, fill: "#FFD700" });
		gradeText.anchor.set(0.5);
		gradeText.position.set(0, 100);
		overlay.addChild(gradeText);
	}

	public override update(dt: number): void {
		if (this.gameOver) {
			return;
		}

		// Restar tiempo
		this.timeLeft -= dt / 1000;
		this.timeText.text = `Tiempo: ${Math.max(0, Math.floor(this.timeLeft))}`;

		// Actualizar order manager
		this.orderMgr.update(dt);

		// Actualizar ingredientes
		this.ingredients.forEach((ing) => ing.update(dt));

		// Actualizar estaciones
		this.stations.forEach((s) => s.update(dt));

		// Fin de partida
		if (this.timeLeft <= 0) {
			this.endGame("¡Tiempo terminado!");
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

		ScaleHelper.setScaleRelativeToIdeal(this.uiLeftContainer, _newW, _newH, 1536, 1024, ScaleHelper.FIT);
		this.uiLeftContainer.x = _newW * 0.5;
		this.uiLeftContainer.y = _newH * 0.5;
	}
}
