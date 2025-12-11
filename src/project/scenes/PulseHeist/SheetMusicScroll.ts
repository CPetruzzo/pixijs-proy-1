/* eslint-disable @typescript-eslint/naming-convention */
import type { TilingSprite } from "pixi.js";
import { Container, Graphics, Text } from "pixi.js";

interface Note {
	note: string; // e.g., "C4", "D#5"
	position: number; // Posición X en el scroll
	staffLine: number; // Línea del pentagrama (0-10, donde 5 es la línea central)
	duration: number; // Duración visual (ancho de la nota)
	isSharp: boolean; // Si tiene sostenido
}

export class SheetMusicScroll extends Container {
	private scrollContainer: Container;
	public tilingBackground: TilingSprite;
	private notesContainer: Container;
	private staffContainer: Container;

	private scrollSpeed: number = 2; // Píxeles por segundo
	private currentOffset: number = 0;
	private notes: Note[] = [];

	private readonly STAFF_LINE_SPACING = 12; // Espaciado entre líneas del pentagrama
	private readonly NOTE_WIDTH = 40;
	private readonly VISIBLE_WIDTH = 600;
	private readonly STAFF_HEIGHT = 120;

	constructor() {
		super();

		this.scrollContainer = new Container();
		this.notesContainer = new Container();
		this.staffContainer = new Container();

		this.addChild(this.scrollContainer);
		this.scrollContainer.addChild(this.staffContainer);
		this.scrollContainer.addChild(this.notesContainer);

		this.setupStaff();
		this.setupMask();
	}

	private setupStaff(): void {
		// Crear el pentagrama base (5 líneas)
		const staffLines = new Graphics();
		const lineColor = 0x333333;
		const lineWidth = 2;

		for (let i = 0; i < 5; i++) {
			const y = i * this.STAFF_LINE_SPACING + 40;
			staffLines.lineStyle(lineWidth, lineColor, 0.8);
			staffLines.moveTo(0, y);
			staffLines.lineTo(5000, y); // Línea muy larga para scroll
		}

		this.staffContainer.addChild(staffLines);

		// Agregar clave de Sol al inicio
		const trebleClef = new Text("𝄞", {
			fontFamily: "Arial",
			fontSize: 72,
			fill: "#333333",
		});
		trebleClef.position.set(20, 15);
		this.staffContainer.addChild(trebleClef);

		// Líneas de compás cada cierto intervalo
		for (let i = 0; i < 20; i++) {
			const barLine = new Graphics();
			barLine.lineStyle(2, lineColor, 0.6);
			const x = 100 + i * 200;
			barLine.moveTo(x, 40);
			barLine.lineTo(x, 40 + 4 * this.STAFF_LINE_SPACING);
			this.staffContainer.addChild(barLine);
		}
	}

	private setupMask(): void {
		// Máscara para que solo se vea la porción visible del scroll
		const mask = new Graphics();
		mask.beginFill(0xffffff);
		mask.drawRect(50, 0, this.VISIBLE_WIDTH, this.STAFF_HEIGHT);
		mask.endFill();
		this.addChild(mask);
		this.scrollContainer.mask = mask;
	}

