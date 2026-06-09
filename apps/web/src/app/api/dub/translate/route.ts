import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildTranslateMessages } from "@/dub/translate-prompt";

// Thin proxy: the browser can't call DeepSeek directly (CORS). The user's own
// API key is passed in per-request and used only to call their DeepSeek
// endpoint — nothing is stored server-side.

const bodySchema = z.object({
	apiKey: z.string().min(1),
	baseUrl: z.string().url(),
	model: z.string().min(1),
	items: z
		.array(z.object({ id: z.string(), text: z.string() }))
		.min(1)
		.max(60),
});

export async function POST(request: NextRequest) {
	const parsed = bodySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid input" }, { status: 400 });
	}
	const { apiKey, baseUrl, model, items } = parsed.data;

	const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
	let upstream: Response;
	try {
		upstream = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: buildTranslateMessages({ items }),
				// 1.3 made the model degenerate into repetition loops ("new new new…"
				// filling the whole response). 0.7 + a frequency penalty keeps output
				// faithful and stops the loops.
				temperature: 0.7,
				frequency_penalty: 0.5,
				// Enough for a small batch of subtitles; low enough that any residual
				// runaway is bounded (the degeneration guard re-translates it).
				max_tokens: 4096,
				stream: false,
				response_format: { type: "json_object" },
			}),
		});
	} catch (error) {
		return NextResponse.json(
			{ error: `Upstream request failed: ${String(error)}` },
			{ status: 502 },
		);
	}

	if (!upstream.ok) {
		const detail = await upstream.text().catch(() => "");
		return NextResponse.json(
			{ error: `DeepSeek error ${upstream.status}`, detail: detail.slice(0, 500) },
			{ status: 502 },
		);
	}

	const data = (await upstream.json()) as {
		choices?: { message?: { content?: string } }[];
	};
	const content = data.choices?.[0]?.message?.content ?? "";

	let translations: { id: string; zh: string }[] = [];
	try {
		const obj = JSON.parse(content) as {
			translations?: { id: string; zh: string }[];
		};
		translations = Array.isArray(obj.translations) ? obj.translations : [];
	} catch {
		return NextResponse.json(
			{ error: "Failed to parse DeepSeek JSON output" },
			{ status: 502 },
		);
	}

	return NextResponse.json({ translations });
}
