// src/engine/scenes/ConstructionEngineScene/files/FileSystemManager.ts
declare global {
	interface Window {
		showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
	}
}

export class FileSystemManager {
	private savedProjectsDirHandle: FileSystemDirectoryHandle | null = null;

	public async getOrCreateSavedProjectsFolder(): Promise<FileSystemDirectoryHandle> {
		if (!this.savedProjectsDirHandle) {
			if (!window.showDirectoryPicker) {
				throw new Error("La API File System Access no está soportada en este navegador.");
			}
			// Se pide al usuario que seleccione una carpeta padre
			const parentHandle = await window.showDirectoryPicker();
			this.savedProjectsDirHandle = await parentHandle.getDirectoryHandle("savedProyects", { create: true });
		}
		return this.savedProjectsDirHandle;
	}

	/**
	 * Abre el explorador de archivos nativo de Windows/Mac para guardar el nivel.
	 */
	public async exportStateToFile(data: string, filename: string = "scene.json"): Promise<void> {
		try {
			// Verificamos si el navegador soporta la API moderna de guardado
			if ("showSaveFilePicker" in window) {
				const handle = await (window as any).showSaveFilePicker({
					suggestedName: filename,
					types: [
						{
							description: "JSON Files",
							// eslint-disable-next-line @typescript-eslint/naming-convention
							accept: { "application/json": [".json"] },
						},
					],
				});

				const writable = await handle.createWritable();
				await writable.write(data);
				await writable.close();
				console.log("Archivo guardado en la ubicación elegida.");
			} else {
				// Opción de respaldo para navegadores que no soportan la API (descarga automática)
				const blob = new Blob([data], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = filename;
				link.click();
				URL.revokeObjectURL(url);
			}
		} catch (error: any) {
			// Si el usuario cierra la ventana sin guardar, no lanzamos error
			if (error.name !== "AbortError") {
				console.error("Error al exportar:", error);
			}
		}
	}

	/**
	 * Abre un selector de archivos nativo para cargar un JSON.
	 * Incluye fallback para navegadores que no soportan la API moderna.
	 */
	public async loadFile(): Promise<string | null> {
		try {
			// 1. Intento con API Moderna (Chrome/Edge)
			if ("showOpenFilePicker" in window) {
				const [handle] = await (window as any).showOpenFilePicker({
					types: [
						{
							description: "JSON Level",
							// eslint-disable-next-line @typescript-eslint/naming-convention
							accept: { "application/json": [".json"] },
						},
					],
					multiple: false,
				});
				const file = await handle.getFile();
				return await file.text();
			}

			// 2. Fallback clásico (Firefox/Safari/Otros) usando input HTML oculto
			return new Promise((resolve) => {
				const input = document.createElement("input");
				input.type = "file";
				input.accept = ".json";

				input.onchange = async (e: any) => {
					const file = e.target.files[0];
					if (file) {
						const text = await file.text();
						resolve(text);
					} else {
						resolve(null);
					}
				};

				input.click();
			});
		} catch (error: any) {
			// Si el usuario cancela, no es un error crítico
			if (error.name !== "AbortError") {
				console.error("Error al abrir archivo:", error);
			}
			return null;
		}
	}

	public async saveStateDirectly(data: string, filename: string = "state.json"): Promise<void> {
		if (!this.savedProjectsDirHandle) {
			console.error("No se tiene acceso previo a la carpeta 'savedProyects'.");
			return;
		}
		try {
			const fileHandle = await this.savedProjectsDirHandle.getFileHandle(filename, { create: false });
			const writable = await (fileHandle as any).createWritable();
			await writable.write(data);
			await writable.close();
			console.log("Estado sobrescrito en:", filename);
		} catch (error) {
			console.error("Error al sobrescribir el estado:", error);
		}
	}

	public async createLoadPanel(callback: (data: string) => void): Promise<HTMLElement> {
		// Por simplicidad, devolvemos un elemento HTML con botones para cada archivo.
		const panel = document.createElement("div");
		panel.style.position = "absolute";
		panel.style.top = "100px";
		panel.style.left = "50px";
		panel.style.background = "#333";
		panel.style.color = "#fff";
		panel.style.padding = "10px";

		const folderHandle = await this.getOrCreateSavedProjectsFolder();
		for await (const [name, handle] of (folderHandle as any).entries()) {
			if (name.endsWith(".json") && handle.kind === "file") {
				const button = document.createElement("button");
				button.textContent = name;
				button.onclick = async () => {
					const fileHandle = handle as FileSystemFileHandle;
					const file = await fileHandle.getFile();
					const text = await file.text();
					callback(text);
				};
				panel.appendChild(button);
			}
		}
		return panel;
	}
}
