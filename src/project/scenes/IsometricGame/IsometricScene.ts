/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Assets } from "@pixi/assets";
import type { AABB, CameraOrbitControl, StandardMaterial } from "pixi3d/pixi7";
import { Light, LightingEnvironment, Model, LightType, Color, Point3D } from "pixi3d/pixi7";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Manager, cameraControl } from "../../..";
import { Keyboard } from "../../../engine/input/Keyboard";
import { Tween } from "tweedle.js";
import { Container, Graphics, Text, TextStyle, Texture } from "pixi.js";
import { LoseScene } from "../BallCollisionGame/LoseScene";
import Random from "../../../engine/random/Random";
import { ProgressBar } from "@pixi/ui";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { CAMERA_MOVE_SPEED, DRAGON_SPEED, HAND_MOVEMENT_AMPLITUDE, HAND_MOVEMENT_FREQUENCY, MINIMAP_HEIGHT, MINIMAP_WIDTH, VEHICULE_SPEED } from "../../../utils/constants";
import { Loli } from "../3dgame/Loli";
// import { SoundLib } from "../../../engine/sound/SoundLib";

export class IsometricScene extends PixiScene {
	public static readonly BUNDLES = ["3d", "package-1"];

	// Models
	private impala: Model;
	private road1: Model;
	private road2: Model;
	private road3: Model;
	private road4: Model;
	private road5: Model;
	private road6: Model;
	private hauntedhouse: Model;
	private firstperson: Model;
	private dragon: Model;

	// hitboxs
	public impalaBox: any;
	public dragonBox: any;

	private cameraControl: CameraOrbitControl;
	public explanationText: Text = new Text("");
	private lolis: Loli[] = [];
	private hpBar: ProgressBar;

	// flags
	public onCar: boolean = false;
	private colliding: boolean = false;
	private isPaused: boolean = false;

	// minimap
	private miniMapContainer = new Container();
	private miniMapBackground = new Graphics();
	public cameraIndicator: Graphics;

	constructor() {
		super();

		// SoundLib.playMusic("");

		this.firstperson = Model.from(Assets.get("firstperson"));
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
		this.dragon = Model.from(Assets.get("dragon"));
		this.dragon.name = "dragon";
		this.firstperson.scale.set(0.03, 0.03, 0.03);
		this.firstperson.y = 50;
		this.impala.x = 60;
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
			// this.hauntedhouse,
			this.firstperson,
			this.dragon
		);
		this.sortableChildren = true;
		this.hauntedhouse.zIndex = -1;

		// const loli = new Sprite3D(Texture.from("loli"));
		// loli.billboardType = SpriteBillboardType.spherical;
		for (let i = 0; i < 50; i++) {
			const loli = new Loli(Texture.from("loli"), MINIMAP_WIDTH, new Point3D(5, 5, 5));
			// loli.zIndex = 0;
			this.lolis.push(loli);
			this.addChild(loli);
		}

		this.impalaBox = this.impala.getBoundingBox();
		console.log("impalaBox", this.impalaBox);
		this.dragonBox = this.dragon.getBoundingBox();
		console.log("dragonBox", this.dragonBox);

		this.makeDemoText();

		this.hpBar = new ProgressBar({
			bg: "barBG",
			fill: "bar",
			progress: 100,
		});
		this.hpBar.scale.set(0.3);
		this.hpBar.position.set(0, 320);

		this.addChild(this.hpBar);

		// Crea una luz para simular la linterna (puedes usar point o spot, ajusta según tus necesidades)
		const flashlight = new Light();
		flashlight.type = LightType.spot; // Usamos spot para simular un cono de luz
		flashlight.range = 30; // Rango de alcance de la linterna
		flashlight.color = new Color(1, 1, 0.5); // Color de la luz (amarillo en este ejemplo)
		flashlight.intensity = 100; // Intensidad de la luz (ajusta según lo necesites)

		// Asigna la posición de la linterna para que coincida con la posición de firstperson
		flashlight.position.set(this.firstperson.position.x, this.firstperson.position.y, this.firstperson.position.z);

		// Ajusta la rotación de la linterna según la dirección de firstperson si es necesario
		flashlight.rotationQuaternion.copyFrom(this.firstperson.rotationQuaternion);

		// Agrega la linterna a LightingEnvironment para que afecte a la escena
		LightingEnvironment.main.lights.push(flashlight);

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

		this.cameraControl = cameraControl;
		this.cameraControl.distance = 0;
		(this.cameraControl.target.x = 0), (this.cameraControl.target.y = 2), (this.cameraControl.target.z = 50);

