/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { DisplacementFilter, WRAP_MODES } from "pixi.js";
import { Container, Graphics, Text, BlurFilter, Sprite, Ticker, BLEND_MODES } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";

type PlayerRole = "BRIGADISTA" | "POLITICO_BUENO" | "CIUDADANO";

export class GameplayScene extends PixiScene {
	public static readonly BUNDLES = ["patagonia"];

	// Dimensiones ideales del mundo para efectos a pantalla completa
	private readonly WORLD_BOUNDS = { minX: -1024, minY: -1536, width: 2048, height: 3072 };

	private worldContainer: Container = new Container();
	private boardContainer: Container = new Container();
	private effectsContainer: Container = new Container(); // Nueva capa para efectos atmosféricos
	private cardsContainer: Container = new Container();
	private playersContainer: Container = new Container();
	private uiContainer: Container = new Container();
	private overlayContainer: Container = new Container();

	// Estado del Juego
	private playerRole: PlayerRole | null = null;
	private isPoliticoBuenoPresent: boolean = false;
	private hectareasQuemadas: number = 55000;
	private hectareasMax: number = 100000;
	private isPlayerTurn: boolean = false;
	private selectedFireNode: any | null = null;
	private gameEnded: boolean = false;

	// Contadores
	private evidencePoints: number = 0;
	private visibilityScore: number = 0;
	public cardsToDrawNextTurn: number = 2;

	// Estados Globales (Mecánicas de IA)
	private isPoliticoMaloBlocked: boolean = false;
	private isInmobiliariaBlocked: boolean = false;
	private weatherEffect: "NORMAL" | "VIENTO" | "LLUVIA" = "NORMAL";

	// UI
	private hectareasText: Text;
	private visibilityText: Text;
	private objectiveText: Text;
	private turnStatusText: Text;
	private weatherText: Text;
	private fireStatusBar: Graphics;
	private evidenceText: Text;
	private isReportActive: boolean = false;
	private justiceBonusCard: boolean = false;
	private endTurnBtn: Container;

	// Elementos de Efectos Visuales Atmosféricos
	private smokeOverlay: Sprite; // Capa de humo sobre el tablero
	private vignetteOverlay: Graphics; // Marco rojo de sofocación en bordes
	// En la sección de propiedades de la clase GameplayScene
	private smokeDisplacementSprite: Sprite;
	private smokeDisplacementFilter: DisplacementFilter;
	constructor() {
		super();
		this.addChild(this.worldContainer);
		SoundLib.playMusic("bgm", { loop: true, volume: 0.4 });

		this.worldContainer.addChild(
			this.boardContainer,
			this.playersContainer,
			this.effectsContainer, // Humo y viñeta van sobre el mapa/jugadores pero bajo cartas/UI
			this.cardsContainer,
			this.uiContainer,
			this.overlayContainer
		);

		this.setupBoard();
		this.setupVisualEffects(); // Inicializar humo y viñeta
		this.setupPlayers();
		this.setupUI();
		this.showRoleSelection();
		this.showHowToPlay();

		Ticker.shared.add(this.updateJuice, this);

		// Bucle de propagación de fuego
		setInterval(() => {
			if (this.playerRole && !this.gameEnded) {
				const activeFocos = this.boardContainer.children.filter((c: any) => c.intensity > 0).length;
				if (activeFocos > 0) {
					const modifier = this.weatherEffect === "VIENTO" ? 2.8 : this.weatherEffect === "LLUVIA" ? 0.3 : 1;
					this.spreadFire(60 * activeFocos * modifier);
				}
			}
		}, 3000);
	}

	// --- CONFIGURACIÓN DE EFECTOS VISUALES ATMOSFÉRICOS ---

	private setupVisualEffects(): void {
		// 1. Capa de Humo Atmosférico
		this.smokeOverlay = Sprite.from("smoke");
		this.smokeOverlay.anchor.set(0.5);
		this.smokeOverlay.blendMode = BLEND_MODES.SCREEN;
		this.smokeOverlay.alpha = 0;

		const scale = Math.max((this.WORLD_BOUNDS.width * 1.2) / this.smokeOverlay.texture.width, this.WORLD_BOUNDS.height / this.smokeOverlay.texture.height);
		this.smokeOverlay.scale.set(scale);

		// 2. Marco de Viñeteado/Sofocación Rojizo
		this.vignetteOverlay = new Graphics();
		this.vignetteOverlay.filters = [new BlurFilter(100)]; // Desenfoque fuerte para bordes suaves
		this.drawVignette(0x000000, 0); // Inicia negro e invisible

		// --- LÓGICA DE DESPLAZAMIENTO (ESTILO BANDERA) ---

		// Cargamos el mapa de desplazamiento (puedes usar una textura de ruido o nubes)
		// Si no tienes una, 'displacement_map' suele ser el estándar.
		this.smokeDisplacementSprite = Sprite.from("displacement_map_repeat");

		// IMPORTANTE: Hacer que la textura se repita para que la animación sea infinita
		this.smokeDisplacementSprite.texture.baseTexture.wrapMode = WRAP_MODES.REPEAT;

		// Creamos el filtro
		// Scale: x controla el vaivén horizontal, y el vertical.
		this.smokeDisplacementFilter = new DisplacementFilter(this.smokeDisplacementSprite);
		this.smokeDisplacementFilter.scale.x = 50;
		this.smokeDisplacementFilter.scale.y = 50;

		// Añadimos el sprite de desplazamiento al contenedor (pero no necesita ser visible)
		this.effectsContainer.addChild(this.smokeDisplacementSprite);

		// Aplicamos el filtro al humo
		this.smokeOverlay.filters = [this.smokeDisplacementFilter];

		this.effectsContainer.addChild(this.smokeOverlay);

		// ... resto de setup (vignette, etc.)
	}

