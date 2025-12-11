import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Sprite, Texture, Container, Graphics, TextStyle, Text } from "pixi.js";
import { Keyboard } from "../../../engine/input/Keyboard";
import { StateMachineAnimator } from "../../../engine/animation/StateMachineAnimation";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Tween } from "tweedle.js";
import { DialogueOverlay } from "./Utils/DialogOverlay";
import { Manager } from "../../..";
import { SoulMountainScene } from "./SoulMountainScene";

const CLASS_NAME = "[DRUID_HOUSE] ";
// CAMBIO: Define aquí el nombre de tu textura de máscara (debe medir lo mismo que el background)
const WALKABLE_ASSET = "treehouse";

interface Interactable {
	x: number;
	y: number;
	radius: number;
	prompt: Container;
	action: () => void;
	waitForExit?: boolean;
	hasLeft?: boolean;
	autoTrigger?: boolean;
}

export class DruidHouseScene extends PixiScene {
	private world: Container;
	private player: StateMachineAnimator;

	// NPC y Objetos
	private druidNPC: Sprite;

	// UI y Sistemas
	private dialogueOverlay: DialogueOverlay;
	private uiContainer: Container;
	private interactables: Interactable[] = [];
	private interactionCooldown: number = 0;

	private choiceContainer: Container;
	private choiceYesText: Text;
	private choiceNoText: Text;
	private isChoosingExit: boolean = false;
	private currentChoiceIndex: number = 0;
	public exitZoneInteractable: Interactable | null = null;

	// Movimiento
	private playerSpeed: number = 5;
	public movementDirection: string = "idle";
	private facingDirection: "up" | "down" | "left" | "right" = "up";
	public static readonly BUNDLES = ["fallrungame", "sfx", "myfriend"];

	// --- NUEVO: SISTEMA DE ZONA CAMINABLE ---
	private walkableZoneSprite: Sprite | null = null;
	private walkableZoneCanvas: HTMLCanvasElement | null = null;
	private walkableZoneContext: CanvasRenderingContext2D | null = null;
	private readonly DEBUG_WALKABLE: boolean = false; // Pon esto en TRUE si quieres ver la zona verde

	constructor() {
		super();
		this.createScene();
	}

	private createScene(): void {
		this.world = new Container();
		this.addChild(this.world);
		this.world.name = "WORLD";

		SoundLib.stopAllMusic();
		// SoundLib.playMusic("druid_house_theme", { loop: true, volume: 0.2 });

		this.createBackground();

		// CAMBIO: Inicializamos la zona caminable antes que el jugador
		this.createWalkableZone();

		this.createPlayer();
		this.createDruidNPC();
		this.createUI();
		this.createExitZone();
		this.createChoiceUI();

		this.dialogueOverlay.hide();
	}

	private createBackground(): void {
		const bg = Sprite.from("treehouse");
		bg.anchor.set(0.5);
		// IMPORTANTE: El background está en (0,0) local del world
		this.world.addChild(bg);
	}

	// --- NUEVO: Crea el canvas para leer píxeles ---
	private createWalkableZone(): void {
		// Usamos una textura específica o fallbask a una existente si no existe la variable
		// Asegúrate de que esta textura exista en tus assets
		try {
			this.walkableZoneSprite = Sprite.from(WALKABLE_ASSET);
		} catch (e) {
			console.warn("No se encontró textura walkable, usando placeholder vacío");
			this.walkableZoneSprite = new Sprite(Texture.EMPTY);
		}

		// Debe coincidir con la posición y anchor del Background
		this.walkableZoneSprite.anchor.set(0.5);
		this.walkableZoneSprite.x = 0;
		this.walkableZoneSprite.y = 0;

		// En modo debug la mostramos semitransparente (verde por ejemplo)
		this.walkableZoneSprite.alpha = this.DEBUG_WALKABLE ? 0.5 : 0;
		if (this.DEBUG_WALKABLE) {
			this.walkableZoneSprite.tint = 0x00ff00;
		}

		this.world.addChild(this.walkableZoneSprite);

		// Crear Canvas
		this.walkableZoneCanvas = document.createElement("canvas");
		const tex = this.walkableZoneSprite.texture;

		// Esperar a que cargue la textura si es necesario, o usar sus dimensiones base
		this.walkableZoneCanvas.width = tex.width || 100;
		this.walkableZoneCanvas.height = tex.height || 100;

		// Contexto optimizado para lectura frecuente
		this.walkableZoneContext = this.walkableZoneCanvas.getContext("2d", { willReadFrequently: true });

		// Dibujar la imagen en el canvas
		const img = tex.baseTexture.resource as any;
		if (img && img.source && this.walkableZoneContext) {
			this.walkableZoneContext.drawImage(img.source, 0, 0);
		}
	}

