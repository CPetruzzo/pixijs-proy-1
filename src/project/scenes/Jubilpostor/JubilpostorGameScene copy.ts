/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Graphics } from "@pixi/graphics";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import Random from "../../../engine/random/Random";
import { ColorMatrixFilter } from "pixi.js";
import { Easing, Tween } from "tweedle.js";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Manager } from "../../..";
import { Flag } from "./Flag";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";

interface PoliceTween {
	startX: number;
	startY: number;
	targetX: number;
	targetY: number;
	duration: number;
	elapsed: number;
}

export class JubilpostorGameScene extends PixiScene {
	public static readonly BUNDLES = ["img", "jubilpostor"];

	// Agregar la propiedad para el filtro en la clase
	private dayNightFilter: ColorMatrixFilter;
	// Contenedores
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

	// Modo de marcado
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

	// Sprites de la policía
	private policeTruck: Sprite | null = null;
	private policeman: Sprite | null = null;

	// Agrega una propiedad para evitar múltiples disparos del final del juego
	private gameEnded: boolean = false;

	// Agrega nuevas propiedades al inicio de la clase
	private currentMarchTime: number = 17 * 60; // En minutos (17:00 -> 1020 minutos)
	private marchTimerText: Text | null = null;
	// Nuevo contenedor para el equipo de policías fijos
	private policeTeamContainer: Container = new Container();

	// Agrega estas propiedades a la clase
	private policeTruckTween: PoliceTween | null = null;
	private charactersToLoad: (Sprite | Graphics)[] = [];
	private truckExitScheduled: boolean = false;

	private lightsContainer: Container = new Container();

	// private TENSION_PUBLICA: number = 0.005;
	private TENSION_PUBLICA: number = 0.0015;
	private TEXT_SPEED: number = 0.05;
	private TIME_SPEED: number = 3;
	private INITIAL_REPORTERS: number = 4;
	private INITIAL_PROTESTER: number = 2000;
	private INITIAL_INFILTRATORS: number = 60;
	private timeContainer: Container = new Container();
	private CAOS_FACTOR: number = 40;
	private DESACREDITACION_FACTOR: number = 20;
	private JUBILADO_FACTOR: number = 0.1;
	private NEWREPORTERS: number = 5;

	constructor() {
		super();
		this.name = "JubilpostorGame";

		this.worldContainer.name = "WORLD CONTAINER";
		this.addChild(this.worldContainer);
		this.worldContainer.sortableChildren = true;

		SoundLib.stopAllMusic();
		SoundLib.playMusic("marcha", { volume: 0.2 });
		// En el constructor, después de crear el worldContainer:
		this.dayNightFilter = new ColorMatrixFilter();
		this.worldContainer.filters = [this.dayNightFilter];

		const background = Sprite.from("street");
		background.width = this.backgroundSize.width;
		background.height = this.backgroundSize.height;
		this.worldContainer.addChild(background);

		this.worldContainer.addChild(this.crowdContainer);
		this.worldContainer.addChild(this.infiltradoContainer);
		this.worldContainer.addChild(this.reporterContainer);
		// Inicializar contenedor de luces y agregarlo al world
		this.initLights();
		this.addChild(this.lightsContainer);
		this.addChild(this.timeContainer);
		this.addChild(this.hudContainer);

		// Agregar el contenedor del equipo de policías
		this.createPoliceTeam();
		this.worldContainer.addChild(this.policeTeamContainer);

		this.createNewsTicker();

		for (let i = 0; i < this.INITIAL_PROTESTER; i++) {
			const x = Math.random() * this.backgroundSize.width;
			const y = Math.random() * this.backgroundSize.height;
			const manifestante = this.createProtester(x, y);
			this.crowdContainer.addChild(manifestante);
		}

		for (let i = 0; i < this.INITIAL_INFILTRATORS; i++) {
			const x = Math.random() * this.backgroundSize.width;
			const y = Math.random() * this.backgroundSize.height;
			const infiltrado = this.createInfiltrator(x, y);
			this.infiltradoContainer.addChild(infiltrado);
		}

		for (let i = 0; i < this.INITIAL_REPORTERS; i++) {
			const x = Math.random() * this.backgroundSize.width;
			const y = Math.random() * this.backgroundSize.height;
			const target = this.getRandomPlayer();
			const reporter = this.createReporter(x, y, target);
			this.reporterContainer.addChild(reporter);
		}

		const flag1 = new Flag(this.worldContainer, 500, 350, "flag", 0.2);
		console.log("flag1", flag1);
		const flag2 = new Flag(this.worldContainer, 300, 500, "flag2", 0.2, 0.14);
		console.log("flag2", flag2);
		this.createUI();
		this.createMarchTimer();

		this.interactive = true;
		this.eventMode = "static";
		this.on("pointertap", this.onWorldClick, this);
	}

