/* eslint-disable @typescript-eslint/explicit-function-return-type */
// FridgeOrganizerScene.ts
import { Container, Graphics, Text, TextStyle, Sprite, Texture } from "pixi.js";
import { Tween, Easing } from "tweedle.js";
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { FadeColorTransition } from "../../../engine/scenemanager/transitions/FadeColorTransition";
import { ScaleHelper } from "../../../engine/utils/ScaleHelper";
import { Manager } from "../../..";

/**
 * Escena de demo: ordenar la heladera.
 * Placeholders gráficos, drag & drop, reglas simples de bromatología.
 *
 * Reglas implementadas (simples, demostrativas):
 *  - "meat" solo puede estar en el estante más bajo.
 *  - "dairy" (leche/queso) idealmente en puerta/derecha.
 *  - "vegetable" debe estar en estantes superiores o medios (no por debajo de meat).
 *
 * Interacción:
 *  - Arrastrar items con el mouse/touch y soltarlos sobre estantes / puerta.
 *  - Mensaje de "Correcto" / "Incorrecto" y puntajes.
 */

type ItemType = "meat" | "vegetable" | "dairy" | "cheese" | "sausage";

interface FridgeItem {
	id: string;
	type: ItemType;
	view: Graphics;
	home?: { x: number; y: number };
}

export class FridgeOrganizerScene extends PixiScene {
	public static readonly BUNDLES = ["fridge-assets", "engine"]; // placeholder

	private root: Container;
	private fridgeContainer: Container;
	private doorContainer: Container;
	private uiContainer: Container;

	private shelves: { x: number; y: number; w: number; h: number }[] = [];
	private doorShelves: { x: number; y: number; w: number; h: number }[] = [];

	private items: FridgeItem[] = [];

	private dragging?: { item: FridgeItem; offsetX: number; offsetY: number; startZ: number };
	private infoText: Text;
	private scoreText: Text;
	private correctCount = 0;
	private wrongCount = 0;

	constructor() {
		super();

		this.root = new Container();
		this.fridgeContainer = new Container();
		this.doorContainer = new Container();
		this.uiContainer = new Container();

		this.addChild(this.root);
		this.root.addChild(this.fridgeContainer, this.doorContainer, this.uiContainer);

		this.buildFridgeLayout();
		this.spawnItemsPlaceholders();
		this.createUI();

		// pointermove at stage level to support dragging outside an item
		this.eventMode = "dynamic";
		this.on("pointermove", this.onPointerMove, this);
		this.on("pointerupoutside", this.onPointerUpAny, this);
	}

