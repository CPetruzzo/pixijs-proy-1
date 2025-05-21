/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Assets } from "@pixi/assets";
import type { AABB, CameraOrbitControl, StandardMaterial } from "pixi3d/pixi7";
import { Light, LightingEnvironment, Model, LightType, Color, Point3D, ShadowCastingLight, ShadowQuality, Mesh3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager, cameraControl } from "../../..";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Tween } from "tweedle.js";
import {
	Container,
	Graphics,
	Renderer,
	Text,
	Texture,
	// 	Texture
} from "pixi.js";
import { LoseScene } from "../BallCollisionGame/LoseScene";
import Random from "../../../engine/random/Random";
import { ProgressBar } from "@pixi/ui";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import {
	// CAMERA_MOVE_SPEED,
	HAND_MOVEMENT_AMPLITUDE,
	HAND_MOVEMENT_FREQUENCY,
	MINIMAP_HEIGHT,
	MINIMAP_WIDTH,
	VEHICULE_SPEED,
} from "../../../utils/constants";
import type { PhysicsContainer3d } from "../3dgame/3DPhysicsContainer";
import { GameObjectFactory } from "../3dgame/GameObject";
import type { MazeFixed } from "../3dgame/MazeFixed";
import { UI } from "../3dgame/UI";
import { Enemy3D } from "./enemies/Enemy3D";

export class AH3DScene extends PixiScene {
	public static readonly BUNDLES = ["3d", "package-1", "abandonedhouse"];

	// Models
	private impala: Model;
	private road1: Model;
	private road2: Model;
	private road3: Model;
	private road4: Model;
	private road5: Model;
	private road6: Model;
	private hauntedhouse: Model;
	private firstperson: PhysicsContainer3d;

	// hitboxs
	public impalaBox: any;

	private cameraControl: CameraOrbitControl;
	public explanationText: Text = new Text("");
	private lolis: Enemy3D[] = [];
	private hpBar: ProgressBar;

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
	public initialCinematicCompleted: boolean = false;

