// /* eslint-disable @typescript-eslint/explicit-function-return-type */
// /* eslint-disable @typescript-eslint/naming-convention */
// /* eslint-disable @typescript-eslint/restrict-template-expressions */
// import { Container, Graphics, Text, BlurFilter, Sprite } from "pixi.js";
// import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
// import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
// import { Easing, Tween } from "tweedle.js";

// type PlayerRole = "BRIGADISTA" | "POLITICO_BUENO" | "CIUDADANO";

// export class GameplayScene extends PixiScene {
// 	public static readonly BUNDLES = ["patagonia"];

// 	private worldContainer: Container = new Container();
// 	private boardContainer: Container = new Container();
// 	private cardsContainer: Container = new Container();
// 	private playersContainer: Container = new Container();
// 	private uiContainer: Container = new Container();
// 	private overlayContainer: Container = new Container();

// 	// Estado del Juego
// 	private playerRole: PlayerRole | null = null;
// 	private isPoliticoBuenoPresent: boolean = false;
// 	private hectareasQuemadas: number = 40000;
// 	private hectareasMax: number = 100000;
// 	private isPlayerTurn: boolean = false;
// 	private selectedFireNode: Container | null = null;

// 	// Contadores
// 	private evidencePoints: number = 0;
// 	private visibilityScore: number = 0; // Conciencia Social 0 - 100
// 	private cardsToDrawBase: number = 2;

// 	// Estados Globales
// 	private cardsToDrawNextTurn: number = 2;
// 	private isPoliticoMaloBlocked: boolean = false;
// 	private isInmobiliariaBlocked: boolean = false;
// 	private weatherEffect: "NORMAL" | "VIENTO" | "LLUVIA" = "NORMAL";

// 	// UI
// 	private hectareasText: Text;
// 	private visibilityText: Text;
// 	private objectiveText: Text;
// 	private turnStatusText: Text;
// 	private weatherText: Text;
// 	private fireStatusBar: Graphics;

// 	constructor() {
// 		super();
// 		this.addChild(this.worldContainer);
// 		const tableBackground = new Graphics().beginFill(0x1a1108).drawRect(-1024, -1536, 2048, 3072).endFill();
// 		this.worldContainer.addChild(tableBackground, this.boardContainer, this.playersContainer, this.cardsContainer, this.uiContainer, this.overlayContainer);

// 		this.setupBoard();
// 		this.setupPlayers();
// 		this.setupUI();
// 		this.showRoleSelection();

// 		setInterval(() => {
// 			if (this.playerRole) {
// 				const activeFocos = this.boardContainer.children.length - 1;
// 				if (activeFocos > 0) {
// 					const modifier = this.weatherEffect === "VIENTO" ? 2.5 : this.weatherEffect === "LLUVIA" ? 0.2 : 1;
// 					this.spreadFire(85 * activeFocos * modifier);
// 				}
// 			}
// 		}, 3000);
// 	}

// 	// --- SELECCIÓN DE ROL ---

// 	private showRoleSelection(): void {
// 		const bg = new Graphics().beginFill(0x000000, 0.9).drawRect(-1024, -1536, 2048, 3072).endFill();
// 		this.overlayContainer.addChild(bg);
// 		const title = new Text("PATAGONIA: EL NEGOCIO DEL FUEGO", {
// 			fill: 0xffffff,
// 			fontSize: 42,
// 			fontWeight: "bold",
// 			align: "center",
// 			dropShadow: true,
// 			dropShadowBlur: 10,
// 		});
// 		title.anchor.set(0.5);
// 		title.y = -450;
// 		this.overlayContainer.addChild(title);