	// Helper para dibujar la viñeta (borde degradado/desenfocado)
	private drawVignette(color: number, alpha: number): void {
		const b = this.WORLD_BOUNDS;
		this.vignetteOverlay.clear();
		if (alpha <= 0) {
			return;
		}

		// Dibujar un marco grueso alrededor de los bordes desenfocado por el filtro
		const borderThickness = 300;
		this.vignetteOverlay.beginFill(color, alpha);

		// Rectángulo exterior
		this.vignetteOverlay.drawRect(b.minX - borderThickness, b.minY - borderThickness, b.width + borderThickness * 2, b.height + borderThickness * 2);

		// Agujero interior (Hole)
		this.vignetteOverlay.beginHole();
		this.vignetteOverlay.drawRoundedRect(b.minX + 100, b.minY + 100, b.width - 200, b.height - 200, 200);
		this.vignetteOverlay.endHole();

		this.vignetteOverlay.endFill();
	}

	// --- ACTUALIZACIÓN CONTINUA DE EFECTOS (TICK) ---

	private updateJuice(): void {
		const elapsed = Ticker.shared.lastTime / 1000;

		// 1. Efectos visuales de Cartas y Focos existentes (sin cambios)
		this.cardsContainer.children.forEach((card: any, i) => {
			const wobble = Math.sin(elapsed * 1.5 + i * 0.7) * 0.03;
			const hoverScale = card.isHovered ? 1.25 : 1.0;
			card.rotation = (card.baseRotation || 0) + wobble;
			card.scale.set(card.scale.x + (hoverScale - card.scale.x) * 0.15);
		});

		this.boardContainer.children.forEach((foco: any) => {
			if (foco && foco.intensity) {
				const pulse = 0.7 + Math.sin(elapsed * 5 + foco.x) * 0.3;
				const glow = foco.getChildByName("glow");
				if (glow) {
					glow.alpha = pulse * 0.4;
					glow.scale.set(1 + pulse * 0.1);
				}
				const fire = foco.getChildByName("fireGraphic");
				if (fire) {
					fire.skew.x = Math.sin(elapsed * 10) * 0.06;
				}
			}
		});

		// 2. Lógica de Efectos Atmosféricos Dinámicos

		// --- ANIMACIÓN DEL DESPLAZAMIENTO DEL HUMO ---
		if (this.smokeDisplacementSprite) {
			// Movemos el mapa de desplazamiento lentamente
			// Esto crea el efecto de "ondas" de calor o viento
			this.smokeDisplacementSprite.x += 1.5;
			this.smokeDisplacementSprite.y += 0.8;

			// Resetear para evitar números astronómicos (aunque WRAP_MODES lo maneja)
			if (this.smokeDisplacementSprite.x > this.smokeDisplacementSprite.width) {
				this.smokeDisplacementSprite.x = 0;
			}
			if (this.smokeDisplacementSprite.y > this.smokeDisplacementSprite.height) {
				this.smokeDisplacementSprite.y = 0;
			}
		}

		// Actualizar el alpha del humo basado en los focos (como ya hacías)
		const activeFocosCount = this.boardContainer.children.filter((c: any) => c.intensity > 0).length;
		const targetSmokeAlpha = Math.min(0.7, activeFocosCount * 0.12);
		this.smokeOverlay.alpha += (targetSmokeAlpha - this.smokeOverlay.alpha) * 0.01;

		// Movimiento lento y sutil del humo
		this.smokeOverlay.rotation = Math.sin(elapsed * 0.2) * 0.05;
		this.smokeOverlay.skew.x = Math.cos(elapsed * 0.3) * 0.02;

		// B. Viñeta de Sofocación basada en hectáreas quemadas (rodeado por fuego)
		const burnPercentage = this.hectareasQuemadas / this.hectareasMax;

		// Solo activar efecto rojizo/sofocante si el desastre es avanzado (>40%)
		if (burnPercentage > 0.4 && !this.gameEnded) {
			const intensity = (burnPercentage - 0.4) / 0.6; // Mapear 0.4-1.0 a 0.0-1.0

			// Color transiciona de negro (sofocación leve) a rojo intenso (fuego cerca)
			const redComponent = Math.floor(intensity * 255);
			const vignetteColor = (redComponent << 16) + (0 << 8) + 0; // RGB: [X, 0, 0]

			// Opacidad base aumenta con el desastre, capada a 0.8
			const baseAlpha = Math.min(0.8, intensity * 0.9);

			// Añadir un parpadeo/latido sutil de calor ("sofoca")
			const heatThrob = Math.sin(elapsed * 4) * 0.05;
			const finalAlpha = Math.max(0, baseAlpha + heatThrob);

			this.vignetteOverlay.visible = true;
			this.drawVignette(vignetteColor, finalAlpha);
		} else if (this.gameEnded) {
			// Mantener viñeta roja estática si terminó en derrota, o apagar si victoria
			if (this.hectareasQuemadas >= this.hectareasMax) {
				this.drawVignette(0xff0000, 0.8);
			} else {
				this.vignetteOverlay.visible = false;
			}
		} else {
			this.vignetteOverlay.visible = false;
		}
	}

