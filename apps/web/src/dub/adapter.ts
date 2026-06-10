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
import { getSharedAudioContext } from "@/dub/audio-context";
import type { DubCredentials } from "@/dub/credentials";
import { hasTtsKey } from "@/dub/credentials";
import { synthesizeSegment } from "@/dub/tts";
import { autoFitSpeed } from "@/dub/timing";
import type { DubSettings, Segment } from "@/dub/types";

// Tracks we own — matched by name so re-apply REPLACES instead of stacking.
const DUB_AUDIO_TRACK_NAME = "配音 · 中文";
const DUB_SUBTITLE_TRACK_NAME = "字幕 · 中文";

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

interface BuiltDubAudio {
	segId: string;
	element: UploadAudioElement;
}

/**
 * Apply the dubbing result to the real timeline:
 * - real豆包 TTS audio per line (no mock), placed at its scheduled start (no
 *   ripple); element duration = realDuration / rate so overflow overlaps;
 * - retime rate from the REAL synthesized audio vs its slot (maintainPitch);
 * - 中文字幕 track; original audio muted or ducked;
 * - one undoable snapshot; idempotent (named tracks replaced, not stacked).
 */
export async function applyDubToTimeline({
	editor,
	segments,
	settings,
	creds,
	onStep,
}: {
	editor: EditorCore;
	segments: Segment[];
	settings: DubSettings;
	creds: DubCredentials;
	onStep?: (args: { step: string; pct: number }) => void;
}): Promise<void> {
	const project = editor.project.getActive();
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!project || !scene) return;
	if (!hasTtsKey(creds)) {
		throw new Error("请先在「语音 / 翻译 凭据」填写豆包 TTS API Key");
	}
	const projectId = project.metadata.id;
	const canvasSize = project.settings.canvasSize ?? { width: 1920, height: 1080 };

	const audioParams = buildDefaultParamValues(
		getBuiltInElementParams({ type: "audio" }),
	);

	const voiceType = settings.voiceId;
	const dubbable = segments.filter((s) => s.translated.trim().length > 0);
	if (dubbable.length === 0) {
		throw new Error("没有可配音的句子（请先翻译或填写译文）");
	}

	// Decode TTS mp3 → real duration (drives retime). Shared module-level
	// context — never per-call (browsers cap live AudioContexts at ~6).
	const audioCtx = getSharedAudioContext();

	// 1. Synthesize real audio per line, register as a media asset, build element.
	const built: BuiltDubAudio[] = [];
	for (let i = 0; i < dubbable.length; i++) {
		const seg = dubbable[i];
		onStep?.({
			step: `合成配音 ${i + 1}/${dubbable.length}`,
			pct: Math.round((i / dubbable.length) * 100),
		});

		const bytes = await synthesizeSegment({
			text: seg.translated,
			voiceType,
			creds,
		});
		const file = new File([bytes.slice(0)], `dub-${seg.id}.mp3`, {
			type: "audio/mpeg",
		});

		let realDuration = seg.timing.targetDuration;
		try {
			const decoded = await audioCtx.decodeAudioData(bytes.slice(0));
			if (decoded.duration > 0) realDuration = decoded.duration;
		} catch {
			// keep the slot length as a fallback if decode fails
		}

		const target = seg.timing.targetDuration;
		const rate =
			seg.speedMode === "manual"
				? seg.timing.appliedSpeedup
				: autoFitSpeed({
						originalDuration: realDuration,
						targetDuration: target,
						maxSpeedup: settings.maxSpeedup,
					});
		const fitted = rate > 0 ? realDuration / rate : realDuration;

		const asset = await editor.media.addMediaAsset({
			projectId,
			asset: {
				file,
				name: `配音 ${seg.index + 1}`,
				type: "audio",
				duration: realDuration,
				hasAudio: true,
				ephemeral: true,
			},
		});
		if (!asset) continue;

		built.push({
			segId: seg.id,
			element: {
				id: generateUUID(),
				type: "audio",
				sourceType: "upload",
				mediaId: asset.id,
				name: `配音 ${seg.index + 1}`,
				startTime: mediaTimeFromSeconds({ seconds: seg.start }),
				duration: mediaTimeFromSeconds({ seconds: fitted }),
				trimStart: mediaTimeFromSeconds({ seconds: 0 }),
				trimEnd: mediaTimeFromSeconds({ seconds: 0 }),
				params: { ...audioParams },
				retime: {
					rate: Number(rate.toFixed(3)),
					maintainPitch: settings.maintainPitch,
				},
			},
		});
	}
	onStep?.({ step: "写入时间轴…", pct: 100 });

	// 2. Build the `after` snapshot. Idempotent: drop any prior dub-owned tracks
	//    first, then add fresh ones — clicking apply twice never duplicates.
	const before = scene.tracks;

	const dubAudioTrack: AudioTrack = {
		id: generateUUID(),
		name: DUB_AUDIO_TRACK_NAME,
		type: "audio",
		muted: false,
		elements: built.map((b) => b.element),
	};

	const existingAudio = before.audio
		.filter((t) => t.name !== DUB_AUDIO_TRACK_NAME)
		.map((t) => ({ ...t, muted: settings.originalAudio === "mute" }));
	const nextAudio: AudioTrack[] = [...existingAudio, dubAudioTrack];

	let nextOverlay = before.overlay.filter(
		(t) => !(t.type === "text" && t.name === DUB_SUBTITLE_TRACK_NAME),
	);
	if (settings.subtitles) {
		const subtitleElements: TextElement[] = dubbable.map((seg, i) => ({
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

	// 3. One undoable operation — a single snapshot command (not N inserts).
	editor.command.execute({
		command: new TracksSnapshotCommand({ before, after }),
	});
}

export { DUB_AUDIO_TRACK_NAME, DUB_SUBTITLE_TRACK_NAME };
