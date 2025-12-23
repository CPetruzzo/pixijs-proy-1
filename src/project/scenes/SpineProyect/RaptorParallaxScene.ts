import { Graphics, Text, TextStyle, Container } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager } from "../../..";
import { Keyboard } from "../../../engine/input/Keyboard";

export class RaptorParallaxScene extends PixiScene {
	public static readonly BUNDLES = ["spine-characters"];

	private raptor: Spine | undefined;
	private instructions: Text;

	// Layers
	private moonLayer: Container;
	private farBgLayer: Container;
	private gameLayer: Container;

	// Physics
	private velocity = { x: 0, y: 0 };
	private readonly SPEED = 2;
	private readonly RUN_SPEED = 10;
	private readonly SCALE = 0.25;
	private readonly GRAVITY = 0.8;
	private readonly JUMP_FORCE = -20;
	private floorY = 0;
	private isGrounded = false;
	private currentAnim: string = "";

	private readonly WORLD_WIDTH = 5000;

	constructor() {
		super();
		this.moonLayer = new Container();
		this.farBgLayer = new Container();
		this.gameLayer = new Container();

		// Habilitar interacción para el click
		this.eventMode = "static";
		this.createScene();
	}

	private createScene(): void {
		this.floorY = Manager.height - 100;

		this.addChild(this.moonLayer);
		this.addChild(this.farBgLayer);
		this.addChild(this.gameLayer);

		this.createUI();

		// --- FONDO ---
		const moon = new Graphics();
		moon.beginFill(0xeeeeee);
		moon.drawCircle(0, 0, 60);
		moon.endFill();
		moon.x = Manager.width - 150;
		moon.y = 100;
		this.moonLayer.addChild(moon);

		const farBuildings = this.createBuildings(0x2c3e50, 200, 400, this.WORLD_WIDTH);
		farBuildings.y = Manager.height - 150;
		this.farBgLayer.addChild(farBuildings);

		const nearBuildings = this.createBuildings(0x546e7a, 100, 300, this.WORLD_WIDTH);
		nearBuildings.y = Manager.height - 100;
		this.gameLayer.addChild(nearBuildings);

		const floor = new Graphics();
		floor.beginFill(0x222222);
		floor.drawRect(0, 0, this.WORLD_WIDTH, 300);
		floor.endFill();
		floor.y = this.floorY;
		this.gameLayer.addChild(floor);

		// --- CARGAR RAPTOR ---
		this.loadSpineCharacter();

		// Evento de Click para Rugir
		this.on("pointertap", () => {
			if (this.raptor) {
				// 1. Ejecutamos el rugido en el Track 1
				this.raptor.state.setAnimation(1, "roar", false);

				// 2. IMPORTANTE: Ponemos en cola una "animación vacía" para después del rugido.
				// El tercer parámetro (0.2) es el tiempo de mezcla (mix duration).
				// Esto hace que al terminar "roar", el Track 1 se desvanezca suavemente hacia Track 0.
				this.raptor.state.addEmptyAnimation(1, 0.2, 0);
			}
		});
	}

	private createBuildings(color: number, minH: number, maxH: number, totalWidth: number): Graphics {
		const g = new Graphics();
		g.beginFill(color);
		let currentX = 0;
		while (currentX < totalWidth) {
			const width = 50 + Math.random() * 100;
			const height = minH + Math.random() * (maxH - minH);
			g.drawRect(currentX, -height, width, height);
			currentX += width + Math.random() * 20;
		}
		g.endFill();
		return g;
	}

	private loadSpineCharacter(): void {
		try {
			this.raptor = Spine.from("raptor-data", "raptor-atlas");
			this.raptor.scale.set(this.SCALE);
			this.raptor.position.set(200, this.floorY);

			// Mixes: Configuramos transiciones suaves entre las animaciones QUE SI EXISTEN
			const data = this.raptor.state.data;

			// De caminar a saltar
			data.setMix("walk", "jump", 0.2);
			data.setMix("jump", "walk", 0.2);

			// De caminar a quieto (usaremos gun-holster como quieto)
			data.setMix("walk", "gun-holster", 0.2);
			data.setMix("gun-holster", "walk", 0.2);

			data.setMix("jump", "gun-holster", 0.2);
			data.setMix("gun-holster", "jump", 0.2);

			// Estado inicial: Quieto
			this.raptor.state.setAnimation(0, "gun-holster", false);
			this.currentAnim = "gun-holster";

			this.gameLayer.addChild(this.raptor);
		} catch (e) {
			console.error("Error loading raptor", e);
		}
	}

