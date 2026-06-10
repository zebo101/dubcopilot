import type { DubCredentials } from "@/dub/credentials";
import type { TranscriptionLanguage } from "@/transcription/types";
import { encodeWavFromFloat32 } from "@/dub/wav";

export interface CloudTranscriptSegment {
	start: number;
	end: number;
	text: string;
}

/**
 * Cloud transcription via the Groq Whisper proxy. Encodes the already-decoded
 * 16 kHz mono samples to a compact WAV and uploads it — Groq's
 * whisper-large-v3-turbo returns the full transcript with per-segment
 * timestamps in seconds, far faster than browser inference.
 */
export async function transcribeViaGroq({
	samples,
	sampleRate,
	language,
	creds,
}: {
	samples: Float32Array;
	sampleRate: number;
	language?: TranscriptionLanguage;
	creds: DubCredentials;
}): Promise<{ text: string; segments: CloudTranscriptSegment[] }> {
	const wav = encodeWavFromFloat32({ samples, sampleRate });
	// Groq caps uploads at 25 MB. 16 kHz mono 16-bit ≈ 1.92 MB/min, so this
	// triggers around ~12.5 min of audio — fail with guidance, not a vague 4xx.
	const MAX_GROQ_BYTES = 24 * 1024 * 1024;
	if (wav.size > MAX_GROQ_BYTES) {
		throw new Error(
			`音频 ${(wav.size / 1e6).toFixed(0)} MB 超出 Groq 25 MB 上限（约 12 分钟），请改用本地转写`,
		);
	}
	const form = new FormData();
	form.append("file", wav, "audio.wav");
	form.append("apiKey", creds.groqApiKey);
	form.append("baseUrl", creds.groqBaseUrl);
	form.append("model", creds.groqModel);
	if (language) form.append("language", language);

	const res = await fetch("/api/dub/transcribe", { method: "POST", body: form });
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as { error?: string };
		throw new Error(err.error ?? `云端转写失败 (${res.status})`);
	}
	return (await res.json()) as {
		text: string;
		segments: CloudTranscriptSegment[];
	};
}
