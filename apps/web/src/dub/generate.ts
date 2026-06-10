import type { EditorCore } from "@/core";
import { extractTimelineAudio } from "@/media/mediabunny";
import { decodeAudioToFloat32 } from "@/media/audio";
import { DEFAULT_TRANSCRIPTION_SAMPLE_RATE } from "@/transcription/audio";
import type {
	TranscriptionLanguage,
	TranscriptionModelId,
} from "@/transcription/types";
import type { DubCredentials } from "@/dub/credentials";
import { transcribeSamples } from "@/dub/transcribe-core";
import type { Segment } from "@/dub/types";

/**
 * In-editor transcription of the ACTIVE timeline's audio. Thin shell over the
 * shared transcribe-core (also used headless by the course engine). Backends:
 * "cloud" = the user's Groq Whisper endpoint (seconds); "local" = browser
 * Whisper (free + private, slower). No mock data anywhere.
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

	return transcribeSamples({
		samples,
		sampleRate: DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
		provider,
		modelId,
		language,
		creds,
		onStep,
	});
}
