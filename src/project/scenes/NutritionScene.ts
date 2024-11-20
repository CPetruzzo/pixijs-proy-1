import { Graphics, Text, TextStyle } from "pixi.js";
import { PixiScene } from "../../engine/scenemanager/scenes/PixiScene";
import { ShaderTest } from "./ShaderTests";

export interface NutritionData {
	nombre: string;
	apellido: string;
	edad: number;
	peso: number;
	actividad: string;
	sintomas: string;
	historia: string;
	inicio: string;
	ultima: string;
	total: number;
	desayuno: string;
	almuerzo: string;
	merienda: string;
	cena: string;
	colaciones: string;
}

export class NutritionScene extends PixiScene {
	public names: string[] = [];
	public nutritionDataArray: NutritionData[] = [];
	private shaderBG: ShaderTest;
	private currentPatientData: NutritionData[] = [];

	constructor() {
		super();

		this.shaderBG = new ShaderTest();
		this.addChild(this.shaderBG);

		const spreadsheetId = "1IzRe_lN7R0Ib5jXNAXfYuKwZVaULKnGfFOuq0jiCDzQ";
		const tabName = "Pacientes";
		const apiUrl = `https://opensheet.elk.sh/${spreadsheetId}/${tabName}`;

		fetch(apiUrl)
			.then((response) => response.json())
			.then((data) => {
				console.log("Datos obtenidos:", data);
				this.processNutritionData(data);
				this.createGenerateJsonButton();
				this.createPatientButtons(this.nutritionDataArray);
			})
			.catch((error) => {
				console.error("Error al obtener datos:", error);
			});
	}

	private processNutritionData(data: any): void {
		if (data && data.length > 0) {
			for (let i = 0; i < data.length; i++) {
				const row = data[i];
				const nutritionData: NutritionData = {
					nombre: row.Nombre,
					apellido: row.Apellido,
					edad: parseInt(row.Edad),
					peso: parseInt(row.Peso),
					actividad: row.Actividad,
					sintomas: row.Sintomas,
					historia: row.Historia,
					inicio: row.FechaInicio,
					ultima: row.FechaUltimaConsulta,
					total: row.TiempoAtendido,
					desayuno: row.Desayuno,
					almuerzo: row.Almuerzo,
					merienda: row.Merienda,
					cena: row.Cena,
					colaciones: row.Colaciones,
				};
				this.nutritionDataArray.push(nutritionData);
			}

			console.log("Datos de nutrición procesados:", this.nutritionDataArray);
			this.displayNutritionData();
		} else {
			console.error("Error: No se encontraron datos válidos en la respuesta.");
		}
	}

	public override update(): void {
		this.shaderBG.update();
	}

	private displayNutritionData(): void {
		this.updateTable(this.nutritionDataArray);
	}

	private updateTable(data: NutritionData[]): void {
		const table = new Graphics();
		table.lineStyle(1, 0x000000);
		table.beginFill(0xffffff);
		table.drawRect(50, 50, 900, 400);
		table.endFill();
		this.addChild(table);

		// Crear textos para los encabezados de la tabla
		const headers = ["Nombre", "Apellido", "Edad", "Peso", "Actividad Fisica", "Sintomas"];
		for (let i = 0; i < headers.length; i++) {
			const headerText = new Text(headers[i], { fontSize: 16, fill: 0x000000 });
			headerText.x = 75 + i * 150;
			headerText.y = 70;
			this.addChild(headerText);
		}

		// Mostrar los datos de nutrición en la tabla
		for (let i = 0; i < data.length; i++) {
			const patient = data[i];
			const nombreText = new Text(patient.nombre, { fontSize: 16, fill: 0x000000 });
			nombreText.x = 75;
			nombreText.y = 100 + i * 50;
			this.addChild(nombreText);

			const apellidoText = new Text(patient.apellido, { fontSize: 16, fill: 0x000000 });
			apellidoText.x = 225;
			apellidoText.y = 100 + i * 50;
			this.addChild(apellidoText);

			const edadText = new Text(patient.edad.toString(), { fontSize: 16, fill: 0x000000 });
			edadText.x = 375;
			edadText.y = 100 + i * 50;
			this.addChild(edadText);

			const pesoText = new Text(patient.peso.toString(), { fontSize: 16, fill: 0x000000 });
			pesoText.x = 525;
			pesoText.y = 100 + i * 50;
			this.addChild(pesoText);

			const actividadText = new Text(patient.actividad, { fontSize: 16, fill: 0x000000 });
			actividadText.x = 725;
			actividadText.y = 100 + i * 50;
			this.addChild(actividadText);

			const sintomasText = new Text(patient.sintomas, { fontSize: 16, fill: 0x000000 });
			sintomasText.x = 825;
			sintomasText.y = 100 + i * 50;
			this.addChild(sintomasText);

			if (data.length === 1) {
				const patientHistory = new Text(`Historia:\n\n${patient.historia}`, new TextStyle({ fontSize: 16, fill: 0x000000, wordWrap: true, wordWrapWidth: 850 }));
				patientHistory.x = 75;
				patientHistory.y = 150;
				this.addChild(patientHistory);

				const inicio = new Text(`Fecha de inicio: ${patient.inicio}`, new TextStyle({ fontSize: 16, fill: 0x000000, wordWrap: true, wordWrapWidth: 500 }));
				inicio.x = 75;
				inicio.y = 275;
				this.addChild(inicio);

				const ultima = new Text(`Ultima consulta: ${patient.ultima}`, new TextStyle({ fontSize: 16, fill: 0x000000, wordWrap: true, wordWrapWidth: 500 }));
				ultima.x = 75;
				ultima.y = 325;
				this.addChild(ultima);

				const total = new Text(`Dias de tratamiento: ${patient.total}`, new TextStyle({ fontSize: 16, fill: 0x000000, wordWrap: true, wordWrapWidth: 500 }));
				total.x = 75;
				total.y = 375;
				this.addChild(total);
			}
		}
	}

