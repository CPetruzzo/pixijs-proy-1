// AIzaSyCE_heodZUl1KG0He93jDjXrBJEnAYuJ4I
import { PixiScene } from "../../../engine/scenemanager/scenes/PixiScene";
import { Container, Text, Graphics } from "pixi.js";
// Si quieres un input HTML “sobre” el canvas, usa un elemento `<input>` normal.
// O emplea un plugin tipo pixi-text-input.

export class AITestScene extends PixiScene {
	private messages: { from: "user" | "ai"; text: string }[] = [];
	private chatContainer: Container;
	private inputElement: HTMLInputElement;

	constructor() {
		super();

		// 1) Contenedor donde pintaremos burbujas de chat:
		this.chatContainer = new Container();
		this.chatContainer.y = 20;
		this.addChild(this.chatContainer);

		// 2) Creamos un <input> HTML sencillo y lo posicionamos en la esquina inferior:
		this.inputElement = document.createElement("input");
		Object.assign(this.inputElement.style, {
			position: "absolute",
			bottom: "10px",
			left: "10px",
			width: "400px",
			fontSize: "16px",
			padding: "8px",
		});
		document.body.appendChild(this.inputElement);

		// 3) Capturamos Enter:
		this.inputElement.addEventListener("keydown", async (e) => {
			if (e.key === "Enter" && this.inputElement.value.trim()) {
				const text = this.inputElement.value.trim();
				this.inputElement.value = "";
				await this.sendUserMessage(text);
			}
		});
	}

	private async sendUserMessage(text: string): Promise<void> {
		// 1) Mostrar mensaje de usuario
		this.messages.push({ from: "user", text });
		this.renderMessages();

		// 2) Mostrar “…” de espera
		this.messages.push({ from: "ai", text: "Pensando…" });
		this.renderMessages();

		try {
			// 3) Llamada al backend que a su vez consulta a Gemini
			const resp = await fetch("/api/chat", {
				method: "POST",
				// eslint-disable-next-line @typescript-eslint/naming-convention
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: text }),
			});
			const { reply } = await resp.json();

			// 4) Reemplazar “Pensando…” por la respuesta real
			this.messages.pop();
			this.messages.push({ from: "ai", text: reply });
			this.renderMessages();
		} catch (err) {
			console.error(err);
			this.messages.pop();
			this.messages.push({ from: "ai", text: "¡Error comunicándome con la IA!" });
			this.renderMessages();
		}
	}

	private renderMessages(): void {
		this.chatContainer.removeChildren();
		let y = 0;
		for (const msg of this.messages) {
			const bg = new Graphics()
				.beginFill(msg.from === "user" ? 0x3366ff : 0x888888, 0.7)
				.drawRoundedRect(0, 0, 400, 30, 6)
				.endFill();
			bg.y = y;
			const txt = new Text(msg.text, { fontSize: 14, fill: "#fff", wordWrap: true, wordWrapWidth: 380 });
			txt.position.set(10, y + 6);
			this.chatContainer.addChild(bg, txt);
			y += 40;
		}
	}
}