	private createPoliceTeam(): void {
		const marginX = 170;
		const marginY = 205;
		const rect = {
			x: marginX,
			y: marginY,
			width: this.backgroundSize.width - marginX * 2,
			height: this.backgroundSize.height - marginY * 2,
		};

		const spacing = 50;

		// Función para aplicar tween de "respiración" al sprite
		const applyBreathingTween = (police: Sprite): void => {
			// Tomamos la escala base en Y
			const baseScaleY = police.scale.y;
			// Calculamos el objetivo (por ejemplo, un 10% más grande)
			const targetScaleY = baseScaleY * 1.05;
			// Duración base de 1000 ms, con un offset aleatorio de ±50ms
			const duration = 1000 + (Math.random() * 100 - 50);

			new Tween(police.scale).to({ y: targetScaleY }, duration).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start();
		};

		// Borde superior
		for (let x = rect.x; x <= rect.x + rect.width; x += spacing) {
			const police = Sprite.from("policeman");
			police.scale.set(0.15);
			police.anchor.set(0.5, 1);
			police.x = x;
			police.y = rect.y + 20;
			this.policeTeamContainer.addChild(police);
			applyBreathingTween(police);
		}

		// Borde inferior
		for (let x = rect.x; x <= rect.x + rect.width; x += spacing) {
			const police = Sprite.from("policeman");
			police.scale.set(0.15);
			police.anchor.set(0.5, 1);
			police.x = x;
			police.y = rect.y + rect.height;
			this.policeTeamContainer.addChild(police);
			applyBreathingTween(police);
		}

		// Borde izquierdo (excluyendo esquinas para no duplicar)
		for (let y = rect.y + spacing; y < rect.y + rect.height; y += spacing) {
			const police = Sprite.from("policeman");
			police.anchor.set(0.5, 1);
			police.scale.set(0.15);
			police.x = rect.x;
			police.y = y;
			this.policeTeamContainer.addChild(police);
			applyBreathingTween(police);
		}

		// Borde derecho
		for (let y = rect.y + spacing; y < rect.y + rect.height; y += spacing) {
			const police = Sprite.from("policeman");
			police.anchor.set(0.5, 1);
			police.scale.set(0.15);
			police.x = rect.x + rect.width;
			police.y = y;
			this.policeTeamContainer.addChild(police);
			applyBreathingTween(police);
		}
	}