	// Construye la forma de la heladera y estantes (placeholders)
	private buildFridgeLayout(): void {
		const fridgeW = 520;
		const fridgeH = 900;
		const doorW = 180;
		const padding = 24;

		// --- BACKGROUND PLACEHOLDER (imagen o fallback gráfico) ---
		// Intentamos usar una textura llamada "FRIDGE_BG" (puedes reemplazarla por tu atlas)
		let backgroundSprite: Sprite | null = null;
		try {
			// Si tenés una textura en el loader con key "FRIDGE_BG", úsala.
			const tex = Texture.from("blackboard2");
			backgroundSprite = new Sprite(tex);
			backgroundSprite.scale.set(3);
			backgroundSprite.anchor.set(0.5);
			// cubrimos un área un poco mayor que la heladera + puerta

			backgroundSprite.x = 0;
			backgroundSprite.y = 0;
			// si la textura es realmente vacía (por loader no existente) puede verse raro, pero lo dejan así y lo cambiás después
			this.root.addChildAt(backgroundSprite, 0);
		} catch (err) {
			// si algo falla, simplemente seguimos y dibujamos el fallback
			backgroundSprite = null;
		}

		if (!backgroundSprite) {
			// fallback: patrón sencillo con Graphics (textura placeholder)
			const patt = new Graphics();
			const bw = fridgeW + doorW + 120;
			const bh = fridgeH + 120;

			// fondo base
			patt.beginFill(0xe6f0f2);
			patt.drawRect(-bw / 2, -bh / 2, bw, bh);
			patt.endFill();

			// dibujo un patrón de líneas diagonales para simular "textura"
			patt.lineStyle(1, 0xdfe9ec, 1);
			const step = 24;
			for (let x = -bw / 2 - bh; x < bw / 2 + bh; x += step) {
				patt.moveTo(x, -bh / 2);
				patt.lineTo(x + bh, bh / 2);
			}
			this.root.addChildAt(patt, 0);
		}

		// fridge body
		const body = new Graphics();
		body.beginFill(0xe8f0f5);
		body.drawRoundedRect(-fridgeW / 2, -fridgeH / 2, fridgeW, fridgeH, 12);
		body.endFill();
		this.fridgeContainer.addChild(body);

		// door (a la derecha)
		const door = new Graphics();
		door.beginFill(0xf7fbfd);
		door.drawRoundedRect(fridgeW / 2 + 8, -fridgeH / 2 + 40, doorW - 16, fridgeH - 80, 10);
		door.endFill();
		this.doorContainer.addChild(door);

		// crear 3 estantes internos (top, mid, bottom)
		const shelfW = fridgeW - padding * 2;
		const shelfH = 16;
		const topY = -fridgeH / 2 + 120;
		const midY = 0;
		const botY = fridgeH / 2 - 200;

		const shelfXs = -shelfW / 2;
		[this.createShelf(shelfXs, topY, shelfW, shelfH), this.createShelf(shelfXs, midY, shelfW, shelfH), this.createShelf(shelfXs, botY, shelfW, shelfH)];

		// puerta con 2 repisas (dairy)
		const doorBaseX = fridgeW / 2 + 18;
		const doorInnerX = doorBaseX + 10;
		const doorShelfW = doorW - 40;
		const doorTopY = -fridgeH / 2 + 140;
		const doorMidY = -fridgeH / 2 + 300;
		this.createDoorShelf(doorInnerX, doorTopY, doorShelfW, shelfH);
		this.createDoorShelf(doorInnerX, doorMidY, doorShelfW, shelfH);

		// label estantes
		// const labelStyle = new TextStyle({ fontSize: 20, fill: 0x334455 });
		const title = new Text("Ordená la heladera", { fontSize: 28, fill: 0x0a0a0a, fontWeight: "700" });
		title.anchor.set(0.5);
		title.y = -fridgeH / 2 - 40;
		this.root.addChild(title);

		// posicionamiento inicial
		this.fridgeContainer.x = 0;
		this.fridgeContainer.y = 0;
		this.doorContainer.x = 0;
		this.doorContainer.y = 0;
		this.uiContainer.x = 0;
		this.uiContainer.y = 0;
	}

	private createShelf(x: number, y: number, w: number, h: number): void {
		const g = new Graphics();
		g.beginFill(0xcfe6f2);
		g.drawRect(x, y - h / 2, w, h);
		g.endFill();
		this.fridgeContainer.addChild(g);
		this.shelves.push({ x, y: y + 10, w, h }); // y pos usable para items
	}

	private createDoorShelf(x: number, y: number, w: number, h: number): void {
		const g = new Graphics();
		g.beginFill(0xdfeff6);
		g.drawRect(x, y - h / 2, w, h);
		g.endFill();
		this.doorContainer.addChild(g);
		this.doorShelves.push({ x, y: y + 10, w, h });
	}

	// Crea items "placeholder" con colores y tipos
	private spawnItemsPlaceholders(): void {
		// Definir una lista de items con tipos
		const seed: { id: string; type: ItemType; color: number; label: string }[] = [
			{ id: "meat1", type: "meat", color: 0xdb6b6b, label: "Carne" },
			{ id: "veg1", type: "vegetable", color: 0x7fc97f, label: "Lechuga" },
			{ id: "veg2", type: "vegetable", color: 0x77c0a0, label: "Zanahoria" },
			{ id: "dairy1", type: "dairy", color: 0xffffff, label: "Leche" },
			{ id: "cheese1", type: "cheese", color: 0xffe28a, label: "Queso" },
			{ id: "sausage1", type: "sausage", color: 0xd97a4a, label: "Salchicha" },
		];

		// posición inicial para desplegar items (zona inferior izquierda)
		const startX = -380;
		const startY = 300;
		const gapY = 80;

		for (let i = 0; i < seed.length; i++) {
			const s = seed[i];
			const box = new Graphics();
			box.beginFill(s.color);
			box.drawRoundedRect(-60 / 2, -40 / 2, 60, 40, 6);
			box.endFill();

			const txt = new Text(s.label, new TextStyle({ fontSize: 12, fill: 0x153446 }));
			txt.anchor.set(0.5);
			txt.y = 0;
			box.addChild(txt);

			box.x = startX;
			box.y = startY + i * gapY;
			box.eventMode = "static";
			box.interactive = true;

			const item: FridgeItem = { id: s.id, type: s.type, view: box, home: { x: box.x, y: box.y } };
			this.items.push(item);
			this.root.addChild(box);

			// handlers drag
			box.on("pointerdown", (e: any) => this.onItemPointerDown(e, item));
			box.on("pointerup", () => this.onItemPointerUp(item));
			box.on("pointerupoutside", () => this.onItemPointerUp(item));
		}
	}