	// --- RESTO DE LA ESCENA (POPUP, RESTART, FIRELOGIC, CARDS, UI, ETC - SIN CAMBIOS SIGNIFICATIVOS SALVO RESIZE) ---

	private showHowToPlay(): void {
		this.overlayContainer.removeChildren();
		const bg = new Graphics().beginFill(0x000000, 0.9).drawRect(-2048, -1536, 4096, 3072).endFill();
		this.overlayContainer.addChild(bg);
		const container = new Container();
		const panel = new Graphics().beginFill(0x1a1a1a).lineStyle(4, 0xffaa00).drawRoundedRect(-800, -800, 1600, 1600, 30).endFill();
		const title = new Text("INSTRUCCIONES", { fill: 0xffaa00, fontSize: 50, fontWeight: "900" });
		title.anchor.set(0.5);
		title.y = -690;
		const instructions = [
			"🔥 El fuego avanza cada 3 segundos. Más fuegos generan más HUMO dificultando la visión.",
			"🌲 Si llegas a 100.000 Ha perdidas, la Patagonia se devasta y pierdes. Sentirás el CALOR en los bordes.",
			"📍 Para apagar un incendio: SELECCIONA el foco primero y luego usa una carta de Bomberos.",
			"🃏 Usa cartas para investigar, viralizar o combatir el fuego.",
			"❌ Puedes descartar cartas haciendo clic en la (X).",
			"⏳ Al FINALIZAR DÍA, el clima cambia y los enemigos actúan.",
			"🤝 Los aliados (IAs) te ayudarán según tu rol.",
			"Las manifestaciones son mejores cuando más gente está al tanto - como en la vida misma",
			"Postear en redes ayuda, pero nunca es igual a los efectos de la movilización masiva de la sociedad",
			"Postear es casi gratis (quienes más cartas tienen son los ciudadanos), así que hay que hacerlo",
			"Los bomberos tienen más recursos (cartas) cuando hay más visibilidad",
			"La justicia es lenta, pero así como con los bomberos de a poco se puede ir teniendo más herramientas, hay que insistir",
			"Aceptar coimas es malo (si, es obvio pero hay que decirlo porque aparentemente en este país no se ve así)",
		];
		const content = new Text(instructions.join("\n\n"), { fill: 0xffffff, fontSize: 35, wordWrap: true, wordWrapWidth: 1200, lineHeight: 40 });
		content.anchor.set(0.5, 0);
		content.y = -570;
		const btn = new Container();
		const btnBg = new Graphics().beginFill(0x2ecc71).drawRoundedRect(-150, -40, 300, 80, 15).endFill();
		const btnText = new Text("ENTENDIDO", { fill: 0xffffff, fontSize: 24, fontWeight: "bold" });
		btnText.anchor.set(0.5);
		btn.addChild(btnBg, btnText);
		btn.y = 780;
		btn.eventMode = "static";
		btn.cursor = "pointer";
		btn.on("pointertap", () => {
			SoundLib.playSound("tap1", {});
			this.overlayContainer.removeChild(container);
			this.showRoleSelection();
		});
		container.addChild(panel, title, content, btn);
		this.overlayContainer.addChild(container);
		container.scale.set(0.8);
		container.alpha = 0;
		new Tween(container).to({ scale: 1, alpha: 1 }, 500).easing(Easing.Back.Out).start();
	}

	private showRestartButton(): void {
		const btn = new Container();
		const btnBg = new Graphics().beginFill(0x3498db).lineStyle(3, 0xffffff).drawRoundedRect(-200, -40, 400, 80, 15).endFill();
		const btnText = new Text("REINICIAR PARTIDA", { fill: 0xffffff, fontSize: 28, fontWeight: "bold" });
		btnText.anchor.set(0.5);
		btn.addChild(btnBg, btnText);
		btn.position.set(0, 200);
		btn.eventMode = "static";
		btn.cursor = "pointer";
		btn.on("pointertap", () => {
			this.restartGame();
			SoundLib.playSound("tap1", {});
		});
		this.uiContainer.addChild(btn);
		btn.alpha = 0;
		new Tween(btn).to({ alpha: 1 }, 500).start();
	}

	private restartGame(): void {
		this.hectareasQuemadas = 55000;
		this.evidencePoints = 0;
		this.visibilityScore = 0;
		this.gameEnded = false;
		this.isPlayerTurn = false;
		this.selectedFireNode = null;
		this.weatherEffect = "NORMAL";
		this.isReportActive = false;
		this.justiceBonusCard = false;
		this.endTurnBtn.visible = true;
		this.cardsContainer.visible = true;

		// Resetar opacidad de efectos
		this.smokeOverlay.alpha = 0;
		this.drawVignette(0x000000, 0);
		this.vignetteOverlay.visible = false;

		this.boardContainer.removeChildren();
		this.cardsContainer.removeChildren();
		this.uiContainer.removeChildren();
		this.playersContainer.removeChildren();
		this.setupBoard();
		this.setupPlayers();
		this.setupUI();
		this.updateEvidenceUI();
		this.overlayContainer.visible = true;
		this.overlayContainer.alpha = 1;
		this.showHowToPlay();
	}