// 		const roles: { id: PlayerRole; title: string; desc: string; color: number }[] = [
// 			{ id: "BRIGADISTA", title: "BRIGADISTA", desc: "Objetivo: Detener el fuego.\nIA: Ciudadanos y Políticos Éticos te apoyan.", color: 0xe67e22 },
// 			{ id: "POLITICO_BUENO", title: "POLÍTICO ÉTICO", desc: "Objetivo: 5 pruebas de corrupción.\nIA: Brigadistas y Ciudadanos accionan.", color: 0x3498db },
// 			{ id: "CIUDADANO", title: "CIUDADANO", desc: "Objetivo: 100% Conciencia Social.\nIA: Brigadistas luchan, el Político investiga.", color: 0x2ecc71 },
// 		];

// 		roles.forEach((role, i) => {
// 			const card = new Container();
// 			const rect = new Graphics().beginFill(role.color, 0.8).lineStyle(4, 0xffffff).drawRoundedRect(-250, -100, 500, 160, 20).endFill();
// 			const txt = new Text(role.title, { fill: 0xffffff, fontSize: 24, fontWeight: "bold" });
// 			const sub = new Text(role.desc, { fill: 0xffffff, fontSize: 16, align: "center" });
// 			txt.anchor.set(0.5, 1);
// 			sub.anchor.set(0.5, 0);
// 			card.addChild(rect, txt, sub);
// 			card.y = -150 + i * 220;
// 			card.eventMode = "static";
// 			card.cursor = "pointer";
// 			card.on("pointertap", () => this.startGameAs(role.id));
// 			this.overlayContainer.addChild(card);
// 		});
// 	}

// 	private startGameAs(role: PlayerRole): void {
// 		this.playerRole = role;
// 		this.isPoliticoBuenoPresent = Math.random() > 0.3 || role === "POLITICO_BUENO";
// 		this.isPlayerTurn = true;
// 		this.overlayContainer.visible = false;
// 		this.objectiveText.text = `OBJETIVO: ${this.getObjectiveText()}`;
// 		this.replenishHand(4);
// 		this.updateVisibilityUI();
// 		this.showFloatingText(`MODO ${role} INICIADO`, 0, -200, 0xffffff);
// 	}

// 	// --- TURNO DE LAS IA ---

// 	private async processIATurns(): Promise<void> {
// 		this.showTurnStatus("EL MUNDO ESTÁ ACCIONANDO...", 0xffffff);
// 		await this.wait(1000);

// 		const rndWeather = Math.random();
// 		if (rndWeather < 0.3) {
// 			this.weatherEffect = "LLUVIA";
// 			this.applyWeatherEffect();
// 			this.showFloatingText("⛈️ LLUVIAS", 0, 0, 0x3498db);
// 		} else if (rndWeather < 0.6) {
// 			this.weatherEffect = "VIENTO";
// 			this.showFloatingText("🌬️ VIENTOS FUERTES", 0, 0, 0xe74c3c);
// 		} else {
// 			this.weatherEffect = "NORMAL";
// 		}
// 		this.weatherText.text = `CLIMA: ${this.weatherEffect}`;
// 		await this.wait(1000);

// 		// IA Aliada: Brigadistas
// 		if (this.playerRole !== "BRIGADISTA") {
// 			this.showFloatingText("IA: BRIGADISTAS TRABAJANDO", -300, 200, 0xe67e22);
// 			if (this.boardContainer.children.length > 1) {
// 				const randomFoco = this.boardContainer.children[Math.floor(Math.random() * (this.boardContainer.children.length - 1)) + 1] as Container;
// 				this.reduceFire(randomFoco, 1);
// 			}
// 			await this.wait(1200);
// 		}

// 		// IA Aliada: Ciudadanos
// 		if (this.playerRole !== "CIUDADANO") {
// 			this.showFloatingText("IA: CIUDADANOS GENERAN CONCIENCIA", -300, 400, 0x2ecc71);
// 			this.visibilityScore += 3;
// 			this.updateVisibilityUI();
// 			await this.wait(1200);
// 		}

