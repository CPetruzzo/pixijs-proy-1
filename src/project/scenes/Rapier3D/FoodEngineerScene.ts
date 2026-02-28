/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Color, Container3D, Light, LightingEnvironment, LightType, Mesh3D, StandardMaterial, StandardMaterialAlphaMode } from "pixi3d/pixi7";
import { cameraControl, mousePosition } from "../../..";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Graphics, Rectangle, Text } from "pixi.js";

enum IngredientType {
	AIR = 0,
	COOKIE = 1,
	CREAM = 2,
	TOPPING = 3,
}

const INGREDIENT_CONFIG: Record<number, { label: string; color: number; r: number; g: number; b: number }> = {
	[IngredientType.COOKIE]: { label: "CHOCOLINAS", color: 0x5c4033, r: 0.36, g: 0.25, b: 0.2 },
	[IngredientType.CREAM]: { label: "MIX CREMA", color: 0xf2e8cf, r: 0.95, g: 0.9, b: 0.8 },
	[IngredientType.TOPPING]: { label: "CACAO", color: 0x3d2b1f, r: 0.2, g: 0.1, b: 0.05 },
};

export class FoodEngineerScene extends PixiScene {
	private readonly GRID_W = 10;
	private readonly GRID_D = 8;
	private readonly GRID_H = 6;
	private readonly TILE_SIZE = 1;

	private cakeGrid: Uint8Array;
	private blockMeshes: Map<string, Mesh3D> = new Map();
	private worldContainer: Container3D;
	private uiLayer: Container;
	private selectedIngredient: IngredientType = IngredientType.COOKIE;
	private previewCube: Mesh3D;

	constructor() {
		super();
		this.cakeGrid = new Uint8Array(this.GRID_W * this.GRID_H * this.GRID_D);
		this.worldContainer = this.addChild(new Container3D());
		this.uiLayer = this.addChild(new Container());

		this.setupLighting();
		this.setupCamera();
		this.createContainerGlass();
		this.createPreviewCube();
		this.createUI();
		this.setupEvents();

		this.hitArea = new Rectangle(0, 0, 2000, 2000);
	}

	private setupLighting() {
		LightingEnvironment.main.lights = [];
		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 2;
		dirLight.rotationQuaternion.setEulerAngles(45, 45, 0);
		LightingEnvironment.main.lights.push(dirLight);

		const ambLight = new Light();
		ambLight.type = LightType.directional;
		ambLight.intensity = 0.5;
		LightingEnvironment.main.lights.push(ambLight);
	}

	private setupCamera() {
		cameraControl.allowControl = false;
		cameraControl.angles.x = 40; // Vista isométrica desde arriba
		cameraControl.angles.y = 35;
		cameraControl.distance = 15;
		cameraControl.target = {
			x: (this.GRID_W / 2) * this.TILE_SIZE - 5,
			y: (this.GRID_H / 2) * this.TILE_SIZE,
			z: (this.GRID_D / 2) * this.TILE_SIZE - 5,
		};
	}

	private createContainerGlass() {
		// Base del recipiente (vidrio)
		const glass = Mesh3D.createCube();
		glass.scale.set((this.GRID_W * this.TILE_SIZE) / 2 + 0.1, 0.1, (this.GRID_D * this.TILE_SIZE) / 2 + 0.1);
		glass.position.set(this.GRID_W / 2 - 0.5, -0.6, this.GRID_D / 2 - 0.5);

		const mat = new StandardMaterial();
		mat.baseColor = new Color(0.8, 0.9, 1.0, 0.3);
		mat.alphaMode = StandardMaterialAlphaMode.blend;
		glass.material = mat;
		this.worldContainer.addChild(glass);
	}

	private createPreviewCube() {
		this.previewCube = Mesh3D.createCube();
		this.previewCube.scale.set(0.51);
		const mat = new StandardMaterial();
		mat.baseColor = new Color(1, 1, 1, 0.4);
		mat.alphaMode = StandardMaterialAlphaMode.blend;
		mat.unlit = true;
		this.previewCube.material = mat;
		this.worldContainer.addChild(this.previewCube);
	}

