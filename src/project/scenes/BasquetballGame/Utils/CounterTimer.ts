import { Container } from "@pixi/display";
import { Text } from "@pixi/text";

export enum CounterEmits {
	START = "START",
	TIME_ENDED = "TIME_ENDED",
	TIME_PAUSE = "TIME_PAUSE",
	CONTINUE = "CONTINUE",
}

export class CounterTimer extends Container {
	private counter: Text;
	public currentCounterTime: number;
	public initialTime: number;
	private timeRounded: number;

	constructor(currentCounterTime: number) {
		super();
		this.initialTime = currentCounterTime;
		this.currentCounterTime = currentCounterTime;
		this.counter = new Text(`${this.currentCounterTime}`, {
			fontSize: 250,
			fill: 0xffffff,
			dropShadowDistance: 15,
			dropShadow: true,
			dropShadowColor: 0x000000,
			fontFamily: "DK Boarding House III",
		});
		this.counter.anchor.set(0.5);
		this.counter.y = this.counter.height * 0.75;
		this.addChild(this.counter);
	}

	public updateCounterTime(_countdownTime?: number, _finish?: boolean): void {
		if (_countdownTime !== undefined && this.currentCounterTime > 0 && !_finish) {
			this.startCountDown(_countdownTime);
		}

		if (this.currentCounterTime <= 0 && !_finish) {
			this.timeEnded();
		}

		this.timeRounded = this.roundTime(Math.max(this.currentCounterTime, 0));

		this.counter.text = this.timeRounded;
	}

	private roundTime(timeToRound: number): number {
		return Math.round(timeToRound);
	}

	public timeEnded(): void {
		this.emit(CounterEmits.TIME_ENDED);
	}

	public startCountDown(_countdownTime: number): void {
		this.currentCounterTime -= _countdownTime;
		this.emit(CounterEmits.START);
	}

	public timeRemaining(): number {
		return this.timeRounded;
	}
}