	private createUI(): void {
		const style = new TextStyle({
			fill: "#ffffff",
			fontSize: 16,
			fontFamily: "Arial",
			dropShadow: true,
			dropShadowDistance: 2,
		});
		this.instructions = new Text("A/D: Caminar | SHIFT: Correr | ESPACIO: Saltar | CLICK: Rugir", style);
		this.instructions.x = 20;
		this.instructions.y = 20;
		this.addChild(this.instructions);
	}

	public override update(_dt: number): void {
		if (!this.raptor) {
			return;
		}

		// --- A. LÓGICA MOVIMIENTO ---
		this.velocity.x = 0;
		const isRunning = Keyboard.shared.isDown("ShiftLeft");
		const currentSpeed = isRunning ? this.RUN_SPEED : this.SPEED;

		if (Keyboard.shared.isDown("KeyA")) {
			this.velocity.x = -currentSpeed;
			this.raptor.scale.x = -this.SCALE; // Mirar izquierda
		} else if (Keyboard.shared.isDown("KeyD")) {
			this.velocity.x = currentSpeed;
			this.raptor.scale.x = this.SCALE; // Mirar derecha
		}

		if ((Keyboard.shared.justPressed("Space") || Keyboard.shared.justPressed("KeyW")) && this.isGrounded) {
			this.velocity.y = this.JUMP_FORCE;
			this.isGrounded = false;
		}

		this.velocity.y += this.GRAVITY;
		this.raptor.x += this.velocity.x;
		this.raptor.y += this.velocity.y;

		// Limites
		if (this.raptor.x < 50) {
			this.raptor.x = 50;
		}
		if (this.raptor.x > this.WORLD_WIDTH - 50) {
			this.raptor.x = this.WORLD_WIDTH - 50;
		}

		// Suelo
		if (this.raptor.y >= this.floorY) {
			this.raptor.y = this.floorY;
			this.velocity.y = 0;
			this.isGrounded = true;
		} else {
			this.isGrounded = false;
		}

		this.handleAnimations();

		// --- B. CAMARA ---
		let camX = this.raptor.x - Manager.width / 2;
		const maxCamX = this.WORLD_WIDTH - Manager.width;
		camX = Math.max(0, Math.min(camX, maxCamX));

		this.farBgLayer.x = -camX * 0.2;
		this.gameLayer.x = -camX;
	}

	private handleAnimations(): void {
		let newAnim = "";

		// 1. Prioridad: Aire
		if (!this.isGrounded) {
			newAnim = "jump";
		}
		// 2. Suelo
		else {
			if (Math.abs(this.velocity.x) > 0.1) {
				newAnim = "walk";
				// Ajustar velocidad de animacion segun si corre o camina
				this.raptor.state.timeScale = Math.abs(this.velocity.x) > this.SPEED + 1 ? 1.5 : 1.0;
			} else {
				// NO EXISTE IDLE. Usamos 'gun-holster' como pose de descanso
				newAnim = "gun-holster";
				this.raptor.state.timeScale = 1.0;
			}
		}

		// Solo cambiar si es diferente
		if (this.currentAnim !== newAnim) {
			// Loop solo si es walk
			const loop = newAnim === "walk";

			// Si pasamos a 'gun-holster' (fake idle), no lo loopeamos para que se quede en el ultimo frame
			// o lo reseteamos para que haga la accion de guardar arma una vez.

			this.raptor.state.setAnimation(0, newAnim, loop);
			this.currentAnim = newAnim;
		}
	}

	public override onResize(_w: number, h: number): void {
		this.floorY = h - 100;
		if (this.raptor && this.isGrounded) {
			this.raptor.y = this.floorY;
		}
	}
}