	private createUI(): void {
		this.infoText = new Text("Arrastrá los productos al estante correcto", new TextStyle({ fontSize: 18, fill: 0x1b2b33 }));
		this.infoText.anchor.set(0.5);
		this.infoText.y = -440;
		this.uiContainer.addChild(this.infoText);

		this.scoreText = new Text(`Correctos: ${this.correctCount}  Incorrectos: ${this.wrongCount}`, new TextStyle({ fontSize: 16, fill: 0x1b2b33 }));
		this.scoreText.anchor.set(0.5);
		this.scoreText.y = -410;
		this.uiContainer.addChild(this.scoreText);

		// botón simple volver al menú (ejemplo)
		const hint = new Text("Volver al menú (ESC)", new TextStyle({ fontSize: 12, fill: 0x334455 }));
		hint.anchor.set(0.5);
		hint.y = 440;
		this.uiContainer.addChild(hint);

		// key listener para volver
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				Manager.changeScene(null as any, { transitionClass: FadeColorTransition, transitionParams: [] }); // asumiendo tu engine acepta null o reemplazar con escena menú
			}
		});
	}

	/* -----------------------------
	   Drag & Drop handlers
	   ----------------------------- */
	private onItemPointerDown(e: any, item: FridgeItem): void {
		const target = item.view;
		const p = e.data.global;
		this.dragging = {
			item,
			offsetX: p.x - target.x,
			offsetY: p.y - target.y,
			startZ: target.zIndex ?? 0,
		};
		// bring to front
		target.zIndex = 1000;
		// small scale feedback
		new Tween(target.scale).to({ x: 1.05, y: 1.05 }, 120).easing(Easing.Quadratic.Out).start();
	}

	private onPointerMove(e: any): void {
		if (!this.dragging) {
			return;
		}
		const p = e.data.global;
		const it = this.dragging.item;
		it.view.x = p.x - this.dragging.offsetX;
		it.view.y = p.y - this.dragging.offsetY;
	}

	private onItemPointerUp(item: FridgeItem): void {
		if (!this.dragging || this.dragging.item.id !== item.id) {
			return;
		}
		// Restaurar escala
		new Tween(item.view.scale).to({ x: 1, y: 1 }, 120).start();

		// decidir a qué estante cayó (si alguno)
		const placedOn = this.getShelfForItem(item);

		if (placedOn) {
			// snap to shelf slot
			this.snapToShelf(item, placedOn);
			const ok = this.validateItemPlacement(item, placedOn);
			this.showPlacementResult(ok, item);
		} else {
			// volver a home
			this.snapHome(item);
		}

		// restore zIndex
		item.view.zIndex = this.dragging.startZ;
		this.dragging = undefined;
	}

	private onPointerUpAny(): void {
		// Si sueltan fuera del canvas, cancelar dragging
		if (this.dragging) {
			this.snapHome(this.dragging.item);
			this.dragging = undefined;
		}
	}

	// Determina si el centro del item está sobre un estante interno o de puerta
	private getShelfForItem(item: FridgeItem): { kind: "shelf" | "door"; index: number } | null {
		const centerX = item.view.x;
		const centerY = item.view.y;

		// chequear puerta primero
		for (let i = 0; i < this.doorShelves.length; i++) {
			const s = this.doorShelves[i];
			const left = s.x;
			const right = s.x + s.w;
			const top = s.y - 20;
			const bottom = s.y + 40;
			if (centerX >= left && centerX <= right && centerY >= top && centerY <= bottom) {
				return { kind: "door", index: i };
			}
		}

		// chequear estantes internos
		for (let i = 0; i < this.shelves.length; i++) {
			const s = this.shelves[i];
			const left = s.x;
			const right = s.x + s.w;
			const top = s.y - 40;
			const bottom = s.y + 40;
			if (centerX >= left && centerX <= right && centerY >= top && centerY <= bottom) {
				return { kind: "shelf", index: i };
			}
		}

		return null;
	}

	private snapToShelf(item: FridgeItem, placedOn: { kind: "shelf" | "door"; index: number }) {
		let targetX: number;
		let targetY: number;
		if (placedOn.kind === "door") {
			const s = this.doorShelves[placedOn.index];
			targetX = s.x + s.w / 2;
			targetY = s.y;
		} else {
			const s = this.shelves[placedOn.index];
			targetX = s.x + s.w / 2 - 20 + Math.random() * 40; // pequeño offset para que no se apilen exacto
			targetY = s.y - 10;
		}

		new Tween(item.view).to({ x: targetX, y: targetY }, 180).easing(Easing.Quadratic.Out).start();
	}

	private snapHome(item: FridgeItem) {
		if (!item.home) {
			return;
		}
		new Tween(item.view).to({ x: item.home.x, y: item.home.y }, 200).easing(Easing.Quadratic.Out).start();
	}

	/* -----------------------------
	   Validaciones de bromatología (simples / demo)
	   ----------------------------- */

	/**
	 * Reglas de ejemplo:
	 * - meat solo en shelf index 2 (bottom)
	 * - vegetable no debe estar por debajo de meat (es decir, su shelf index debe ser < shelf index de meat)
	 * - dairy preferible en door (si cae en door -> ok)
	 */
	private validateItemPlacement(item: FridgeItem, placedOn: { kind: "shelf" | "door"; index: number }): boolean {
		if (item.type === "meat") {
			// meat sólo permitido en estante 2 (bottom) o puerta inferior (no ideal)
			if (placedOn.kind === "shelf" && placedOn.index === 2) {
				return true;
			}
			// permitimos sausage como "meat-like" en shelf 2 también
			return false;
		}

		if (item.type === "vegetable") {
			// vegetable no puede estar en shelf index > any meat placed (simple check:)
			// Para demo, consideramos incorrecto si vegetable se coloca en shelf index 2 (inferior)
			if (placedOn.kind === "shelf" && placedOn.index === 2) {
				return false;
			}
			return true;
		}

		if (item.type === "dairy" || item.type === "cheese") {
			// dairy ideal en door shelves (preferible). Si está en estante interno también es aceptable.
			if (placedOn.kind === "door") {
				return true;
			}
			return true;
		}

		return true;
	}

	private showPlacementResult(ok: boolean, item: FridgeItem) {
		if (ok) {
			this.correctCount++;
			this.infoText.text = "Correcto ✅";
			this.flashItemBorder(item.view, 0x7bd389);
		} else {
			this.wrongCount++;
			this.infoText.text = "Incorrecto ❌ — revisá las normas de almacenamiento";
			this.flashItemBorder(item.view, 0xff6b6b);
		}
		this.scoreText.text = `Correctos: ${this.correctCount}  Incorrectos: ${this.wrongCount}`;

		// pequeño feedback textual que desaparece
		// const prev = this.infoText.text;
		setTimeout(() => {
			this.infoText.text = "Arrastrá los productos al estante correcto";
		}, 1400);
	}

	private flashItemBorder(g: Graphics, color: number) {
		const border = new Graphics();
		border.lineStyle(6, color, 1);
		border.drawRoundedRect(-60 / 2, -40 / 2, 60, 40, 6);
		border.endFill();
		g.addChild(border);
		// fade out
		new Tween(border)
			.to({ alpha: 0 }, 600)
			.start()
			.onComplete(() => border.destroy());
	}

	/* -----------------------------
	   Resize
	   ----------------------------- */
	public override onResize(newW: number, newH: number): void {
		// centrar escena en pantalla y escalar relativo
		this.x = newW * 0.5;
		this.y = newH * 0.5;

		ScaleHelper.setScaleRelativeToIdeal(this.root, newW * 0.9, newH * 0.9, 720, 1600, ScaleHelper.FIT);
	}
}