	constructor() {
		super();

		this.firstperson = GameObjectFactory.createPlayer();
		this.firstperson.name = "firstperson";
		this.impala = Model.from(Assets.get("impala"));
		this.impala.name = "impala";
		this.road1 = Model.from(Assets.get("road"));
		this.road2 = Model.from(Assets.get("road"));
		this.road3 = Model.from(Assets.get("road"));
		this.road4 = Model.from(Assets.get("road"));
		this.road5 = Model.from(Assets.get("road"));
		this.road6 = Model.from(Assets.get("road"));
		this.hauntedhouse = Model.from(Assets.get("hauntedhouse"));
		this.hauntedhouse.name = "hauntedhouse";

		this.firstperson.scale.set(0.03, 0.03, 0.03);
		this.firstperson.y = 50;
		this.impala.x = 0;
		this.impala.y = +1;
		this.impala.scale.set(30, 30, 30);
		this.impala.eventMode = "static";
		this.hauntedhouse.x = 50;

		const roadsize = 234.5;
		this.road2.z = roadsize;
		this.road3.z = roadsize * 2;
		this.road4.z = roadsize * 3;
		this.road5.z = roadsize * 4;
		this.road6.z = roadsize * 5;

		this.addChild(
			this.impala,
			this.road1,
			this.road2,
			this.road3,
			this.road4,
			this.road5,
			this.road6,
			this.hauntedhouse,
			this.firstperson,
			// this.textContainer,
			this.uiContainer
		);
		this.sortableChildren = true;
		this.hauntedhouse.zIndex = -1;

		const ground = this.addChild(Mesh3D.createPlane());
		ground.y = -0.8;
		ground.scale.set(100, 1, 100);

		for (let i = 0; i < 10; i++) {
			const skeleton = new Enemy3D(Texture.from("AH_skeleton"), MINIMAP_WIDTH, new Point3D(5, 5, 5));
			skeleton.scale.set(0.8);
			this.lolis.push(skeleton);
			this.addChild(skeleton);
		}

		this.impalaBox = this.impala.getBoundingBox();

		this.hpBar = new ProgressBar({
			bg: "barBG",
			fill: "bar",
			progress: 100,
		});
		this.hpBar.scale.set(0.6);
		this.hpBar.position.set(0, -35);

		this.uiContainer.addChild(this.hpBar);

		this.flashlight = new Light();
		this.flashlight.type = LightType.spot; // Usamos spot para simular un cono de luz
		this.flashlight.range = 100;
		this.flashlight.color = new Color(1, 1, 0.5);
		this.flashlight.intensity = 100;

		// this.createWall(new Point3D(0, 0, 0), 10);
		// this.createWall(new Point3D(0, 0, 5), 1, 3, 10);
		// this.createWall(new Point3D(5, 0, 5), 1, 3, 10);
		// this.createWall(new Point3D(0, 0, 15), 10);
		// this.createWall(new Point3D(-5, 0, 15), 1, 3, 10);

		// Asigna la posición de la linterna para que coincida con la posición de firstperson
		this.flashlight.position.set(this.firstperson.position.x, this.firstperson.model.position.y, this.firstperson.position.z);

		// Ajusta la rotación de la linterna según la dirección de firstperson si es necesario
		this.flashlight.rotationQuaternion.copyFrom(this.firstperson.rotationQuaternion);

		// Agrega la linterna a LightingEnvironment para que afecte a la escena
		LightingEnvironment.main.lights.push(this.flashlight);

		// light for background
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
		this.cameraControl.distance = 55;
		this.cameraControl.angles.x = 30;
		(this.cameraControl.target.x = 20), (this.cameraControl.target.y = 0), (this.cameraControl.target.z = 50);

		this.hauntedhouse.animations[0].loop = true;
		this.hauntedhouse.animations[0].play();
		this.hauntedhouse.scale.set(3);
		this.hauntedhouse.meshes.forEach((mesh) => {
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

		// Agregar fondo del minimapa
		this.miniMapBackground.beginFill(0xfff, 0.5);
		this.miniMapBackground.drawRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
		this.miniMapBackground.endFill();
		this.miniMapBackground.pivot.set(this.miniMapBackground.width / 2, this.miniMapBackground.height / 2);
		this.miniMapContainer.addChild(this.miniMapBackground);

		this.ui = new UI(this.uiContainer);

		// En lugar de tres tramos, lanzamos la circular:
		const center = new Point3D(20, 2, 0);
		const radius = 70;
		const circleEnd = new Point3D(center.x + radius, center.y, center.z); // (30, 2, 0)
		const duration = 10500; // ms

		// 1) Dale la vuelta completa:
		this.circularCinematic(
			duration, // duración total
			center, // centro
			radius, // radio
			() => {
				// 2) justo al terminar, arranca la segunda cinemática,
				//    desde circleEnd hacia tu siguiente punto:
				this.cinematicCamera(
					[
						{ time: 2000, from: circleEnd, to: new Point3D(0, 10, 30) },
						{ time: 1500, from: new Point3D(0, 10, 30), to: new Point3D(-5, 5, 10) },
						{ time: 1000, from: new Point3D(-5, 5, 10), to: center },
					],
					() => {
						console.log("Cinemática Finalizada");
						this.initialCinematicCompleted = true;
						new Tween(this.cameraControl).to({ distance: 20, y: this.cameraControl.target.y }, 500).start();
					}
				);
			}
		);
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
		// Obtén la cantidad de objetos en la escena principal
		const objectCount = this.children.length;
		// Define un valor máximo y mínimo para la escala del minimapa
		const maxScale = 1;
		const minScale = 1;

		// Calcula la escala del minimapa basada en la densidad de objetos
		const scale = Math.min(maxScale, minScale + objectCount * 0.1);

		// Aplica la escala al contenedor del minimapa
		this.miniMapContainer.scale.set(scale);
	}

	private updateMiniMap(): void {
		// Limpiar el minimapa antes de actualizarlo
		this.miniMapContainer.removeChildren();

		// Volver a agregar el fondo del minimapa
		this.miniMapContainer.addChild(this.miniMapBackground);

		// Agregar marcadores para las lolis y el personaje
		this.lolis.forEach((loli) => {
			const loliMarker = new Graphics();
			loliMarker.beginFill(0xff0000); // Color del marcador de loli
			loliMarker.drawCircle(loli.x, loli.z, 2);
			loliMarker.endFill();
			this.miniMapContainer.addChild(loliMarker);
		});

		// Agregar marcador para el impala (auto)
		this.addMiniMapMarker(this.impala, 0xffff00); // Marcador de impala en amarillo
		// Agregar el marcador del personaje (cámara)
		this.addMiniMapMarker(this.cameraControl.target, 0x00ff00); // Marcador de personaje en verde

		// this.drawMazeOnMiniMap(this.maze);

		// for (let i = 0; i < this.maze.rows; i++) {
		// 	for (let j = 0; j < this.maze.cols; j++) {
		// 		// Si la celda está ocupada (pared), dibuja un marcador en el minimapa
		// 		if (this.maze.grid[i][j] === "wall") {
		// 			const x = j * (this.miniMapContainer.width / this.maze.cols);
		// 			const y = i * (this.miniMapContainer.height / this.maze.rows);
		// 			this.addMiniMapMarker({ x, y }, 0xffffff); // Puedes ajustar el color según lo desees
		// 		}
		// 	}
		// }
	}

	/**
	 * Agrega un marcador al minimapa para un objeto dado.
	 * @param object El objeto para el cual se agregará el marcador.
	 * @param color El color del marcador.
	 */
	private addMiniMapMarker(object: Container | Point3D | any, color: number): void {
		const marker = new Graphics();
		const objectX = object.x * (this.miniMapContainer.width / this.width);
		const objectY = object.z * (this.miniMapContainer.height / this.height);

		// Verificar si el objeto está dentro de los límites del fondo del minimapa
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
	private updateText(): void {
		const movementInstructions = `Use A/S/D/W to move, \nUse ←↕→ or mouse to rotate camera, \nUse +- or mousewheel to zoom in/out camera, \nUse Space to Jump`;
		const carInstructions = `camera angle: ${this.cameraControl.angles.x} \nIt's colliding: ${this.colliding}\nIt's onCar: ${this.onCar}`;
		const carControlInstructions = `Use R/F to move car faster`;
		const generalInstructions = `camera angle: ${this.cameraControl.angles.x}\nIt's colliding: ${this.colliding}\nIt's onCar: ${this.onCar}\nUse E to get in and out of the car,\n Distance to floor: ${this.firstperson.model.y}\n canJump: ${this.firstperson.canJump} \n Acceleration: ${this.firstperson.acceleration.y}\n speed: ${this.firstperson.speed.y}    `;

		this.explanationText.text = this.onCar ? `${movementInstructions}\n${carInstructions}\n${carControlInstructions}` : `${movementInstructions}\n${generalInstructions}`;
	}

	public intersect(a: AABB, b: AABB): boolean {
		return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y && a.min.z <= b.max.z && a.max.z >= b.min.z;
	}

	private updateHPBar(): void {
		if (this.hpBar.progress <= 0) {
			Manager.changeScene(LoseScene);
		} else {
			// console.log(this.hpBar.progress);
		}
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

	public updateCameraIndicator(): void {
		const rotationSpeed = -Math.PI / 180;

		const cameraDirection = new Point3D(1, 1, 1);

		cameraDirection.normalize();

		const indicatorX = this.cameraControl.target.x * (this.miniMapContainer.width / this.width);
		const indicatorZ = this.cameraControl.target.z * (this.miniMapContainer.height / this.height);
		const indicatorLength = 30;

		const indicatorEndX = indicatorX + cameraDirection.x * Math.cos(this.cameraControl.angles.y * rotationSpeed + Math.PI / 2) * indicatorLength;
		const indicatorEndZ = indicatorZ + cameraDirection.z * Math.sin(this.cameraControl.angles.y * rotationSpeed + Math.PI / 2) * indicatorLength;

		console.log("Indicator Coordinates:", indicatorX, indicatorZ);
		console.log("Indicator End Coordinates:", indicatorEndX, indicatorEndZ);
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

			this.updateHPBar();
			this.firstperson.update(dt);

			if (this.initialCinematicCompleted) {
				this.lolis.forEach((loli) => {
					const cameraTarget = this.cameraControl.target;
					loli.update();
					loli.moveTowards(cameraTarget, Random.shared.random(0.05, 0.08));
					if (loli.distanceFromCamera() <= 2) {
						if (this.hpBar.progress >= 1) {
							// Scene3D.vehiculeSpeed *= Scene3D.loliSlowdownFactor;
							// console.log("Scene3D.vehiculeSpeed", VEHICULE_SPEED);
							// Reduce la barra de progreso y disminuye la velocidad si te alcanza la loli
							this.hpBar.progress = this.hpBar.progress - 1;
							navigator.vibrate([100, 100, 500, 100, 100]);
						}
					}
				});
				this.firstperson.position.set(this.cameraControl.target.x, this.cameraControl.target.y, this.cameraControl.target.z);
				this.firstperson.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
				this.firstperson.position.y = this.cameraControl.target.y - 0.2 + Math.cos(performance.now() * HAND_MOVEMENT_FREQUENCY) * HAND_MOVEMENT_AMPLITUDE;

				if (this.firstperson.y <= 1) {
					this.colliding = true;
					this.updateText();
				} else {
					this.colliding = false;
					this.updateText();
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
					// cameraControl.target.y += CAMERA_MOVE_SPEED;
					this.firstperson.jump();
				}

				if (Keyboard.shared.isDown("ArrowUp")) {
					if (!this.onCar) {
						this.cameraControl.angles.x -= 2;
					}
				}
				if (Keyboard.shared.isDown("ArrowLeft")) {
					if (this.onCar) {
						if (Keyboard.shared.isDown("KeyW")) {
							this.cameraControl.angles.y += 2;
						}
						if (Keyboard.shared.isDown("KeyS")) {
							this.cameraControl.angles.y -= 2;
						}
						this.impala.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
					} else if (this.onCar) {
					} else {
						this.cameraControl.angles.y += 2;
					}
				}
				if (Keyboard.shared.isDown("ArrowRight")) {
					if (this.onCar) {
						if (Keyboard.shared.isDown("KeyW")) {
							this.cameraControl.angles.y -= 2;
						}
						if (Keyboard.shared.isDown("KeyS")) {
							this.cameraControl.angles.y += 2;
						}
						this.impala.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
					} else if (this.onCar) {
					} else {
						this.cameraControl.angles.y -= 2;
					}
				}
				if (Keyboard.shared.isDown("ArrowDown")) {
					if (!this.onCar) {
						this.cameraControl.angles.x += 2;
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
					this.updateText();
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
				const firstpersonBox = this.firstperson.model.getBoundingBox();

				const crashToCar = this.intersect(firstpersonBox, this.impalaBox);
				if (crashToCar) {
					this.firstperson.position.x -= this.firstperson.speed.x * dt;
					this.firstperson.position.z -= this.firstperson.speed.z * dt;
				}

				// // Calcula el ángulo de dirección del jugador respecto al eje z (norte)
				// const playerDirection = Math.atan2(this.firstperson.rotationQuaternion.z, this.firstperson.rotationQuaternion.x);

				// // Define la distancia hacia adelante que quieres mover la linterna
				// const offsetDistance = 1;

				// Calcula la nueva posición de la linterna
				const newPosition = new Point3D(
					this.firstperson.position.x,
					// + playerDirection * offsetDistance
					this.firstperson.position.y,
					this.firstperson.position.z
					// + playerDirection * offsetDistance
				);

				// Establece la posición de la linterna
				this.flashlight.position.copyFrom(newPosition);

				// Copia la rotación del jugador a la linterna
				this.flashlight.rotationQuaternion.copyFrom(this.firstperson.rotationQuaternion);
			}

			this.updateMiniMapScale();
			this.updateMiniMap();
			// this.updateCameraIndicator();
		}
	}

	/**
	 * Recorre la cámara por una serie de “pasos” cinemáticos.
	 *
	 * @param steps Array de pasos:
	 *   - time: duración del tramo en ms
	 *   - from: posición inicial (Point3D)
	 *   - to: posición final (Point3D)
	 * @param onComplete Callback opcional al terminar.
	 */
	public cinematicCamera(steps: { time: number; from: Point3D; to: Point3D }[], onComplete?: () => void): void {
		if (steps.length === 0) {
			onComplete?.();
			return;
		}

		// Sacamos el siguiente paso
		const { time, from, to } = steps.shift()!;

		// *** OPCIÓN A: casteamos a Point3D para usar copyFrom() ***
		// (this.cameraControl.target as Point3D).copyFrom(from);

		// *** OPCIÓN B: asignar a mano ***
		this.cameraControl.target.x = from.x;
		this.cameraControl.target.y = from.y;
		this.cameraControl.target.z = from.z;

		// Tweeneamos target hacia la posición “to”
		new Tween(this.cameraControl.target)
			.to({ x: to.x, y: to.y, z: to.z }, time)
			.easing((k) => k) // easing lineal; puedes usar otro
			.onComplete(() => {
				// Al terminar este tramo, si quedan pasos, recursivamente lanzamos el siguiente
				if (steps.length) {
					this.cinematicCamera(steps, onComplete);
				} else {
					onComplete?.();
				}
			})
			.start();
	}

	public circularCinematic(duration: number, center: Point3D, radius: number, onComplete?: () => void): void {
		// 1) Posición inicial en ángulo = 0
		this.cameraControl.target.x = center.x + radius;
		this.cameraControl.target.y = center.y;
		this.cameraControl.target.z = center.z;

		// 2) Tween de t=0 → 1
		const obj = { t: 0 };
		new Tween(obj)
			.to({ t: 1 }, duration)
			.easing((k) => k)
			.onUpdate(() => {
				const angle = obj.t * Math.PI * 2;
				this.cameraControl.target.x = center.x + radius * Math.cos(angle);
				this.cameraControl.target.y = center.y;
				this.cameraControl.target.z = center.z + radius * Math.sin(angle);
			})
			.onComplete(() => {
				// Aseguramos que vuelva exactamente al centro final
				this.cameraControl.target.x = center.x;
				this.cameraControl.target.y = center.y;
				this.cameraControl.target.z = center.z;
				onComplete?.();
			})
			.start();
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

	public addWallsFromMaze(maze: MazeFixed): void {
		const wallSize = 10; // Tamaño de cada celda del laberinto en la escena

		for (let row = 0; row < maze.rows; row++) {
			for (let col = 0; col < maze.cols; col++) {
				if (maze.grid[row][col] === "empty") {
					// Si la celda está vacía en el laberinto, determinar la dirección del pasillo
					let direction = Math.floor(Math.random() * 3); // 0: adelante, 1: izquierda, 2: derecha
					if (direction === 0) {
						// Avanzar hacia adelante
						for (let i = col; i < maze.cols; i++) {
							if (maze.grid[row][i] === "wall") {
								const wall = Mesh3D.createCube();
								wall.position.set(i * wallSize, wallSize / 2, row * wallSize);
								wall.scale.set(wallSize, wallSize, wallSize / 4);
								this.addChild(wall);
								break;
							}
						}
					} else if (direction === 1) {
						// Avanzar hacia la izquierda
						for (let i = row; i < maze.rows; i++) {
							if (maze.grid[i][col] === "wall") {
								const wall = Mesh3D.createCube();
								wall.position.set(col * wallSize, wallSize / 2, i * wallSize);
								wall.scale.set(wallSize, wallSize, wallSize / 4);
								this.addChild(wall);
								break;
							}
						}
					} else {
						// Avanzar hacia la derecha
						for (let i = row; i < maze.rows; i++) {
							if (maze.grid[i][col] === "wall") {
								const wall = Mesh3D.createCube();
								wall.position.set(col * wallSize, wallSize / 2, i * wallSize);
								wall.scale.set(wallSize, wallSize, wallSize / 4);
								this.addChild(wall);
								break;
							}
						}
					}
				}

				let direction = Math.floor(Math.random() * 3); // 0: adelante, 1: izquierda, 2: derecha
				if (direction === 0) {
					// Avanzar hacia adelante
					for (let i = col; i < maze.cols; i++) {
						if (maze.grid[row][i] === "wall") {
							const wall = Mesh3D.createCube();
							wall.position.set(i * wallSize, wallSize / 2, row * wallSize);
							wall.scale.set(wallSize, wallSize, wallSize / 4);
							this.addChild(wall);
							break;
						}
					}
				} else if (direction === 1) {
				} else {
					// Avanzar hacia la derecha
					for (let i = row; i < maze.rows; i++) {
						if (maze.grid[i][col] === "wall") {
							const wall = Mesh3D.createCube();
							wall.position.set(col * wallSize, wallSize / 2, i * wallSize);
							wall.scale.set(wallSize / 4, wallSize, wallSize);
							this.addChild(wall);
							break;
						}
					}
				}
			}
		}
	}

	public drawMazeOnMiniMap(maze: MazeFixed): void {
		const cellWidth = maze.cols;
		const cellHeight = maze.rows;

		const emptyColor = 0x000000; // Color de las celdas vacías en el minimapa
		const wallColor = 0x00000f; // Color de las paredes en el minimapa

		const graphics = new Graphics();

		for (let row = 0; row < maze.rows; row++) {
			for (let col = 0; col < maze.cols; col++) {
				const x = col * cellWidth;
				const y = row * cellHeight;

				if (maze.grid[row][col] === "wall") {
					graphics.beginFill(wallColor);
					graphics.drawRect(x, y, cellWidth, cellHeight);
					graphics.endFill();
				} else if (maze.grid[row][col] === "empty") {
					graphics.beginFill(emptyColor);
					graphics.drawRect(x, y, cellWidth, cellHeight);
					graphics.endFill();
				}
				// Puedes agregar más condiciones aquí para otros tipos de celdas, si es necesario
			}
		}

		this.miniMapContainer.addChild(graphics);
	}
}
