/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle, Graphics, Texture } from "pixi.js";
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
	private comboText: Text;

	// Elementos de instrucciones toggleables
	private instructionsPanel: Container;
	private helpBtn: Container;

	private timeLeft = 180; // 3 minutos
	public static readonly BUNDLES = ["coffee"];
	private deliverBtn: Sprite;
	private trashCan: Sprite;

	private score = 0;
	private combo = 0;
	private hygieneScore = 100;
	private violations = 0;
	private gameOver = false;

	private feedbackMessages: Record<string, string> = {
		"station-dirty": "⚠️ ¡Estación sucia! Límpiala",
		"ingredient-spoiled": "⚠️ ¡Ingrediente podrido!",
		"temperature-abuse": "⚠️ ¡Pérdida de frío!",
		"order-complete": "✅ ¡Pedido servido!",
		"order-expired": "❌ ¡Cliente se fue!",
		"trash": "🗑️ Desechado",
	};

	private readonly STYLE_HUD = new TextStyle({
		fill: "#f4e4c2",
		fontFamily: '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
		fontSize: 34,
		fontWeight: "bolder",
		stroke: "#3f2b1d",
		strokeThickness: 5,
	});

	constructor() {
		super();
		this.addChild(this.gameContainer);
		this.addChild(this.uiTopRightContainer);
		this.addChild(this.uiLeftContainer);

		// Fondo
		const bg = Sprite.from("mock-up4");
		bg.anchor.set(0.5);
		this.gameContainer.addChild(bg);

		// Inicializar Manager de Pedidos
		this.orderMgr = new OrderManager(this.uiTopRightContainer);

		this.setupEvents();
		this.createStations();
		this.createIngredients();
		this.createTrashCan();
		this.createUI();

		if (DEBUG) {
			addGoToMenuButton(this);
		}
	}

	private setupEvents(): void {
		this.orderMgr.on("orderComplete", () => {
			this.combo++;
			const bonus = this.combo > 2 ? this.combo * 2 : 0;
			const points = 10 + bonus;
			this.score += points;

			this.updateScoreUI();
			this.showFeedback("order-complete");
			this.spawnFloatingText(`+${points} PTS`, 0, -200, 0x00FF00);
		});

		this.orderMgr.on("orderExpired", () => {
			this.combo = 0;
			this.violations++;
			this.hygieneScore = Math.max(0, this.hygieneScore - 10);
			this.updateHygieneUI();
			this.updateScoreUI();
			this.showFeedback("order-expired");
			this.spawnFloatingText("¡EXPIRADO!", 0, -200, 0xFF0000);
		});
	}

	private createStations(): void {
		const coffeeStation = new Station("café", 550, 15);
		const sandwichStation = new Station("sandwich", 480, 230);
		this.stations.push(coffeeStation, sandwichStation);
		this.stations.forEach((s) => this.gameContainer.addChild(s));
	}

	private createIngredients(): void {
		const ingKeys = ["jamon", "pan", "agua", "granos"];
		ingKeys.forEach((key, i) => {
			const ing = new Ingredient(key, -300 + i * 180, 400);
			this.ingredients.push(ing);
			this.gameContainer.addChild(ing);

			ing.on("hygieneviolation", (violationType: string) => {
				this.combo = 0;
				this.violations++;
				this.hygieneScore = Math.max(0, this.hygieneScore - 15);
				this.score = Math.max(0, this.score - 10);
				this.updateHygieneUI();
				this.updateScoreUI();
				this.showFeedback(violationType);
				this.spawnFloatingText("⚠️ VIOLACIÓN", ing.x, ing.y - 50, 0xFF0000);
			});

			ing.on("served", (stationType: string) => {
				if (this.orderMgr.tryServe(stationType, key)) {
					this.score += 10;
					if (this.hygieneScore >= 80) { this.score += 2; }
					this.spawnFloatingText("¡BIEN!", ing.x, ing.y - 50, 0xFFFF00);
				} else {
					this.score = Math.max(0, this.score - 5);
					this.spawnFloatingText("-5", ing.x, ing.y - 50, 0xFF6600);
				}
				this.updateScoreUI();
			});
		});
	}

	private createTrashCan(): void {
		this.trashCan = new Sprite(Texture.WHITE);
		this.trashCan.tint = 0x444444;
		this.trashCan.width = 120;
		this.trashCan.height = 150;
		this.trashCan.anchor.set(0.5);
		this.trashCan.position.set(650, 400);
		this.trashCan.interactive = true;
		this.trashCan.cursor = "pointer";

		const label = new Text("BASURA", { fill: "#FFFFFF", fontSize: 16, fontWeight: 'bold' });
		label.anchor.set(0.5);
		this.trashCan.addChild(label);

		this.trashCan.on("pointerdown", () => {
			this.showFeedback("trash");
			this.spawnFloatingText("LIMPIO", 650, 350, 0xAAAAAA);
		});

		this.gameContainer.addChild(this.trashCan);
	}

	private createUI(): void {
		this.scoreText = new Text("Puntaje: 0", this.STYLE_HUD);
		this.scoreText.position.set(-700, -450);

		this.timeText = new Text("Tiempo: 180", this.STYLE_HUD);
		this.timeText.position.set(-700, -380);

		this.hygieneScoreText = new Text("Higiene: 100%", { ...this.STYLE_HUD, fill: "#00FF00" });
		this.hygieneScoreText.position.set(-700, -310);

		this.violationsText = new Text("Violaciones: 0", this.STYLE_HUD);
		this.violationsText.position.set(-700, -240);

		this.comboText = new Text("", { ...this.STYLE_HUD, fill: "#FFD700", fontSize: 48 });
		this.comboText.anchor.set(0.5);
		this.comboText.position.set(0, -320);

		this.gameContainer.addChild(this.scoreText, this.timeText, this.hygieneScoreText, this.violationsText, this.comboText);

		this.feedbackText = new Text("", { ...this.STYLE_HUD, fontSize: 28 });
		this.feedbackText.anchor.set(0.5);
		this.feedbackText.position.set(0, -430);
		this.feedbackText.alpha = 0;
		this.gameContainer.addChild(this.feedbackText);

		// Botón Entregar
		this.deliverBtn = Sprite.from("ready");
		this.deliverBtn.anchor.set(0.5);
		this.deliverBtn.scale.set(0.25);
		this.deliverBtn.position.set(600, -360);
		this.deliverBtn.interactive = true;
		this.deliverBtn.cursor = "pointer";
		this.deliverBtn.on("pointerdown", () => this.orderMgr.deliverReady());
		this.uiTopRightContainer.addChild(this.deliverBtn);

		this.createInstructionsPanel();
	}

	private spawnFloatingText(msg: string, x: number, y: number, color: number): void {
		const txt = new Text(msg, { ...this.STYLE_HUD, fill: color, fontSize: 28 });
		txt.position.set(x, y);
		txt.anchor.set(0.5);
		this.gameContainer.addChild(txt);

		let elapsed = 0;
		const duration = 1000;
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const animate = (dt: number) => {
			elapsed += dt;
			txt.y -= 1.5;
			txt.alpha = 1 - (elapsed / duration);
			if (elapsed >= duration) {
				this.gameContainer.removeChild(txt);
			} else {
				setTimeout(() => animate(16), 16);
			}
		};
		animate(16);
	}

	private updateScoreUI(): void {
		this.scoreText.text = `Puntaje: ${this.score}`;
		this.comboText.text = this.combo > 1 ? `x${this.combo} Combo!` : "";

		this.scoreText.scale.set(1.3);
		if (this.combo > 1) {
			this.comboText.scale.set(1.5);
		}
	}

	private updateHygieneUI(): void {
		this.hygieneScoreText.text = `Higiene: ${this.hygieneScore}%`;
		this.violationsText.text = `Violaciones: ${this.violations}`;

		if (this.hygieneScore >= 80) { this.hygieneScoreText.style.fill = "#00FF00"; }
		else if (this.hygieneScore >= 50) { this.hygieneScoreText.style.fill = "#FFAA00"; }
		else { this.hygieneScoreText.style.fill = "#FF0000"; }

		if (this.hygieneScore <= 0) { this.endGame("¡Local clausurado por sanidad!"); }
	}

	private showFeedback(messageType: string): void {
		const message = this.feedbackMessages[messageType] || "";
		this.feedbackText.text = message;
		this.feedbackText.alpha = 1;

		setTimeout(() => {
			this.feedbackText.alpha = 0;
		}, 2500);
	}

	private createInstructionsPanel(): void {
		// 1. Botón de Ayuda (Trigger)
		this.helpBtn = new Container();
		const helpBg = new Graphics();
		helpBg.beginFill(0xFFD700);
		helpBg.drawCircle(0, 0, 30);
		helpBg.endFill();

		const helpIcon = new Text("?", { fill: "#3f2b1d", fontWeight: 'bold', fontSize: 32 });
		helpIcon.anchor.set(0.5);

		this.helpBtn.addChild(helpBg, helpIcon);
		this.helpBtn.position.set(-720, -170);
		this.helpBtn.interactive = true;
		this.helpBtn.cursor = "pointer";
		this.helpBtn.on("pointertap", () => this.toggleInstructions(true));
		this.uiLeftContainer.addChild(this.helpBtn);

		// 2. Panel de Instrucciones (Contenedor principal)
		this.instructionsPanel = new Container();
		this.instructionsPanel.visible = false; // Oculto por defecto
		this.uiLeftContainer.addChild(this.instructionsPanel);

		const panelBg = new Graphics();
		panelBg.beginFill(0x000000, 0.9);
		panelBg.drawRoundedRect(0, 0, 450, 380, 15);
		panelBg.endFill();
		panelBg.position.set(-750, -150);
		this.instructionsPanel.addChild(panelBg);

		// 3. Botón de Cerrar (X)
		const closeBtn = new Container();
		const closeBg = new Graphics();
		closeBg.beginFill(0xFF4444);
		closeBg.drawCircle(0, 0, 20);
		closeBg.endFill();

		const closeIcon = new Text("X", { fill: "#FFFFFF", fontWeight: 'bold', fontSize: 20 });
		closeIcon.anchor.set(0.5);

		closeBtn.addChild(closeBg, closeIcon);
		closeBtn.position.set(-320, -135); // Posición arriba a la derecha del panel
		closeBtn.interactive = true;
		closeBtn.cursor = "pointer";
		closeBtn.on("pointertap", () => this.toggleInstructions(false));
		this.instructionsPanel.addChild(closeBtn);

		// 4. Contenido del Manual
		const titleStyle = new TextStyle({ fill: "#FFD700", fontSize: 26, fontWeight: "bold" });
		const textStyle = new TextStyle({ fill: "#FFFFFF", fontSize: 18, wordWrap: true, wordWrapWidth: 400, lineHeight: 28 });

		const title = new Text("📋 MANUAL DE OPERACIÓN", titleStyle);
		title.position.set(-525, -120);
		title.anchor.set(0.5, 0);
		this.instructionsPanel.addChild(title);

		const content = new Text(
			"• Haz clic en estaciones para LIMPIARLAS.\n" +
			"• Usa la BASURA para descartar errores.\n" +
			"• Los COMBOS duplican tus puntos.\n" +
			"• Mantén la HIGIENE >80% para bonos.\n" +
			"• ¡Saca los pedidos antes que expiren!",
			textStyle
		);
		content.position.set(-730, -60);
		this.instructionsPanel.addChild(content);
	}

	private toggleInstructions(show: boolean): void {
		this.instructionsPanel.visible = show;
		this.helpBtn.visible = !show; // Ocultar el icono "?" cuando el panel está abierto
	}

	private endGame(reason: string): void {
		if (this.gameOver) { return; }
		this.gameOver = true;

		this.orderMgr.clearAllOrders();
		this.deliverBtn.interactive = false;
		this.deliverBtn.alpha = 0.5;

		const overlay = new Graphics();
		overlay.beginFill(0x000000, 0.9);
		overlay.drawRect(-1000, -1000, 2000, 2000);
		overlay.endFill();
		this.gameContainer.addChild(overlay);

		const endStyle = new TextStyle({ fill: "#FFFFFF", fontSize: 54, fontWeight: "bold", align: "center" });
		const resultText = new Text(
			`${reason}\n\n` +
			`Puntaje: ${this.score}\n` +
			`Higiene Final: ${this.hygieneScore}%\n` +
			`Errores: ${this.violations}`,
			endStyle
		);
		resultText.anchor.set(0.5);
		resultText.position.set(0, -50);
		overlay.addChild(resultText);

		let grade = "F - Clausurado";
		let color = "#FF0000";
		if (this.hygieneScore >= 90 && this.score > 200) { grade = "S - Chef Estrella"; color = "#00FFFF"; }
		else if (this.hygieneScore >= 80) { grade = "A - Excelente"; color = "#00FF00"; }
		else if (this.hygieneScore >= 60) { grade = "B - Aceptable"; color = "#FFFF00"; }
		else if (this.hygieneScore >= 40) { grade = "C - Necesita mejorar"; color = "#FFAA00"; }

		const gradeText = new Text(grade, { ...endStyle, fontSize: 42, fill: color });
		gradeText.anchor.set(0.5);
		gradeText.position.set(0, 180);
		overlay.addChild(gradeText);
	}

	public override update(dt: number): void {
		if (this.gameOver) { return; }

		this.timeLeft -= dt / 1000;
		this.timeText.text = `Tiempo: ${Math.max(0, Math.floor(this.timeLeft))}`;

		if (this.timeLeft < 30) {
			const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 1;
			this.timeText.scale.set(pulse);
			this.timeText.style.fill = "#FF0000";
		}

		if (this.scoreText.scale.x > 1) { this.scoreText.scale.set(this.scoreText.scale.x - 0.02); }
		if (this.comboText.scale.x > 1) { this.comboText.scale.set(this.comboText.scale.x - 0.02); }

		this.orderMgr.update(dt);
		this.ingredients.forEach((ing) => ing.update(dt));
		this.stations.forEach((s) => {
			s.update(dt);
			// @ts-ignore
			if (s.isDirty) {
				s.bg.tint = 0xFF8888;
			} else {
				s.bg.tint = 0xFFFFFF;
			}
		});

		if (this.timeLeft <= 0) { this.endGame("¡Tiempo agotado!"); }
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