	private createProtester(x: number, y: number): Sprite {
		const randomNumber = Random.shared.randomInt(1, 4);
		const protester = Sprite.from(`protester${randomNumber}`);
		protester.anchor.set(0.5);
		protester.scale.set(0.15);
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
		infiltrator.scale.set(0.15);
		infiltrator.alpha = 0.8;
		infiltrator.x = x;
		infiltrator.y = y;
		infiltrator.zIndex = 2;
		infiltrator.tint = 0xff0000;
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
			fontFamily: "DK Boarding House III",
			fontSize: 16,
			fill: 0xffffff,
			dropShadowDistance: 5,
			dropShadow: true,
			dropShadowColor: 0x000000,
		});

		const markButton = new Graphics();
		markButton.beginFill(0x0000ff);
		markButton.drawRoundedRect(-100, 0, 200, 50, 5);
		markButton.endFill();
		markButton.x = 110;
		markButton.y = -20;
		markButton.interactive = true;
		markButton.on("pointertap", () => {
			this.markingMode = !this.markingMode;
			markText.text = this.markingMode ? "Marcado: ON" : "Marcado: OFF";
		});
		this.hudContainer.addChild(markButton);

		const markText = new Text("Marcado: OFF", style);
		markText.x = -markText.width * 0.5;
		markText.y = 15;
		markButton.addChild(markText);

		const removeButton = new Graphics();
		removeButton.beginFill(0x333333);
		removeButton.drawRoundedRect(-100, 0, 200, 50, 5);
		removeButton.endFill();
		removeButton.x = 110;
		removeButton.y = 35;
		removeButton.interactive = true;
		removeButton.on("pointertap", () => {
			this.removeMarkedInfiltrators();
		});
		this.hudContainer.addChild(removeButton);

		const removeText = new Text("Retirar Infiltrados", style);
		removeText.x = -removeText.width * 0.5;
		removeText.y = 15;
		removeButton.addChild(removeText);

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
			if (distance < 15 && child.name === "infiltrator") {
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

	private createInterviewBox(target: Sprite | Graphics, message: string): Container {
		const container = new Container();
		const bg = new Graphics();

		const fillColor = target.name === "infiltrator" ? 0xff0000 : 0x0000ff;

		bg.beginFill(fillColor);
		bg.drawRoundedRect(0, 0, 160, 60, 8);
		bg.endFill();
		bg.alpha = 0.7;
		container.addChild(bg);

		const style = new TextStyle({
			fontSize: 12,
			fill: 0xffffff,
			dropShadowDistance: 5,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
			align: "center",
			wordWrap: true,
			wordWrapWidth: 150,
		});

		const text = new Text(message, style);
		text.anchor.set(0.5);
		text.x = 80;
		text.y = 30;
		container.addChild(text);

		container.x = target.x - 80;
		container.y = target.y - 50;

		return container;
	}

	private createNewsTicker(): void {
		const tickerBg = new Graphics();
		tickerBg.beginFill(0x000000);
		tickerBg.drawRoundedRect(0, 0, this.tickerWidth, 30, 8);
		tickerBg.endFill();
		tickerBg.alpha = 0.8;
		this.tickerContainer.addChild(tickerBg);
		const mask = new Graphics();
		mask.beginFill(0xffffff);
		mask.drawRect(0, 0, this.tickerWidth, 30);
		mask.endFill();
		this.tickerContainer.mask = mask;
		this.tickerContainer.addChild(mask);

		this.tickerContainer.x = 0;
		this.tickerContainer.y = this.backgroundSize.height - 30;
		this.tickerContainer.pivot.set(this.tickerContainer.width * 0.5, this.tickerContainer.height * 0.5);
		this.addChild(this.tickerContainer);
	}

	private pushTickerMessage(message: string): void {
		const fullMessage = `Testimonio de un jubilado: ${message}`;
		this.tickerQueue.push(fullMessage);
		if (!this.tickerText) {
			this.createTickerText();
		}
	}

	private createTickerText(): void {
		const style = new TextStyle({
			fontSize: 16,
			fill: 0xffffff,
			dropShadowDistance: 5,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
			align: "center",
		});
		this.tickerText = new Text(this.tickerQueue.shift() || "", style);
		this.tickerText.x = this.tickerWidth;
		this.tickerText.y = this.tickerText.height * 0.25;
		this.tickerContainer.addChild(this.tickerText);
	}

	private updateNewsTicker(_dt: number): void {
		if (this.tickerText) {
			this.tickerText.x -= this.tickerSpeed * _dt * this.TEXT_SPEED;
			if (this.tickerText.x + this.tickerText.width * 0.5 < 0) {
				this.tickerContainer.removeChild(this.tickerText);
				this.tickerText.destroy();
				this.tickerText = null;
				if (this.tickerQueue.length > 0) {
					this.createTickerText();
				}
			}
		}
	}

	private initLights(): void {
		const positions = [
			{ x: 300, y: 200 },
			{ x: 700, y: 600 },
			{ x: 500, y: 400 },
			{ x: 1300, y: 750 },
		];
		positions.forEach((pos) => {
			const light = this.createLightSprite(500, 0xffee88);
			light.x = pos.x;
			light.y = pos.y;
			light.alpha = 0.1;
			new Tween(light).to({ alpha: 0.15 }, 1500).easing(Easing.Quadratic.InOut).repeat(Infinity).yoyo(true).start();

			(light as any).baseRadius = 250;
			this.lightsContainer.addChild(light);
		});
	}

	private handleTensionMax(): void {
		const allCharacters: (Sprite | Graphics)[] = this.crowdContainer.children.concat(this.infiltradoContainer.children) as (Sprite | Graphics)[];
		const countToRemove = Math.ceil(allCharacters.length * 0.001);
		const groupToRemove: (Sprite | Graphics)[] = [];
		// Seleccionar aleatoriamente sin repetir
		while (groupToRemove.length < countToRemove && allCharacters.length > 0) {
			const randomIndex = Math.floor(Math.random() * allCharacters.length);
			const selected = allCharacters.splice(randomIndex, 1)[0];
			groupToRemove.push(selected);
		}

		this.policeTruck = Sprite.from("policetruck");
		this.policeTruck.anchor.set(0.5);
		this.policeTruck.scale.set(0.15);

		this.policeTruck.x = this.backgroundSize.width + this.policeTruck.width;
		this.policeTruck.y = this.backgroundSize.height * 0.5;
		this.worldContainer.addChild(this.policeTruck);

		const truckTargetX = this.backgroundSize.width - this.policeTruck.width;
		this.policeTruckTween = {
			startX: this.policeTruck.x,
			startY: this.policeTruck.y,
			targetX: truckTargetX,
			targetY: this.policeTruck.y,
			duration: 1000,
			elapsed: 0,
		};

		SoundLib.playSound("police_siren", { volume: 0.3, end: 4 });

		this.policeman = Sprite.from("policeman");
		this.policeman.anchor.set(0.5);
		this.policeman.scale.set(0.15);

		this.policeman.x = this.policeTruck.x - 50;
		this.policeman.y = this.policeTruck.y;

		this.charactersToLoad = groupToRemove;

		const pointsToAdd = groupToRemove.length * this.CAOS_FACTOR;
		this.caosMediatico = Math.min(100, this.caosMediatico + pointsToAdd);
		console.log(`Caos mediático incrementado en ${pointsToAdd} puntos. Nuevo valor: ${this.caosMediatico}`);

		if (this.caosMediatico >= 100) {
			for (let i = 0; i < this.NEWREPORTERS; i++) {
				const x = Math.random() * this.backgroundSize.width;
				const y = Math.random() * this.backgroundSize.height;
				const target = this.getRandomPlayer();
				const newReporter = this.createReporter(x, y, target);
				this.reporterContainer.addChild(newReporter);
			}
			console.log(`Caos mediático alcanzó 100: se han agregado ${this.NEWREPORTERS} reporteros.`);
			this.caosMediatico = 0;
		}
	}

	private updatePoliceTweens(_dt: number): void {
		const containers = [this.crowdContainer, this.infiltradoContainer];
		containers.forEach((container) => {
			container.children.forEach((child: any) => {
				if (child.policeTween) {
					child.policeTween.elapsed += _dt;
					const t = Math.min(child.policeTween.elapsed / child.policeTween.duration, 1);
					child.x = child.policeTween.startX + (child.policeTween.targetX - child.policeTween.startX) * t;
					child.y = child.policeTween.startY + (child.policeTween.targetY - child.policeTween.startY) * t;
					if (t === 1) {
						container.removeChild(child);
						child.destroy();
					}
				}
			});
		});
	}

	public override update(_dt: number): void {
		if (this.gameEnded) {
			return;
		}
		const marginX = 200;
		const marginY = 250;
		const bgWidth = this.backgroundSize.width;
		const bgHeight = this.backgroundSize.height;

		const startTime = 17 * 60; // 17:00 en minutos
		const endTime = 21 * 60; // 21:00 en minutos
		// Calcular el valor 't' en el rango [0,1]
		const t = Math.min(1, Math.max(0, (this.currentMarchTime - startTime) / (endTime - startTime)));
		// Mapeamos t a un brillo: 1 en 17:00 y 0.5 en 21:00 (podés ajustar el valor final según convenga)
		const brightness = 1 - t * (1 - 0.35);
		this.dayNightFilter.brightness(brightness, false);

		if (this.policeTruckTween && this.policeTruck) {
			this.policeTruckTween.elapsed += _dt;
			const t = Math.min(this.policeTruckTween.elapsed / this.policeTruckTween.duration, 1);
			this.policeTruck.x = this.policeTruckTween.startX + (this.policeTruckTween.targetX - this.policeTruckTween.startX) * t;
			this.policeTruck.y = this.policeTruckTween.startY;
			if (t === 1) {
				// Si era el tween de entrada...
				if (this.policeTruckTween.targetX < this.policeTruckTween.startX) {
					if (!this.worldContainer.children.includes(this.policeman)) {
						this.worldContainer.addChild(this.policeman);
					}
					this.charactersToLoad.forEach((character: any) => {
						const tween: PoliceTween = {
							startX: character.x,
							startY: character.y,
							targetX: this.policeTruck.x,
							targetY: this.policeTruck.y,
							duration: 3000,
							elapsed: 0,
						};
						character.policeTween = tween;
					});
					this.charactersToLoad = [];
					if (!this.truckExitScheduled) {
						setTimeout(() => {
							this.startTruckExitTween();
						}, 3000);
						this.truckExitScheduled = true;
					}
				} else {
					if (this.policeTruck.parent) {
						this.worldContainer.removeChild(this.policeTruck);
					}
					this.policeTruck.destroy();
					this.policeTruck = null;
					if (this.policeman && this.policeman.parent) {
						this.worldContainer.removeChild(this.policeman);
					}
					if (this.policeman) {
						this.policeman.destroy();
						this.policeman = null;
					}
					this.truckExitScheduled = false;
				}
				this.policeTruckTween = null;
			}
		}

		if (this.tensionPublica >= 100) {
			this.handleTensionMax();
			this.desacreditacionMediatica += this.DESACREDITACION_FACTOR;
			this.tensionPublica = 0;
		}

		// Incremento de Tensión Pública: si un infiltrado está cerca de otros (distancia < 50px)
		this.infiltradoContainer.children.forEach((child: any) => {
			this.crowdContainer.children.concat(this.infiltradoContainer.children).forEach((other: any) => {
				if (child !== other) {
					const dx = child.x - other.x;
					const dy = child.y - other.y;
					const distance = Math.sqrt(dx * dx + dy * dy);
					if (distance < 50) {
						this.tensionPublica = Math.min(100, this.tensionPublica + (this.TENSION_PUBLICA * _dt) / 1600);
					}
				}
			});
		});

		// Movimiento aleatorio de infiltrados (si no están en entrevista ni en tween policial)
		this.infiltradoContainer.children.forEach((child: any) => {
			if (!child.isBeingInterviewed && !child.policeTween) {
				child.x += (Math.random() - 0.5) * 2;
				child.y += (Math.random() - 0.5) * 2;
				child.x = Math.max(marginX, Math.min(bgWidth - marginX, child.x));
				child.y = Math.max(marginY, Math.min(bgHeight - marginY, child.y));
			}
		});

		// Movimiento aleatorio sutil de manifestantes (si no están en entrevista ni en tween policial)
		this.crowdContainer.children.forEach((child: any) => {
			if (!child.isBeingInterviewed && !child.policeTween) {
				child.x += Math.random() - 0.5;
				child.y += Math.random() - 0.5;
				child.x = Math.max(marginX, Math.min(bgWidth - marginX, child.x));
				child.y = Math.max(marginY, Math.min(bgHeight - marginY, child.y));
			}
		});

		// Movimiento dirigido de reporteros hacia su objetivo e implementación de entrevista
		this.reporterContainer.children.forEach((child: any) => {
			// Verificar si el target existe y sigue en la escena (por ejemplo, comprobando si tiene parent)
			if (!child.target || !child.target.parent) {
				child.target = this.getRandomPlayer();
			}
			const target: Sprite | Graphics | null = child.target;
			if (target) {
				const dx = target.x - child.x;
				const dy = target.y - child.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < 30) {
					if (!child.isInterviewing) {
						child.isInterviewing = true;
						child.interviewTimer = 8000; // 8 segundos
						(target as any).isBeingInterviewed = true;
						const timerText = new Text("8.0", { fontFamily: "Arial", fontSize: 14, fill: "white" });
						timerText.name = "interviewTimerText";
						timerText.x = -10;
						timerText.y = -20;
						child.addChild(timerText);
						let messages: string[] = [];
						if (target.name === "protester") {
							messages = [
								"quiero una jubilación digna",
								"no quiero vivir en la pobreza",
								"las jubilación por moratoria es un derecho",
								"al final la casta éramos nosotros",
								"trabajé toda la vida y nunca pensé que iba a llegar a grande y no tener nada",
								"esto no es Cristina, Alberto, Massa, Macri o Milei, somos nosotros",
								"quiero un país donde los jubilados vivan con dignidad",
								"mis aportes no son limosnas, son mi derecho",
								"la patria es el otro, no los mercados",
								"que los abuelos no tengan que elegir entre remedios o comida",
								"basta de ajustes con los que menos tienen",
								"merecemos un retiro tranquilo, no una lucha diaria",
							];
						} else if (target.name === "infiltrator") {
							messages = [
								"la verdad que yo vine porque me pagó la oposición",
								"aguante la camporaaaa",
								"aguante el javoooo",
								"solo vine por los choripanes",
								"me dijeron que había colectivo gratis y vine",
								"esto es todo un circo, nos usan como carne de cañón",
								"yo vengo a hacer bulto, ni sé por qué estamos protestando",
								"¿esto no era un festival de música?",
								"desde la CGT me dijeron que viniera a hacer bulto",
								"vine a ver si ligaba algo gratis",
								"me pagaron $500 y un sánguche para venir",
								"igual yo después voto a Milei, jeje",
							];
						}
						if (messages.length > 0) {
							const chosen = messages[Random.shared.randomInt(0, messages.length)];
							const interviewBox = this.createInterviewBox(target, chosen);
							child.interviewBox = interviewBox;
							this.worldContainer.addChild(interviewBox);
							this.pushTickerMessage(chosen);
						}
					} else {
						child.interviewTimer -= _dt;
						const timerText = child.getChildByName("interviewTimerText") as Text;
						if (timerText) {
							timerText.text = (child.interviewTimer / 1000).toFixed(1);
						}
						if (child.interviewBox) {
							const box: Container = child.interviewBox;
							box.x = target.x - 80;
							box.y = target.y - 50;
						}
						if (child.interviewTimer <= 0) {
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
						this.desacreditacionMediatica = Math.min(100, this.desacreditacionMediatica + this.DESACREDITACION_FACTOR);
					}
					if (target.name === "protester" && dist < 31) {
						this.desacreditacionMediatica = Math.max(0, this.desacreditacionMediatica - this.JUBILADO_FACTOR);
					}
				}
			} else {
				// Si no hay target, intentar asignar uno nuevo
				const newTarget = this.getRandomPlayer();
				if (newTarget) {
					child.target = newTarget;
				} else {
					child.leaveTimer = (child.leaveTimer || 0) + _dt;
					if (child.leaveTimer > 3000) {
						this.reporterContainer.removeChild(child);
						child.destroy();
					}
				}
			}
		});

		// Actualizar el timer de la marcha
		this.currentMarchTime += (_dt / 1000) * this.TIME_SPEED;
		if (this.marchTimerText) {
			this.marchTimerText.text = this.formatTime(this.currentMarchTime);
		}
		// Verificar si la marcha llegó a las 21hs (1260 minutos) sin alcanzar el máximo de desacreditación
		if (this.currentMarchTime >= 21 * 60 && !this.gameEnded) {
			// Condición de victoria: La marcha duró hasta las 21hs sin perder
			this.winGame();
		}

		// Actualizar tweens de la policía
		this.updatePoliceTweens(_dt);

		this.updateOpinionBarsGraphics();

		// Verificar si la barra de desacreditación llegó al 100% para disparar la derrota
		if (this.desacreditacionMediatica >= 100 && !this.gameEnded) {
			this.loseGame();
		}

		this.updateNewsTicker(_dt);
	}

	private createLightSprite(radius: number, color: number = 0xffee88): Sprite {
		// Crear un canvas para el gradiente
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = radius * 2;
		const ctx = canvas.getContext("2d")!;
		// Crear gradiente radial: centro opaco y borde transparente
		const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
		// Extraer componentes RGB del color
		const r = (color >> 16) & 0xff;
		const g = (color >> 8) & 0xff;
		const b = color & 0xff;
		gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
		gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		// Crear la textura y el sprite
		const texture = Texture.from(canvas);
		const sprite = new Sprite(texture);
		sprite.anchor.set(0.5);
		return sprite;
	}

	// Método para iniciar el tween de salida de la camioneta
	private startTruckExitTween(): void {
		if (this.policeTruck) {
			this.policeTruckTween = {
				startX: this.policeTruck.x,
				startY: this.policeTruck.y,
				targetX: this.backgroundSize.width + this.policeTruck.width,
				targetY: this.policeTruck.y,
				duration: 1000,
				elapsed: 0,
			};
		}
	}

	// Función para crear el timer de la marcha en la parte superior central
	private createMarchTimer(): void {
		const style = new TextStyle({
			fontSize: 70,
			dropShadowDistance: 8,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fill: "white",
			align: "center",
		});
		this.marchTimerText = new Text(this.formatTime(this.currentMarchTime), style);
		// Posición central en la parte superior (ajustamos el valor Y a gusto)
		this.marchTimerText.anchor.set(0.5);
		this.marchTimerText.x = 0;
		this.marchTimerText.y = 0;
		this.timeContainer.addChild(this.marchTimerText);
	}

	// Función para formatear el tiempo (en minutos) a un string "HH:MM"
	private formatTime(totalMinutes: number): string {
		const hours = Math.floor(totalMinutes / 60);
		const minutes = Math.floor(totalMinutes % 60);
		const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;
		return `${hours}:${paddedMinutes}`;
	}

	// Función para mostrar mensaje de fin de juego con sprite adicional según el resultado
	private showGameMessage(message: string, result: "win" | "lose"): void {
		this.hudContainer.removeChildren();
		this.timeContainer.removeChildren();
		this.tickerContainer.removeChildren();
		this.lightsContainer.removeChildren();
		this.removeChild(this.lightsContainer);
		// Crear un overlay semitransparente
		const overlay = new Graphics();
		overlay.beginFill(0x000000, 0.7);
		overlay.drawRect(0, 0, this.backgroundSize.width, this.backgroundSize.height);
		overlay.endFill();
		overlay.name = "gameMessageOverlay";
		overlay.interactive = true;
		this.worldContainer.addChild(overlay);

		const style = new TextStyle({
			fontSize: 50,
			fill: 0xffffff,
			dropShadowDistance: 15,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
			align: "center",
			wordWrap: true,
			wordWrapWidth: 500,
		});
		const text = new Text(message, style);
		text.anchor.set(0.5);
		text.x = this.backgroundSize.width / 2;
		text.y = this.backgroundSize.height / 2;
		overlay.addChild(text);

		// Crear el sprite placeholder según el resultado (los nombres 'win_placeholder' y 'lose_placeholder' son placeholders)
		let resultSprite: Sprite;
		if (result === "win") {
			resultSprite = Sprite.from("win");
		} else {
			resultSprite = Sprite.from("lose");
		}
		resultSprite.anchor.set(0.5);
		resultSprite.scale.set(0.5);
		// Posicionar el sprite a la derecha del mensaje; se ajusta según convenga
		resultSprite.x = text.x + text.width / 2 + resultSprite.width / 2 + 20;
		resultSprite.y = text.y;
		overlay.addChild(resultSprite);

		// Crear un botón de reinicio (placeholder)
		const restartButton = new Graphics();
		restartButton.beginFill(0x333333);
		restartButton.drawRoundedRect(0, 0, 250, 50, 10);
		restartButton.endFill();
		restartButton.interactive = true;
		// Posicionar el botón debajo del mensaje
		restartButton.x = this.backgroundSize.width / 2 - 125;
		restartButton.y = text.y + text.height / 2 + 30;
		restartButton.zIndex = 5;
		overlay.addChild(restartButton);

		// Texto del botón
		const buttonText = new Text("Marchar de nuevo!", {
			fontFamily: "Arial",
			fontSize: 20,
			fill: "white",
		});
		buttonText.anchor.set(0.5);
		buttonText.x = 125;
		buttonText.y = 25;
		restartButton.addChild(buttonText);

		// Evento del botón: reinicia la escena
		restartButton.on("pointertap", () => {
			// Suponiendo que Manager.changeScene está disponible
			Manager.changeScene(JubilpostorGameScene, { transitionClass: FadeColorTransition });
		});
	}

	// Funciones de fin de juego
	private loseGame(): void {
		if (this.gameEnded) {
			return;
		}
		this.gameEnded = true;
		console.log("Perdiste: La desacreditación alcanzó el 100%");
		this.showGameMessage("¡La marcha ha fallado,\nla protesta ha sido desprestigiada!", "lose");
	}

	private winGame(): void {
		if (this.gameEnded) {
			return;
		}
		this.gameEnded = true;
		console.log("¡Ganaste!");
		this.showGameMessage("¡Has logrado mantenerte firme en tu protesta!\n¡Victoria!", "win");
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, newW, newH, 1000, 800, ScaleHelper.forceWidth);
		ScaleHelper.setScaleRelativeToIdeal(this.hudContainer, newW, newH, 1000, 800, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.tickerContainer, newW, newH, 1000, 800, ScaleHelper.FIT);
		ScaleHelper.setScaleRelativeToIdeal(this.timeContainer, newW, newH, 1000, 800, ScaleHelper.FIT);

		this.tickerContainer.x = newW * 0.5;
		this.tickerContainer.y = newH * 0.9 - this.tickerContainer.height;
		this.worldContainer.x = newW * 0.5 - this.worldContainer.width * 0.5;
		this.worldContainer.y = newH * 0.5 - this.worldContainer.height * 0.5;
		// Asegurarse de que el contenedor de luces tenga la misma posición que el worldContainer
		this.lightsContainer.x = this.worldContainer.x;
		this.lightsContainer.y = this.worldContainer.y;

		this.hudContainer.x = 0;
		this.hudContainer.y = newH * 0.95 - this.hudContainer.height;

		this.timeContainer.x = newW * 0.5;
		this.timeContainer.y = this.timeContainer.height;
	}
}
