import { OverlayMode } from "./DialogOverlay";
import { DialogueOverlay } from "./DialogOverlay";
import type { Container } from "pixi.js";

export interface TalkOptions {
	portrait?: string;
	highlight?: string;
	speed?: number;
	mode?: OverlayMode;
	target?: { x: number; y: number };
}

type QueueItem = { type: "talk"; text: string; options: TalkOptions } | { type: "action"; callback: () => void };

export class DialogueOverlayManager {
	// Renderizado y Estado
	private static _overlay: DialogueOverlay | undefined; // Puede ser undefined si se destruye
	private static _queue: QueueItem[] = [];
	private static _isProcessing: boolean = false;

	// Configuración actual
	private static _currentPortrait: string = "playerface";
	private static _currentSpeed: number = 30;

	// Referencia al evento de teclado para poder eliminarlo
	private static _boundKeyDownHandler: ((e: KeyboardEvent) => void) | undefined;

	public static get isOpen(): boolean {
		return Boolean(this._overlay && this._overlay.visible);
	}

	public static init(sceneStage: Container): void {
		// 1. Si no existe el overlay, lo creamos
		if (!this._overlay || this._overlay.destroyed) {
			this._overlay = new DialogueOverlay();

			// Evento de click en el overlay
			this._overlay.on("pointerdown", () => this.handleInput());

			// 2. Configurar evento de teclado (Solo una vez)
			// Primero limpiamos por seguridad si ya existía
			if (this._boundKeyDownHandler) {
				window.removeEventListener("keydown", this._boundKeyDownHandler);
			}

			// Creamos el handler y guardamos la referencia
			this._boundKeyDownHandler = (e: KeyboardEvent) => {
				if (this._overlay && this._overlay.visible) {
					if (e.code === "Enter" || e.code === "Space") {
						this.handleInput();
					}
				}
			};

			window.addEventListener("keydown", this._boundKeyDownHandler);
		}

		// 3. Reparenting: Mover el overlay a la nueva escena
		// Si ya tenía padre, lo quitamos (Pixi lo hace auto, pero es buena práctica ser explícito)
		if (this._overlay.parent) {
			this._overlay.parent.removeChild(this._overlay);
		}
		sceneStage.addChild(this._overlay);

		// Reset de estado visual
		this._overlay.hide();
		this._queue = []; // Opcional: ¿Quieres borrar los diálogos pendientes al cambiar de escena? Normalmente sí.
		this._isProcessing = false;
	}

	/**
	 * ¡IMPORTANTE! Llama a esto cuando destruyas la escena o salgas del juego
	 * para limpiar la memoria y los eventos globales.
	 */
	public static dispose(): void {
		// 1. Limpiar evento de teclado global
		if (this._boundKeyDownHandler) {
			window.removeEventListener("keydown", this._boundKeyDownHandler);
			this._boundKeyDownHandler = undefined;
		}

		// 2. Destruir el objeto visual de Pixi
		if (this._overlay) {
			this._overlay.destroy({ children: true });
			this._overlay = undefined;
		}

		// 3. Resetear variables estáticas
		this._queue = [];
		this._isProcessing = false;
	}

	public static talk(text: string, options?: TalkOptions): void {
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
		if (this._overlay && !this._overlay.destroyed && this._overlay.visible) {
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
		if (this._overlay && !this._overlay.destroyed) {
			this._overlay.hide();
		}
	}

	private static processQueue(): void {
		// Chequeo de seguridad por si se llamó a dispose mientras procesaba
		if (!this._overlay || this._overlay.destroyed) {
			return;
		}

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
			const { options, text } = item;
			const portrait = options.portrait || this._currentPortrait;
			const speed = options.speed !== undefined ? options.speed : this._currentSpeed;
			const mode: OverlayMode = options.mode || OverlayMode.CINEMATIC;

			this._overlay.setPortraitImage(portrait);
			this._overlay.typeSpeed = speed;

			let screenTarget = options.target;
			if (mode === "bubble" && options.target && this._overlay.parent) {
				screenTarget = options.target;
				// Aquí iría la lógica de conversión de coordenadas si fuera necesaria
			}

			this._overlay.configure(mode, screenTarget);
			this._overlay.resize();
			this._overlay.show(text, options.highlight || "");
		}
	}

	private static handleInput(): void {
		if (!this._isProcessing || !this._overlay || !this._overlay.visible) {
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
