import { Assets } from "pixi.js";
import { Model } from "pixi3d/pixi7";
import { PhysicsContainer3d } from "./3DPhysicsContainer";

export class FutureCopPlayer extends PhysicsContainer3d {
	private models: Map<string, Model> = new Map();
	private currentModel: Model | null = null;
	public hp?: number;

	public idleModel: Model | null = null;
	public runningModel: Model | null = null;

	constructor() {
		super("futurecop", "futurecoprunningforward");

		this.models.set("idle", this.model);

		this.models.set("run", this.animationModel);

		console.log("this.animationModel", this.animationModel, this.asset, this.animationAsset);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public loadAdditionalModel(name: string, asset: string): void {
		const model = Model.from(Assets.get(asset));
		this.models.set(name, model);
		model.visible = false; // Lo ocultamos inicialmente
		this.addChild(model);
		console.log("model", model.name);
	}

	public switchModel(name: string): void {
		if (this.models.has(name)) {
			if (this.currentModel) {
				this.currentModel.visible = false; // Ocultamos el modelo actual
			}
			this.currentModel = this.models.get(name)!;
			this.currentModel.visible = true; // Mostramos el nuevo modelo
		}
	}
}
