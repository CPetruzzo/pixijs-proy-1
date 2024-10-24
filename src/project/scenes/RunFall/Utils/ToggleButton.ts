import { sound } from "@pixi/sound";
import { Button } from "./Button";

export class ToggleButton extends Button {
	public static readonly TOGGLE_EVENT: any = "toggledButtonEvent";
	private btnOn: Button;
	private btnOff: Button;
	private _state: boolean = true;

	public get state(): boolean {
		return this._state;
	}

	public set state(value: boolean) {
		this._state = value;
		this.fixState();
	}

	constructor(texture1: string, texture2: string) {
		super({
			defaultState: {
				texture: { name: texture1 },
			},
			highlightState: {
				texture: { name: texture2 },
			},
			downState: {
				scale: 0.97,
			},
		});

		this.btnOn = new Button({
			defaultState: { texture: { name: texture1 } },
			highlightState: { texture: { name: texture1 } },
			onClick: this.toggle,
		});
		this.btnOff = new Button({
			defaultState: { texture: { name: texture2 } },
			highlightState: { texture: { name: texture2 } },
			onClick: this.toggle,
		});

		// this.btnOff.visible = false;

		this.addChild(this.btnOn, this.btnOff);
	}

	public toggle(): void {
		this.state = !this.state;
		this.emit(ToggleButton.TOGGLE_EVENT, this.state);
		sound.toggleMuteAll();
		console.log(ToggleButton.TOGGLE_EVENT);
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		console.log(`state is ${this.state}`);
	}

	private fixState(): void {
		if (this.state == true) {
			this.btnOff.visible = false;
			this.btnOn.visible = true;
		} else {
			this.btnOff.visible = true;
			this.btnOn.visible = false;
		}
	}
}