		this.hauntedhouse.animations[0].loop = true;
		this.hauntedhouse.animations[0].play();
		this.hauntedhouse.scale.set(3);
		this.hauntedhouse.meshes.forEach((mesh) => {
			const mat = mesh.material as StandardMaterial;
			mat.exposure = 1.1;
			mat.roughness = 0.6;
			mat.metallic = 0;
		});

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
		this.miniMapContainer.position.set(500, 500); // Ajusta la posición según sea necesario
		this.miniMapContainer.scale.set(3);
		this.miniMapContainer.pivot.set();
		this.addChild(this.miniMapContainer);

		// Agregar fondo del minimapa
		this.miniMapBackground.beginFill(0xfff, 0.5);
		this.miniMapBackground.drawRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
		this.miniMapBackground.endFill();
		this.miniMapBackground.pivot.set(this.miniMapBackground.width / 2, this.miniMapBackground.height / 2);
		this.miniMapContainer.addChild(this.miniMapBackground);

		// Llama a esta función en el constructor después de crear el fondo del minimapa
		// this.createCameraIndicator();
	}

	private getInCar(): void {
		new Tween(this.cameraControl).to({ x: this.impala.x, y: this.impala.y + 10, z: this.impala.z }, 500).start();
	}

	private updateMiniMapScale(): void {
		// Obtén la cantidad de objetos en la escena principal
		const objectCount = this.children.length;
		console.log("objectCount", objectCount);

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

		// Agregar marcador para el dragon
		this.addMiniMapMarker(this.dragon, 0x0000ff); // Marcador de dragon en azul

		// Agregar marcador para el impala (auto)
		this.addMiniMapMarker(this.impala, 0xffff00); // Marcador de impala en amarillo
		// Agregar el marcador del personaje (cámara)
		this.addMiniMapMarker(this.cameraControl.target, 0x00ff00); // Marcador de personaje en verde
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

	/**
	 * Method to make the text explaining the demo. Nothing to see here.
	 */
	private makeDemoText(): void {
		const textStyle = new TextStyle({
			fill: "white",
			fontFamily: "Arial Rounded MT",
			stroke: "black",
			strokeThickness: 10,
			lineJoin: "round",
		});

		if (this.onCar) {
			this.explanationText = new Text(
				`Use A/S/D/W to move, \nUse ←↕→ or mouse to rotate camera, \nUse +- or mousewheel to zoom in/out camera, \nUse Space to go up \ncamera angle: ${this.cameraControl.angles.x} \nIt's colliding: ${this.colliding}\nIt's onCar: ${this.onCar}`,
				textStyle
			);
			this.addChild(this.explanationText);
		} else {
			this.explanationText = new Text(
				(this.explanationText.text = `Use A/S/D/W to move, \nUse ←↕→ or mouse to rotate camera, \nUse +- or mousewheel to zoom in/out camera, \nUse Space to go up \nIt's colliding: ${this.colliding}\nIt's onCar: ${this.onCar}\nUse E to get in and out of the car`),
				textStyle
			);
			this.addChild(this.explanationText);
		}
	}

	private updateText(): void {
		const movementInstructions = `Use A/S/D/W to move, \nUse ←↕→ or mouse to rotate camera, \nUse +- or mousewheel to zoom in/out camera, \nUse Space to go up`;
		const carInstructions = `camera angle: ${this.cameraControl.angles.x} \nIt's colliding: ${this.colliding}\nIt's onCar: ${this.onCar}`;
		const carControlInstructions = `Use R/F to move car faster`;
		const generalInstructions = `camera angle: ${this.cameraControl.angles.x}\nIt's colliding: ${this.colliding}\nIt's onCar: ${this.onCar}\nUse E to get in and out of the car`;

		this.explanationText.text = this.onCar ? `${movementInstructions}\n${carInstructions}\n${carControlInstructions}` : `${movementInstructions}\n${generalInstructions}`;
	}

	public intersect(a: AABB, b: AABB): boolean {
		return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y && a.min.z <= b.max.z && a.max.z >= b.min.z;
	}

	private updateHPBar(): void {
		if (this.hpBar.progress <= 0) {
			console.log("you lose");
			Manager.changeScene(LoseScene);
		} else {
			console.log(this.hpBar.progress);
		}
	}

	private pauseOnOff(): void {
		this.isPaused = !this.isPaused;
		console.log("this.isPaused", this.isPaused);
	}

	public createCameraIndicator(): void {
		// Crea el indicador de la cámara (puedes personalizar esto según tus preferencias)
		this.cameraIndicator = new Graphics();
		this.cameraIndicator.lineStyle(2, 0xffffff); // Línea blanca de grosor 2
		this.cameraIndicator.moveTo(0, 0);
		this.cameraIndicator.lineTo(20, 0); // Longitud del indicador
		this.miniMapContainer.addChild(this.cameraIndicator);
	}

	public updateCameraIndicator(): void {
		const rotationSpeed = -Math.PI / 180; // Experimenta con diferentes valores

		// Actualiza la posición y rotación del indicador según la dirección de la cámara
		const cameraDirection = new Point3D(1, 1, 1); // Dirección inicial

		// Normaliza la dirección para asegurarse de que la línea tenga la longitud correcta
		cameraDirection.normalize();

		// Establece la posición y rotación del indicador en el minimapa
		const indicatorX = this.cameraControl.target.x * (this.miniMapContainer.width / this.width);
		const indicatorZ = this.cameraControl.target.z * (this.miniMapContainer.height / this.height);
		const indicatorLength = 30; // Longitud del indicador en el minimapa

		// Calcula las coordenadas finales del indicador con ajuste de velocidad
		const indicatorEndX = indicatorX + cameraDirection.x * Math.cos(this.cameraControl.angles.y * rotationSpeed + Math.PI / 2) * indicatorLength;
		const indicatorEndZ = indicatorZ + cameraDirection.z * Math.sin(this.cameraControl.angles.y * rotationSpeed + Math.PI / 2) * indicatorLength;

		console.log("Indicator Coordinates:", indicatorX, indicatorZ);
		console.log("Indicator End Coordinates:", indicatorEndX, indicatorEndZ);

		// this.cameraIndicator.clear();
		// this.cameraIndicator.lineStyle(2, 0xffffff); // Línea blanca de grosor 2
		// this.cameraIndicator.moveTo(indicatorX, indicatorZ);
		// this.cameraIndicator.lineTo(indicatorEndX, indicatorEndZ);
	}

	public override update(dt: number): void {
		if (Keyboard.shared.justPressed("KeyP")) {
			this.pauseOnOff();
		}
		if (this.isPaused) {
			return;
		} else {
			super.update(dt);

			this.updateHPBar();

			this.lolis.forEach((loli) => {
				const cameraTarget = this.cameraControl.target;
				loli.update();
				loli.moveTowards(cameraTarget, Random.shared.random(0.05, 0.08)); // Puedes ajustar la velocidad según sea necesario
				if (loli.distanceFromCamera() <= 2) {
					console.log("loli.distanceFromCamera()", loli.distanceFromCamera());
					if (this.hpBar.progress >= 1) {
						// Scene3D.vehiculeSpeed *= Scene3D.loliSlowdownFactor;
						console.log("Scene3D.vehiculeSpeed", VEHICULE_SPEED);
						// Reduce la barra de progreso y disminuye la velocidad si te alcanza la loli
						this.hpBar.progress = this.hpBar.progress - 1;
						navigator.vibrate([100, 100, 500, 100, 100]);
					}
				}
			});
			this.firstperson.position.set(this.cameraControl.target.x, this.cameraControl.target.y, this.cameraControl.target.z);
			this.firstperson.rotationQuaternion.setEulerAngles(this.cameraControl.angles.x, this.cameraControl.angles.y, 0);
			this.firstperson.position.y = this.cameraControl.target.y - 0.2 + Math.cos(performance.now() * HAND_MOVEMENT_FREQUENCY) * HAND_MOVEMENT_AMPLITUDE;
			this.dragon.z += DRAGON_SPEED;

			if (this.firstperson.y <= 1) {
				this.colliding = true;
				this.updateText();
			} else {
				this.colliding = false;
				this.updateText();
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

			if (Keyboard.shared.isDown("Space")) {
				cameraControl.target.y += CAMERA_MOVE_SPEED;
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
			this.dragonBox = this.dragon.getBoundingBox();

			this.impalaBox;
			const firstpersonBox = this.firstperson.getBoundingBox();
			const collisionfirstperson = this.intersect(firstpersonBox, this.dragonBox);
			if (collisionfirstperson && !this.colliding) {
				this.colliding = true;
				this.updateText();
			}

			const collision = this.intersect(this.dragonBox, this.impalaBox);
			if (collision && !this.colliding) {
				this.colliding = true;
				console.log("this.colliding", this.colliding);
				Manager.changeScene(LoseScene);
				this.updateText();
			}
		}

		this.updateMiniMapScale();
		this.updateMiniMap();
		// this.updateCameraIndicator();
	}

	public override onResize(newW: number, newH: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.miniMapContainer, newW, newH, 1920, 1080, ScaleHelper.FIT);
		this.miniMapContainer.x = newW * 0.8;
		this.miniMapContainer.y = newH * 0.2;
	}
}
