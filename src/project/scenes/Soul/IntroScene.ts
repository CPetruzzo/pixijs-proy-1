import { BlurFilter, Container, Sprite, Text, Texture } from "pixi.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Easing, Tween } from "tweedle.js";
import {
	Manager,
	// pixiRenderer
} from "../../..";
import { SoundLib } from "../../../engine/sound/SoundLib";
import { Emitter, upgradeConfig } from "@pixi/particle-emitter";
import emitterConfigDefault from "../../../../assets/img/myfriend/emitter.json"; // <- ajusta la ruta
import { SoulMountainScene } from "./SoulMountainScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";

export class IntroScene extends PixiScene {
	public static readonly BUNDLES = ["myfriend", "abandonedhouse"];
	private worldContainer: Container = new Container();
	private handPointer: Sprite;
	// dentro de la clase IntroScene agrega propiedades:
	private emitterContainer: Container = new Container();
	private leafEmitter?: Emitter;
	private emitterRunning = false;
	private emitterInitialized = false;

	constructor() {
		super();

		SoundLib.playMusic("introSoulBGM", {
			loop: false,
			start: 2.6,
			// speed: 1.4,
			// filters: [new filters.ReverbFilter(5, 2), new filters.TelephoneFilter()],
			volume: 0.4,
		});

		// test de voz de telefono
		// SoundLib.playSound("hello", { filters: [new filters.TelephoneFilter()] });

		this.addChild(this.worldContainer);

		const fullWidthBacklayer = Sprite.from("fullWidthBacklayer");
		fullWidthBacklayer.anchor.set(0.5);
		fullWidthBacklayer.scale.set(2);
		fullWidthBacklayer.y = -200;

		const backlayer = Sprite.from("fullWidthBacklayer");
		backlayer.anchor.set(0.5);
		const charlayer = Sprite.from("charlayer");
		charlayer.anchor.set(0.5);
		const doglayer = Sprite.from("doglayer");
		doglayer.anchor.set(0.5);
		doglayer.alpha = 0;

		const soulTitle = new Text("Soul", { fontFamily: "Spirituality", fontSize: 240, lineHeight: 350, fontWeight: "bold", fill: 0xffffff });
		soulTitle.anchor.set(0.5);
		soulTitle.y = -450;
		soulTitle.alpha = 0;
		// 1) Creamos y guardamos la referencia al BlurFilter
		const blurFilter = new BlurFilter(50);
		// CORRECCIÓN 1: Aumentar padding para que no se corte el glow del blur
		blurFilter.padding = 100;

		// CORRECCIÓN 2: ESTA ES LA CLAVE. Evita que la imagen "tiemble" al
		// usar los colores del borde en lugar de transparencia.
		blurFilter.repeatEdgePixels = true;

		// Opcional: Calidad del blur (por defecto es 4, subirlo suaviza pero consume más)
		blurFilter.quality = 4;
		doglayer.filters = [blurFilter];

		const start = Sprite.from("start");
		start.anchor.set(0.5);
		start.y = 600;
		start.alpha = 0;
		start.eventMode = "none";
		start.on("pointertap", () => {
			Manager.changeScene(SoulMountainScene, { transitionClass: FadeColorTransition });
		});

		// 2) Tween de charlayer
		new Tween(charlayer)
			.from({ y: 700 })
			.to({ y: 0 }, 15000)
			.start()
			.easing(Easing.Cubic.Out)
			.onComplete(() => {
				new Tween(doglayer).to({ alpha: 1 }, 4000).easing(Easing.Exponential.Out).start();
				// 🔑 PASO CLAVE 1: ACTIVAR justo ANTES de animar el filtro.
				new Tween(blurFilter)
					.to({ blurX: 0, blurY: 0 }, 4000)
					.easing(Easing.Exponential.Out)
					.start()
					.onComplete(() => {
						new Tween(soulTitle).to({ alpha: 1 }, 1500).start();
						new Tween(start)
							.to({ alpha: 1 }, 5500)
							.start()
							.onComplete(() => {
								start.cursor = "pointer";
								start.eventMode = "static";
								console.log("ready");
								new Tween(start).to({ alpha: 0.5 }, 1000).repeat(Infinity).yoyo(true).start();
							});
					});
			});

		// ------------- Agregar el sprite de “handPointer” -------------
		this.handPointer = Sprite.from("handPointer");
		this.handPointer.scale.set(0.2);
		this.handPointer.anchor.set(1, 0.11);
		this.handPointer.interactive = false; // ¡Muy importante! Desactiva la interactividad.
		this.handPointer.eventMode = "none"; // Asegura que no capture ningún evento.
		// this.addChild(this.handPointer); // Lo ponemos encima de todos

		this.worldContainer.addChild(
			// fullWidthBacklayer,
			backlayer,
			charlayer,
			doglayer,
			soulTitle,
			start
		);
		this.worldContainer.addChild(this.emitterContainer);

		// Llamalo desde el constructor (o cuando quieras que empiece)
		this.createLeafEmitter(1024, 1536); // valores iniciales (se re-ajustan en onResize)
	}