// 		// IA Aliada: Político Ético
// 		if (this.playerRole !== "POLITICO_BUENO" && this.isPoliticoBuenoPresent) {
// 			this.showFloatingText("IA: INVESTIGANDO CORRUPCIÓN", -300, 0, 0x3498db);
// 			if (Math.random() > 0.6) {
// 				this.evidencePoints++;
// 				this.showFloatingText("PRUEBA HALLADA POR ALIADO", -300, 50, 0x3498db);
// 			} else {
// 				this.isPoliticoMaloBlocked = true;
// 				this.showFloatingText("BLOQUEO POLÍTICO ALIADO", -300, 50, 0x3498db);
// 			}
// 			await this.wait(1200);
// 		}

// 		await this.processEnemyTurn();

// 		this.isPlayerTurn = true;
// 		this.showTurnStatus("TU TURNO", 0x3498db);

// 		let drawAmount = this.cardsToDrawNextTurn;
// 		if (this.visibilityScore >= 75) {
// 			drawAmount++;
// 			this.showFloatingText("🎁 APOYO POPULAR: +1 CARTA", 0, 500, 0x2ecc71);
// 		}

// 		this.replenishHand(drawAmount);
// 		this.cardsToDrawNextTurn = 2;
// 	}

// 	private async processEnemyTurn(): Promise<void> {
// 		if (!this.isPoliticoMaloBlocked) {
// 			this.highlightPlayer("politico", true);
// 			const strategy = Math.random();
// 			if (strategy < 0.25) {
// 				this.showFloatingText("📺 FAKE NEWS DIFUNDIDAS", 350, -500, 0xff0000);
// 				this.visibilityScore -= 10;
// 			} else if (strategy < 0.5) {
// 				this.showFloatingText("🎭 OPERACIÓN: CULPAN A TERCEROS", 350, -500, 0xff0000);
// 				this.visibilityScore -= 15;
// 			} else if (strategy < 0.75) {
// 				this.showFloatingText("📢 DISCURSO VACÍO: 'HEROES'", 350, -500, 0xf1c40f);
// 				this.cardsToDrawNextTurn = 1;
// 				this.visibilityScore -= 5;
// 			} else {
// 				this.showFloatingText("🔥 ESCÁNDALO DISTRACTOR", 350, -500, 0xe74c3c);
// 				this.visibilityScore -= 10;
// 			}
// 			await this.wait(1500);
// 			this.highlightPlayer("politico", false);
// 		} else {
// 			this.showFloatingText("OPERACIÓN ENEMIGA FRENADA", 350, -500, 0x2ecc71);
// 			this.isPoliticoMaloBlocked = false;
// 			await this.wait(1000);
// 		}

// 		if (!this.isInmobiliariaBlocked) {
// 			this.highlightPlayer("inmobiliaria", true);
// 			this.showFloatingText("🏗️ NUEVO FOCO PROVOCADO", 350, 500, 0xff0000);
// 			this.createNewFire(5);
// 			await this.wait(1500);
// 			this.highlightPlayer("inmobiliaria", false);
// 		} else {
// 			this.showFloatingText("INMOBILIARIA FRENADA", 350, 500, 0x2ecc71);
// 			this.isInmobiliariaBlocked = false;
// 			await this.wait(1000);
// 		}
// 	}

// 	// --- ACCIONES DE JUGADOR ---

// 	private playCard(card: Container, type: string): void {
// 		if (!this.isPlayerTurn) {
// 			return;
// 		}
// 		let used = false;
// 		let feedback = "";

