import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Thin proxy: the browser can't call Volcengine BigTTS directly (CORS). The
// user's own API key is passed per-request and only used to call their TTS
// endpoint. Mirrors zh-dub's API-key (v1) request shape. Nothing is stored.

const bodySchema = z.object({
	apiKey: z.string().min(1),
	ttsUrl: z.string().url(),
	resourceId: z.string().min(1),
	cluster: z.string().min(1),
	voiceType: z.string().min(1),
	text: z.string().min(1),
	encoding: z.enum(["mp3", "wav"]).default("mp3"),
	speedRatio: z.number().min(0.5).max(2).default(1),
	/** BigTTS explicit_language (en/ja/es-mx/pt-br/id/th/vi); omitted for 中文 */
	language: z.string().min(1).max(10).optional(),
});

function pickBase64(obj: unknown): string | null {
	if (!obj || typeof obj !== "object") return null;
	const rec = obj as Record<string, unknown>;
	for (const key of ["data", "audio", "audio_data", "base64"]) {
		const v = rec[key];
		if (typeof v === "string" && v.length > 0) return v;
	}
	return null;
}

export async function POST(request: NextRequest) {
	const parsed = bodySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid input" }, { status: 400 });
	}
	const {
		apiKey,
		ttsUrl,
		resourceId,
		cluster,
		voiceType,
		text,
		encoding,
		speedRatio,
		language,
	} = parsed.data;

	const requestId = crypto.randomUUID();
	let upstream: Response;
	try {
		upstream = await fetch(ttsUrl.replace(/\/+$/, ""), {
			method: "POST",
			headers: {
				"X-Api-Key": apiKey,
				"X-Api-Request-Id": requestId,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				app: { appid: resourceId, cluster },
				user: { uid: "opencut-dub" },
				audio: {
					voice_type: voiceType,
					encoding,
					speed_ratio: speedRatio,
					volume_ratio: 1.0,
					// non-Chinese targets must name their language or BigTTS 400s
					...(language ? { explicit_language: language } : {}),
				},
				request: {
					reqid: requestId,
					text,
					text_type: "plain",
					operation: "query",
				},
			}),
		});
	} catch (error) {
		return NextResponse.json(
			{ error: `Upstream request failed: ${String(error)}` },
			{ status: 502 },
		);
	}

	const raw = await upstream.text();
	if (!upstream.ok) {
		return NextResponse.json(
			{ error: `TTS error ${upstream.status}`, detail: raw.slice(0, 500) },
			{ status: 502 },
		);
	}

	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return NextResponse.json(
			{ error: "TTS response was not JSON" },
			{ status: 502 },
		);
	}

	const b64 = pickBase64(json);
	if (!b64) {
		const msg =
			(json as { message?: string; Message?: string })?.message ??
			(json as { Message?: string })?.Message ??
			"no audio data";
		return NextResponse.json(
			{ error: `TTS returned no audio: ${msg}`, detail: raw.slice(0, 500) },
			{ status: 502 },
		);
	}

	const audio = Buffer.from(b64, "base64");
	return new NextResponse(audio, {
		status: 200,
		headers: {
			"Content-Type": encoding === "wav" ? "audio/wav" : "audio/mpeg",
			"Cache-Control": "no-store",
		},
	});
}
