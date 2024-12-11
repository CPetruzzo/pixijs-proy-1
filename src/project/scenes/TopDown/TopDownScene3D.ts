/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Assets } from "@pixi/assets";
import type { AABB, CameraOrbitControl, StandardMaterial } from "pixi3d/pixi7";
import { Light, LightingEnvironment, Model, LightType, Color, Point3D, ShadowCastingLight, ShadowQuality, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager, cameraControl } from "../../..";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Tween } from "tweedle.js";
import { Container, Graphics, Renderer } from "pixi.js";
import { LoseScene } from "../BallCollisionGame/LoseScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { DRAGON_SPEED, HAND_MOVEMENT_AMPLITUDE, HAND_MOVEMENT_FREQUENCY, MINIMAP_HEIGHT, MINIMAP_WIDTH, VEHICULE_SPEED } from "../../../utils/constants";
import type { PhysicsContainer3d } from "../3dgame/3DPhysicsContainer";
import { GameObjectFactory } from "../3dgame/GameObject";
import { UI } from "../3dgame/UI";

export class TopDownScene3D extends PixiScene {
	public static readonly BUNDLES = ["3d", "package-1"];

	// Models
	private impala: Model;
	private firstperson: PhysicsContainer3d;
	private dragon: Model;

	// hitboxs
	public impalaBox: any;
	public dragonBox: any;

	private cameraControl: CameraOrbitControl;

	// flags
	public onCar: boolean = false;
	private colliding: boolean = false;
	private isPaused: boolean = false;

	// minimap
	private miniMapContainer = new Container();
	private miniMapBackground = new Graphics();
	public cameraIndicator: Graphics;

	private flashlight: Light;
	private textContainer: Container = new Container();
	private uiContainer: Container = new Container();
	private ui: UI;

	constructor() {
		super();

		this.firstperson = GameObjectFactory.createPlayer();
		this.firstperson.name = "firstperson";
		this.impala = Model.from(Assets.get("impala"));
		this.impala.name = "impala";
		this.dragon = Model.from(Assets.get("dragon"));
		this.dragon.name = "dragon";
		this.firstperson.scale.set(0.03, 0.03, 0.03);
		this.firstperson.y = 50;
		this.impala.x = 60;
		this.impala.y = +1;
		this.impala.scale.set(30, 30, 30);
		this.impala.eventMode = "static";

		this.addChild(this.impala, this.firstperson, this.dragon, this.uiContainer);
		this.sortableChildren = true;

		const ground = this.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(100, 1, 100);

		this.impalaBox = this.impala.getBoundingBox();
		this.dragonBox = this.dragon.getBoundingBox();

		this.flashlight = new Light();
		this.flashlight.type = LightType.spot;
		this.flashlight.range = 100;
		this.flashlight.color = new Color(1, 1, 0.5);
		this.flashlight.intensity = 100;

		this.flashlight.position.set(this.firstperson.position.x, this.firstperson.model.position.y, this.firstperson.position.z);
		this.flashlight.rotationQuaternion.copyFrom(this.firstperson.rotationQuaternion);
		LightingEnvironment.main.lights.push(this.flashlight);

		const dirLight = new Light();
		dirLight.type = LightType.directional;
		dirLight.intensity = 5;
		dirLight.color = new Color(1, 1, 1);
		dirLight.rotationQuaternion.setEulerAngles(45, -75, 0);
		LightingEnvironment.main.lights.push(dirLight);

		const dirLight3 = new Light();
		dirLight3.type = LightType.directional;
		dirLight3.intensity = 5;
		dirLight3.color = new Color(1, 1, 1);
		dirLight3.rotationQuaternion.setEulerAngles(-80, 0, -45);
		LightingEnvironment.main.lights.push(dirLight3);

		const renderer = new Renderer({
			width: 800,
			height: 600,
			antialias: true,
			resolution: 1,
			autoDensity: true,
			backgroundColor: 0x1099bb,
		});

		const shadowCastingLight = new ShadowCastingLight(renderer, this.flashlight, { shadowTextureSize: 1024, quality: ShadowQuality.medium });
		shadowCastingLight.softness = 1;
		shadowCastingLight.shadowArea = 15;

		this.cameraControl = cameraControl;
		this.cameraControl.distance = 0;
		(this.cameraControl.target.x = 20), (this.cameraControl.target.y = 2), (this.cameraControl.target.z = 50);

		this.dragon.z = -500;
		this.dragon.animations[0].loop = true;
		this.dragon.animations[0].play();
		this.dragon.scale.set(15);
		this.dragon.meshes.forEach((mesh) => {
			const mat = mesh.material as StandardMaterial;
			mat.exposure = 1.1;
			mat.roughness = 0.6;
			mat.metallic = 0;
		});

		this.miniMapContainer.width = MINIMAP_WIDTH;
		this.miniMapContainer.height = MINIMAP_HEIGHT;
		this.miniMapContainer.position.set(500, 500);
		this.miniMapContainer.scale.set(3);
		this.miniMapContainer.pivot.set();
		this.addChild(this.miniMapContainer);

		this.miniMapBackground.beginFill(0xfff, 0.5);
		this.miniMapBackground.drawRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
		this.miniMapBackground.endFill();
		this.miniMapBackground.pivot.set(this.miniMapBackground.width / 2, this.miniMapBackground.height / 2);
		this.miniMapContainer.addChild(this.miniMapBackground);

		this.ui = new UI(this.uiContainer);
		// this.updateCamera();
	}

