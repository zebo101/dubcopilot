// Stage: transcribe (only for lessons WITHOUT a subtitle sidecar). Fully
// headless: composes a throwaway single-video timeline in memory, extracts its
// audio with the pure extractTimelineAudio, then runs the shared
// transcribe-core (local browser Whisper — nothing is uploaded).

import { buildDefaultScene } from "@/timeline/scenes";
import { extractTimelineAudio } from "@/media/mediabunny";
import { decodeAudioToFloat32 } from "@/media/audio";
import { DEFAULT_TRANSCRIPTION_SAMPLE_RATE } from "@/transcription/audio";
import {
	buildDefaultParamValues,
	getBuiltInElementParams,
} from "@/params/registry";
import { generateUUID } from "@/utils/id";
import { mediaTimeFromSeconds } from "@/wasm";
import type { MediaAsset } from "@/media/types";
import type {
	TranscriptionLanguage,
	TranscriptionModelId,
} from "@/transcription/types";
import { transcribeSamples } from "@/dub/transcribe-core";
import { AUTO_LANG, toWhisperLanguage } from "@/dub/languages";
import type { Segment } from "@/dub/types";
import type { LessonMeta, StepReport } from "@/dub/course/engine/types";

export async function transcribeLesson({
	videoFile,
	meta,
	modelId,
	sourceLang = AUTO_LANG,
	onStep,
}: {
	videoFile: File;
	meta: LessonMeta;
	modelId: TranscriptionModelId;
	/** "auto" = let Whisper detect; otherwise a code from dub/languages.ts */
	sourceLang?: string;
	onStep?: (args: StepReport) => void;
}): Promise<Segment[]> {
	if (!meta.hasAudio) return [];

	// In-memory asset + throwaway scene — nothing touches storage or the editor.
	const asset: MediaAsset = {
		id: generateUUID(),
		name: videoFile.name,
		type: "video",
		file: videoFile,
		duration: meta.duration,
		width: meta.width,
		height: meta.height,
		fps: meta.fps,
		hasAudio: true,
	};

	const scene = buildDefaultScene({ name: "headless", isMain: true });
	scene.tracks.main.elements.push({
		id: generateUUID(),
		type: "video",
		mediaId: asset.id,
		name: videoFile.name,
		startTime: mediaTimeFromSeconds({ seconds: 0 }),
		duration: mediaTimeFromSeconds({ seconds: meta.duration }),
		trimStart: mediaTimeFromSeconds({ seconds: 0 }),
		trimEnd: mediaTimeFromSeconds({ seconds: 0 }),
		params: buildDefaultParamValues(getBuiltInElementParams({ type: "video" })),
	});

	onStep?.({ step: "提取音频…", pct: 5 });
	const audioBlob = await extractTimelineAudio({
		tracks: scene.tracks,
		mediaAssets: [asset],
		totalDuration: mediaTimeFromSeconds({ seconds: meta.duration }),
	});

	onStep?.({ step: "解码音频…", pct: 15 });
	const { samples } = await decodeAudioToFloat32({
		audioBlob,
		sampleRate: DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
	});
	if (!samples || samples.length === 0) return [];

	return transcribeSamples({
		samples,
		modelId,
		// Whisper accepts any ISO 639-1 code; the app-level union is just the UI
		// list, so the widened value is narrowed here.
		language: toWhisperLanguage(sourceLang) as TranscriptionLanguage,
		onStep,
	});
}