	// --- NUEVO: Lógica para verificar si un píxel es caminable ---
	private isWalkable(x: number, y: number): boolean {
		if (!this.walkableZoneContext || !this.walkableZoneCanvas || !this.walkableZoneSprite) {
			return true; // Si falla la carga, permitir caminar para no bloquear el juego
		}

		// Transformación de Coordenadas:
		// El jugador está en coordenadas locales de 'world' donde (0,0) es el centro.
		// El canvas tiene coordenadas de imagen donde (0,0) es la esquina superior izquierda.
		// Como el sprite tiene anchor 0.5, tenemos que sumar la mitad del ancho/alto.

		const texW = this.walkableZoneCanvas.width;
		const texH = this.walkableZoneCanvas.height;

		const pixelX = Math.floor(x + texW / 2);
		const pixelY = Math.floor(y + texH / 2);

		// Verificar límites del canvas
		if (pixelX < 0 || pixelX >= texW || pixelY < 0 || pixelY >= texH) {
			return false; // Fuera del mapa no se camina
		}

		try {
			const pixelData = this.walkableZoneContext.getImageData(pixelX, pixelY, 1, 1).data;
			// pixelData[3] es el canal Alpha (0-255).
			// Asumimos que > 128 es caminable (visible), y transparente es pared.
			return pixelData[3] > 128;
		} catch (e) {
			return false;
		}
	}

	private createPlayer(): void {
		this.player = new StateMachineAnimator();
		this.player.anchor.set(0.5);

		this.player.addState("idle", [Texture.from("soul_walk0")], 0.2, true);
		this.player.addState("idleback", [Texture.from("soul_walkback0")], 0.2, true);
		this.player.addState(
			"move",
			[
				Texture.from("soul_walk1"),
				Texture.from("soul_walk2"),
				Texture.from("soul_walk3"),
				Texture.from("soul_walk4"),
				Texture.from("soul_walk5"),
				Texture.from("soul_walk6"),
				Texture.from("soul_walk7"),
				Texture.from("soul_walk8"),
				Texture.from("soul_walk9"),
			],
			12,
			true
		);
		this.player.addState(
			"move_back",
			[
				Texture.from("soul_walkback0"),
				Texture.from("soul_walkback1"),
				Texture.from("soul_walkback2"),
				Texture.from("soul_walkback3"),
				Texture.from("soul_walkback4"),
				Texture.from("soul_walkback5"),
				Texture.from("soul_walkback6"),
			],
			6,
			true
		);

		this.player.playState("idleback");
		this.player.scale.set(1.3);

		this.player.y = 200;

		this.world.addChild(this.player);
	}

	private createDruidNPC(): void {
		this.druidNPC = Sprite.from("NPC_monk");
		this.druidNPC.anchor.set(0.5);
		this.druidNPC.scale.set(1.2);
		this.druidNPC.y = -200;

		this.world.addChild(this.druidNPC);

		this.addInteractable(this.druidNPC.x, this.druidNPC.y + 50, () => {
			this.dialogueOverlay.setPortraitImage("NPC_monkface");
			this.dialogueOverlay.show("Bienvenido a mi hogar. Disculpa el desorden, estoy buscando a mi gato negro...", "gato negro", "#aaffaa");
		});
	}

	private createChoiceUI(): void {
		this.choiceContainer = new Container();
		this.choiceContainer.name = "CHOICECONTAINER";
		this.choiceContainer.visible = false;

		const WIDTH = 420;
		const HEIGHT = 160;
		const bg = new Graphics();
		bg.beginFill(0x000000, 0.9);
		bg.lineStyle(2, 0xffffff);
		bg.drawRoundedRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, 12);
		bg.endFill();
		this.choiceContainer.addChild(bg);

		const questionStyle = new TextStyle({
			fontFamily: "Arial",
			fontSize: 20,
			fill: "#ffffff",
			align: "center",
			wordWrap: true,
			wordWrapWidth: WIDTH - 40,
		});
		const question = new Text("¿Quieres salir al bosque?", questionStyle);
		question.anchor.set(0.5, 0.5);
		question.y = -40;
		this.choiceContainer.addChild(question);

		const optionStyle = new TextStyle({ fontFamily: "Arial", fontSize: 28, fontWeight: "bold", fill: "#ffffff" });

		this.choiceYesText = new Text("SÍ", optionStyle);
		this.choiceYesText.anchor.set(0.5);
		this.choiceYesText.position.set(-80, 40);

		this.choiceNoText = new Text("NO", optionStyle);
		this.choiceNoText.anchor.set(0.5);
		this.choiceNoText.position.set(80, 40);

		this.choiceContainer.addChild(this.choiceYesText);
		this.choiceContainer.addChild(this.choiceNoText);

