import type { EditorCore } from "@/core";
import { extractTimelineAudio } from "@/media/mediabunny";
import { decodeAudioToFloat32 } from "@/media/audio";
import { DEFAULT_TRANSCRIPTION_SAMPLE_RATE } from "@/transcription/audio";
import { transcriptionService } from "@/services/transcription/service";
import type {
	TranscriptionLanguage,
	TranscriptionModelId,
} from "@/transcription/types";
import type { DubCredentials } from "@/dub/credentials";
import { transcribeViaGroq } from "@/dub/transcribe-cloud";
import type { Segment } from "@/dub/types";

interface RawSegment {
	start: number;
	end: number;
	text: string;
}

/**
 * Real transcription of the project's actual timeline audio. Two backends:
 *
 * - "cloud": upload the decoded audio to the user's Groq Whisper endpoint
 *   (whisper-large-v3-turbo) — by far the fastest, finishes in seconds.
 * - "local": client-side browser Whisper (free + private, but CPU/WebGPU-bound
 *   and much slower). Browser Whisper emits download progress but NOT per-chunk
 *   inference progress, so the UI shows an elapsed timer once recognizing.
 *
 * Either way, translation + TTS are the next real steps (need the user's
 * DeepSeek / 豆包 credentials). No mock data.
 */
export async function generateDubSegments({
	editor,
	provider,
	modelId,
	language = "en",
	creds,
	onStep,
}: {
	editor: EditorCore;
	provider: "local" | "cloud";
	modelId: TranscriptionModelId;
	language?: TranscriptionLanguage;
	creds: DubCredentials;
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

	let segments: RawSegment[];
	if (provider === "cloud") {
		onStep({ step: "云端转写中（上传音频，几秒即可）…", pct: 40 });
		const result = await transcribeViaGroq({
			samples,
			sampleRate: DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
			language,
			creds,
		});
		segments = result.segments;
	} else {
		onStep({ step: "加载语音识别模型（首次会下载，请稍候）…", pct: 25 });
		let downloading = true;
		const result = await transcriptionService.transcribe({
			audioData: samples,
			language,
			modelId,
			onProgress: (p) => {
				if (p.status === "transcribing") {
					// Inference started — there is no per-chunk progress, so flip to
					// a clear "recognizing" message and let the UI show elapsed time.
					downloading = false;
					onStep({
						step: "识别语音中（视频较长时需数分钟，请勿切换标签页）…",
						pct: 95,
					});
					return;
				}
				if (!downloading) return;
				const raw = p.progress ?? 0;
				const frac = raw > 1 ? raw / 100 : raw;
				onStep({
					step: p.message ?? "加载模型…",
					pct: Math.min(90, 25 + Math.round(frac * 65)),
				});
			},
		});
		segments = result.segments;
	}

	onStep({ step: "整理逐句…", pct: 98 });
	return segments.map((seg, i) => {
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
