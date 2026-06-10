// Shared "audio samples → dub segments" core, used by BOTH the in-editor flow
// (generate.ts) and the headless course engine (engine/stages/transcribe.ts).

import { transcriptionService } from "@/services/transcription/service";
import type {
	TranscriptionLanguage,
	TranscriptionModelId,
} from "@/transcription/types";
import type { DubCredentials } from "@/dub/credentials";
import { transcribeViaGroq } from "@/dub/transcribe-cloud";
import { extendSlots } from "@/dub/timing";
import type { Segment } from "@/dub/types";

export interface RawSegment {
	start: number;
	end: number;
	text: string;
}

/** Map raw transcript segments into the editable dub-segment shape. */
export function segmentsFromRaw({ raw }: { raw: RawSegment[] }): Segment[] {
	const segments: Segment[] = raw.map((seg, i) => {
		const target = Math.max(0, seg.end - seg.start);
		return {
			id: `seg_${String(i).padStart(3, "0")}`,
			index: i,
			start: seg.start,
			end: seg.end,
			source: seg.text.trim(),
			// translated is filled by the translation step (or manual edit)
			translated: "",
			status: "ready",
			speedMode: "auto",
			timing: {
				originalDuration: 0,
				targetDuration: target,
				fittedDuration: target,
				appliedSpeedup: 1,
			},
		};
	});
	// absorb inter-cue silence so lines breathe instead of leaving dead air
	return extendSlots({ segments });
}

/** Transcribe decoded 16 kHz samples via the chosen backend → dub segments. */
export async function transcribeSamples({
	samples,
	sampleRate,
	provider,
	modelId,
	language = "en",
	creds,
	onStep,
}: {
	samples: Float32Array;
	sampleRate: number;
	provider: "local" | "cloud";
	modelId: TranscriptionModelId;
	language?: TranscriptionLanguage;
	creds: DubCredentials;
	onStep?: (args: { step: string; pct: number }) => void;
}): Promise<Segment[]> {
	let raw: RawSegment[];
	if (provider === "cloud") {
		onStep?.({ step: "云端转写中（上传音频，几秒即可）…", pct: 40 });
		const result = await transcribeViaGroq({
			samples,
			sampleRate,
			language,
			creds,
		});
		raw = result.segments;
	} else {
		onStep?.({ step: "加载语音识别模型（首次会下载，请稍候）…", pct: 25 });
		let downloading = true;
		const result = await transcriptionService.transcribe({
			audioData: samples,
			language,
			modelId,
			onProgress: (p) => {
				if (p.status === "transcribing") {
					downloading = false;
					onStep?.({
						step: "识别语音中（视频较长时需数分钟，请勿切换标签页）…",
						pct: 95,
					});
					return;
				}
				if (!downloading) return;
				const rawP = p.progress ?? 0;
				const frac = rawP > 1 ? rawP / 100 : rawP;
				onStep?.({
					step: p.message ?? "加载模型…",
					pct: Math.min(90, 25 + Math.round(frac * 65)),
				});
			},
		});
		raw = result.segments;
	}
	onStep?.({ step: "整理逐句…", pct: 98 });
	return segmentsFromRaw({ raw });
}
