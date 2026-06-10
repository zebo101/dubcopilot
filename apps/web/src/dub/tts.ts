import type { DubCredentials } from "@/dub/credentials";
import type { Segment } from "@/dub/types";

/** Synthesize one line of text to mp3 bytes via the豆包 TTS proxy. */
export async function synthesizeSegment({
	text,
	voiceType,
	creds,
	speedRatio = 1,
	language,
}: {
	text: string;
	voiceType: string;
	creds: DubCredentials;
	speedRatio?: number;
	/** BigTTS explicit_language for non-Chinese targets; omit for Chinese */
	language?: string;
}): Promise<ArrayBuffer> {
	const res = await fetch("/api/dub/tts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			apiKey: creds.ttsApiKey,
			ttsUrl: creds.ttsUrl,
			resourceId: creds.ttsResourceId,
			cluster: creds.ttsCluster,
			voiceType,
			text,
			encoding: "mp3",
			speedRatio,
			...(language ? { language } : {}),
		}),
	});
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as {
			error?: string;
			detail?: string;
		};
		// surface the upstream message — "TTS error 400" alone is undebuggable
		const detail = err.detail ? `：${err.detail.slice(0, 200)}` : "";
		throw new Error((err.error ?? `TTS 请求失败 (${res.status})`) + detail);
	}
	return await res.arrayBuffer();
}

/** Synthesize every translated segment (sequential, with progress). */
export async function synthesizeSegments({
	segments,
	voiceType,
	creds,
	onStep,
}: {
	segments: Segment[];
	voiceType: string;
	creds: DubCredentials;
	onStep?: (args: { step: string; pct: number }) => void;
}): Promise<Map<string, ArrayBuffer>> {
	const out = new Map<string, ArrayBuffer>();
	const pending = segments.filter((s) => s.translated.trim().length > 0);
	for (let i = 0; i < pending.length; i++) {
		const seg = pending[i];
		const audio = await synthesizeSegment({
			text: seg.translated,
			voiceType,
			creds,
		});
		out.set(seg.id, audio);
		onStep?.({
			step: `合成配音 ${i + 1}/${pending.length}`,
			pct: Math.round(((i + 1) / pending.length) * 100),
		});
	}
	return out;
}