	// Convertir nota musical a posición en el pentagrama
	private noteToStaffLine(note: string): number {
		// Mapeo de notas a líneas del pentagrama
		// Línea 0 = Do5 (arriba), Línea 10 = Do3 (abajo)
		const noteMap: { [key: string]: number } = {
			C5: 0,
			B4: 1,
			A4: 2,
			G4: 3,
			F4: 4,
			E4: 5,
			D4: 6,
			C4: 7,
			B3: 8,
			A3: 9,
			G3: 10,
		};

		const baseName = note.replace(/[#b]/g, ""); // Quitar sostenidos/bemoles
		return noteMap[baseName] ?? 5; // Default a línea central
	}

	// Agregar una nota a la partitura
	public addNote(note: string, duration: number = 1): void {
		const lastNotePos = this.notes.length > 0 ? this.notes[this.notes.length - 1].position + this.NOTE_WIDTH : 150;

		const newNote: Note = {
			note: note,
			position: lastNotePos,
			staffLine: this.noteToStaffLine(note),
			duration: duration,
			isSharp: note.includes("#") || note.includes("b"),
		};

		this.notes.push(newNote);
		this.renderNote(newNote);
	}

	private renderNote(note: Note): void {
		const noteGraphics = new Container();

		// Posición Y basada en la línea del pentagrama
		const yPos = 40 + (note.staffLine * this.STAFF_LINE_SPACING) / 2;

		// Cabeza de la nota (óvalo)
		const noteHead = new Graphics();
		noteHead.beginFill(0x000000);
		noteHead.drawEllipse(0, 0, 10, 8);
		noteHead.endFill();
		noteHead.rotation = -0.3; // Inclinación típica
		noteGraphics.addChild(noteHead);

		// Plica (línea vertical)
		const stem = new Graphics();
		stem.lineStyle(2, 0x000000);
		stem.moveTo(9, 0);
		stem.lineTo(9, -35);
		noteGraphics.addChild(stem);

		// Sostenido si aplica
		if (note.isSharp) {
			const sharp = new Text("♯", {
				fontFamily: "Arial",
				fontSize: 20,
				fill: "#000000",
			});
			sharp.anchor.set(0.5);
			sharp.position.set(-15, 0);
			noteGraphics.addChild(sharp);
		}

		// Líneas adicionales si la nota está fuera del pentagrama
		if (note.staffLine < 0 || note.staffLine > 8) {
			const ledgerLine = new Graphics();
			ledgerLine.lineStyle(2, 0x333333);
			ledgerLine.moveTo(-12, 0);
			ledgerLine.lineTo(12, 0);
			noteGraphics.addChild(ledgerLine);
		}

		noteGraphics.position.set(note.position, yPos);
		this.notesContainer.addChild(noteGraphics);
	}

	// Actualizar el scroll (llamar en tu game loop/ticker)
	public update(deltaTime: number): void {
		this.currentOffset += this.scrollSpeed * deltaTime;
		this.scrollContainer.x = -this.currentOffset;

		// Limpiar notas que ya pasaron
		this.cleanupOldNotes();
	}

	private cleanupOldNotes(): void {
		// Remover notas que ya están fuera de vista
		while (this.notes.length > 0 && this.notes[0].position < this.currentOffset - 100) {
			this.notes.shift();
			if (this.notesContainer.children.length > 0) {
				this.notesContainer.removeChildAt(0);
			}
		}
	}

	// Configurar velocidad de scroll
	public setScrollSpeed(speed: number): void {
		this.scrollSpeed = speed;
	}

	// Agregar una secuencia de notas (útil para cargar melodías)
	public addMelody(melody: string[]): void {
		melody.forEach((note, index) => {
			setTimeout(() => {
				this.addNote(note);
			}, index * 500); // Agregar cada nota cada 500ms
		});
	}

	// Pausar/reanudar scroll
	private isPaused: boolean = false;

	public pause(): void {
		this.isPaused = true;
	}

	public resume(): void {
		this.isPaused = false;
	}

	public updateIfNotPaused(deltaTime: number): void {
		if (!this.isPaused) {
			this.update(deltaTime);
		}
	}
}

// ============================================
// INTEGRACIÓN CON TU CÓDIGO EXISTENTE
// ============================================

/* 
En tu PianoGameScene, agregar:

1. Declarar la partitura:
   private sheetMusic: SheetMusicScroll;

2. En el constructor, después de inicializar containers:
   this.sheetMusic = new SheetMusicScroll();
   this.sheetMusic.position.set(50, 50); // Ajustar según necesites
   this.mainContainer.addChild(this.sheetMusic);

3. En el método createKey, donde llamas a synth.triggerAttackRelease, agregar:
   this.sheetMusic.addNote(note);

4. Agregar un ticker para actualizar el scroll:
   this.app.ticker.add((delta) => {
	   this.sheetMusic.update(delta / 60); // Convertir a segundos
   });

5. Ejemplo de melodía pre-cargada (opcional):
   const melody = ["C4", "E4", "G4", "C5", "G4", "E4", "C4"];
   this.sheetMusic.addMelody(melody);

6. Para pausar cuando se abre el menú:
   En toggleMenu():
   if (this.isMenuOpen) {
	   this.sheetMusic.pause();
   } else {
	   this.sheetMusic.resume();
   }
*/
