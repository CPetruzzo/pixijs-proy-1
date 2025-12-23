import { Graphics, Text, TextStyle, Container } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene"; // Ajusta ruta
import { Manager } from "../../../"; // Ajusta ruta
import { Keyboard } from "../../../engine/input/Keyboard"; // Ajusta ruta

export class SpineParallaxScene extends PixiScene {
	public static readonly BUNDLES = ["spine-characters"];

	// --- ELEMENTOS DE ESCENA ---
	private spineBoy: Spine | undefined;
	private instructions: Text;

	// Contenedores para las capas (Layers)
	private moonLayer: Container; // Fondo fijo
	private farBgLayer: Container; // Edificios lejanos (lento)
	private gameLayer: Container; // Juego real (piso, boy, colisiones)

	// --- FÍSICA ---
	private velocity = { x: 0, y: 0 };
	private readonly SPEED = 3;
	private readonly RUN_SPEED = 10; // Nueva velocidad para correr
	private readonly GRAVITY = 0.8;
	private readonly JUMP_FORCE = -18;
	private floorY = 0;
	private isGrounded = false;
	private currentAnim: string = "";

	// --- CÁMARA ---
	// El largo del nivel dibujado
	private readonly WORLD_WIDTH = 5000;

	constructor() {
		super();
		// Inicializamos contenedores
		this.moonLayer = new Container();
		this.farBgLayer = new Container();
		this.gameLayer = new Container();

		this.createScene();
	}

	private createScene(): void {
		this.floorY = Manager.height - 100;

		// IMPORTANTE: El orden de addChild determina el orden de dibujo (Z-Index)
		this.addChild(this.moonLayer);
		this.addChild(this.farBgLayer);
		this.addChild(this.gameLayer);

		// Capa de UI (Instrucciones) va al final para estar siempre arriba
		this.createUI();

		// --- 1. CAPA: LUNA (Fija) ---
		const moon = new Graphics();
		moon.beginFill(0xeeeeee); // Blanco hueso
		moon.drawCircle(0, 0, 60);
		moon.endFill();
		moon.x = Manager.width - 150; // Arriba a la derecha
		moon.y = 100;
		this.moonLayer.addChild(moon);

		// --- 2. CAPA: EDIFICIOS LEJANOS (Parallax) ---
		// Generamos siluetas oscuras y pequeñas
		const farBuildings = this.createBuildings(0x2c3e50, 200, 400, this.WORLD_WIDTH);
		farBuildings.y = Manager.height - 150; // Más elevados horizonte
		this.farBgLayer.addChild(farBuildings);

		// --- 3. CAPA: JUEGO (Suelo + Edificios cercanos) ---

		// Fondo visual de edificios cercanos (más claros/grandes)
		const nearBuildings = this.createBuildings(0x546e7a, 100, 300, this.WORLD_WIDTH);
		nearBuildings.y = Manager.height - 100;
		this.gameLayer.addChild(nearBuildings);

		// Suelo físico (Dibujamos un rectángulo muy largo)
		const floor = new Graphics();
		floor.beginFill(0x222222);
		floor.drawRect(0, 0, this.WORLD_WIDTH, 300); // 300px de profundidad
		floor.endFill();
		floor.y = this.floorY;
		this.gameLayer.addChild(floor);

		// --- 4. SPINE ---
		this.loadSpineCharacter();
	}

	// Helper para generar gráficos tipo "ciudad" procedural
	private createBuildings(color: number, minH: number, maxH: number, totalWidth: number): Graphics {
		const g = new Graphics();
		g.beginFill(color);

		let currentX = 0;
		while (currentX < totalWidth) {
			const width = 50 + Math.random() * 100;
			const height = minH + Math.random() * (maxH - minH);
			// Dibujamos el edificio hacia arriba desde el eje 0
			g.drawRect(currentX, -height, width, height);

			// Espacio entre edificios
			currentX += width + Math.random() * 20;
		}
		g.endFill();
		return g;
	}