// 		switch (type) {
// 			case "BOMBEROS":
// 				if (this.selectedFireNode) {
// 					this.reduceFire(this.selectedFireNode, 2);
// 					feedback = "TRABAJO EN TERRENO";
// 					used = true;
// 				} else {
// 					this.showFloatingText("¡SELECCIONA UN FOCO!", 0, -300, 0xffffff);
// 				}
// 				break;
// 			case "DENUNCIA":
// 				this.evidencePoints++;
// 				feedback = `PRUEBA RECOLECTADA (${this.evidencePoints}/5)`;
// 				used = true;
// 				break;
// 			case "POST_VIRAL":
// 				this.visibilityScore += 10;
// 				feedback = "¡VIRALIZADO!";
// 				used = true;
// 				break;
// 			case "VIDEO_DRONE":
// 				this.visibilityScore += 10;
// 				feedback = "VISTA AÉREA";
// 				used = true;
// 				break;
// 			case "MANIFESTACION": {
// 				this.isInmobiliariaBlocked = true;
// 				const manifestImpact = this.visibilityScore >= 50 ? 15 : this.visibilityScore >= 30 ? 5 : 2;
// 				this.visibilityScore += manifestImpact;
// 				feedback = `MARCHA: +${manifestImpact}% CONCIENCIA`;
// 				used = true;
// 				break;
// 			}
// 			case "REDES_SOCIALES":
// 				this.isPoliticoMaloBlocked = true;
// 				this.visibilityScore += 5;
// 				feedback = "CONTRA-OPERACIÓN";
// 				used = true;
// 				break;
// 			case "COIMA":
// 				feedback = "COIMA RECHAZADA";
// 				used = true;
// 				break;
// 			default:
// 				used = true;
// 		}

// 		if (used) {
// 			this.showFloatingText(feedback, 0, -500, 0x3498db);
// 			this.removeCard(card);
// 			this.updateVisibilityUI();
// 			this.checkVictory();
// 			this.updateHectareasUI();
// 		}
// 	}

// 	// --- UI Y ASSETS ---

// 	private setupUI(): void {
// 		this.hectareasText = new Text("", { fill: 0xffffff, fontSize: 24, fontWeight: "bold" });
// 		this.hectareasText.y = -730;
// 		this.hectareasText.anchor.set(0.5);

// 		this.visibilityText = new Text("", { fill: 0x2ecc71, fontSize: 22, fontWeight: "bold", stroke: 0x000000, strokeThickness: 4 });
// 		this.visibilityText.y = -720;
// 		this.visibilityText.x = -920;
// 		this.visibilityText.anchor.set(0.5);

// 		this.objectiveText = new Text("", { fill: 0xf1c40f, fontSize: 18 });
// 		this.objectiveText.y = -690;
// 		this.objectiveText.anchor.set(0.5);

// 		this.turnStatusText = new Text("INICIANDO...", { fill: 0x3498db, fontSize: 32, fontWeight: "bold" });
// 		this.turnStatusText.y = -630;
// 		this.turnStatusText.anchor.set(0.5);

// 		this.weatherText = new Text("CLIMA: NORMAL", { fill: 0xaaaaaa, fontSize: 20 });
// 		this.weatherText.y = -580;
// 		this.weatherText.anchor.set(0.5);

// 		const barBg = new Graphics().beginFill(0x333333).drawRect(-200, -780, 400, 15).endFill();
// 		this.fireStatusBar = new Graphics();

// 		const endTurnBtn = new Container();
// 		const btnBg = new Graphics().beginFill(0xcc6600).drawRoundedRect(-100, -30, 200, 60, 15).endFill();
// 		const btnText = new Text("FINALIZAR DÍA", { fill: 0xffffff, fontSize: 18 });
// 		btnText.anchor.set(0.5);
// 		endTurnBtn.addChild(btnBg, btnText);
// 		endTurnBtn.position.set(0, 480);
// 		endTurnBtn.eventMode = "static";
// 		endTurnBtn.cursor = "pointer";
// 		endTurnBtn.on("pointertap", () => this.endTurn());

// 		this.uiContainer.addChild(this.hectareasText, this.visibilityText, this.objectiveText, this.turnStatusText, this.weatherText, barBg, this.fireStatusBar, endTurnBtn);
// 	}

// 	private updateVisibilityUI(): void {
// 		this.visibilityScore = Math.max(0, Math.min(100, this.visibilityScore));
// 		this.visibilityText.text = `CONCIENCIA SOCIAL: ${this.visibilityScore}%`;
// 	}