	private createLeafEmitter(w: number, h: number): void {
		const oldCfg = JSON.parse(JSON.stringify(emitterConfigDefault));

		// obtenemos la textura (asegurate que esté preloadada; si no, comprobar baseTexture.valid)
		const leafTex = Texture.from("leaf");
		console.log("[createLeafEmitter] leafTex:", leafTex, "valid:", Boolean(leafTex) && Boolean((leafTex as any).baseTexture?.valid));

		if (!leafTex) {
			console.warn("[IntroScene] Texture 'leaf' no encontrada.");
			return;
		}
		// Si no está todavía valid, mejor esperar al loader o abortar aquí:
		if ((leafTex as any).baseTexture && !(leafTex as any).baseTexture.valid) {
			console.warn("[IntroScene] 'leaf' baseTexture aún no es válida. Crea el emitter después del loader.complete.");
			// opcional: podés return aquí y crear el emitter desde el callback del loader.
			// return;
		}

		// upgradeConfig: pasamos el 'art' original como array. Podés pasar names (strings) o Textures.
		// A veces pasar strings funciona mejor si el viejo config referenciaba filenames; si no, pasa Textures.
		const upgraded: any = upgradeConfig(oldCfg, [leafTex /* o "leaf.png" */]);

		// --- Si upgradeConfig no generó particleImages, forzamos uno ---
		if (!upgraded.particleImages || upgraded.particleImages.length === 0) {
			console.log("[createLeafEmitter] particleImages vacío en upgraded — lo forzamos con leafTex");
			upgraded.particleImages = [leafTex];
		}

		// --- Además: parcheamos behaviors que puedan referenciar strings en lugar de Textures ---
		if (Array.isArray(upgraded.behaviors)) {
			for (const b of upgraded.behaviors) {
				// behavior 'textureSingle' suele tener config.texture
				if (b.type === "textureSingle" && b.config) {
					if (typeof b.config.texture === "string") {
						// si venía como nombre de archivo, asignamos la Texture cargada
						b.config.texture = leafTex;
					} else if (!b.config.texture) {
						// si está vacía, poné la textura por defecto
						b.config.texture = leafTex;
					}
				}

				// behavior 'textureSequence' / 'flipbook' (si existe) puede tener frames array
				if ((b.type === "textureSequence" || b.type === "flipbook" || b.type === "textureAnimated") && b.config) {
					if (Array.isArray(b.config.frames) && b.config.frames.length > 0) {
						// si son strings, transformalos a Textures
						b.config.frames = b.config.frames.map((f: any) => (typeof f === "string" ? Texture.from(f) : f));
					} else {
						// si no había frames, fallback a nuestra textura
						b.config.frames = [leafTex];
					}
				}
			}
		}

		// Ajustar spawnRect
		// CALCULAMOS EL TAMAÑO LOCAL REAL DIVIDIENDO POR LA ESCALA
		const scale = this.worldContainer.scale.x || 1;
		const localW = w / scale;
		const localH = h / scale;

		upgraded.spawnRect = {
			// x: Borde izquierdo local (con un margen extra de 100px para que nazcan fuera)
			x: -localW - 500,
			// y: Borde superior local
			y: -(localH / 2) - 100,
			// w: Ancho total local + margenes (para cubrir toda la pantalla de izq a derecha)
			w: localW + 200,
			// h: Altura fina para que solo salgan desde arriba
			h: 50,
		};
		console.log("[createLeafEmitter] upgraded.particleImages.length:", upgraded.particleImages?.length);
		console.log("[createLeafEmitter] upgraded.behaviors.length:", upgraded.behaviors?.length);

		if (this.leafEmitter) {
			this.leafEmitter.cleanup();
			this.leafEmitter.destroy();
			this.leafEmitter = undefined;
		}

		this.leafEmitter = new Emitter(this.emitterContainer, upgraded);
		this.leafEmitter.emit = true;
		this.emitterRunning = true;
		this.emitterInitialized = true;
	}

	public override update(_dt: number): void {
		// // a) Ocultamos el cursor del sistema
		// pixiRenderer.pixiRenderer.view.style.cursor = "none";
		// // b) Obtenemos la posición global del puntero desde renderer.events.pointer.global
		// const globalPos = pixiRenderer.pixiRenderer.events.pointer.global;
		// this.handPointer.visible = true;
		// this.handPointer.position.set(globalPos.x, globalPos.y);}
		const dtSeconds = _dt * 0.001;

		if (this.leafEmitter && this.emitterRunning) {
			// Si en el config no pusiste autoUpdate:true, necesitás esto:
			this.leafEmitter.update(dtSeconds);
		}
	}

	public override onResize(w: number, h: number): void {
		ScaleHelper.setScaleRelativeToIdeal(this.worldContainer, w, h, 1024, 1536, ScaleHelper.forceHeight);
		this.worldContainer.x = w * 0.5;
		this.worldContainer.y = h * 0.5;

		// re-creamos el emitter para recalcular spawnRect según w,h (podés optimizar solo actualizando cfg)
		if (!this.emitterInitialized) {
			this.createLeafEmitter(w, h);
		} else {
			// si querés actualizar spawnRect sin destruir, podés aplicar:
			// upgraded.spawnRect = {...}; pero más simple: recreate cuando cambie mucho
			this.createLeafEmitter(w, h); // ya estás destruyendo antes, así que es seguro
		}
	}

	// --- cleanup: cuando salgas de la escena o destruya el scene ---
	public override destroy(): void {
		if (this.leafEmitter) {
			this.leafEmitter.cleanup();
			this.leafEmitter.destroy();
			this.leafEmitter = undefined;
		}
		this.emitterContainer.destroy({ children: true });
		super.destroy();
	}
}