	private loadSpineCharacter(): void {
		try {
			this.spineBoy = Spine.from("spineboy-data", "spineboy-atlas");
			this.spineBoy.scale.set(0.5);
			// Empezamos un poco adelante
			this.spineBoy.position.set(200, this.floorY);

			// Mixes
			this.spineBoy.state.data.setMix("idle", "walk", 0.2); // Añadido walk/idle mix
			this.spineBoy.state.data.setMix("walk", "idle", 0.2);
			this.spineBoy.state.data.setMix("walk", "run", 0.2); // Añadido walk/run mix
			this.spineBoy.state.data.setMix("run", "walk", 0.2);
			this.spineBoy.state.data.setMix("idle", "jump", 0.1);
			this.spineBoy.state.data.setMix("run", "jump", 0.1);
			this.spineBoy.state.data.setMix("walk", "jump", 0.1); // Añadido walk/jump mix
			this.spineBoy.state.data.setMix("jump", "run", 0.2);
			this.spineBoy.state.data.setMix("jump", "walk", 0.2); // Añadido jump/walk mix
			this.spineBoy.state.data.setMix("jump", "idle", 0.2);

			this.spineBoy.state.setAnimation(0, "idle", true);
			this.currentAnim = "idle";

			// Agregamos al personaje a la capa de JUEGO
			this.gameLayer.addChild(this.spineBoy);
		} catch (e) {
			console.error("Error loading spine", e);
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
		// Instrucciones actualizadas
		this.instructions = new Text("A/D: Caminar | SHIFT + A/D: Correr | W/ESPACIO: Saltar | K: Disparar", style);
		this.instructions.x = 20;
		this.instructions.y = 20;
		// Agregamos directo a 'this' (HUD), no a las capas que se mueven
		this.addChild(this.instructions);
	}

	public override update(_dt: number): void {
		if (!this.spineBoy) {
			return;
		}

		// --- A. LÓGICA DE JUEGO ---
		this.velocity.x = 0;

		const currentSpeed = Keyboard.shared.isDown("ShiftLeft") || Keyboard.shared.isDown("ShiftRight") ? this.RUN_SPEED : this.SPEED;

		if (Keyboard.shared.isDown("KeyA")) {
			this.velocity.x = -currentSpeed; // Usa la velocidad de caminar o correr
			this.spineBoy.scale.x = -0.5;
		} else if (Keyboard.shared.isDown("KeyD")) {
			this.velocity.x = currentSpeed; // Usa la velocidad de caminar o correr
			this.spineBoy.scale.x = 0.5;
		}

		if ((Keyboard.shared.justPressed("Space") || Keyboard.shared.justPressed("KeyW")) && this.isGrounded) {
			this.velocity.y = this.JUMP_FORCE;
			this.isGrounded = false;
		}

		this.velocity.y += this.GRAVITY;
		this.spineBoy.x += this.velocity.x;
		this.spineBoy.y += this.velocity.y;

		// Límites del mundo (para no caerse al inicio o final del dibujo)
		if (this.spineBoy.x < 50) {
			this.spineBoy.x = 50;
		}
		if (this.spineBoy.x > this.WORLD_WIDTH - 50) {
			this.spineBoy.x = this.WORLD_WIDTH - 50;
		}

		// Colisión suelo
		if (this.spineBoy.y >= this.floorY) {
			this.spineBoy.y = this.floorY;
			this.velocity.y = 0;
			this.isGrounded = true;
		} else {
			this.isGrounded = false;
		}

		// Animaciones
		this.handleAnimations();

		// --- B. LÓGICA DE CÁMARA Y PARALLAX ---

		// 1. Calculamos dónde quiere estar la cámara (centrada en el personaje)
		let camX = this.spineBoy.x - Manager.width / 2;

		// 2. Clampeamos la cámara para no ver el vacío (izquierda y derecha)
		const maxCamX = this.WORLD_WIDTH - Manager.width;
		if (camX < 0) {
			camX = 0;
		}
		if (camX > maxCamX) {
			camX = maxCamX;
		}

		// 3. Movemos las capas opuestas a la cámara
		this.farBgLayer.x = -camX * 0.2;
		this.gameLayer.x = -camX;
	}

	private handleAnimations(): void {
		let newAnim = "idle";

		// El personaje está en el aire, forzamos jump
		if (!this.isGrounded) {
			newAnim = "jump";
		}
		// El personaje está en el suelo
		else {
			// Si el personaje se está moviendo (velocity.x es diferente de cero)
			if (Math.abs(this.velocity.x) > 0.1) {
				// Determinamos si es 'run' o 'walk' basado en la velocidad
				// Si la velocidad actual es mayor que la velocidad base (SPEED), significa que está corriendo.
				if (Math.abs(this.velocity.x) > this.SPEED + 0.1) {
					newAnim = "run";
				} else {
					newAnim = "walk";
				}
			}
			// Si velocity.x es cero o casi cero, es 'idle'
			else {
				newAnim = "idle";
			}
		}

		if (this.currentAnim !== newAnim) {
			const loop = newAnim !== "jump";
			this.spineBoy.state.setAnimation(0, newAnim, loop);
			this.currentAnim = newAnim;
		}

		if (Keyboard.shared.justPressed("KeyK")) {
			this.spineBoy.state.setAnimation(1, "shoot", false);
			this.spineBoy.state.tracks[1].alpha = 1;
		}
	}

	public override onResize(_w: number, h: number): void {
		// Recalcular suelo y UI si cambia el tamaño
		this.floorY = h - 100;
		// Ajustar posición vertical de layers si es necesario
		// ...
	}
}
