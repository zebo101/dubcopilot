import type { DubCredentials } from "@/dub/credentials";
import type { Segment } from "@/dub/types";

// A single dub unit synthesizes in a few seconds — 90s only trips on a STALLED
// connection (mainland ↔ overseas links drop packets and the TCP stream hangs
// forever; without this, one dead request pinned a concurrency slot and the
// whole lesson froze at "合成配音 x/y").
const TTS_TIMEOUT_MS = 90_000;

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
	let res: Response;
	try {
		res = await fetch("/api/dub/tts", {
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
			signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") {
			throw new Error("TTS 请求超时（网络不稳定，已自动重试）");
		}
		throw error;
	}
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as {
			error?: string;
			detail?: string;
		};
		// surface the upstream message — "TTS error 400" alone is undebuggable
		const detail = err.detail ? `：${err.detail.slice(0, 200)}` : "";
		throw new Error((err.error ?? `TTS 请求失败 (${res.status})`) + detail);
	}
	try {
		return await res.arrayBuffer();
	} catch (error) {
		// the timeout signal also aborts a stalled body download
		if (error instanceof DOMException && error.name === "TimeoutError") {
			throw new Error("TTS 音频下载超时（网络不稳定，已自动重试）");
		}
		throw error;
	}
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
