import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { DialogueOverlayManager } from "../../engine/dialog/DialogueOverlayManager";
// ... tus otros imports ...

export class DialogueScene extends PixiScene {
	public static readonly BUNDLES = ["myfriend"];
	constructor() {
		super();

		// 1. IMPORTANTE: Inicializar el manager pasándole 'this' (la escena actual)
		// Esto coloca el overlay visualmente en esta escena.
		DialogueOverlayManager.init(this);

		// ... lógica de tu escena (fondo, botones, etc) ...

		// EJEMPLO 1: Diálogo simple al empezar
		DialogueOverlayManager.changeTalkerImage("playerface");
		DialogueOverlayManager.talk("¡Hola! Bienvenido al sistema de menús.");

		// EJEMPLO 2: Encadenamiento y cambio de imagen
		DialogueOverlayManager.talk("Voy a cambiar mi cara ahora...", { speed: 50 }); // Más lento

		DialogueOverlayManager.chainEvent(() => {
			console.log("¡Evento ejecutado en mitad del diálogo!");
			// Aquí podrías reproducir un sonido o animar algo
			DialogueOverlayManager.changeTalkerImage("blackcatface");
		});

		DialogueOverlayManager.talk("¡Jaja! ¡Ahora soy un gato!", { highlight: "gato" });

		DialogueOverlayManager.chainEvent(() => {
			console.log("¡Evento ejecutado en mitad del diálogo!");
			// Aquí podrías reproducir un sonido o animar algo
			DialogueOverlayManager.changeTalkerImage("playerface");
		});
		DialogueOverlayManager.talk("Traqui, he vuelto a la normalidad, solo era una muestra", { speed: 50 }); // Más lento

		// EJEMPLO 3: Callback final
		DialogueOverlayManager.chainEvent(() => {
			// Lógica cuando termina toda la conversación
			console.log("Fin de la intro");
		});
	}

	public override update(dt: number): void {
		// Si tu overlay necesitara update manual (para tweens internos si no usas libreria global)
		// podrías necesitar llamar algo aquí, pero con Tweedle global no hace falta.
		super.update(dt);
	}
}
