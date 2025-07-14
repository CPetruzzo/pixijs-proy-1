/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// pages/api/gemini.ts

export default async function handler(req: any, res: any) {
	const { prompt } = req.body as { prompt: string };
	const apiKey = process.env.GEMINI_API_KEY!; // viene de ./env.ts, no lo pusheas
	const response = await fetch("https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			prompt: { text: prompt },
			model: "chat-bison-001",
		}),
	});
	const json = (await response.json()) as { candidates: { content: string }[] };
	res.status(200).json({ reply: json.candidates[0].content });
}