	private createFireNode(data: any): Container {
		const container = new Container() as any;
		container.position.set(data.x, data.y);
		container.intensity = data.intensity;
		container.focoName = data.name;
		const forest = Sprite.from("woods");
		forest.anchor.set(0.5);
		forest.scale.set(0.35);
		const glow = new Graphics().beginFill(0xff4400, 0.4).drawCircle(0, 0, 75).endFill();
		glow.name = "glow";
		glow.filters = [new BlurFilter(25)];
		const fireGraphic = new Graphics();
		fireGraphic.name = "fireGraphic";
		container.addChild(forest, glow, fireGraphic);
		this.drawFireVisuals(container);
		container.eventMode = "static";
		container.cursor = "pointer";
		container.on("pointertap", () => {
			SoundLib.playSound("tap2", {});
			if (!this.isPlayerTurn || this.gameEnded) {
				return;
			}
			if (this.selectedFireNode && !this.selectedFireNode.destroyed) {
				new Tween(this.selectedFireNode.scale).to({ x: 1, y: 1 }, 200).start();
			}
			this.selectedFireNode = container;
			new Tween(container.scale).to({ x: 1.3, y: 1.3 }, 300).easing(Easing.Back.Out).start();
		});
		return container;
	}

	private reduceFire(node: any, amount: number): void {
		if (!node || node.destroyed) {
			return;
		}
		node.intensity -= amount;
		this.showFloatingText(`-${amount} FUEGO`, node.x, node.y - 60, 0x3498db);
		if (node.intensity <= 0) {
			if (this.selectedFireNode === node) {
				this.selectedFireNode = null;
			}
			new Tween(node.scale)
				.to({ x: 0, y: 0 }, 500)
				.onComplete(() => {
					if (!node.destroyed) {
						node.destroy();
					}
					this.checkVictory();
				})
				.start();
		} else {
			this.drawFireVisuals(node);
			new Tween(node.position)
				.to({ x: node.x + 10 }, 50)
				.yoyo(true)
				.repeat(3)
				.start();
		}
	}

	private playCard(card: any): void {
		if (!this.isPlayerTurn || this.gameEnded) {
			return;
		}
		let used = false;
		const type = card.type;
		if (type === "BOMBEROS" || type === "HIDROAVION") {
			if (this.selectedFireNode && !this.selectedFireNode.destroyed && this.selectedFireNode.intensity > 0) {
				this.reduceFire(this.selectedFireNode, type === "BOMBEROS" ? 2 : 5);
				used = true;
			} else {
				this.showFloatingText("¡SELECCIONA UN FOCO ACTIVO!", 0, -300, 0xff4400);
				return;
			}
		} else if (type === "DENUNCIA") {
			this.evidencePoints++;
			this.updateEvidenceUI();
			used = true;
		} else if (type === "PEDIDO_INFORME") {
			this.visibilityScore += 5;
			this.isReportActive = true;
			this.showFloatingText("SOLICITUD ENVIADA A LA JUSTICIA", 0, -400, 0xf1c40f);
			used = true;
		} else if (type === "POST_VIRAL" || type === "VIDEO_DRONE") {
			this.visibilityScore += type === "POST_VIRAL" ? 1 : 3;
			used = true;
		} else if (type === "MANIFESTACION") {
			this.isInmobiliariaBlocked = true;
			const manifestImpact = this.visibilityScore >= 40 ? 15 : this.visibilityScore >= 25 ? 5 : 2;
			this.visibilityScore += manifestImpact;
			used = true;
		} else if (type === "REDES_SOCIALES") {
			this.isPoliticoMaloBlocked = true;
			used = true;
		} else if (type === "COIMA") {
			this.visibilityScore -= 5;
			this.evidencePoints -= 1;
			used = true;
		} else if (type === "REFORESTAR") {
			this.hectareasQuemadas = Math.max(0, this.hectareasQuemadas - 500);
			used = true;
		}
		if (used) {
			this.showFloatingText(`¡${type.replace("_", " ")}!`, 0, -300, 0x3498db);
			this.removeCard(card);
			this.updateVisibilityUI();
			this.updateEvidenceUI();
			this.updateHectareasUI();
			this.checkVictory();
		}
	}

