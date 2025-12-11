import type { OverlayMode } from "./DialogOverlay";
import { DialogueOverlay } from "./DialogOverlay";
import type { Container } from "pixi.js";

// 1. Definimos una interfaz para las opciones de diálogo para que sea más limpio
export interface TalkOptions {
	portrait?: string;
	highlight?: string;
	speed?: number;
	mode?: OverlayMode; // "cinematic" o "bubble"
	target?: { x: number; y: number }; // Posición para la burbuja (world coordinates)
}

// Actualizamos el tipo del item de cola
type QueueItem = { type: "talk"; text: string; options: TalkOptions } | { type: "action"; callback: () => void };
export class DialogueOverlayManager {
	private static _overlay: DialogueOverlay;
	private static _queue: QueueItem[] = [];
	private static _isProcessing: boolean = false;
	private static _currentPortrait: string = "playerface";
	private static _currentSpeed: number = 30;

	// --- NUEVO: Getter para saber si el diálogo está abierto ---
	public static get isOpen(): boolean {
		return this._overlay && this._overlay.visible;
	}

	public static init(sceneStage: Container): void {
		if (!this._overlay) {
			this._overlay = new DialogueOverlay();

			// 1. Input de Mouse/Touch
			this._overlay.on("pointerdown", () => this.handleInput());

			// 2. --- NUEVO: Input de Teclado (Enter y Espacio) ---
			window.addEventListener("keydown", (e) => {
				// Solo actuamos si el overlay está visible
				if (this._overlay.visible) {
					if (e.code === "Enter" || e.code === "Space") {
						this.handleInput();
					}
				}
			});
		}

		if (this._overlay.parent) {
			this._overlay.parent.removeChild(this._overlay);
		}
		sceneStage.addChild(this._overlay);

		this._overlay.hide();
		this._queue = [];
		this._isProcessing = false;
	}

	public static talk(text: string, options?: TalkOptions): void {
		// Usamos un objeto vacío por defecto si no hay opciones
		this._queue.push({
			type: "talk",
			text: text,
			options: options || {},
		});

		if (!this._isProcessing) {
			this.processQueue();
		}
	}

	public static changeTalkerImage(imageName: string): void {
		this._currentPortrait = imageName;
		if (this._overlay && this._overlay.visible) {
			this._overlay.setPortraitImage(imageName);
		}
	}

	public static talkSpeed(msPerChar: number): void {
		this._currentSpeed = msPerChar;
	}

	public static chainEvent(callback: () => void): void {
		this._queue.push({ type: "action", callback });
	}

	public static hide(): void {
		this._queue = [];
		this._isProcessing = false;
		if (this._overlay) {
			this._overlay.hide();
		}
	}

	private static processQueue(): void {
		if (this._queue.length === 0) {
			this._isProcessing = false;
			this._overlay.hide();
			return;
		}

		this._isProcessing = true;
		const item = this._queue[0];

		if (item.type === "action") {
			this._queue.shift();
			item.callback();
			this.processQueue();
		} else {
			// Extraemos las opciones
			const { options, text } = item;
			const portrait = options.portrait || this._currentPortrait;
			const speed = options.speed !== undefined ? options.speed : this._currentSpeed;

			// Determinar el modo (por defecto "cinematic")
			const mode: OverlayMode = options.mode || "cinematic";

			this._overlay.setPortraitImage(portrait);
			this._overlay.typeSpeed = speed;

			// --- NUEVO: Configurar el overlay antes de mostrar ---
			// Si es burbuja, necesitamos pasarle las coordenadas.
			// IMPORTANTE: Si tu juego tiene cámara, las coordenadas 'target' que vienen
			// de la escena suelen ser de MUNDO. El overlay necesita coordenadas de PANTALLA.
			// Si el overlay es hijo directo del stage y no se mueve con la cámara, necesitas convertir.

			let screenTarget = options.target;
			if (mode === "bubble" && options.target && this._overlay.parent) {
				// EJEMPLO BÁSICO DE CONVERSIÓN (Asumiendo que el parent del overlay es el Stage (0,0))
				// Deberías usar el worldTransform de tu contenedor de mundo real.
				// Si 'this._overlay.parent' es el Stage, y tu mundo está movido:
				// screenX = worldTargetX + worldContainerX
				// Por ahora, usaremos las coordenadas directas asumiendo que el target ya viene convertido o no hay cámara compleja.
				screenTarget = options.target;
				// Si usas pixi-viewport u otro sistema de cámara, usa su función toScreen(worldPos).
			}

			this._overlay.configure(mode, screenTarget);
			// Forzamos el resize para que aplique el nuevo layout
			this._overlay.resize();
			// ----------------------------------------------------

			this._overlay.show(text, options.highlight || "");
		}
	}

	private static handleInput(): void {
		if (!this._isProcessing || !this._overlay.visible) {
			return;
		}

		if (this._overlay.isTyping) {
			this._overlay.showImmediate();
		} else {
			this._queue.shift();
			this.processQueue();
		}
	}
}