// 	private updateHectareasUI(): void {
// 		this.hectareasText.text = `BOSQUE PERDIDO: ${Math.floor(this.hectareasQuemadas).toLocaleString()} Ha.`;
// 		const pct = Math.min(this.hectareasQuemadas / this.hectareasMax, 1);
// 		this.fireStatusBar
// 			.clear()
// 			.beginFill(0xff3300)
// 			.drawRect(-200, -780, 400 * pct, 15)
// 			.endFill();
// 		if (pct >= 1) {
// 			this.gameOver();
// 		}
// 	}

// 	private setupBoard(): void {
// 		const mapa = Sprite.from("mapa");
// 		mapa.anchor.set(0.5);
// 		mapa.alpha = 0.4;
// 		this.boardContainer.addChild(mapa);

// 		const focos = [
// 			{ name: "Bosque Milenario", x: -150, y: -100, intensity: 3 },
// 			{ name: "Reserva Sur", x: 100, y: 150, intensity: 4 },
// 		];
// 		focos.forEach((f) => this.boardContainer.addChild(this.createFireNode(f)));
// 	}

// 	private createFireNode(data: any): Container {
// 		const container = new Container();
// 		container.position.set(data.x, data.y);
// 		(container as any).intensity = data.intensity;
// 		(container as any).focoName = data.name;

// 		// Usamos el asset 'woods' para los focos
// 		const forest = Sprite.from("woods");
// 		forest.anchor.set(0.5);
// 		forest.scale.set(0.3);

// 		const fireGraphic = new Graphics();
// 		this.drawFireCircle(fireGraphic, data.intensity);

// 		container.addChild(forest, fireGraphic);
// 		container.eventMode = "static";
// 		container.cursor = "pointer";
// 		container.on("pointertap", () => {
// 			if (!this.isPlayerTurn) {
// 				return;
// 			}
// 			if (this.selectedFireNode) {
// 				this.selectedFireNode.alpha = 1;
// 			}
// 			this.selectedFireNode = container;
// 			this.selectedFireNode.alpha = 0.6;
// 		});
// 		return container;
// 	}

// 	private drawFireCircle(g: Graphics, intensity: number): void {
// 		g.clear();
// 		if (intensity <= 0) {
// 			return;
// 		}
// 		g.beginFill(0xff3300, 0.5)
// 			.drawCircle(0, 0, 40 + intensity * 10)
// 			.endFill();
// 		g.filters = [new BlurFilter(8)];
// 	}

// 	private reduceFire(node: Container, amount: number): void {
// 		const data = node as any;
// 		data.intensity -= amount;
// 		if (data.intensity <= 0) {
// 			this.showFloatingText(`EXTINTO: ${data.focoName}`, node.x, node.y, 0x3498db);
// 			new Tween(node.scale)
// 				.to({ x: 0, y: 0 }, 500)
// 				.onComplete(() => node.destroy())
// 				.start();
// 		} else {
// 			this.drawFireCircle(node.children[1] as Graphics, data.intensity);
// 		}
// 	}

// 	private createNewFire(intensity: number): void {
// 		const node = this.createFireNode({
// 			name: "Foco Provocado",
// 			x: (Math.random() - 0.5) * 600,
// 			y: (Math.random() - 0.5) * 600,
// 			intensity,
// 		});
// 		this.boardContainer.addChild(node);
// 	}

// 	private setupPlayers(): void {
// 		const pData = [
// 			{ id: "politico", name: "CORRUPCIÓN", x: 650, y: -460, color: 0xe74c3c },
// 			{ id: "inmobiliaria", name: "INTERÉS PRIVADO", x: 950, y: 500, color: 0xf1c40f },
// 		];
// 		pData.forEach((p) => {
// 			const c = new Container();
// 			c.name = `player_${p.id}`;
// 			c.position.set(p.x, p.y);
// 			const b = new Graphics().beginFill(0x222222).lineStyle(3, p.color).drawRoundedRect(-120, -40, 240, 80, 10).endFill();
// 			const t = new Text(p.name, { fill: 0xffffff, fontSize: 14 });
// 			t.anchor.set(0.5);
// 			c.addChild(b, t);
// 			this.playersContainer.addChild(c);
// 		});
// 	}

