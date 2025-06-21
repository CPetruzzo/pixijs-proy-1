// ChoiceMenu.ts
import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { SoundLib } from "../../../../engine/sound/SoundLib";

export interface ChoiceMenuOptions {
	options: string[];
	frameKey?: string;
	x?: number;
	y?: number;
	textStyle?: Partial<{
		fill: string | number;
		fontFamily: string;
		fontSize: number;
		dropShadow: boolean;
		dropShadowDistance: number;
		wordWrap: boolean;
		wordWrapWidth: number;
	}>;
	highlightColor?: string | number;
	normalColor?: string | number;
	soundOnNavigate?: { name: string; volume?: number };
}

export class ChoiceMenu extends Container {
	private options: string[];
	private menuTexts: Text[] = [];
	private menuIndex: number = 0;
	private bg: Sprite;
	private highlightColor: string | number;
	private normalColor: string | number;
	private soundOnNavigate?: { name: string; volume?: number };
	private baseTextStyle: TextStyle; // estilo base a clonar

	constructor(opts: ChoiceMenuOptions) {
		super();

		this.options = opts.options;
		this.x = opts.x ?? 0;
		this.y = opts.y ?? 0;

		const frameKey = opts.frameKey ?? "frameBlue";
		this.bg = Sprite.from(frameKey);
		this.bg.alpha = 0.7;
		this.bg.scale.set(0.25, 0.56);
		this.addChild(this.bg);

		this.highlightColor = opts.highlightColor ?? "#8b4915";
		this.normalColor = opts.normalColor ?? "#ffffff";
		this.soundOnNavigate = opts.soundOnNavigate;

		// TextStyle base
		const defaultStyle = {
			fill: "#ffffff",
			fontFamily: "Pixelate-Regular",
			fontSize: 20,
			dropShadow: true,
			dropShadowDistance: 2,
			wordWrap: true,
			wordWrapWidth: 280,
		};
		this.baseTextStyle = new TextStyle({
			...defaultStyle,
			...(opts.textStyle ?? {}),
		});

		// Crear Texts, cada uno con su propia copia de estilo
		for (let i = 0; i < this.options.length; i++) {
			// clonamos el estilo base para cada Text
			const txtStyle = this.baseTextStyle.clone();
			const txt = new Text(this.options[i], txtStyle);
			txt.x = 8;
			txt.y = 24 + i * 32;
			this.addChild(txt);
			this.menuTexts.push(txt);
		}

		this.visible = false;
		this.updateMenuHighlight();
	}

	public open(x?: number, y?: number): void {
		if (x !== undefined) {
			this.x = x;
		}
		if (y !== undefined) {
			this.y = y;
		}
		this.menuIndex = 0;
		this.updateMenuHighlight();
		this.visible = true;
	}

	public close(): void {
		this.visible = false;
	}

	public navigate(delta: number): void {
		if (!this.visible) {
			return;
		}
		const n = this.options.length;
		if (this.soundOnNavigate) {
			SoundLib.playSound(this.soundOnNavigate.name, { volume: this.soundOnNavigate.volume ?? 1.0 });
		}
		this.menuIndex = (this.menuIndex + delta + n) % n;
		console.log("this.menuIndex", this.menuIndex);
		this.updateMenuHighlight();
	}

	private updateMenuHighlight(): void {
		for (let i = 0; i < this.menuTexts.length; i++) {
			// Ahora cada Text tiene su propio TextStyle, así este cambio se aplica solo a uno
			this.menuTexts[i].style.fill = (i === this.menuIndex ? this.highlightColor : this.normalColor) as any;
		}
	}

	public getSelectedOption(): string {
		return this.options[this.menuIndex];
	}
	public getSelectedIndex(): number {
		return this.menuIndex;
	}
}
