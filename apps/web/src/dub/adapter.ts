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
import type { DubCredentials } from "@/dub/credentials";
import { hasTtsKey } from "@/dub/credentials";
import { synthesizeLesson } from "@/dub/course/engine/stages/synthesize";
import { applyOriginalAudio } from "@/dub/original-audio";
import { DUB_SUBTITLE_STYLE } from "@/dub/subtitle-style";
import { splitCaption } from "@/dub/subtitle-split";
import type { DubSettings, Segment } from "@/dub/types";

// Tracks we own — matched by PREFIX so re-apply REPLACES instead of stacking,
// even when the target language changed between two applies. Single source of
// truth lives in the engine's assemble stage.
import {
	DUB_AUDIO_TRACK_PREFIX,
	DUB_SUBTITLE_TRACK_PREFIX,
	dubAudioTrackName,
	dubSubtitleTrackName,
} from "@/dub/course/engine/stages/assemble";
import { languageByCode } from "@/dub/languages";

interface BuiltDubAudio {
	segId: string;
	element: UploadAudioElement;
}

/** Real timing per line, returned so the review store can sync to the truth. */
export interface AppliedTiming {
	rate: number;
	fitted: number;
	realDuration: number;
}

/**
 * Apply the dubbing result to the real timeline:
 * - real豆包 TTS audio per line (8-way concurrent synth via the shared engine
 *   stage), placed at its scheduled start (no ripple); element duration =
 *   realDuration / rate so overflow overlaps;
 * - retime rate from the REAL synthesized audio vs its slot (maintainPitch);
 * - 中文字幕 track; original audio muted or ducked;
 * - one undoable snapshot; idempotent (named tracks replaced, not stacked).
 * Returns the real per-line timing so the review UI can replace its estimates.
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
}): Promise<Map<string, AppliedTiming>> {
	const project = editor.project.getActive();
	const scene = editor.scenes.getActiveSceneOrNull();
	if (!project || !scene) return new Map();
	if (!hasTtsKey(creds)) {
		throw new Error("请先在「语音 / 翻译 凭据」填写豆包 TTS API Key");
	}
	const projectId = project.metadata.id;
	const canvasSize = project.settings.canvasSize ?? { width: 1920, height: 1080 };
	const langLabel = languageByCode(settings.targetLang).label;

	const audioParams = buildDefaultParamValues(
		getBuiltInElementParams({ type: "audio" }),
	);

	// 1. Concurrent TTS over packed dub UNITS (one clip per speech run).
	const clips = await synthesizeLesson({ segments, settings, creds, onStep });
	const applied = new Map<string, AppliedTiming>();

	// 2. Register assets + build one element per unit, serially (storage writes).
	const built: BuiltDubAudio[] = [];
	for (let i = 0; i < clips.length; i++) {
		const clip = clips[i];
		const file = new File([clip.bytes.slice(0)], `dub-unit-${i}.mp3`, {
			type: "audio/mpeg",
		});
		const asset = await editor.media.addMediaAsset({
			projectId,
			asset: {
				file,
				name: `配音 ${i + 1}`,
				type: "audio",
				duration: clip.realDuration,
				hasAudio: true,
				ephemeral: true,
			},
		});
		if (!asset) continue;

		// every member line shows its unit's perceived speed in the review UI
		for (const segId of clip.segIds) {
			applied.set(segId, {
				rate: clip.totalSpeedup,
				fitted: clip.fitted,
				realDuration: clip.realDuration,
			});
		}
		built.push({
			segId: clip.segIds[0],
			element: {
				id: generateUUID(),
				type: "audio",
				sourceType: "upload",
				mediaId: asset.id,
				name: `配音 ${i + 1}`,
				startTime: mediaTimeFromSeconds({ seconds: clip.start }),
				duration: mediaTimeFromSeconds({ seconds: clip.fitted }),
				trimStart: mediaTimeFromSeconds({ seconds: 0 }),
				trimEnd: mediaTimeFromSeconds({ seconds: 0 }),
				params: { ...audioParams },
				retime: {
					rate: clip.rate,
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
		name: dubAudioTrackName({ label: langLabel }),
		type: "audio",
		muted: false,
		elements: built.map((b) => b.element),
	};

	const existingAudio = before.audio
		.filter((t) => !t.name?.startsWith(DUB_AUDIO_TRACK_PREFIX))
		.map((t) => ({ ...t, muted: settings.originalAudio === "mute" }));
	const nextAudio: AudioTrack[] = [...existingAudio, dubAudioTrack];

	let nextOverlay = before.overlay.filter(
		(t) => !(t.type === "text" && t.name?.startsWith(DUB_SUBTITLE_TRACK_PREFIX)),
	);
	const dubbable = segments.filter((s) => s.translated.trim().length > 0);
	if (settings.subtitles) {
		// long merged segments become several short sequential captions tiling
		// the same slot — one 100-char caption was a wall of text on screen
		const cues = dubbable.flatMap((seg) =>
			splitCaption({
				text: seg.translated,
				start: seg.start,
				// extended slot: subtitle stays up until just before the next
				// line — continuous reading instead of flashing off in gaps
				duration: seg.timing.targetDuration,
			}),
		);
		const subtitleElements: TextElement[] = cues.map((cue, i) => ({
			...buildSubtitleTextElement({
				index: i,
				caption: {
					text: cue.text,
					startTime: cue.start,
					duration: cue.duration,
					// legibility on any background (white-on-white was unreadable)
					style: DUB_SUBTITLE_STYLE,
				},
				canvasSize,
			}),
			id: generateUUID(),
		}));
		const subtitleTrack: TextTrack = {
			id: generateUUID(),
			name: dubSubtitleTrackName({ label: langLabel }),
			type: "text",
			hidden: false,
			elements: subtitleElements,
		};
		nextOverlay = [...nextOverlay, subtitleTrack];
	}

	const after: SceneTracks = {
		// source video may sit on an overlay track too (Media-panel import) —
		// 原声处理 must reach it, not just the main track
		overlay: nextOverlay.map((t) =>
			t.type === "video" ? applyOriginalAudio({ track: t, settings }) : t,
		),
		main: applyOriginalAudio({ track: before.main, settings }),
		audio: nextAudio,
	};

	// 3. One undoable operation — a single snapshot command (not N inserts).
	editor.command.execute({
		command: new TracksSnapshotCommand({ before, after }),
	});

	return applied;
}

export { DUB_AUDIO_TRACK_PREFIX, DUB_SUBTITLE_TRACK_PREFIX };