// 	private replenishHand(count: number): void {
// 		const rolePools: Record<PlayerRole, string[]> = {
// 			BRIGADISTA: ["BOMBEROS", "HIDROAVION", "VIDEO_DRONE", "REFORESTAR", "BOMBEROS"],
// 			POLITICO_BUENO: ["DENUNCIA", "PEDIDO_INFORME", "REDES_SOCIALES", "COIMA", "MANIFESTACION"],
// 			CIUDADANO: ["POST_VIRAL", "VIDEO_DRONE", "MANIFESTACION", "REDES_SOCIALES"],
// 		};
// 		const pool = rolePools[this.playerRole];
// 		for (let i = 0; i < count; i++) {
// 			const type = pool[Math.floor(Math.random() * pool.length)];
// 			this.addCardToHand(this.cardsContainer.children.length, type);
// 		}
// 	}

// 	private addCardToHand(index: number, type: string): void {
// 		const card = new Container();
// 		const textureName = this.getTextureForType(type);

// 		// Fondo de la carta
// 		const cardBg = new Graphics().beginFill(0x222222).lineStyle(2, 0xffffff).drawRoundedRect(-70, -100, 140, 200, 10).endFill();

// 		// Imagen de la carta (Sprite)
// 		const img = Sprite.from(textureName);
// 		img.anchor.set(0.5);
// 		img.width = 160;
// 		img.height = 250;

// 		// Botón de descarte
// 		const discardBtn = new Graphics().beginFill(0xff0000).drawCircle(60, -90, 15).endFill();
// 		const discardX = new Text("X", { fill: 0xffffff, fontSize: 12, fontWeight: "bold" });
// 		discardX.anchor.set(0.5);
// 		discardX.position.set(60, -90);

// 		card.addChild(cardBg, img, discardBtn, discardX);
// 		card.x = (index - 2) * 155;
// 		card.y = 800;
// 		this.cardsContainer.addChild(card);
// 		new Tween(card).to({ y: 650 }, 600).easing(Easing.Back.Out).start();

// 		card.eventMode = "static";
// 		card.cursor = "pointer";
// 		card.on("pointertap", (e) => {
// 			const localPos = e.getLocalPosition(card);
// 			if (localPos.x > 40 && localPos.y < -70) {
// 				this.discardCard(card);
// 			} else {
// 				this.playCard(card, type);
// 			}
// 		});
// 	}

// 	private getTextureForType(type: string): string {
// 		const map: any = {
// 			BOMBEROS: "bombero",
// 			DENUNCIA: "denuncia",
// 			POST_VIRAL: "postviral",
// 			REDES_SOCIALES: "redessociales",
// 			COIMA: "coima",
// 			MANIFESTACION: "manifestacion",
// 			HIDROAVION: "hidroavion",
// 			VIDEO_DRONE: "videodrone",
// 			PEDIDO_INFORME: "pedidoinforme",
// 		};
// 		return map[type] || "cards";
// 	}

// 	private applyWeatherEffect(): void {
// 		if (this.weatherEffect === "LLUVIA") {
// 			this.boardContainer.children.forEach((f: any) => {
// 				if (f.intensity) {
// 					f.intensity = Math.max(1, f.intensity - 1);
// 					this.drawFireCircle(f.children[1] as Graphics, f.intensity);
// 				}
// 			});
// 		}
// 	}

// 	private spreadFire(amount: number): void {
// 		this.hectareasQuemadas += amount;
// 		this.updateHectareasUI();
// 	}

// 	private endTurn(): void {
// 		if (!this.isPlayerTurn) {
// 			return;
// 		}
// 		this.isPlayerTurn = false;
// 		this.processIATurns();
// 	}

