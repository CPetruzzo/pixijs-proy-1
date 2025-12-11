import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { Graphics, Text, Container, TextStyle } from "pixi.js";
import { Filter, Rectangle } from "@pixi/core";
import { Manager } from "../..";
import { SceneKey, SceneRegistry } from "../../scenes";
import { LoadingTransition } from "../../engine/scenemanager/transitions/LoadingTransition";

interface ButtonConfig {
	label: string;
	sceneKey: SceneKey;
	color: number;
}

export class CachoMenuScene extends PixiScene {
	private viewport!: Container;
	private content!: Container;
	private buttons: ButtonConfig[] = [
		{ label: "RunFall", sceneKey: SceneKey.RUNFALL_MenuScene, color: 0xff6b6b },
		{ label: "Soul", sceneKey: SceneKey.SOUL_IntroScene, color: 0x9b59b6 },
		{ label: "Horror", sceneKey: SceneKey.HORROR_AHHomeScene, color: 0x2c3e50 },
		{ label: "Aurora", sceneKey: SceneKey.AURORA_MapScene, color: 0x3498db },
		{ label: "TowerDefense", sceneKey: SceneKey.TOWER_DefenseScene, color: 0xe67e22 },
		{ label: "CachoBasquet", sceneKey: SceneKey.BASQUET_MainScene, color: 0xf39c12 },
		{ label: "Jubilpostor", sceneKey: SceneKey.JUBIL_HomeScene, color: 0x1abc9c },
		{ label: "Tetris", sceneKey: SceneKey.TETRIS_Scene, color: 0x16a085 },
		{ label: "3DDemo", sceneKey: SceneKey.DEMO_3DScene, color: 0x8e44ad },
		{ label: "Coffee", sceneKey: SceneKey.COFFEE_ShopScene, color: 0x6f4e37 },
		{ label: "AStarAlgoritm", sceneKey: SceneKey.ASTAR_Scene, color: 0x27ae60 },
		{ label: "CachoWorld", sceneKey: SceneKey.CACHO_MultiplayerScene, color: 0xe74c3c },
	];
	private bgGraphics: Graphics[] = [];
	private buttonContainers: Container[] = [];
	private selectedIndex = 0;
	private borderFilter!: Filter;
	private glowFilter!: Filter;
	private keyDownHandler?: (e: KeyboardEvent) => void;
	private changeScene = false;
	private particles: Container[] = [];
	private backgroundGrid!: Graphics;
	private title!: Text;

	constructor() {
		super();

		this.createBackground();
		this.createTitle();
		this.setupViewport();
		this.setupShaders();
		this.createMenu();
		this.createParticles();
		this.setupScrolling();
		this.setupInput();
	}

	private createBackground(): void {
		// Grid background animado
		this.backgroundGrid = new Graphics();
		this.addChild(this.backgroundGrid);
		this.drawGrid();
	}

	private drawGrid(): void {
		this.backgroundGrid.clear();
		this.backgroundGrid.lineStyle(1, 0x00ffff, 0.1);

		const gridSize = 50;
		for (let x = 0; x < Manager.width; x += gridSize) {
			this.backgroundGrid.moveTo(x, 0);
			this.backgroundGrid.lineTo(x, Manager.height);
		}
		for (let y = 0; y < Manager.height; y += gridSize) {
			this.backgroundGrid.moveTo(0, y);
			this.backgroundGrid.lineTo(Manager.width, y);
		}
	}

