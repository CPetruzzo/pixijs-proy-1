import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { Graphics, Text, Container, TextStyle } from "pixi.js";
import { Filter, Rectangle } from "@pixi/core";
import { Manager } from "../..";

import { MenuScene } from "./RunFall/Scenes/MenuScene";
import { AHHomeScene } from "./AbandonedShelter/AHHomeScene";
import { AuroraQuilmesMapScene } from "./Aurora/Scenes/AuroraQuilmesMapScene";
import { TowerDefenseScene } from "./TowerDefenseGame/scenes/TowerDefenseScene";
import { BasquetballMainScene } from "./BasquetballGame/BasquetballMainScene";
import { JubilpostorHomeScene } from "./Jubilpostor/JubilpostorHomeScene";
import { TetrisScene } from "./Tetris/TetrisScene";
import { CoffeeShopScene } from "./CoffeeGame/CoffeeGameScene";
import { AStarScene } from "./AStarAlgorithm/AStarScene";
import { MultiplayerCachoWorldGameScene } from "./CachoWorld/Scenes/MultiplayerCachoWorldGameScene";
import { Scene3D } from "./3dgame/Scene3D";
import { LoadingTransition } from "../../engine/scenemanager/transitions/LoadingTransition";
import { IntroScene } from "./Soul/IntroScene";

interface ButtonConfig {
	label: string;
	scene: new (...args: any[]) => PixiScene;
}

export class CachoMenuScene extends PixiScene {
	private viewport!: Container;
	private content!: Container;
	private buttons: ButtonConfig[] = [
		{ label: "RunFall", scene: MenuScene },
		{ label: "Soul", scene: IntroScene },
		{ label: "Horror", scene: AHHomeScene },
		{ label: "Aurora", scene: AuroraQuilmesMapScene },
		{ label: "TowerDefense", scene: TowerDefenseScene },
		{ label: "CachoBasquet", scene: BasquetballMainScene },
		{ label: "Jubilpostor", scene: JubilpostorHomeScene },
		{ label: "Tetris", scene: TetrisScene },
		{ label: "3DDemo", scene: Scene3D },
		{ label: "Coffee", scene: CoffeeShopScene },
		{ label: "AStarAlgoritm", scene: AStarScene },
		{ label: "CachoWorld", scene: MultiplayerCachoWorldGameScene },
	];
	private bgGraphics: Graphics[] = [];
	private selectedIndex = 0;
	private borderFilter!: Filter;
	private keyDownHandler?: (e: KeyboardEvent) => void;
	private changeScene = false;

	constructor() {
		super();

		// 1) viewport + mask
		// 1) viewport + hitArea con Rectangle + eventMode
		this.viewport = new Container();
		this.viewport.y = 100;
		this.viewport.eventMode = "static";
		this.viewport.hitArea = new Rectangle(0, 0, Manager.width, 400);
		this.addChild(this.viewport);

		// 2) masking shape
		const maskShape = new Graphics().beginFill(0xffffff).drawRect(0, 0, Manager.width, 400).endFill();
		this.viewport.addChild(maskShape);
		this.viewport.mask = maskShape;

		// 3) content container
		this.content = new Container();
		this.viewport.addChild(this.content);

		// 4) shader + menu + scrolling + input
		this.setupShader();
		this.createMenu();
		this.setupScrolling();
		this.setupInput();
	}

	private setupShader(): void {
		const frag = `
      precision mediump float;
      uniform float time;
      uniform vec3 color;
      void main() {
        vec2 uv = gl_FragCoord.xy / vec2(${Manager.width.toFixed(1)}, 400.0);
        float glow = 0.5 + 0.5 * sin((uv.x+uv.y)*10.0 - time*2.0);
        gl_FragColor = vec4(color * glow, 1.0);
      }`;
		this.borderFilter = new Filter(undefined, frag, {
			time: 0,
			color: [0.2, 0.8, 1.0],
		});
	}

	private createMenu(): void {
		const buttonW = 250,
			buttonH = 60,
			gap = 20;
		const textStyle = new TextStyle({ fontFamily: "Pixelate-Regular", fontSize: 35, fill: "#fff" });

		this.buttons.forEach((cfg, i) => {
			const y = i * (buttonH + gap);

			const btnC = new Container();
			btnC.x = (Manager.width - buttonW) / 2;
			btnC.y = y;
			btnC.eventMode = "static"; // allow pointer events on the container

			// Background
			const bg = new Graphics().beginFill(0x333333).drawRoundedRect(0, 0, buttonW, buttonH, 10).endFill();
			bg.eventMode = "static";
			bg.cursor = "pointer";
			bg.filters = [];
			this.bgGraphics.push(bg);

			// Label
			const label = new Text(cfg.label, textStyle);
			label.anchor.set(0.5);
			label.x = buttonW / 2;
			label.y = buttonH / 2;

			btnC.addChild(bg, label);

			// Restore hover & click
			btnC.on("pointerover", () => {
				this.selectedIndex = i;
			});
			btnC.on("pointertap", () => {
				this.activateButton(i);
			});

			this.content.addChild(btnC);
		});
	}

	private setupScrolling(): void {
		let dragging = false,
			startY = 0,
			startScroll = 0;

		// pointerdown + move sobre viewport
		this.viewport.on("pointerdown", (e) => {
			dragging = true;
			startY = e.global.y;
			startScroll = this.content.y;
		});
		window.addEventListener("pointerup", () => (dragging = false));
		this.viewport.on("pointermove", (e) => {
			if (!dragging) {
				return;
			}
			const dy = e.global.y - startY;
			this.content.y = this.clamp(startScroll + dy, -(this.buttons.length * (60 + 20) - 400), 0);
		});

		// 4) rueda de scroll en el DOM
		window.addEventListener("wheel", (ev) => {
			// ev.deltaY te da el scroll vertical
			this.content.y = this.clamp(this.content.y - ev.deltaY, -(this.buttons.length * (60 + 20) - 400), 0);
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
			// auto‐scroll to keep selected in view
			const targetY = this.selectedIndex * (60 + 20);
			this.content.y = this.clamp(-targetY + 200, -(this.buttons.length * (60 + 20) - 400), 0);
		};
		window.addEventListener("keydown", this.keyDownHandler);
	}

	private activateButton(i: number): void {
		this.changeScene = true;
		Manager.changeScene(this.buttons[i].scene, {
			sceneParams: [],
			transitionClass: LoadingTransition,
		});
	}

	public override update(_dt: number): void {
		if (this.changeScene) {
			return;
		}
		// animate glow
		this.borderFilter.uniforms.time += 0.02;
		// highlight only selected
		this.bgGraphics.forEach((bg, i) => {
			if (i === this.selectedIndex) {
				bg.filters = [this.borderFilter];
				bg.alpha = 1;
			} else {
				bg.filters = [];
				bg.alpha = 0.7;
			}
		});
	}

	public override destroy(): void {
		if (this.keyDownHandler) {
			window.removeEventListener("keydown", this.keyDownHandler);
		}
		this.bgGraphics.forEach((g) => g.destroy({ children: true }));
		this.viewport.destroy({ children: true });
		super.destroy();
	}

	public override onResize(w: number, _h: number): void {
		// resize mask
		const mask = this.viewport.mask as Graphics;
		mask.clear().beginFill(0xffffff).drawRect(0, 0, w, 400).endFill();
		// recenter buttons
		this.content.children.forEach((c) => {
			c.x = (w - 250) / 2;
		});
	}
}