	private async endTurn(): Promise<void> {
		if (!this.isPlayerTurn || this.gameEnded) {
			return;
		}
		this.isPlayerTurn = false;
		if (this.selectedFireNode && !this.selectedFireNode.destroyed) {
			this.selectedFireNode.scale.set(1);
		}
		this.selectedFireNode = null;
		this.turnStatusText.style.fontSize = 24;
		this.turnStatusText.text = "EL MUNDO ACCIONA...";
		this.turnStatusText.style.fill = 0xffffff;
		await new Promise((r) => setTimeout(r, 1000));
		const rndWeather = Math.random();
		if (rndWeather < 0.25) {
			this.weatherEffect = "LLUVIA";
			this.showFloatingText("⛈️ LLUVIAS: FUEGO REDUCIDO", 0, 0, 0x3498db);
			this.applyRainEffect();
		} else if (rndWeather < 0.5) {
			this.weatherEffect = "VIENTO";
			this.showFloatingText("🌬️ VIENTOS: EL FUEGO VUELA", 0, 0, 0xe74c3c);
		} else {
			this.weatherEffect = "NORMAL";
		}
		this.weatherText.text = `${this.weatherEffect}`;
		await new Promise((r) => setTimeout(r, 1200));
		if (this.isReportActive) {
			await new Promise((r) => setTimeout(r, 800));
			if (Math.random() > 0.5) {
				this.justiceBonusCard = true;
				this.showFloatingText("⚖️ ¡LA JUSTICIA AVANZA! +1 CARTA PRÓX. TURNO", 0, 0, 0x2ecc71);
			} else {
				this.showFloatingText("⚖️ PEDIDO DE INFORME CAJONEADO", 0, 0, 0xff4444);
			}
			this.isReportActive = false;
		}
		if (this.playerRole !== "BRIGADISTA") {
			this.showFloatingText("IA: BRIGADISTAS COMBATIENDO", -300, 200, 0xe67e22);
			const focos = this.boardContainer.children.filter((c: any) => c.intensity > 0);
			if (focos.length > 0) {
				this.reduceFire(focos[Math.floor(Math.random() * focos.length)], 1);
			}
			await new Promise((r) => setTimeout(r, 1000));
		}
		if (this.playerRole !== "CIUDADANO") {
			this.showFloatingText("IA: ASAMBLEAS ACTIVAS", -300, 400, 0x2ecc71);
			this.visibilityScore += 4;
			this.updateVisibilityUI();
			await new Promise((r) => setTimeout(r, 1000));
		}
		if (this.playerRole !== "POLITICO_BUENO" && this.isPoliticoBuenoPresent) {
			this.showFloatingText("IA: INVESTIGACIÓN JUDICIAL", -300, 0, 0x3498db);
			if (Math.random() > 0.5) {
				this.evidencePoints++;
				this.updateEvidenceUI();
			} else {
				this.isPoliticoMaloBlocked = true;
			}
			await new Promise((r) => setTimeout(r, 1000));
		}
		await this.processEnemyTurn();
		if (!this.gameEnded) {
			this.isPlayerTurn = true;
			this.turnStatusText.style.fontSize = 45;
			this.turnStatusText.text = "TU TURNO";
			this.turnStatusText.style.fill = 0x3498db;
			this.replenishHand();
		}
	}