	private createTitle(): void {
		const titleStyle = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fontSize: 60,
			fill: ["#00ffff", "#0080ff"],
			fillGradientType: 1,
			stroke: "#000000",
			strokeThickness: 4,
			dropShadow: true,
			dropShadowColor: "#00ffff",
			dropShadowBlur: 10,
			dropShadowDistance: 0,
		});

		this.title = new Text("CACHO GAMES", titleStyle);
		this.title.anchor.set(0.5);
		this.title.x = Manager.width / 2;
		this.title.y = 50;
		this.addChild(this.title);
	}

	private setupViewport(): void {
		this.viewport = new Container();
		this.viewport.y = 120;
		this.viewport.eventMode = "static";
		this.viewport.hitArea = new Rectangle(0, 0, Manager.width, 500);
		this.addChild(this.viewport);

		const maskShape = new Graphics().beginFill(0xffffff).drawRect(0, 0, Manager.width, 500).endFill();
		this.viewport.addChild(maskShape);
		this.viewport.mask = maskShape;

		this.content = new Container();
		this.viewport.addChild(this.content);
	}

	private setupShaders(): void {
		// Border glow shader
		const borderFrag = `
			precision mediump float;
			uniform float time;
			uniform vec3 color;
			void main() {
				vec2 uv = gl_FragCoord.xy / vec2(${Manager.width.toFixed(1)}, 500.0);
				float glow = 0.5 + 0.5 * sin((uv.x+uv.y)*10.0 - time*3.0);
				gl_FragColor = vec4(color * glow, 1.0);
			}`;
		this.borderFilter = new Filter(undefined, borderFrag, {
			time: 0,
			color: [0.0, 1.0, 1.0],
		});

		// Pulse glow shader
		const glowFrag = `
			precision mediump float;
			uniform float time;
			uniform vec3 color;
			void main() {
				float pulse = 0.8 + 0.2 * sin(time * 4.0);
				gl_FragColor = vec4(color * pulse, 0.3);
			}`;
		this.glowFilter = new Filter(undefined, glowFrag, {
			time: 0,
			color: [0.0, 1.0, 1.0],
		});
	}

	private createMenu(): void {
		const buttonW = 300;
		const buttonH = 70;
		const gap = 25;
		const textStyle = new TextStyle({
			fontFamily: "Pixelate-Regular",
			fontSize: 32,
			fill: "#ffffff",
			dropShadow: true,
			dropShadowColor: "#000000",
			dropShadowBlur: 4,
			dropShadowDistance: 2,
		});

		this.buttons.forEach((cfg, i) => {
			const y = i * (buttonH + gap);

			const btnC = new Container();
			btnC.x = (Manager.width - buttonW) / 2;
			btnC.y = y;
			btnC.eventMode = "static";

			// Shadow layer
			const shadow = new Graphics().beginFill(0x000000, 0.4).drawRoundedRect(5, 5, buttonW, buttonH, 15).endFill();

			// Background con gradiente
			const bg = new Graphics();
			bg.beginFill(cfg.color, 0.8).drawRoundedRect(0, 0, buttonW, buttonH, 15).endFill();
			bg.eventMode = "static";
			bg.cursor = "pointer";
			bg.filters = [];

			// Glow overlay
			const glow = new Graphics().beginFill(0xffffff, 0.2).drawRoundedRect(0, 0, buttonW, buttonH, 15).endFill();
			glow.alpha = 0;

			// Border highlight
			const border = new Graphics();
			border.lineStyle(3, 0x00ffff, 0);
			border.drawRoundedRect(0, 0, buttonW, buttonH, 15);

			// Label con efecto
			const label = new Text(cfg.label, textStyle);
			label.anchor.set(0.5);
			label.x = buttonW / 2;
			label.y = buttonH / 2;

			// Icono decorativo
			const icon = new Graphics();
			icon.beginFill(0xffffff, 0.3);
			icon.drawPolygon([0, 0, 20, 10, 0, 20]);
			icon.endFill();
			icon.x = 20;
			icon.y = buttonH / 2 - 10;
			icon.alpha = 0;

			this.bgGraphics.push(bg);
			btnC.addChild(shadow, bg, glow, border, label, icon);

			// Store references
			(btnC as any).glow = glow;
			(btnC as any).border = border;
			(btnC as any).icon = icon;
			(btnC as any).originalY = y;

			// Hover effects
			btnC.on("pointerover", () => {
				this.selectedIndex = i;
				glow.alpha = 1;
				icon.alpha = 1;
			});
			btnC.on("pointerout", () => {
				if (this.selectedIndex !== i) {
					glow.alpha = 0;
					icon.alpha = 0;
				}
			});
			btnC.on("pointertap", () => {
				this.activateButton(i);
			});

			this.buttonContainers.push(btnC);
			this.content.addChild(btnC);
		});
	}

	private createParticles(): void {
		for (let i = 0; i < 30; i++) {
			const particle = new Container();
			const gfx = new Graphics();
			gfx.beginFill(0x00ffff, Math.random() * 0.5 + 0.3);
			gfx.drawCircle(0, 0, Math.random() * 3 + 1);
			gfx.endFill();

			particle.addChild(gfx);
			particle.x = Math.random() * Manager.width;
			particle.y = Math.random() * Manager.height;
			(particle as any).speed = Math.random() * 0.5 + 0.2;
			(particle as any).wobble = Math.random() * Math.PI * 2;

			this.particles.push(particle);
			this.addChildAt(particle, 1);
		}
	}

	private setupScrolling(): void {
		let dragging = false;
		let startY = 0;
		let startScroll = 0;
		this.viewport.on("pointerdown", (e) => {
			dragging = true;
			startY = e.global.y;
			startScroll = this.content.y;
		});

		window.addEventListener("pointerup", () => {
			dragging = false;
		});

		this.viewport.on("pointermove", (e) => {
			if (!dragging) {
				return;
			}
			const dy = e.global.y - startY;
			this.content.y = this.clamp(startScroll + dy, -(this.buttons.length * 95 - 500), 0);
		});

		window.addEventListener("wheel", (ev) => {
			this.content.y = this.clamp(this.content.y - ev.deltaY * 0.5, -(this.buttons.length * 95 - 500), 0);
		});
	}

	private clamp(v: number, min: number, max: number): number {
		return v < min ? min : v > max ? max : v;
	}

	private setupInput(): void {
		this.keyDownHandler = (e) => {
			if (e.key === "ArrowDown") {
				this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
			} else if (e.key === "ArrowUp") {
				this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
			} else if (e.key === "Enter") {
				this.activateButton(this.selectedIndex);
				return;
			}
			const targetY = this.selectedIndex * 95;
			this.content.y = this.clamp(-targetY + 250, -(this.buttons.length * 95 - 500), 0);
		};
		window.addEventListener("keydown", this.keyDownHandler);
	}

	private activateButton(i: number): void {
		this.changeScene = true;
		const sceneKey = this.buttons[i].sceneKey;
		Manager.changeScene(SceneRegistry[sceneKey](), {
			transitionClass: LoadingTransition,
		});
	}

	public override update(dt: number): void {
		if (this.changeScene) {
			return;
		}

		// Animate shaders
		this.borderFilter.uniforms.time += dt * 0.001;
		this.glowFilter.uniforms.time += dt * 0.001;

		// Animate title
		this.title.y = 50 + Math.sin(Date.now() * 0.002) * 5;

		// Animate particles
		this.particles.forEach((p) => {
			p.y -= (p as any).speed;
			p.x += Math.sin((p as any).wobble) * 0.5;
			(p as any).wobble += 0.02;

			if (p.y < 0) {
				p.y = Manager.height;
				p.x = Math.random() * Manager.width;
			}
		});

		// Update buttons
		this.buttonContainers.forEach((btn, i) => {
			const glow = (btn as any).glow;
			const border = (btn as any).border;
			const icon = (btn as any).icon;

			if (i === this.selectedIndex) {
				// Selected state
				this.bgGraphics[i].filters = [this.borderFilter];
				this.bgGraphics[i].alpha = 1;
				glow.alpha = 1;
				border.alpha = 1;
				icon.alpha = 1;

				// Subtle scale animation
				const scale = 1 + Math.sin(Date.now() * 0.005) * 0.02;
				btn.scale.set(scale);
			} else {
				// Unselected state
				this.bgGraphics[i].filters = [];
				this.bgGraphics[i].alpha = 0.6;
				glow.alpha = 0;
				border.alpha = 0;
				icon.alpha = 0;
				btn.scale.set(1);
			}
		});
	}

	public override destroy(): void {
		if (this.keyDownHandler) {
			window.removeEventListener("keydown", this.keyDownHandler);
		}
		this.particles.forEach((p) => p.destroy({ children: true }));
		this.bgGraphics.forEach((g) => g.destroy({ children: true }));
		this.buttonContainers.forEach((b) => b.destroy({ children: true }));
		this.viewport.destroy({ children: true });
		this.backgroundGrid.destroy();
		this.title.destroy();
		super.destroy();
	}

	public override onResize(_w: number, _h: number): void {
		// Resize grid
		this.drawGrid();

		// Resize title
		this.title.x = _w / 2;

		// Resize mask
		const mask = this.viewport.mask as Graphics;
		mask.clear().beginFill(0xffffff).drawRect(0, 0, _w, 500).endFill();

		// Recenter buttons
		this.buttonContainers.forEach((c) => {
			c.x = (_w - 300) / 2;
		});

		// Redistribute particles
		this.particles.forEach((p) => {
			if (p.x > _w) {
				p.x = Math.random() * _w;
			}
		});
	}
}
