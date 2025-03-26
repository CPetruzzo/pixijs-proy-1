import { Graphics } from "@pixi/graphics";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import Random from "../../../engine/random/Random";

export class JubilpostorGameScene extends PixiScene {
	public static readonly BUNDLES = ["img", "jubilpostor"];

	// Contenedores para separar elementos
	private worldContainer: Container = new Container();
	private crowdContainer: Container = new Container();
	private infiltradoContainer: Container = new Container();
	private reporterContainer: Container = new Container();
	private hudContainer: Container = new Container();
	// Ticker de noticias
	private tickerContainer: Container = new Container();
	private tickerText: Text | null = null;
	private tickerSpeed: number = 1;
	private tickerQueue: string[] = [];
	private readonly tickerWidth: number = 600; // Zona centrada para el ticker

	// Modo de marcado: si true, al hacer click sobre una persona se marca/desmarca
	private markingMode: boolean = false;

	// Variables de opinión (0 a 100)
	private tensionPublica: number = 0;
	private caosMediatico: number = 0;
	private desacreditacionMediatica: number = 0;

	// Gráficos para barras de opinión
	private barTension: Graphics = new Graphics();
	private barCaos: Graphics = new Graphics();
	private barDesacreditacion: Graphics = new Graphics();

	private readonly backgroundSize = { width: 1000, height: 800 };

	constructor() {
		super();
		this.name = "GuardianesDeLaMarchaGameScene";

		// Configuración del contenedor principal
		this.worldContainer.name = "WORLD CONTAINER";
		this.addChild(this.worldContainer);

		// Fondo base (sprite "street")
		const background = Sprite.from("street");
		background.width = this.backgroundSize.width;
		background.height = this.backgroundSize.height;
		this.worldContainer.addChild(background);

		// Agregar contenedores de elementos
		this.worldContainer.addChild(this.crowdContainer);
		this.worldContainer.addChild(this.infiltradoContainer);
		this.worldContainer.addChild(this.reporterContainer);
		this.addChild(this.hudContainer);

		// Crear ticker de noticias y agregarlo al hud
		this.createNewsTicker();

		// Crear manifestantes (usando sprite "protester")
		for (let i = 0; i < 80; i++) {
			const x = Math.random() * this.backgroundSize.width;
			const y = Math.random() * this.backgroundSize.height;
			const manifestante = this.createProtester(x, y);
			this.crowdContainer.addChild(manifestante);
		}

		// Crear infiltrados (usando sprite "impostor")
		for (let i = 0; i < 8; i++) {
			const x = Math.random() * this.backgroundSize.width;
			const y = Math.random() * this.backgroundSize.height;
			const infiltrado = this.createInfiltrator(x, y);
			this.infiltradoContainer.addChild(infiltrado);
		}

		// Crear reporteros (usando sprite "cameraman")
		for (let i = 0; i < 2; i++) {
			const x = Math.random() * this.backgroundSize.width;
			const y = Math.random() * this.backgroundSize.height;
			const target = this.getRandomPlayer();
			const reporter = this.createReporter(x, y, target);
			this.reporterContainer.addChild(reporter);
		}

		// Crear UI: botones y barras de opinión
		this.createUI();

		// Hacer interactivo el mundo para detectar clics en los personajes
		this.interactive = true;
		this.on("pointertap", this.onWorldClick, this);
	}

	private createProtester(x: number, y: number): Sprite {
		const randomNumber = Random.shared.randomInt(1, 3);
		const protester = Sprite.from(`protester${randomNumber}`);
		protester.anchor.set(0.5);
		protester.width = 160 * 0.15;
		protester.height = 270 * 0.15;
		protester.x = x;
		protester.y = y;
		protester.name = "protester";
		(protester as any).isMarked = false;
		(protester as any).isBeingInterviewed = false;
		return protester;
	}

	private createInfiltrator(x: number, y: number): Sprite {
		const infiltrator = Sprite.from("protester4");
		infiltrator.anchor.set(0.5);
		infiltrator.width = 160 * 0.15;
		infiltrator.height = 270 * 0.15;
		infiltrator.x = x;
		infiltrator.y = y;
		infiltrator.tint = 0xff0001;
		infiltrator.name = "infiltrator";
		(infiltrator as any).isMarked = false;
		(infiltrator as any).isBeingInterviewed = false;
		return infiltrator;
	}

	private createReporter(x: number, y: number, target: Sprite | Graphics | null): Sprite {
		const reporter = Sprite.from("cameraman");
		reporter.anchor.set(0.5);
		reporter.scale.set(0.1);
		reporter.x = x;
		reporter.y = y;
		reporter.name = "reporter";
		(reporter as any).target = target;
		(reporter as any).interviewTimer = 0;
		(reporter as any).isInterviewing = false;
		(reporter as any).leaveTimer = 0;
		return reporter;
	}