		this.uiContainer.addChild(this.choiceContainer);
	}

	private createExitZone(): void {
		this.exitZoneInteractable = this.addInteractable(0, 300, () => this.openExitMenu(), true, true);
	}

	private openExitMenu(): void {
		this.isChoosingExit = true;
		this.choiceContainer.visible = true;
		this.currentChoiceIndex = 0;
		this.updateChoiceVisuals();
		this.player.playState("idle");

		this.uiContainer.removeChild(this.choiceContainer);
		this.uiContainer.addChild(this.choiceContainer);
	}

	private closeExitMenu(): void {
		this.isChoosingExit = false;
		this.choiceContainer.visible = false;
	}

	private updateChoiceVisuals(): void {
		if (!this.choiceYesText || !this.choiceNoText) {
			return;
		}
		if (this.currentChoiceIndex === 0) {
			this.choiceYesText.style.fill = "#ffff00";
			this.choiceYesText.scale.set(1.2);
			this.choiceNoText.style.fill = "#ffffff";
			this.choiceNoText.scale.set(1.0);
		} else {
			this.choiceYesText.style.fill = "#ffffff";
			this.choiceYesText.scale.set(1.0);
			this.choiceNoText.style.fill = "#ffff00";
			this.choiceNoText.scale.set(1.2);
		}
	}

	private createUI(): void {
		this.uiContainer = new Container();
		this.uiContainer.name = "UICONTAINER";
		this.addChild(this.uiContainer);

		this.dialogueOverlay = new DialogueOverlay();
		this.dialogueOverlay.name = "DIALOGOVERLAY";
		this.dialogueOverlay.x = 0;
		this.dialogueOverlay.y = 0;
		this.uiContainer.addChild(this.dialogueOverlay);
	}

	private addInteractable(x: number, y: number, action: () => void, waitForExit: boolean = false, autoTrigger: boolean = false): Interactable {
		const promptContainer = new Container();
		promptContainer.name = "promptContainer";
		promptContainer.x = x;
		promptContainer.y = y - 90;
		promptContainer.visible = false;

		const bg = new Graphics();
		bg.beginFill(0x000000, 0.7);
		bg.lineStyle(2, 0xffffff);
		bg.drawRoundedRect(-20, -20, 40, 40, 6);
		bg.endFill();

		const style = new TextStyle({
			fontFamily: "Arial",
			fontSize: 18,
			fontWeight: "bold",
			fill: "#ffffff",
		});
		const letter = new Text("E", style);
		letter.anchor.set(0.5);

		promptContainer.addChild(bg, letter);

		new Tween(promptContainer)
			.to({ y: promptContainer.y - 8 }, 800)
			.yoyo(true)
			.repeat(Infinity)
			.start();

		const pBounds = promptContainer.getLocalBounds();
		promptContainer.pivot.set(pBounds.width / 2 + pBounds.x, pBounds.height / 2 + pBounds.y);

		this.world.addChild(promptContainer);

		const newItem: Interactable = {
			x,
			y,
			radius: 100,
			prompt: promptContainer,
			action,
			waitForExit: waitForExit,
			hasLeft: false,
			autoTrigger: autoTrigger,
		};
		this.interactables.push(newItem);

		return newItem;
	}

	private updateInteractions(dt: number): void {
		if (this.interactionCooldown > 0) {
			this.interactionCooldown -= dt;
		}

		this.interactables.forEach((item) => {
			const dist = Math.sqrt(Math.pow(item.x - this.player.x, 2) + Math.pow(item.y - this.player.y, 2));

			if (item.waitForExit && !item.hasLeft) {
				if (dist > item.radius + 10) {
					item.hasLeft = true;
				} else {
					item.prompt.visible = false;
					return;
				}
			}

			if (dist < item.radius) {
				if (item.autoTrigger) {
					item.prompt.visible = false;
					if (this.interactionCooldown <= 0) {
						item.action();
						this.interactionCooldown = 1000;
					}
				} else {
					item.prompt.visible = true;
					this.world.removeChild(item.prompt);
					this.world.addChild(item.prompt);
					if (Keyboard.shared.isDown("KeyE") && this.interactionCooldown <= 0) {
						item.action();
						this.interactionCooldown = 500;
					}
				}
			} else {
				item.prompt.visible = false;
			}
		});
	}

	public override update(dt: number): void {
		if (this.isChoosingExit) {
			this.handleChoiceInput();
			return;
		}

		if (this.dialogueOverlay.isOpen) {
			if ((Keyboard.shared.justPressed("ArrowDown") || Keyboard.shared.justPressed("KeyS")) && this.dialogueOverlay.canScroll()) {
				this.dialogueOverlay.scrollStepDown();
				return;
			}
			if (Keyboard.shared.justPressed("Space") || Keyboard.shared.justPressed("Enter")) {
				this.dialogueOverlay.hide();
			}
			return;
		}

		this.updatePlayerMovement(dt);
		this.updateInteractions(dt);
	}

	private handleChoiceInput(): void {
		if (Keyboard.shared.justPressed("ArrowLeft") || Keyboard.shared.justPressed("KeyA")) {
			this.currentChoiceIndex = 0;
			this.updateChoiceVisuals();
		}
		if (Keyboard.shared.justPressed("ArrowRight") || Keyboard.shared.justPressed("KeyD")) {
			this.currentChoiceIndex = 1;
			this.updateChoiceVisuals();
		}

		if (Keyboard.shared.justPressed("Space") || Keyboard.shared.justPressed("Enter")) {
			this.closeExitMenu();

			if (this.currentChoiceIndex === 0) {
				console.log(CLASS_NAME, "Volviendo a SoulMountain...");
				const treeHouseX = 1230;
				const treeHouseY = 2100;

				Manager.changeScene(SoulMountainScene, {
					sceneParams: [{ spawnPosition: { x: treeHouseX, y: treeHouseY }, skipIntro: true }],
				});
			} else {
				this.dialogueOverlay.setPortraitImage("NPC_monkface");
				this.dialogueOverlay.show("Puedes quedarte cuanto quieras, solo no toques ningún frasco.", "frasco", "#aaffaa");
			}
		}
	}

	// --- CAMBIO PRINCIPAL: Movimiento con Walkable Zone ---
	private updatePlayerMovement(_dt: number): void {
		let dx = 0;
		let dy = 0;
		let moved = false;
		let scaleX = 1.3;

		// Input
		if (Keyboard.shared.isDown("ArrowUp") || Keyboard.shared.isDown("KeyW")) {
			dy -= 1;
			moved = true;
			this.facingDirection = "up";
		}
		if (Keyboard.shared.isDown("ArrowDown") || Keyboard.shared.isDown("KeyS")) {
			dy += 1;
			moved = true;
			this.facingDirection = "down";
		}
		if (Keyboard.shared.isDown("ArrowLeft") || Keyboard.shared.isDown("KeyA")) {
			dx -= 1;
			moved = true;
			scaleX = -1.3;
			this.facingDirection = "left";
		}
		if (Keyboard.shared.isDown("ArrowRight") || Keyboard.shared.isDown("KeyD")) {
			dx += 1;
			moved = true;
			this.facingDirection = "right";
		}

		if (moved) {
			const length = Math.sqrt(dx * dx + dy * dy) || 1;
			const stepX = (dx / length) * this.playerSpeed;
			const stepY = (dy / length) * this.playerSpeed;

			const nextX = this.player.x + stepX;
			const nextY = this.player.y + stepY;

			// 1. Intentar movimiento completo (diagonal o recto)
			if (this.isWalkable(nextX, nextY)) {
				this.player.x = nextX;
				this.player.y = nextY;
			}
			// 2. Si falló, intentar deslizar en X
			else if (this.isWalkable(nextX, this.player.y)) {
				this.player.x = nextX;
			}
			// 3. Si falló, intentar deslizar en Y
			else if (this.isWalkable(this.player.x, nextY)) {
				this.player.y = nextY;
			}
			// Si todo falla, es una pared y no nos movemos.

			this.player.scale.x = scaleX;
			const newState = this.facingDirection === "up" ? "move_back" : "move";
			if (this.player.currentStateName !== newState) {
				this.player.playState(newState);
			}
		} else {
			if (this.player.currentStateName && this.player.currentStateName.includes("move")) {
				const idleState = this.facingDirection === "up" ? "idleback" : "idle";
				this.player.playState(idleState);
			}
		}
	}

	public override onResize(_newW: number, _newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.world, _newW, _newH, 1080, 600, ScaleHelper.forceHeight);
		this.world.x = _newW / 2;
		this.world.y = _newH / 2;
		// Importante: El Pivot del world ya está centrado implícitamente porque los hijos (bg y walkable) tienen anchor 0.5

		this.uiContainer.scale.set(1, 1);
		this.uiContainer.x = 0;
		this.uiContainer.y = 0;
		this.dialogueOverlay.resize();

		ScaleHelper.setScaleRelativeToIdeal(this.choiceContainer, _newW, _newH, 1280, 800, ScaleHelper.forceHeight);
		const choiceBounds = this.choiceContainer.getLocalBounds();
		this.choiceContainer.pivot.set(choiceBounds.x + choiceBounds.width * 0.5, choiceBounds.y + choiceBounds.height * 0.5);
		this.choiceContainer.x = Math.round(_newW * 0.5);
		this.choiceContainer.y = Math.round(_newH * 0.6);

		if (this.uiContainer.children.indexOf(this.dialogueOverlay) === -1) {
			this.uiContainer.addChild(this.dialogueOverlay);
		}
		this.uiContainer.removeChild(this.choiceContainer);
		this.uiContainer.addChild(this.choiceContainer);
	}
}