	public toggleFlashlight(): void {
		if (this.flashlight.intensity === 0) {
			// Encender la linterna
			this.flashlight.intensity = 100; // O cualquier otro valor que desees
		} else {
			// Apagar la linterna
			this.flashlight.intensity = 0;
		}
	}

	// Función para actualizar el texto en la UI
	public updateUIText(): void {
		const movementInstructions = `Use A/S/D/W to move, \nUse ←↕→ or mouse to rotate camera, \nUse +- or mousewheel to zoom in/out camera, \nUse Space to Jump`;
		const carInstructions = `It's onCar: ${this.onCar}\nUse E to get in and out of the car`;
		const carControlInstructions = `Use R/F to move car faster`;
		const generalInstructions = `camera angle: ${this.cameraControl.angles.x}\nIt's on floor: ${this.colliding}\n Distance to floor: ${this.firstperson.model.y}\n canJump: ${this.firstperson.canJump} \n Acceleration: ${this.firstperson.acceleration.y}\n speed: ${this.firstperson.speed.y}    `;

		// Llamar a la función updateText de la clase UI
		this.ui.updateText(movementInstructions, carInstructions, carControlInstructions, generalInstructions);
	}

	private getInCar(): void {
		new Tween(this.cameraControl).to({ x: this.impala.x, y: this.impala.y + 10, z: this.impala.z }, 500).start();
	}

	private updateMiniMapScale(): void {
		const objectCount = this.children.length;
		const maxScale = 1;
		const minScale = 1;
		const scale = Math.min(maxScale, minScale + objectCount * 0.1);
		this.miniMapContainer.scale.set(scale);
	}

	private updateMiniMap(): void {
		this.miniMapContainer.removeChildren();
		this.miniMapContainer.addChild(this.miniMapBackground);
		this.addMiniMapMarker(this.dragon, 0x0000ff);
		this.addMiniMapMarker(this.impala, 0xffff00);
		this.addMiniMapMarker(this.cameraControl.target, 0x00ff00);
	}

	private addMiniMapMarker(object: Container | Point3D | any, color: number): void {
		const marker = new Graphics();
		const objectX = object.x * (this.miniMapContainer.width / this.width);
		const objectY = object.z * (this.miniMapContainer.height / this.height);

		const isInsideBounds =
			objectX >= -this.miniMapBackground.width / 2 &&
			objectX <= this.miniMapBackground.width / 2 &&
			objectY >= -this.miniMapBackground.height / 2 &&
			objectY <= this.miniMapBackground.height / 2;

		if (isInsideBounds) {
			marker.beginFill(color);
			marker.drawCircle(objectX, objectY, 4);
			marker.endFill();
			this.miniMapContainer.addChild(marker);
		}
	}

	public intersect(a: AABB, b: AABB): boolean {
		return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y && a.min.z <= b.max.z && a.max.z >= b.min.z;
	}

	private pauseOnOff(): void {
		this.isPaused = !this.isPaused;
	}

	public createCameraIndicator(): void {
		this.cameraIndicator = new Graphics();
		this.cameraIndicator.lineStyle(2, 0xffffff);
		this.cameraIndicator.moveTo(0, 0);
		this.cameraIndicator.lineTo(20, 0);
		this.miniMapContainer.addChild(this.cameraIndicator);
	}

