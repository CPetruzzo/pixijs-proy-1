// src/game/services/GeminiService.ts
import { ENV_GEMINI } from "../../../env";

export class GeminiService {
	private static readonly API_KEY = ENV_GEMINI.GEMINI_API_KEY?.trim() || "";

	// ✅ Cambiamos a 'gemini-1.5-flash-8b' (la versión más compatible y ligera)
	// src/game/services/GeminiService.ts

	// 1. Usamos el nombre base sin sufijos de versión técnica
	private static readonly MODEL = "gemini-2.5-flash";
	// 2. Usamos la versión 'v1' (Estable) en lugar de 'v1beta'
	private static readonly API_URL = `https://generativelanguage.googleapis.com/v1/models/${GeminiService.MODEL}:generateContent?key=${GeminiService.API_KEY}`;
	private static systemPrompt = "Eres un Paisano humilde de campo. Sos muy amigable y queres ayudarme en mi camino. Cuidas las paredes.";
	private static chatHistory: any[] = [];

	public static async sendMessage(userMessage: string): Promise<string> {
		if (!this.API_KEY) {
			return "No tengo palabras, me falta la llave.";
		}

		// ✅ Solo mantenemos los últimos 2 mensajes para no saturar la cuota 'Limit: 0'
		const recentHistory = this.chatHistory.slice(-2);

		const payload = {
			contents: [
				{ role: "user", parts: [{ text: `Instrucción: ${this.systemPrompt}` }] },
				{ role: "model", parts: [{ text: "¡Entendido, oiga!" }] },
				...recentHistory,
				{ role: "user", parts: [{ text: userMessage }] },
			],
			generationConfig: {
				maxOutputTokens: 40, // Muy corto para asegurar que pase el filtro
				temperature: 0.7,
			},
		};

		try {
			const response = await fetch(this.API_URL, {
				method: "POST",
				// eslint-disable-next-line @typescript-eslint/naming-convention
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await response.json();

			if (data.error) {
				console.error("❌ Error de Google:", data.error.message);

				// Si es error de cuota o no encontrado, damos una respuesta coherente al personaje
				if (data.error.code === 429 || data.error.code === 404) {
					return "Ando medio cansado hoy, mejor hablamos luego, ¿si?";
				}
				return `(Don Gemini murmura algo ininteligible...)`;
			}

			if (data.candidates?.[0]?.content) {
				const aiText = data.candidates[0].content.parts[0].text;

				// Actualizamos historial
				this.chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
				this.chatHistory.push({ role: "model", parts: [{ text: aiText }] });

				return aiText;
			}

			return "Se me fue la idea pal monte...";
		} catch (e) {
			return "No hay señal por estos rumbos...";
		}
	}

	public static resetConversation(): void {
		this.chatHistory = [];
	}
}