	private async processEnemyTurn(): Promise<void> {
		if (this.gameEnded) {
			return;
		}
		if (!this.isPoliticoMaloBlocked) {
			this.highlightEntity("politico", true);
			this.showFloatingText("🔥 OPERACIÓN: DESINFORMACIÓN", 400, -460, 0xe74c3c);
			this.visibilityScore -= 10;
			this.updateVisibilityUI();
			await new Promise((r) => setTimeout(r, 1500));
			this.highlightEntity("politico", false);
		} else {
			this.showFloatingText("🛡️ POLÍTICO BLOQUEADO", 400, -460, 0x2ecc71);
			this.isPoliticoMaloBlocked = false;
			await new Promise((r) => setTimeout(r, 1000));
		}
		if (!this.isInmobiliariaBlocked) {
			this.highlightEntity("inmobiliaria", true);
			this.showFloatingText("🏗️ INTERÉS INMOBILIARIO: NUEVO FOCO! CUIDADO!", 400, 400, 0xf1c40f);
			SoundLib.playSound("firesfx", { end: 2, volume: 0.4 });
			this.createNewFire(4);
			await new Promise((r) => setTimeout(r, 1500));
			this.highlightEntity("inmobiliaria", false);
		} else {
			this.showFloatingText("🛡️ NEGOCIO FRENADO", 450, 400, 0x2ecc71);
			this.isInmobiliariaBlocked = false;
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	private drawFireVisuals(node: any): void {
		const g = node.getChildByName("fireGraphic");
		if (!g || node.intensity <= 0) {
			g?.clear();
			return;
		}
		g.clear();
		const r = 40 + node.intensity * 14;
		g.beginFill(0xffaa00, 0.6).drawCircle(0, 0, r).endFill();
		g.beginFill(0xff3300, 0.4)
			.drawCircle(0, 0, r * 0.7)
			.endFill();
		g.filters = [new BlurFilter(8)];
	}

	private createNewFire(intensity: number): void {
		const x = (Math.random() - 0.5) * 800;
		const y = (Math.random() - 0.5) * 600;
		const node = this.createFireNode({ name: "Foco Provocado", x, y, intensity });
		this.boardContainer.addChild(node);
		new Tween(node.scale).from({ x: 0, y: 0 }).to({ x: 1, y: 1 }).start();
	}

	private applyRainEffect(): void {
		this.boardContainer.children.forEach((f: any) => {
			if (f.intensity) {
				this.reduceFire(f, 1);
			}
		});
	}

	private checkVictory(): void {
		if (this.gameEnded) {
			return;
		}
		const activeFocos = this.boardContainer.children.filter((c: any) => c.intensity > 0).length;
		if (this.playerRole === "BRIGADISTA" && activeFocos === 0) {
			this.win();
		} else if (this.playerRole === "POLITICO_BUENO" && this.evidencePoints >= 5) {
			this.win();
		} else if (this.playerRole === "CIUDADANO" && this.visibilityScore >= 100) {
			this.win();
		}
	}

	private win(): void {
		this.endTurnBtn.visible = false;
		this.cardsContainer.visible = false;
		if (this.gameEnded) {
			return;
		}
		this.gameEnded = true;
		this.isPlayerTurn = false;
		const loss = Math.floor(this.hectareasQuemadas).toLocaleString();
		this.turnStatusText.style.fontSize = 25;
		this.turnStatusText.text = "OBJETIVO LOGRADO";
		this.turnStatusText.style.fill = 0x2ecc71;
		const reflection = [
			"Aunque ganaste, el ecosistema tarda siglos en sanar.",
			"Buscamos vida afuera, pero destruimos la que tenemos aquí.",
			"Contaminamos el agua para extraer metales inertes...",
			"Lo único realmente raro en el universo es la VIDA.",
			`Resultado: ${loss} Hectáreas perdidas para siempre en lo que va de esta simulación.`,
		];
		reflection.forEach((line, i) => {
			setTimeout(() => {
				this.showFloatingText(line, 0, -150 + i * 90, 0xffffff);
				if (i === reflection.length - 1) {
					setTimeout(() => this.showRestartButton(), 2000);
				}
			}, i * 3500);
		});
	}

	private calculateMaxCards(): number {
		let baseLimit = 5;
		if (this.playerRole === "BRIGADISTA" || this.playerRole === "POLITICO_BUENO") {
			if (this.visibilityScore > 60) {
				baseLimit = 5;
			} else if (this.visibilityScore >= 50 || this.hectareasQuemadas >= 75000) {
				baseLimit = 4;
			} else if (this.visibilityScore >= 25 || this.hectareasQuemadas >= 65000) {
				baseLimit = 3;
			} else {
				baseLimit = 2;
			}
		}
		if (this.justiceBonusCard) {
			baseLimit += 1;
			this.justiceBonusCard = false;
		}
		return baseLimit;
	}

	private gameOver(): void {
		if (this.gameEnded) {
			return;
		}
		this.gameEnded = true;
		this.isPlayerTurn = false;
		this.showFloatingText("PATAGONIA DEVASTADA", 0, -200, 0xff0000);
		this.turnStatusText.style.fontSize = 45;
		this.turnStatusText.text = "DERROTA";
		setTimeout(() => this.showRestartButton(), 2000);
	}

	private setupUI(): void {
		const topUI = Sprite.from("topUI");
		topUI.anchor.set(0.5);
		topUI.scale.set(1.7);
		topUI.y = -650;
		this.uiContainer.addChild(topUI);
		this.hectareasText = new Text("", { fill: 0xffffff, fontSize: 26, fontWeight: "900", stroke: 0x000000, strokeThickness: 4 });
		this.hectareasText.y = -600;
		this.hectareasText.x = -535;
		this.hectareasText.anchor.set(0.5);
		this.visibilityText = new Text("", { fill: 0x000000, fontSize: 40, fontWeight: "bold" });
		this.visibilityText.position.set(-540, -715);
		this.evidenceText = new Text("", { fill: 0xffffff, fontSize: 22, fontWeight: "bold", stroke: 0x000000, strokeThickness: 4 });
		this.evidenceText.position.set(495, -610);
		this.evidenceText.visible = false;
		this.turnStatusText = new Text("INICIANDO...", { fill: 0x000000, fontSize: 45, fontWeight: "bold" });
		this.turnStatusText.y = -687;
		this.turnStatusText.x = 200;
		this.turnStatusText.anchor.set(0.5);
		this.weatherText = new Text("NORMAL", { fill: 0x000000, fontSize: 40 });
		this.weatherText.y = -600;
		this.weatherText.x = 100;
		this.weatherText.anchor.set(0.5);
		this.objectiveText = new Text("", { fill: 0x000000, fontSize: 37, align: "left", wordWrap: true, wordWrapWidth: 700 });
		this.objectiveText.y = -630;
		this.objectiveText.x = 487;
		this.objectiveText.anchor.set(0, 0.5);
		const barBg = new Graphics().beginFill(0x222222).drawRoundedRect(-250, -785, 500, 20, 10).endFill();
		this.fireStatusBar = new Graphics();
		this.endTurnBtn = new Container();
		const finalizar = Sprite.from("finalizar");
		finalizar.scale.set(1.5);
		finalizar.anchor.set(0.5);
		this.endTurnBtn.addChild(finalizar);
		this.endTurnBtn.position.set(0, 400);
		this.endTurnBtn.eventMode = "static";
		this.endTurnBtn.cursor = "pointer";
		this.endTurnBtn.on("pointertap", () => {
			SoundLib.playSound("tap3", {});
			this.endTurn();
			this.endTurnBtn.visible = false;
		});
		this.uiContainer.addChild(
			this.evidenceText,
			barBg,
			this.fireStatusBar,
			this.hectareasText,
			this.visibilityText,
			this.turnStatusText,
			this.objectiveText,
			this.weatherText,
			this.endTurnBtn
		);
		this.updateHectareasUI();
	}

	private updateEvidenceUI(): void {
		if (this.playerRole === "POLITICO_BUENO") {
			this.evidencePoints = Math.max(0, Math.min(5, this.evidencePoints));
			this.evidenceText.text = `PRUEBAS CORRUPCIÓN: ${this.evidencePoints}/5`;
			this.evidenceText.visible = true;
		} else {
			this.evidenceText.visible = false;
		}
	}

	private showRoleSelection(): void {
		const bg = new Graphics().beginFill(0x000000, 0.9).drawRect(-2048, -1536, 4096, 3072).endFill();
		this.overlayContainer.addChild(bg);
		const title = new Text("PATAGONIA: EL NEGOCIO DEL FUEGO", {
			fill: ["#ffffff", "#ffaa00"],
			fontSize: 48,
			fontWeight: "900",
			dropShadow: true,
			dropShadowColor: "#ff4400",
			dropShadowBlur: 15,
		});
		title.anchor.set(0.5);
		title.y = -450;
		this.overlayContainer.addChild(title);
		const roles: { id: PlayerRole; title: string; desc: string; color: number }[] = [
			{ id: "BRIGADISTA", title: "EL BRIGADISTA", desc: "Objetivo: Extinguir focos.\nAliados: Ciudadanos y Políticos Éticos.", color: 0xe67e22 },
			{ id: "POLITICO_BUENO", title: "UN POLÍTICO ÉTICO", desc: "Objetivo: 5 pruebas de corrupción.\nAliados: Brigadistas accionan.", color: 0x3498db },
			{ id: "CIUDADANO", title: "LA CIUDADANÍA", desc: "Objetivo: 100% Conciencia Social.\nAliados: Todos luchan juntos.", color: 0x2ecc71 },
		];
		roles.forEach((role, i) => {
			const card = new Container();
			const rect = new Graphics().beginFill(0x1a1a1a).lineStyle(4, role.color).drawRoundedRect(-250, -100, 500, 160, 20).endFill();
			const txt = new Text(role.title, { fill: role.color, fontSize: 32, fontWeight: "bold" });
			const sub = new Text(role.desc, { fill: 0xcccccc, fontSize: 16, align: "center" });
			txt.anchor.set(0.5, 1);
			txt.y = -5;
			sub.anchor.set(0.5, 0);
			sub.y = 10;
			card.addChild(rect, txt, sub);
			card.y = -150 + i * 220;
			card.eventMode = "static";
			card.cursor = "pointer";
			card.on("pointertap", () => this.startGameAs(role.id));
			this.overlayContainer.addChild(card);
		});
	}

	private startGameAs(role: PlayerRole): void {
		this.playerRole = role;
		this.isPoliticoBuenoPresent = Math.random() > 0.3 || role === "POLITICO_BUENO";
		this.isPlayerTurn = true;
		new Tween(this.overlayContainer)
			.to({ alpha: 0 }, 500)
			.onComplete(() => (this.overlayContainer.visible = false))
			.start();
		this.objectiveText.text = ` ${this.getObjectiveText()}`;
		this.replenishHand();
		this.updateVisibilityUI();
		this.updateEvidenceUI();
		this.showFloatingText(`MODO ${role} INICIADO`, 0, -200, 0xffffff);
	}

	private replenishHand(): void {
		this.endTurnBtn.visible = true;
		if (!this.playerRole) {
			return;
		}
		const limit = this.calculateMaxCards();
		const currentCards = this.cardsContainer.children.length;
		const amountToDraw = limit - currentCards;
		if (amountToDraw <= 0) {
			return;
		}
		const rolePools: Record<PlayerRole, string[]> = {
			BRIGADISTA: ["BOMBEROS", "HIDROAVION", "REFORESTAR", "BOMBEROS", "VIDEO_DRONE"],
			POLITICO_BUENO: ["DENUNCIA", "PEDIDO_INFORME", "REDES_SOCIALES", "COIMA", "MANIFESTACION"],
			CIUDADANO: ["POST_VIRAL", "VIDEO_DRONE", "MANIFESTACION", "REDES_SOCIALES", "POST_VIRAL"],
		};
		const pool = rolePools[this.playerRole];
		for (let i = 0; i < amountToDraw; i++) {
			this.addCardToHand(pool[Math.floor(Math.random() * pool.length)]);
		}
	}

	private addCardToHand(type: string): void {
		const card = new Container() as any;
		card.type = type;
		const cardBg = new Graphics().beginFill(0x1a1a1a).lineStyle(3, 0xffffff).drawRoundedRect(-95, -150, 190, 300, 15).endFill();
		const img = Sprite.from(this.getTextureForType(type));
		img.anchor.set(0.5);
		img.width = 184;
		img.height = 230;
		img.y = -33;
		const txt = new Text(type.replace("_", " "), { fill: 0xffffff, fontSize: 14, fontWeight: "bold" });
		txt.anchor.set(0.5);
		txt.y = 90;
		const discardBtn = new Graphics().beginFill(0xff4444).drawCircle(65, -105, 18).endFill();
		const xText = new Text("X", { fill: 0xffffff, fontSize: 14, fontWeight: "900" });
		xText.anchor.set(0.5);
		xText.position.set(65, -105);
		card.addChild(cardBg, img, txt, discardBtn, xText);
		card.y = 1200;
		card.eventMode = "static";
		card.cursor = "pointer";
		card.on("pointerover", () => {
			SoundLib.playSound("click", {});
			card.isHovered = true;
			card.zIndex = 100;
		});
		card.on("pointerout", () => {
			card.isHovered = false;
			card.zIndex = 0;
		});
		card.on("pointertap", (e: any) => {
			SoundLib.playSound("tap2", {});
			const localPos = e.getLocalPosition(card);
			if (Math.hypot(localPos.x - 65, localPos.y + 105) < 25) {
				this.discardCard(card);
			} else {
				this.playCard(card);
			}
		});
		this.cardsContainer.addChild(card);
		this.reorganizeHand();
	}

	private reorganizeHand(): void {
		const cards = this.cardsContainer.children;
		const total = cards.length;
		const spacing = 170;
		const arc = 0.15;
		cards.forEach((c: any, i) => {
			const offset = i - (total - 1) / 2;
			c.baseRotation = offset * arc;
			new Tween(c)
				.to({ x: offset * spacing, y: 600 + Math.abs(offset) * 30 }, 600)
				.easing(Easing.Elastic.Out)
				.start();
		});
	}

	private discardCard(card: any): void {
		this.showFloatingText("DESCARTADA", card.x, card.y - 100, 0xaaaaaa);
		this.removeCard(card);
	}
	private removeCard(card: any): void {
		new Tween(card)
			.to({ y: -1000, alpha: 0, rotation: 1.5 }, 500)
			.easing(Easing.Back.In)
			.onComplete(() => {
				card.destroy();
				this.reorganizeHand();
			})
			.start();
	}

	private spreadFire(amount: number): void {
		this.hectareasQuemadas += amount;
		this.updateHectareasUI();
	}
	private updateHectareasUI(): void {
		const pct = Math.min(this.hectareasQuemadas / this.hectareasMax, 1);
		this.hectareasText.text = `${Math.floor(this.hectareasQuemadas).toLocaleString()} Ha.`;
		this.fireStatusBar
			.clear()
			.beginFill(0xff3300)
			.drawRoundedRect(-250, -785, 500 * pct, 20, 10)
			.endFill();
		if (pct >= 1) {
			this.gameOver();
		}
	}

	private updateVisibilityUI(): void {
		this.visibilityScore = Math.max(0, Math.min(100, this.visibilityScore));
		this.visibilityText.text = `${this.visibilityScore}%`;
	}

	private highlightEntity(id: string, active: boolean): void {
		const p = this.playersContainer.getChildByName(`player_${id}`);
		if (p) {
			new Tween(p.scale)
				.to({ x: active ? 1.3 : 1, y: active ? 1.3 : 1 }, 400)
				.easing(Easing.Back.Out)
				.start();
		}
	}

	private showFloatingText(msg: string, x: number, y: number, color: number): void {
		const txt = new Text(msg, { fill: color, fontSize: 42, fontWeight: "900", stroke: 0x000000, strokeThickness: 5, align: "center", wordWrap: true, wordWrapWidth: 800 });
		txt.anchor.set(0.5);
		txt.position.set(x, y);
		this.uiContainer.addChild(txt);
		new Tween(txt.scale).from({ x: 0, y: 0 }).to({ x: 1, y: 1 }).easing(Easing.Back.Out).start();
		new Tween(txt)
			.to({ y: y - 150, alpha: 0 }, 3000)
			.onComplete(() => txt.destroy())
			.start();
	}

	private setupBoard(): void {
		const mapa = Sprite.from("mapa");
		mapa.anchor.set(0.5);
		mapa.alpha = 0.5;
		this.boardContainer.addChild(mapa);
		const focos = [
			{ name: "Bosque Milenario", x: -250, y: -200, intensity: 4 },
			{ name: "Reserva Sur", x: 200, y: 250, intensity: 5 },
		];
		focos.forEach((f) => this.boardContainer.addChild(this.createFireNode(f)));
	}

	private setupPlayers(): void {
		const pData = [
			{ id: "politico", name: "CORRUPCIÓN", x: 700, y: -400, color: 0xe74c3c, spr: "corrupcion" },
			{ id: "inmobiliaria", name: "INTERÉS PRIVADO", x: 950, y: 400, color: 0xf1c40f, spr: "privado" },
		];
		pData.forEach((p) => {
			const c = new Container();
			c.name = `player_${p.id}`;
			c.position.set(p.x, p.y);
			const spr = Sprite.from(`${p.spr}`);
			spr.anchor.set(0.5);
			spr.scale.set(0.25);
			c.addChild(spr);
			this.playersContainer.addChild(c);
		});
	}

	private getObjectiveText(): string {
		if (this.playerRole === "BRIGADISTA") {
			return "Extinguir todos los focos.";
		}
		if (this.playerRole === "POLITICO_BUENO") {
			return "Juntar 5 pruebas de corrupción.";
		}
		if (this.playerRole === "CIUDADANO") {
			return "Alcanzar 100% Conciencia Social.";
		}
		return "";
	}

	private getTextureForType(type: string): string {
		const map: any = {
			BOMBEROS: "bombero",
			DENUNCIA: "denuncia",
			POST_VIRAL: "postviral",
			REDES_SOCIALES: "redessociales",
			COIMA: "coima",
			MANIFESTACION: "manifestacion",
			HIDROAVION: "hidroavion",
			VIDEO_DRONE: "videodrone",
			PEDIDO_INFORME: "pedidoinforme",
			REFORESTAR: "woods",
		};
		return map[type] || "cards";
	}

	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 1024, 1536, ScaleHelper.forceHeight);
		this.worldContainer.x = w * 0.5;
		this.worldContainer.y = h * 0.5;

		// Asegurar que los efectos cubren la pantalla tras resize
		if (this.smokeOverlay) {
			const scale = Math.max(this.WORLD_BOUNDS.width / this.smokeOverlay.texture.width, this.WORLD_BOUNDS.height / this.smokeOverlay.texture.height) * 1.2;
			this.smokeOverlay.scale.set(scale);
		}

		if (this.vignetteOverlay) {
			// Redibujar viñeta para ajustar a nuevos límites si cambiaron
			const burnPercentage = this.hectareasQuemadas / this.hectareasMax;
			if (burnPercentage > 0.4 && !this.gameEnded) {
				const intensity = (burnPercentage - 0.4) / 0.6;
				const redComponent = Math.floor(intensity * 255);
				const vignetteColor = redComponent << 16;
				this.drawVignette(vignetteColor, Math.min(0.8, intensity * 0.9));
			} else if (this.gameEnded && this.hectareasQuemadas >= this.hectareasMax) {
				this.drawVignette(0xff0000, 0.8);
			}
		}
	}
}