	public updateCamera(): void {
		// Ajusta la posición de la cámara detrás del jugador en el eje Z (trasero del jugador)
		const offsetX = 20 * Math.sin(this.cameraControl.angles.y * (Math.PI / 180)); // Ajuste en X según la rotación
		const offsetZ = 20 * Math.cos(this.cameraControl.angles.y * (Math.PI / 180)); // Ajuste en Z según la rotación

		// Posición de la cámara a 45 grados respecto al jugador
		const cameraX = this.firstperson.position.x - offsetX;
		const cameraY = this.firstperson.position.y + 10; // Altura de la cámara
		const cameraZ = this.firstperson.position.z - offsetZ;

		// Establecer la nueva posición de la cámara
		this.cameraControl.target.x = cameraX;
		this.cameraControl.target.y = cameraY;
		this.cameraControl.target.z = cameraZ;

		// La cámara siempre sigue la rotación del jugador (mantenemos un ángulo de 45 grados hacia abajo)
		// this.cameraControl.angles.x = -45; // Ángulo en X (vertical) para obtener el ángulo de 45 grados hacia abajo
		this.firstperson.rotationQuaternion.setEulerAngles(-45, this.cameraControl.angles.y, 0); // Mantener la rotación en Y del jugador
	}

	public override update(dt: number): void {
		if (Keyboard.shared.justPressed("KeyP")) {
			this.pauseOnOff();
		}
		if (this.isPaused) {
			return;
		} else {
			super.update(dt);

			this.updateUIText();
			// this.updateCamera();

			this.firstperson.update(dt);
			this.firstperson.position.set(this.cameraControl.target.x, this.cameraControl.target.y, this.cameraControl.target.z - 10);
			this.firstperson.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
			this.firstperson.position.y = this.cameraControl.target.y - 0.2 + Math.cos(performance.now() * HAND_MOVEMENT_FREQUENCY) * HAND_MOVEMENT_AMPLITUDE;
			this.dragon.z += DRAGON_SPEED;

			if (this.firstperson.y <= 1) {
				this.colliding = true;
			} else {
				this.colliding = false;
			}

			if (Keyboard.shared.justPressed("KeyL")) {
				this.toggleFlashlight();
			}
			const angleYRad = cameraControl.angles.y * (Math.PI / 180);
			const angleXRad = cameraControl.angles.x * (Math.PI / 180);
			const moveCarX = VEHICULE_SPEED * Math.sin(angleYRad);
			const moveCarY = VEHICULE_SPEED * Math.sin(angleXRad);
			const moveCarZ = VEHICULE_SPEED * Math.cos(angleYRad);
			const moveX = VEHICULE_SPEED * Math.sin(angleYRad);
			const moveY = VEHICULE_SPEED * Math.sin(angleXRad);
			const moveZ = VEHICULE_SPEED * Math.cos(angleYRad);

			if (Keyboard.shared.isDown("KeyW") || Keyboard.shared.isDown("KeyS") || Keyboard.shared.isDown("KeyA") || Keyboard.shared.isDown("KeyD")) {
				if (Keyboard.shared.isDown("KeyW")) {
					if (this.onCar) {
						cameraControl.target.z += moveCarZ * 2;
						cameraControl.target.x += moveCarX * 2;
						cameraControl.target.y -= moveCarY * 2;

						this.impala.z += moveCarZ * 2;
						this.impala.x += moveCarX * 2;
						this.impala.y -= moveCarY * 2;
					} else {
						cameraControl.target.z += moveZ;
						cameraControl.target.x += moveX;
						cameraControl.target.y -= moveY;
					}
				}

				if (Keyboard.shared.isDown("KeyS")) {
					if (this.onCar) {
						cameraControl.target.z -= moveCarZ * 2;
						cameraControl.target.x -= moveCarX * 2;
						cameraControl.target.y += moveCarY * 2;

						this.impala.z -= moveCarZ * 2;
						this.impala.x -= moveCarX * 2;
						this.impala.y += moveCarY * 2;
					} else {
						cameraControl.target.z -= moveZ;
						cameraControl.target.x -= moveX;
						cameraControl.target.y += moveY;
					}
				}

				if (Keyboard.shared.isDown("KeyA")) {
					if (!this.onCar) {
						cameraControl.target.z -= moveX;
						cameraControl.target.x += moveZ;
					}
				}

				if (Keyboard.shared.isDown("KeyD")) {
					if (!this.onCar) {
						cameraControl.target.z += moveX;
						cameraControl.target.x -= moveZ;
					}
				}

				if (this.colliding) {
					this.cameraControl.target.y = 1;
				}
			}

			if (Keyboard.shared.justPressed("Space")) {
				this.firstperson.jump();
			}

			if (Keyboard.shared.isDown("ArrowUp")) {
				if (!this.onCar) {
					// this.cameraControl.angles.x -= 2;
				}
			}
			if (Keyboard.shared.isDown("ArrowLeft")) {
				if (this.onCar) {
					if (Keyboard.shared.isDown("KeyW")) {
						// this.cameraControl.angles.y += 2;
					}
					if (Keyboard.shared.isDown("KeyS")) {
						// this.cameraControl.angles.y -= 2;
					}
					this.impala.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
				} else if (this.onCar) {
				} else {
					// this.cameraControl.angles.y += 2;
				}
			}
			if (Keyboard.shared.isDown("ArrowRight")) {
				if (this.onCar) {
					if (Keyboard.shared.isDown("KeyW")) {
						// this.cameraControl.angles.y -= 2;
					}
					if (Keyboard.shared.isDown("KeyS")) {
						// this.cameraControl.angles.y += 2;
					}
					this.impala.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
				} else if (this.onCar) {
				} else {
					// this.cameraControl.angles.y -= 2;
				}
			}
			if (Keyboard.shared.isDown("ArrowDown")) {
				if (!this.onCar) {
					// this.cameraControl.angles.x += 2;
				}
			}

			if (Keyboard.shared.isDown("KeyR")) {
				if (this.onCar) {
					cameraControl.target.z += moveZ * 2;
					cameraControl.target.x += moveX * 2;
					cameraControl.target.y -= moveY * 2;

					this.impala.z += moveZ * 2;
					this.impala.x += moveX * 2;
					this.impala.y -= moveY * 2;
				}
			}
			if (Keyboard.shared.isDown("KeyF")) {
				if (this.onCar) {
					cameraControl.target.z -= moveZ * 2;
					cameraControl.target.x -= moveX * 2;
					cameraControl.target.y += moveY * 2;

					this.impala.z -= moveZ * 2;
					this.impala.x -= moveX * 2;
					this.impala.y += moveY * 2;
				}
			}

			if (Keyboard.shared.justPressed("KeyE")) {
				if (!this.onCar) {
					this.onCar = true;
					this.cameraControl.angles.x = 0;
					this.getInCar();
					this.cameraControl.target.y = this.impala.y + 3;
					this.impala.position.set(this.cameraControl.target.x, this.impala.y, this.cameraControl.target.z);
					this.impala.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
				} else {
					this.onCar = false;
				}
			}

			if (Keyboard.shared.justPressed("NumpadSubtract")) {
				if (this.onCar) {
					new Tween(this.cameraControl).to({ distance: 25, y: this.cameraControl.target.y + 10 }, 500).start();
				} else {
					new Tween(this.cameraControl).to({ distance: 5 }, 500).start();
				}
			}
			if (Keyboard.shared.justPressed("NumpadAdd")) {
				new Tween(this.cameraControl).to({ distance: 0, y: this.cameraControl.target.y }, 500).start();
			}

			this.impalaBox = this.impala.getBoundingBox();
			this.dragonBox = this.dragon.getBoundingBox();

			this.impalaBox;
			const firstpersonBox = this.firstperson.model.getBoundingBox();
			const collisionfirstperson = this.intersect(firstpersonBox, this.dragonBox);
			if (collisionfirstperson && !this.colliding) {
				this.colliding = true;
			}

			const collision = this.intersect(this.dragonBox, this.impalaBox);
			if (collision && !this.colliding) {
				this.colliding = true;
				Manager.changeScene(LoseScene);
			}

			const crashToCar = this.intersect(firstpersonBox, this.impalaBox);
			if (crashToCar) {
				this.firstperson.position.x -= this.firstperson.speed.x * dt;
				this.firstperson.position.z -= this.firstperson.speed.z * dt;
			}

			const newPosition = new Point3D(this.firstperson.position.x, this.firstperson.position.y, this.firstperson.position.z);

			this.flashlight.position.copyFrom(newPosition);
			this.flashlight.rotationQuaternion.copyFrom(this.firstperson.rotationQuaternion);
		}

		this.updateMiniMapScale();
		this.updateMiniMap();
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.miniMapContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.miniMapContainer.x = newW * 0.8;
		this.miniMapContainer.y = newH * 0.2;

		ScaleHelper.setScaleRelativeToIdeal(this.textContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.textContainer.x = newW * 0.05;
		this.textContainer.y = newH * 0.05;

		ScaleHelper.setScaleRelativeToIdeal(this.uiContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.uiContainer.x = newW * 0.05;
		this.uiContainer.y = newH * 0.05;
	}
}