	private getIndex(x: number, y: number, z: number) {
		return x + y * this.GRID_W + z * this.GRID_W * this.GRID_H;
	}

	// Lógica de Raycast "Manual" para voxels
	// Cambia la firma para aceptar x e y
	private getVoxelAtRay(mouseX: number, mouseY: number): { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null {
		const ray = cameraControl.camera.screenToRay(mouseX, mouseY);
		if (!ray) {
			return null;
		}

		let px = ray.origin.x;
		let py = ray.origin.y;
		let pz = ray.origin.z;

		// Aumentamos a 500 para cubrir 100 unidades de distancia (500 * 0.2)
		for (let i = 0; i < 500; i++) {
			px += ray.direction.x * 0.2;
			py += ray.direction.y * 0.2;
			pz += ray.direction.z * 0.2;

			const gx = Math.round(px);
			const gy = Math.round(py);
			const gz = Math.round(pz);

			if (gx >= 0 && gx < this.GRID_W && gy >= 0 && gy < this.GRID_H && gz >= 0 && gz < this.GRID_D) {
				const type = this.cakeGrid[this.getIndex(gx, gy, gz)];
				if (type !== IngredientType.AIR) {
					return { x: gx, y: gy, z: gz, nx: 0, ny: 1, nz: 0 };
				}
				// Suelo del recipiente
				if (gy === 0 && py < 0.1) {
					return { x: gx, y: 0, z: gz, nx: 0, ny: 1, nz: 0 };
				}
			}
		}
		return null;
	}
	private createUI() {
		const tools = [IngredientType.COOKIE, IngredientType.CREAM, IngredientType.TOPPING];
		tools.forEach((type, i) => {
			const cfg = INGREDIENT_CONFIG[type];
			const btn = new Graphics().beginFill(cfg.color).drawRoundedRect(0, 0, 150, 60, 8).endFill();

			btn.x = window.innerWidth - 170;
			btn.y = 50 + i * 80;
			btn.eventMode = "static";
			btn.on("pointerdown", () => {
				this.selectedIngredient = type;
				this.uiLayer.children.forEach((c) => (c.alpha = 0.6));
				btn.alpha = 1;
			});

			const txt = new Text(cfg.label, { fill: 0xffffff, fontSize: 14, fontWeight: "bold" });
			txt.anchor.set(0.5);
			txt.position.set(75, 30);
			btn.addChild(txt);
			this.uiLayer.addChild(btn);
		});
	}

	private setupEvents() {
		this.eventMode = "static";
		this.on("pointerdown", (e) => {
			// e.data.global contiene la posición correcta dentro del canvas
			const hit = this.getVoxelAtRay(e.data.global.x, e.data.global.y);
			if (hit) {
				let { x, y, z } = hit;
				if (this.cakeGrid[this.getIndex(x, y, z)] !== IngredientType.AIR) {
					y++;
				}

				if (y < this.GRID_H) {
					this.cakeGrid[this.getIndex(x, y, z)] = this.selectedIngredient;
					this.renderBlock(x, y, z);
				}
			}
		});
	}

	private renderBlock(x: number, y: number, z: number) {
		const key = `${x},${y},${z}`;
		if (this.blockMeshes.has(key)) {
			return;
		}

		const type = this.cakeGrid[this.getIndex(x, y, z)];
		const cfg = INGREDIENT_CONFIG[type];

		const block = Mesh3D.createCube();
		block.scale.set(0.5);
		block.position.set(x, y, z);

		const mat = new StandardMaterial();
		mat.baseColor = new Color(cfg.r, cfg.g, cfg.b);
		block.material = mat;

		this.worldContainer.addChild(block);
		this.blockMeshes.set(key, block);
	}

	public override update(dt: number) {
		super.update(dt);

		// Para el preview, usamos el puntero del renderer de Pixi
		const hit = this.getVoxelAtRay(mousePosition.x, mousePosition.y);

		if (hit) {
			this.previewCube.visible = true;
			let { x, y, z } = hit;
			if (this.cakeGrid[this.getIndex(x, y, z)] !== IngredientType.AIR) {
				y++;
			}
			this.previewCube.position.set(x, y, z);
		} else {
			this.previewCube.visible = false;
		}
	}
}
