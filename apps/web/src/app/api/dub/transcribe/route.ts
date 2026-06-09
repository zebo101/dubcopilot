import { type NextRequest, NextResponse } from "next/server";

// Thin proxy: the browser can't call Groq's audio API directly (CORS). The
// user's own key is passed in per-request and used only to call their endpoint
// — nothing is stored server-side. Runs fine on the edge (just fetch + form
// data), so no Python/long-running server is needed.

interface GroqSegment {
	start: number;
	end: number;
	text: string;
}

export async function POST(request: NextRequest) {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
	}

	const file = form.get("file");
	const apiKey = form.get("apiKey");
	const model = (form.get("model") as string) || "whisper-large-v3-turbo";
	const baseUrl =
		(form.get("baseUrl") as string) || "https://api.groq.com/openai/v1";
	const language = form.get("language");

	if (!(file instanceof File) || typeof apiKey !== "string" || !apiKey.trim()) {
		return NextResponse.json({ error: "缺少音频或 API Key" }, { status: 400 });
	}

	const upstreamForm = new FormData();
	upstreamForm.append("file", file, "audio.wav");
	upstreamForm.append("model", model);
	upstreamForm.append("response_format", "verbose_json");
	upstreamForm.append("timestamp_granularities[]", "segment");
	if (typeof language === "string" && language && language !== "auto") {
		upstreamForm.append("language", language);
	}

	const endpoint = `${baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;
	let upstream: Response;
	try {
		upstream = await fetch(endpoint, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}` },
			body: upstreamForm,
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
			{ error: `Groq error ${upstream.status}`, detail: detail.slice(0, 500) },
			{ status: 502 },
		);
	}

	const data = (await upstream.json()) as {
		text?: string;
		segments?: GroqSegment[];
	};
	const segments: GroqSegment[] = Array.isArray(data.segments)
		? data.segments.map((s) => ({
				start: s.start ?? 0,
				end: s.end ?? s.start ?? 0,
				text: s.text ?? "",
			}))
		: [];

	return NextResponse.json({ text: data.text ?? "", segments });
}
