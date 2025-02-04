import type { StandardMaterial } from "pixi3d/pixi7";
import { Color, Light, LightingEnvironment, LightType, Mesh3D, Model } from "pixi3d/pixi7";
import { SoundLib } from "../../../../engine/sound/SoundLib";
import { Tween } from "tweedle.js";
import { Assets } from "pixi.js";

export class Torch {
	private torchSound: any;
	private torchPosition: { x: number; y: number; z: number };
	private maxVolumeDistance: number;
	private minVolumeDistance: number;
	private maxVolume: number; // Nuevo: Volumen máximo personalizable
	public name: string;

	constructor(container: any, x: number, z: number, maxVolume = 0.03, minVolumeDistance = 1, maxVolumeDistance = 50) {
		const torch = container.addChild(Mesh3D.createCylinder());
		torch.y = 0;
		torch.x = x;
		torch.z = z;
		torch.scale.set(1, 5, 1);
		this.torchPosition = { x, y: 0, z };

		// Guardamos valores personalizables
		this.maxVolume = maxVolume;
		this.minVolumeDistance = minVolumeDistance;
		this.maxVolumeDistance = maxVolumeDistance;

		const flame = Model.from(Assets.get("fire"));
		flame.position.copyFrom(torch.position);
		flame.position.y = 2;
		flame.scale.set(4, 4, 4);
		container.addChild(flame);

		flame.animations[0].loop = true;
		flame.animations[0].play();
		flame.animations[0].speed = 3;
		flame.meshes.forEach((mesh) => {
			const mat = mesh.material as StandardMaterial;
			mat.exposure = 1.1;
			mat.roughness = 0.6;
			mat.metallic = 0;
		});

		const torchLight = new Light();
		torchLight.type = LightType.point;
		torchLight.intensity = 50;
		torchLight.range = 10;
		new Tween(torchLight).to({ range: 12 }, 1000).repeat(Infinity).yoyo(true).start();
		new Tween(torchLight).to({ intensity: 150 }, 1000).repeat(Infinity).yoyo(true).start();
		torchLight.color = new Color(1, 1, 0);
		torchLight.position.copyFrom(torch.position);
		torchLight.position.y = 5;
		LightingEnvironment.main.lights.push(torchLight);

		// 🎵 Iniciar sonido con volumen máximo personalizable
		this.torchSound = SoundLib.playSound("torchsfx", { volume: this.maxVolume, loop: true, singleInstance: false, allowOverlap: true });
	}

	public update(playerPosition: { x: number; y: number; z: number }): void {
		const distance = Math.sqrt(
			Math.pow(this.torchPosition.x - playerPosition.x, 2) + Math.pow(this.torchPosition.y - playerPosition.y, 2) + Math.pow(this.torchPosition.z - playerPosition.z, 2)
		);

		// 📉 Interpolar el volumen entre maxVolume y 0
		const newVolume = this.maxVolume * (1 - Math.min(Math.max((distance - this.minVolumeDistance) / (this.maxVolumeDistance - this.minVolumeDistance), 0), 1));

		// 🎵 Aplicar el volumen al sonido
		if (this.torchSound) {
			this.torchSound.volume = newVolume;
		}
	}
}
