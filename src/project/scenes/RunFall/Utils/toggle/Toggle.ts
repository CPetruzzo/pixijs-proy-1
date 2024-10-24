import { Container } from "@pixi/display";

export abstract class Toggle extends Container {
	public abstract onToggle: (currentValue: boolean) => void;
	public abstract onToggleOn: () => void;
	public abstract onToggleOff: () => void;
	public abstract value: boolean;
}