// 	private discardCard(card: Container): void {
// 		this.showFloatingText("DESCARTADA", card.x, card.y - 100, 0xaaaaaa);
// 		new Tween(card)
// 			.to({ alpha: 0, y: 1000 }, 400)
// 			.onComplete(() => card.destroy())
// 			.start();
// 	}

// 	private removeCard(card: Container): void {
// 		new Tween(card)
// 			.to({ alpha: 0, y: 900 })
// 			.onComplete(() => card.destroy())
// 			.start();
// 	}

// 	private checkVictory(): void {
// 		const activeFocos = this.boardContainer.children.length - 1;
// 		if (this.playerRole === "BRIGADISTA" && activeFocos === 0) {
// 			this.win();
// 		}
// 		if (this.playerRole === "POLITICO_BUENO" && this.evidencePoints >= 5) {
// 			this.win();
// 		}
// 		if (this.playerRole === "CIUDADANO" && this.visibilityScore >= 100) {
// 			this.win();
// 		}
// 	}

// 	private win(): void {
// 		const loss = Math.floor(this.hectareasQuemadas).toLocaleString();
// 		this.showTurnStatus(`OBJETIVO LOGRADO`, 0x2ecc71);
// 		const reflection = [
// 			"Aunque ganaste, el mundo pierde siempre que esto sucede.",
// 			"Buscamos vida afuera, pero lo que está vivo aquí no lo cuidamos.",
// 			"Contaminamos el agua para extraer metales inertes...",
// 			"Lo único realmente raro en el universo es el AGUA y la VIDA.",
// 			`Perdimos permanentemente ${loss} Hectáreas.`,
// 		];
// 		reflection.forEach((line, i) => {
// 			setTimeout(() => {
// 				this.showFloatingText(line, 0, -300 + i * 80, 0xffffff);
// 			}, i * 3000);
// 		});
// 		this.isPlayerTurn = false;
// 	}

// 	private gameOver(): void {
// 		this.showTurnStatus("PATAGONIA DEVASTADA", 0xff0000);
// 		this.isPlayerTurn = false;
// 	}

// 	private getObjectiveText(): string {
// 		if (this.playerRole === "BRIGADISTA") {
// 			return "Extinguir todos los focos activos.";
// 		}
// 		if (this.playerRole === "POLITICO_BUENO") {
// 			return "Juntar 5 pruebas de corrupción.";
// 		}
// 		if (this.playerRole === "CIUDADANO") {
// 			return "Alcanzar 100% de visibilidad social.";
// 		}
// 		return "";
// 	}

// 	private showFloatingText(msg: string, x: number, y: number, color: number): void {
// 		const txt = new Text(msg, {
// 			fill: color,
// 			fontSize: 54,

// 			fontWeight: "bold",
// 			stroke: 0x000000,
// 			strokeThickness: 4,
// 			align: "center",
// 			wordWrap: true,
// 			wordWrapWidth: 800,
// 		});
// 		txt.anchor.set(0.5);
// 		txt.position.set(x, y);
// 		this.uiContainer.addChild(txt);
// 		new Tween(txt)
// 			.to({ y: y - 100, alpha: 0 }, 3500)
// 			.easing(Easing.Quadratic.Out)
// 			.onComplete(() => txt.destroy())
// 			.start();
// 	}

// 	private highlightPlayer(id: string, active: boolean): void {
// 		const p = this.playersContainer.getChildByName(`player_${id}`);
// 		if (p) {
// 			new Tween(p.scale).to({ x: active ? 1.2 : 1, y: active ? 1.2 : 1 }, 300).start();
// 		}
// 	}

// 	private showTurnStatus(msg: string, color: number): void {
// 		this.turnStatusText.text = msg;
// 		this.turnStatusText.style.fill = color;
// 	}

// 	private wait(ms: number) {
// 		return new Promise((r) => setTimeout(r, ms));
// 	}

// 	public override onResize(w: number, h: number): void {
// 		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 1024, 1536, ScaleHelper.forceHeight);
// 		this.worldContainer.x = w * 0.5;
// 		this.worldContainer.y = h * 0.5;
// 	}
// }