	private createGenerateJsonButton(): void {
		const button = new Graphics();
		button.lineStyle(2, 0x000000);
		button.beginFill(0x00ff00);
		button.drawRect(50, 500, 200, 50);
		button.endFill();
		button.interactive = true;
		button.addListener("pointerdown", this.generateJson.bind(this));

		const buttonText = new Text("Generar JSON", new TextStyle({ fontSize: 20, fill: 0x000000 }));
		buttonText.x = 75;
		buttonText.y = 515;

		this.addChild(button, buttonText);
	}

	private generateJson(): void {
		const json = JSON.stringify(this.nutritionDataArray, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const link = document.createElement("a");
		link.href = url;
		link.download = "datos.json";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	private createPatientButtons(data: NutritionData[]): void {
		const buttonSpacing = 10;
		const buttonWidth = 150;
		const buttonHeight = 40;

		for (let i = 0; i < data.length; i++) {
			const patient = data[i];
			const button = new Graphics();
			button.lineStyle(2, 0x000000);
			button.beginFill(0x0000ff);
			button.drawRect(50 + (buttonWidth + buttonSpacing) * i, 455, buttonWidth, buttonHeight);
			button.endFill();
			button.interactive = true;
			button.addListener("pointerdown", () => {
				this.showPatientData(patient);
			});

			const buttonText = new Text(`${patient.nombre} ${patient.apellido}`, new TextStyle({ fontSize: 16, fill: 0xffffff }));
			buttonText.x = 50 + (buttonWidth + buttonSpacing) * i + buttonWidth / 2 - buttonText.width / 2;
			buttonText.y = 455 + buttonHeight / 2 - buttonText.height / 2;

			this.addChild(button, buttonText);
		}
	}

	private showPatientData(patient: NutritionData): void {
		this.currentPatientData = [patient];
		console.log("this.currentPatientData", this.currentPatientData);
		this.clearTable();
		this.updateTable(this.currentPatientData);
		this.createBackButton();
		this.createShowFoodButton(patient);
	}

	private showAvailableFood(patient: NutritionData): void {
		// Eliminar elementos anteriores si los hay
		this.removeChildren();

		// Crear botón para volver a la vista de detalles del paciente
		this.createBackButton();

		// Mostrar las comidas del paciente
		const table = new Graphics();
		table.lineStyle(1, 0x000000);
		table.beginFill(0xffffff);
		table.drawRect(50, 50, 900, 400);
		table.endFill();
		this.addChild(table);

		// Crear textos para los encabezados de la tabla de comidas
		const headers = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Colaciones"];
		for (let i = 0; i < headers.length; i++) {
			const headerText = new Text(headers[i], { fontSize: 16, fill: 0x000000 });
			headerText.x = 75 + i * 150;
			headerText.y = 70;
			this.addChild(headerText);
		}

		// Mostrar las comidas del paciente
		const foodTexts = [patient.desayuno, patient.almuerzo, patient.merienda, patient.cena, patient.colaciones];
		for (let i = 0; i < foodTexts.length; i++) {
			const foodText = new Text(foodTexts[i], { fontSize: 16, fill: 0x000000, wordWrap: true, wordWrapWidth: 150 });
			foodText.x = 75 + i * 150;
			foodText.y = 100;
			this.addChild(foodText);
		}
	}

	private createShowFoodButton(patient: NutritionData): void {
		const button = new Graphics();
		button.lineStyle(2, 0x000000);
		button.beginFill(0x0000ff);
		button.drawRect(50, 570, 200, 50);
		button.endFill();
		button.interactive = true;
		button.addListener("pointerdown", () => this.showAvailableFood(patient));

		const buttonText = new Text("Ver Comidas", new TextStyle({ fontSize: 20, fill: 0xffffff }));
		buttonText.x = 75;
		buttonText.y = 585;

		this.addChild(button, buttonText);
	}

	private clearTable(): void {
		this.removeChildren(); // Eliminar todos los elementos hijos
		this.addChild(this.shaderBG); // Volver a agregar el fondo
	}

	private createBackButton(): void {
		const button = new Graphics();
		button.lineStyle(2, 0x000000);
		button.beginFill(0xff0000);
		button.drawRect(50, 500, 200, 50);
		button.endFill();
		button.interactive = true;
		button.addListener("pointerdown", () => {
			this.clearTable();
			this.displayNutritionData();
			this.createGenerateJsonButton();
			this.createPatientButtons(this.nutritionDataArray);
		});

		const buttonText = new Text("Volver", new TextStyle({ fontSize: 20, fill: 0x000000 }));
		buttonText.x = 75;
		buttonText.y = 515;

		this.addChild(button, buttonText);
	}
}
