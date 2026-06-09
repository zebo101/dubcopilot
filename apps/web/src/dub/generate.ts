import type { EditorCore } from "@/core";
import { extractTimelineAudio } from "@/media/mediabunny";
import { decodeAudioToFloat32 } from "@/media/audio";
import { DEFAULT_TRANSCRIPTION_SAMPLE_RATE } from "@/transcription/audio";
import { transcriptionService } from "@/services/transcription/service";
import type { Segment } from "@/dub/types";

/**
 * Real transcription of the project's actual timeline audio (client-side
 * Whisper — no mock, no network). Produces the per-line segments the dubbing
 * editor works on. Translation + TTS are the next real steps (need the user's
 * Volcengine credentials).
 */
export async function generateDubSegments({
	editor,
	onStep,
}: {
	editor: EditorCore;
	onStep: (args: { step: string; pct: number }) => void;
}): Promise<Segment[]> {
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!scene) return [];

	onStep({ step: "提取时间轴音频…", pct: 5 });
	const audioBlob = await extractTimelineAudio({
		tracks: scene.tracks,
		mediaAssets: editor.media.getAssets(),
		totalDuration: editor.timeline.getTotalDuration(),
	});

	onStep({ step: "解码音频…", pct: 15 });
	const { samples } = await decodeAudioToFloat32({
		audioBlob,
		sampleRate: DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
	});
	if (!samples || samples.length === 0) return [];

	onStep({ step: "识别原文（首次会下载模型，请稍候）…", pct: 25 });
	const result = await transcriptionService.transcribe({
		audioData: samples,
		onProgress: (p) => {
			const raw = p.progress ?? 0;
			const frac = raw > 1 ? raw / 100 : raw;
			onStep({
				step: p.message ?? "识别中…",
				pct: Math.min(95, 25 + Math.round(frac * 70)),
			});
		},
	});

	onStep({ step: "整理逐句…", pct: 98 });
	return result.segments.map((seg, i) => {
		const target = Math.max(0, seg.end - seg.start);
		return {
			id: `seg_${String(i).padStart(3, "0")}`,
			index: i,
			start: seg.start,
			end: seg.end,
			source: seg.text.trim(),
			// translated is filled by the translation step (or manual edit) —
			// never seeded with fake Chinese.
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
}
