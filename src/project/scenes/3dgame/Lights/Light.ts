import { Color, Light, LightingEnvironment, LightType } from "pixi3d/pixi7";

export class EnviromentalLights {
	private dirLight: Light;
	private dirLight3: Light;

	constructor() {
		// Luz direccional 1
		this.dirLight = new Light();
		this.dirLight.type = LightType.directional;
		this.dirLight.intensity = 5;
		this.dirLight.color = new Color(1, 1, 1);
		this.dirLight.rotationQuaternion.setEulerAngles(45, -75, 0);
		LightingEnvironment.main.lights.push(this.dirLight);

		// Luz direccional 2
		this.dirLight3 = new Light();
		this.dirLight3.type = LightType.directional;
		this.dirLight3.intensity = 5;
		this.dirLight3.color = new Color(1, 1, 1);
		this.dirLight3.rotationQuaternion.setEulerAngles(-80, 0, -45);
		LightingEnvironment.main.lights.push(this.dirLight3);
	}

	public destroy(): void {
		const lights = LightingEnvironment.main.lights;
		// Remover la primera luz
		const index1 = lights.indexOf(this.dirLight);
		if (index1 !== -1) {
			lights.splice(index1, 1);
		}
		// Remover la segunda luz
		const index2 = lights.indexOf(this.dirLight3);
		if (index2 !== -1) {
			lights.splice(index2, 1);
		}
	}
}