	private getRandomPlayer(): Sprite | Graphics | null {
		const crowd = this.crowdContainer.children.filter((child: any) => !child.isBeingInterviewed) as (Sprite | Graphics)[];
		const infiltrators = this.infiltradoContainer.children.filter((child: any) => !child.isBeingInterviewed) as (Sprite | Graphics)[];
		const allPlayers = crowd.concat(infiltrators);
		if (allPlayers.length === 0) {
			return null;
		}
		const randomIndex = Math.floor(Math.random() * allPlayers.length);
		return allPlayers[randomIndex];
	}

	private createUI(): void {
		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 16,
			fill: "white",
		});

		const markButton = new Graphics();
		markButton.beginFill(0x0000ff);
		markButton.drawRoundedRect(0, 0, 140, 30, 5);
		markButton.endFill();
		markButton.x = 10;
		markButton.y = 10;
		markButton.interactive = true;
		markButton.on("pointertap", () => {
			this.markingMode = !this.markingMode;
			markText.text = this.markingMode ? "Marcado: ON" : "Marcado: OFF";
		});
		this.hudContainer.addChild(markButton);

		const markText = new Text("Marcado: OFF", style);
		markText.x = 15;
		markText.y = 15;
		this.hudContainer.addChild(markText);

		const removeButton = new Graphics();
		removeButton.beginFill(0x333333);
		removeButton.drawRoundedRect(0, 0, 180, 30, 5);
		removeButton.endFill();
		removeButton.x = 10;
		removeButton.y = 50;
		removeButton.interactive = true;
		removeButton.on("pointertap", () => {
			this.removeMarkedInfiltrators();
		});
		this.hudContainer.addChild(removeButton);

		const removeText = new Text("Retirar Infiltrados", style);
		removeText.x = 15;
		removeText.y = 55;
		this.hudContainer.addChild(removeText);

		this.setupOpinionBar(this.barTension, "Tensión Pública", 90, 10, style);
		this.setupOpinionBar(this.barCaos, "Caos Mediático", 110, 10, style);
		this.setupOpinionBar(this.barDesacreditacion, "Desacreditación", 130, 10, style);
		this.hudContainer.addChild(this.barTension);
		this.hudContainer.addChild(this.barCaos);
		this.hudContainer.addChild(this.barDesacreditacion);
	}

	private setupOpinionBar(bar: Graphics, label: string, posY: number, posX: number, style: TextStyle): void {
		const text = new Text(label, style);
		text.x = posX;
		text.y = posY;
		this.hudContainer.addChild(text);
		this.updateBarGraphics(bar, 0, posX + 120, posY, 200, 10, 0x00ff00);
	}

	private updateBarGraphics(bar: Graphics, value: number, x: number, y: number, width: number, height: number, color: number): void {
		bar.clear();
		bar.beginFill(0x444444);
		bar.drawRect(x, y, width, height);
		bar.endFill();
		const filledWidth = (value / 100) * width;
		bar.beginFill(color);
		bar.drawRect(x, y, filledWidth, height);
		bar.endFill();
	}

	private updateOpinionBarsGraphics(): void {
		this.updateBarGraphics(this.barTension, this.tensionPublica, 130, 90, 200, 10, 0xffaa00);
		this.updateBarGraphics(this.barCaos, this.caosMediatico, 130, 110, 200, 10, 0xff0000);
		this.updateBarGraphics(this.barDesacreditacion, this.desacreditacionMediatica, 130, 130, 200, 10, 0xffff00);
	}

	private onWorldClick(event: any): void {
		if (!this.markingMode) {
			return;
		}
		const pos = event.data.getLocalPosition(this.worldContainer);
		for (const child of this.crowdContainer.children.concat(this.infiltradoContainer.children)) {
			const dx = pos.x - child.x;
			const dy = pos.y - child.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < 15) {
				this.toggleMark(child as Sprite);
				break;
			}
		}
	}

	private toggleMark(target: Sprite): void {
		const isMarked = (target as any).isMarked;
		(target as any).isMarked = !isMarked;
		if (target.getChildByName("markSymbol")) {
			target.removeChild(target.getChildByName("markSymbol")!);
		}
		if (!isMarked) {
			const markSymbol = new Graphics();
			markSymbol.name = "markSymbol";
			markSymbol.beginFill(0xff0000);
			markSymbol.drawCircle(0, -target.height * 6, 25);
			markSymbol.endFill();
			target.addChild(markSymbol);
		}
	}

	private removeMarkedInfiltrators(): void {
		const toRemove: Sprite[] = [];
		for (const child of this.infiltradoContainer.children) {
			if ((child as any).isMarked) {
				toRemove.push(child as Sprite);
			}
		}
		for (const infiltrator of toRemove) {
			this.infiltradoContainer.removeChild(infiltrator);
			this.reporterContainer.children.forEach((reporter: any) => {
				if (reporter.target === infiltrator) {
					reporter.target = null;
				}
			});
			infiltrator.destroy();
		}
	}

	// Crea el cuadro de entrevista (con fondo negro redondeado y texto blanco)
	private createInterviewBox(target: Sprite | Graphics, message: string): Container {
		const container = new Container();
		const bg = new Graphics();
		bg.beginFill(0x000000);
		bg.drawRoundedRect(0, 0, 160, 60, 8);
		bg.endFill();
		bg.alpha = 0.7;
		container.addChild(bg);
		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 12,
			fill: "white",
			wordWrap: true,
			wordWrapWidth: 150,
		});
		const text = new Text(message, style);
		text.anchor.set(0.5);
		text.x = 80;
		text.y = 30;
		container.addChild(text);
		// Posicionar el cuadro sobre el target
		container.x = target.x - 80;
		container.y = target.y - 50;
		return container;
	}

	// Ticker de noticias: crea el contenedor del ticker en la parte inferior de la escena
	private createNewsTicker(): void {
		const tickerBg = new Graphics();
		tickerBg.beginFill(0x000000);
		tickerBg.drawRoundedRect(0, 0, this.tickerWidth, 30, 8);
		tickerBg.endFill();
		tickerBg.alpha = 0.8;
		this.tickerContainer.addChild(tickerBg);

		// Crear la máscara con las mismas dimensiones que el ticker
		const mask = new Graphics();
		mask.beginFill(0xffffff);
		mask.drawRect(0, 0, this.tickerWidth, 30);
		mask.endFill();
		// Asignar la máscara al contenedor del ticker
		this.tickerContainer.mask = mask;
		// Agregar la máscara al tickerContainer o al hudContainer según convenga
		this.tickerContainer.addChild(mask);

		this.addChild(this.tickerContainer);
	}

	// Agrega un mensaje al ticker
	private pushTickerMessage(message: string): void {
		const fullMessage = `Testimonio de un jubilado: ${message}`;
		this.tickerQueue.push(fullMessage);
		if (!this.tickerText) {
			this.createTickerText();
		}
	}

	// Crea el texto del ticker, que comenzará desde el extremo derecho del ticker
	private createTickerText(): void {
		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 16,
			fill: "white",
		});
		this.tickerText = new Text(this.tickerQueue.shift() || "", style);
		this.tickerText.x = this.tickerWidth;
		this.tickerText.y = this.tickerText.height * 0.25;
		this.tickerContainer.addChild(this.tickerText);
	}

	// Actualiza el ticker: desplaza el texto hacia la izquierda dentro de la zona definida
	private updateNewsTicker(_dt: number): void {
		if (this.tickerText) {
			this.tickerText.x -= this.tickerSpeed * _dt * 0.05;
			if (this.tickerText.x + this.tickerText.width < 0) {
				this.tickerContainer.removeChild(this.tickerText);
				this.tickerText.destroy();
				this.tickerText = null;
				if (this.tickerQueue.length > 0) {
					this.createTickerText();
				}
			}
		}
	}

	public override update(_dt: number): void {
		const marginX = 200;
		const marginY = 250;
		const bgWidth = this.backgroundSize.width;
		const bgHeight = this.backgroundSize.height;

		// Incremento de Tensión Pública: si un infiltrado se encuentra cerca de otros (distancia < 50px)
		this.infiltradoContainer.children.forEach((child: any) => {
			this.crowdContainer.children.concat(this.infiltradoContainer.children).forEach((other: any) => {
				if (child !== other) {
					const dx = child.x - other.x;
					const dy = child.y - other.y;
					const distance = Math.sqrt(dx * dx + dy * dy);
					if (distance < 50) {
						this.tensionPublica = Math.min(100, this.tensionPublica + (0.02 * _dt) / 1600);
					}
				}
			});
		});

		// Movimiento aleatorio de infiltrados (si no están en entrevista)
		this.infiltradoContainer.children.forEach((child: any) => {
			if (!child.isBeingInterviewed) {
				child.x += (Math.random() - 0.5) * 2;
				child.y += (Math.random() - 0.5) * 2;
				child.x = Math.max(marginX, Math.min(bgWidth - marginX, child.x));
				child.y = Math.max(marginY, Math.min(bgHeight - marginY, child.y));
			}
		});

		// Movimiento aleatorio sutil de manifestantes (si no están en entrevista)
		this.crowdContainer.children.forEach((child: any) => {
			if (!child.isBeingInterviewed) {
				child.x += Math.random() - 0.5;
				child.y += Math.random() - 0.5;
				child.x = Math.max(marginX, Math.min(bgWidth - marginX, child.x));
				child.y = Math.max(marginY, Math.min(bgHeight - marginY, child.y));
			}
		});

		// Movimiento dirigido de reporteros hacia su objetivo e implementación de entrevista
		this.reporterContainer.children.forEach((child: any) => {
			if (!child.target) {
				child.target = this.getRandomPlayer();
			}
			const target: Sprite | Graphics | null = child.target;
			if (target) {
				const dx = target.x - child.x;
				const dy = target.y - child.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < 30) {
					if (!child.isInterviewing) {
						// Inicia la entrevista
						child.isInterviewing = true;
						child.interviewTimer = 8000; // 8 segundos
						(target as any).isBeingInterviewed = true;
						const timerText = new Text("8.0", { fontFamily: "Arial", fontSize: 14, fill: "white" });
						timerText.name = "interviewTimerText";
						timerText.x = -10;
						timerText.y = -20;
						child.addChild(timerText);
						// Seleccionar mensaje según tipo y enviar al ticker
						let messages: string[] = [];
						if (target.name === "protester") {
							messages = [
								"quiero una jubilación digna",
								"trabajé toda la vida y nunca pensé que iba a llegar a grande así",
								"quiero que el presidente Milei piense que él algún día va a ser viejo",
								"esto no es Cristina, Alberto, Massa, Macri o Milei, somos nosotros",
							];
						} else if (target.name === "infiltrator") {
							messages = ["la verdad que yo vine porque me pagó la oposición", "aguante la camporaaaa", "solo vine por los choripanes"];
						}
						if (messages.length > 0) {
							const chosen = messages[Random.shared.randomInt(0, messages.length - 1)];
							const interviewBox = this.createInterviewBox(target, chosen);
							child.interviewBox = interviewBox;
							this.worldContainer.addChild(interviewBox);
							this.pushTickerMessage(chosen);
						}
					} else {
						// Durante la entrevista, decrementa el timer
						child.interviewTimer -= _dt;
						const timerText = child.getChildByName("interviewTimerText") as Text;
						if (timerText) {
							timerText.text = (child.interviewTimer / 1000).toFixed(1);
						}
						// Actualizar posición del cuadro de entrevista para que siga al target
						if (child.interviewBox) {
							const box: Container = child.interviewBox;
							box.x = target.x - 80;
							box.y = target.y - 50;
						}
						if (child.interviewTimer <= 0) {
							// Finaliza la entrevista: liberar target y eliminar cuadro
							child.isInterviewing = false;
							(target as any).isBeingInterviewed = false;
							if (child.getChildByName("interviewTimerText")) {
								child.removeChild(child.getChildByName("interviewTimerText"));
							}
							if (child.interviewBox) {
								this.worldContainer.removeChild(child.interviewBox);
								delete child.interviewBox;
							}
							child.target = this.getRandomPlayer();
						}
					}
				} else {
					if (!child.isInterviewing) {
						const speed = 0.3;
						child.x += (dx / dist) * speed;
						child.y += (dy / dist) * speed;
					}
					if (target.name === "infiltrator" && dist < 31) {
						this.desacreditacionMediatica = Math.min(100, this.desacreditacionMediatica + 1);
					}
				}
			} else {
				const newTarget = this.getRandomPlayer();
				if (newTarget) {
					child.target = newTarget;
				} else {
					// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
					child.leaveTimer = (child.leaveTimer || 0) + _dt;
					if (child.leaveTimer > 3000) {
						this.reporterContainer.removeChild(child);
						child.destroy();
					}
				}
			}
		});

		this.updateOpinionBarsGraphics();
		this.updateNewsTicker(_dt);
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, newW, newH, 1000, 800, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.hudContainer, newW, newH, 1000, 800, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.tickerContainer, newW, newH, 1000, 800, ScaleHelper.FIT);

		this.tickerContainer.x = newW * 0.5 - this.tickerContainer.width * 0.5;
		this.tickerContainer.y = newH * 0.9;
		this.worldContainer.x = newW * 0.5 - this.worldContainer.width * 0.5;
		this.worldContainer.y = newH * 0.5 - this.worldContainer.height * 0.5;
		this.hudContainer.x = 0;
		this.hudContainer.y = 0;
	}
}
