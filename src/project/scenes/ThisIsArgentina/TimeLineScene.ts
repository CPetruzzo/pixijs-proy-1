import { Container, FederatedPointerEvent, Graphics, Point, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { lerp } from '../../../engine/utils/MathUtils';
import { Easing, Tween } from 'tweedle.js';
import { Manager } from '../../..';
import events from './events.json';
import { GameScene } from './ArgentinaGameScene';
import { FadeColorTransition } from '../../../engine/scenemanager/transitions/FadeColorTransition';

export class TimeLineScene extends PixiScene {
	//#region VARIABLES
	private timelineContainer: Container;
	private draggable: Container;
	private timelineLength: number = 35000;
	private isDragging: boolean;
	private draggingOffset: Point = new Point();
	private dragOverlay: Graphics;
	private imageSprites: { [key: number]: Sprite } = {};
	private imagesContainer: Container;
	private allEventPositions: { x: number, year: number }[] = [];
	//#endregion VARIABLES
	public static readonly BUNDLES = ["aurora"];

	constructor() {
		super();
		this.draggable = new Container();
		this.addChild(this.draggable);

		this.timelineContainer = new Container();
		this.imagesContainer = new Container();
		this.draggable.addChild(this.imagesContainer, this.timelineContainer);

		this.createTimeline();
		this.addEvents();
		this.setupScrolling();

		this.createDragOverlay();
		this.loadImages();
		this.createNavigationButtons();

		this.beginGame();
	}


	private loadImages(): void {
		const imagePaths = {
			1816: 'image1816',
			1982: 'image1982',
		};

		for (const [year, path] of Object.entries(imagePaths)) {
			const texture = Texture.from(path);
			const sprite = new Sprite(texture);
			this.imagesContainer.addChild(sprite);
			this.imageSprites[Number(year)] = sprite;

			const x = this.mapYearToPosition(Number(year), 1500, 2024);
			sprite.x = x;
			sprite.anchor.set(0.5);
			sprite.y = 100;
		}
	}

	private showImagesBasedOnPosition(): void {
		const timelinePosition = this.draggable.x;
		const visibilityMargin = this.width * 1.5;

		for (const [year, sprite] of Object.entries(this.imageSprites)) {
			const x = this.mapYearToPosition(Number(year), 1500, 2024);
			sprite.x = x;

			if (x > timelinePosition - visibilityMargin / 2 && x < timelinePosition + visibilityMargin / 2) {
				sprite.visible = true;
			} else {
				// sprite.visible = false;
			}
		}
	}

	//#region TIMELINE_EVENTS
	private createTimeline(): void {
		const timeline = new Graphics();
		timeline.lineStyle(4, 0xffffff);
		timeline.moveTo(100, 300);
		timeline.lineTo(this.timelineLength + 100, 300);
		this.timelineContainer.addChild(timeline);
	}

	private addEvents(): void {
		const minYear = 1500;
		const maxYear = 2024;

		for (const event of events) {
			const x = this.mapYearToPosition(event.year, minYear, maxYear);
			this.addEvent(x, event.label, event.description);
			this.allEventPositions.push({ year: event.year, x: x });
		}
	}

	private mapYearToPosition(year: number, minYear: number, maxYear: number): number {
		const ratio = (year - minYear) / (maxYear - minYear);
		return 100 + ratio * (this.timelineLength);
	}

	private addEvent(x: number, date: string, description: string): void {
		const eventLine = new Graphics();
		eventLine.lineStyle(2, 0xff0000);
		eventLine.moveTo(x, 300);
		eventLine.lineTo(x, 350);
		this.timelineContainer.addChild(eventLine);

		const dateText = new Text(date, { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, wordWrap: true, wordWrapWidth: 100 });
		dateText.x = x - dateText.width / 2;
		dateText.y = 360;
		this.timelineContainer.addChild(dateText);

		const descriptionText = new Text(description, { fontFamily: 'Arial', fontSize: 12, fill: 0xffffff, wordWrap: true, wordWrapWidth: 150, align: 'center' });
		descriptionText.x = x - descriptionText.width / 2;
		descriptionText.y = 380;
		this.timelineContainer.addChild(descriptionText);
	}
	//#endregion TIMELINE_EVENTS

	//#region TIMELINE_DRAG_MOVE
	private createDragOverlay(): void {
		this.dragOverlay = new Graphics();
		this.dragOverlay.beginFill(0x000000, 0.01);
		this.dragOverlay.drawRect(0, 300, this.draggable.width, this.draggable.height);
		this.dragOverlay.endFill();
		this.draggable.addChild(this.dragOverlay);
		this.dragOverlay.interactive = true;
	}

	private setupScrolling(): void {
		this.draggable.eventMode = "static";
		this.draggable.on("pointerdown", this.beginDrag, this);
		this.draggable.on("pointerup", this.endDrag, this);
		this.draggable.on("pointerupoutside", this.endDrag, this);
		this.draggable.on("globalpointermove", this.moveDrag, this);
		this.tweenToPosition(0);
	}

	private beginDrag(event: FederatedPointerEvent): void {
		const downPosition = this.draggable.toLocal(event.global);
		this.draggingOffset.x = this.draggable.position.x - downPosition.x;
		this.isDragging = true;
	}

	private endDrag(event: FederatedPointerEvent): void {
		this.isDragging = false;
		const newPosition = this.draggable.toLocal(event.global);
		this.draggable.x = newPosition.x + this.draggingOffset.x;
	}

	private moveDrag(event: FederatedPointerEvent): void {
		if (this.isDragging) {
			const newPosition = this.draggable.toLocal(event.global);
			const violenceFactor = 0.1;
			this.draggable.x = lerp(this.draggable.x, newPosition.x + this.draggingOffset.x, violenceFactor);
			this.showImagesBasedOnPosition();
		}
	}

	private tweenToPosition(targetX: number): void {
		const startX = this.draggable.x;
		const tweenDuration = 300;

		const tween = new Tween({ x: startX })
			.to({ x: targetX }, tweenDuration)
			.easing(Easing.Quadratic.Out)
			.onUpdate(obj => {
				this.draggable.x = obj.x;
				this.showImagesBasedOnPosition();
			})

		tween.start();
	}

	private createNavigationButtons(): void {
		const buttonStyle = { fill: 0xffffff, fontSize: 24 };

		const nextButton = new Text("Next", buttonStyle);
		const prevButton = new Text("Prev", buttonStyle);

		nextButton.interactive = true;
		prevButton.interactive = true;

		nextButton.on('pointerdown', this.moveToNextEvent.bind(this));
		prevButton.on('pointerdown', this.moveToPreviousEvent.bind(this));

		this.addChild(nextButton);
		this.addChild(prevButton);

		nextButton.position.set(Manager.width - 100, this.height - 50);
		prevButton.position.set(50, this.height - 50);
	}

	private getEventPositions(): number[] {
		return this.allEventPositions.map(event => event.x);
	}

	private moveToNextEvent(): void {
		const currentPos = -this.draggable.x;
		const eventPositions = this.getEventPositions();

		for (let pos of eventPositions) {
			if (pos > currentPos) {
				this.tweenToPosition(-pos);
				break;
			}
		}
	}

	private moveToPreviousEvent(): void {
		const currentPos = -this.draggable.x;
		const eventPositions = this.getEventPositions();

		for (let i = eventPositions.length - 1; i >= 0; i--) {
			const pos = eventPositions[i];
			if (pos < currentPos) {
				this.tweenToPosition(-pos);
				break;
			}
		}
	}
	//#endregion TIMELINE_DRAG_MOVE

	//#region BEGINGAME
	private beginGame(): void {
		const startButton = new Container();
		const buttonGraphics = new Graphics();
		buttonGraphics.beginFill(0x00ff00, 1);
		buttonGraphics.drawRect(0, 0, 200, 60);
		buttonGraphics.endFill();
		startButton.addChild(buttonGraphics);

		const buttonText = new Text("Start", new TextStyle({
			fill: 0xffffff,
			fontSize: 24
		}));
		buttonText.anchor.set(0.5);
		buttonText.x = buttonGraphics.width / 2;
		buttonText.y = buttonGraphics.height / 2;
		startButton.addChild(buttonText);

		startButton.x = Manager.width * 0.5 - buttonGraphics.width / 2;
		startButton.y = Manager.height * 0.8 - buttonGraphics.height / 2;

		startButton.eventMode = "static";
		startButton.on('pointerdown', this.onStartButtonClick, this);

		this.addChild(startButton);
	}

	private onStartButtonClick(): void {
		// Cambiar a la escena de juego (GameScene) con la transición CircularLoadingTransition
		Manager.changeScene(GameScene, { transitionClass: FadeColorTransition });
	}

	//#endregion BEGINGAME
}
