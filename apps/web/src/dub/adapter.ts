import type { EditorCore } from "@/core";
import { TracksSnapshotCommand } from "@/commands/timeline";
import { buildSubtitleTextElement } from "@/subtitles/build-subtitle-text-element";
import { buildDefaultParamValues, getBuiltInElementParams } from "@/params/registry";
import { generateUUID } from "@/utils/id";
import { mediaTimeFromSeconds } from "@/wasm";
import type {
	AudioTrack,
	SceneTracks,
	TextElement,
	TextTrack,
	UploadAudioElement,
	VideoTrack,
} from "@/timeline";
import type { DubSettings, Segment } from "@/dub/types";

// Tracks we own — matched by name so re-apply REPLACES instead of stacking.
const DUB_AUDIO_TRACK_NAME = "配音 · 中文";
const DUB_SUBTITLE_TRACK_NAME = "字幕 · 中文";

const WAV_SAMPLE_RATE = 44100;

/**
 * A silent mono PCM16 WAV File whose length is `seconds`. The dubbing audio is
 * a placeholder until real TTS (v3); its source length MUST equal the line's
 * estimated original (TTS) duration so that retime rate = original/slot is
 * real — otherwise variable-speed and overflow never trigger.
 */
function makeSilentWavFile({
	seconds,
	name,
}: {
	seconds: number;
	name: string;
}): File {
	const numSamples = Math.max(1, Math.floor(seconds * WAV_SAMPLE_RATE));
	const dataSize = numSamples * 2;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);
	const writeStr = (off: number, s: string) => {
		for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
	};
	writeStr(0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeStr(8, "WAVE");
	writeStr(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, WAV_SAMPLE_RATE, true);
	view.setUint32(28, WAV_SAMPLE_RATE * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeStr(36, "data");
	view.setUint32(40, dataSize, true);
	return new File([buffer], name, { type: "audio/wav" });
}

/** Map the原声处理 setting onto the source video track (both mute + background). */
function applyOriginalAudio({
	main,
	settings,
}: {
	main: VideoTrack;
	settings: DubSettings;
}): VideoTrack {
	if (settings.originalAudio === "mute") {
		return { ...main, muted: true };
	}
	// background: keep audible but duck the volume on every source element.
	return {
		...main,
		muted: false,
		elements: main.elements.map((el) => ({
			...el,
			params: { ...el.params, volume: settings.backgroundVolume },
		})),
	} as VideoTrack;
}

export async function applyDubToTimeline({
	editor,
	segments,
	settings,
}: {
	editor: EditorCore;
	segments: Segment[];
	settings: DubSettings;
}): Promise<void> {
	const project = editor.project.getActive();
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!project || !scene) return;
	const projectId = project.metadata.id;
	const canvasSize = project.settings.canvasSize ?? { width: 1920, height: 1080 };

	const audioParams = buildDefaultParamValues(
		getBuiltInElementParams({ type: "audio" }),
	);

	// 1. Register a placeholder (silent, original-duration) audio asset per line
	//    and build the dub AudioElements. startTime = scheduled start (no ripple);
	//    duration = fittedDuration so overflow naturally overlaps the next line.
	const dubElements: UploadAudioElement[] = [];
	for (const seg of segments) {
		const file = makeSilentWavFile({
			seconds: seg.timing.originalDuration,
			name: `dub-${seg.id}.wav`,
		});
		const asset = await editor.media.addMediaAsset({
			projectId,
			asset: {
				file,
				name: `配音 ${seg.index + 1}`,
				type: "audio",
				duration: seg.timing.originalDuration,
				hasAudio: true,
				ephemeral: true,
			},
		});
		if (!asset) continue;
		dubElements.push({
			id: generateUUID(),
			type: "audio",
			sourceType: "upload",
			mediaId: asset.id,
			name: `配音 ${seg.index + 1}`,
			startTime: mediaTimeFromSeconds({ seconds: seg.start }),
			duration: mediaTimeFromSeconds({ seconds: seg.timing.fittedDuration }),
			trimStart: mediaTimeFromSeconds({ seconds: 0 }),
			trimEnd: mediaTimeFromSeconds({ seconds: 0 }),
			params: { ...audioParams },
			retime: {
				rate: seg.timing.appliedSpeedup,
				maintainPitch: settings.maintainPitch,
			},
		});
	}

	// 2. Build the `after` snapshot. Idempotent: drop any prior dub-owned tracks
	//    first, then add fresh ones — clicking apply twice never duplicates.
	const before = scene.tracks;

	const dubAudioTrack: AudioTrack = {
		id: generateUUID(),
		name: DUB_AUDIO_TRACK_NAME,
		type: "audio",
		muted: false,
		elements: dubElements,
	};

	const existingAudio = before.audio
		.filter((t) => t.name !== DUB_AUDIO_TRACK_NAME)
		.map((t) => ({ ...t, muted: settings.originalAudio === "mute" }));
	const nextAudio: AudioTrack[] = [...existingAudio, dubAudioTrack];

	let nextOverlay = before.overlay.filter(
		(t) => !(t.type === "text" && t.name === DUB_SUBTITLE_TRACK_NAME),
	);
	if (settings.subtitles) {
		const subtitleElements: TextElement[] = segments.map((seg, i) => ({
			...buildSubtitleTextElement({
				index: i,
				caption: {
					text: seg.translated,
					startTime: seg.start,
					duration: seg.end - seg.start,
				},
				canvasSize,
			}),
			id: generateUUID(),
		}));
		const subtitleTrack: TextTrack = {
			id: generateUUID(),
			name: DUB_SUBTITLE_TRACK_NAME,
			type: "text",
			hidden: false,
			elements: subtitleElements,
		};
		nextOverlay = [...nextOverlay, subtitleTrack];
	}

	const after: SceneTracks = {
		overlay: nextOverlay,
		main: applyOriginalAudio({ main: before.main, settings }),
		audio: nextAudio,
	};

	// 3. One undoable operation — a single snapshot command (not 18 inserts).
	editor.command.execute({
		command: new TracksSnapshotCommand({ before, after }),
	});
}

export { DUB_AUDIO_TRACK_NAME, DUB_SUBTITLE_TRACK_NAME };
