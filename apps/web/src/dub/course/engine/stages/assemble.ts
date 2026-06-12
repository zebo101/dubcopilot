// Stage: assemble — build the lesson's editor project as PLAIN DATA and save
// it via storageService, never touching the live editor (the old runner's
// loadProject hijack destroyed the user's open session — review CRIT-3).
// Zero-copy: the source video is referenced by mediaId only; its bytes stay on
// disk. TTS clips (a few MB/lesson) ARE persisted so review works instantly.

import { storageService } from "@/services/storage/service";
import { CURRENT_PROJECT_VERSION } from "@/services/storage/migrations";
import { buildDefaultScene, getProjectDurationFromScenes } from "@/timeline/scenes";
import { buildSubtitleTextElement } from "@/subtitles/build-subtitle-text-element";
import {
	buildDefaultParamValues,
	getBuiltInElementParams,
} from "@/params/registry";
import { DEFAULT_BACKGROUND_COLOR } from "@/background/color";
import { DEFAULT_CANVAS_SIZE } from "@/canvas/sizes";
import { DEFAULT_FPS } from "@/fps/defaults";
import { floatToFrameRate } from "@/fps/utils";
import { generateUUID } from "@/utils/id";
import { mediaTimeFromSeconds } from "@/wasm";
import { applyOriginalAudio } from "@/dub/original-audio";
import { saveDubSession } from "@/dub/session";
import { DUB_SUBTITLE_STYLE } from "@/dub/subtitle-style";
import { splitCaption } from "@/dub/subtitle-split";
import { languageByCode } from "@/dub/languages";
import type {
	AudioTrack,
	TextElement,
	TextTrack,
	UploadAudioElement,
} from "@/timeline";
import type { TProject } from "@/project/types";
import type { DubSettings, Segment } from "@/dub/types";
import type {
	LessonMeta,
	SynthesizedClip,
} from "@/dub/course/engine/types";

// Track names carry the target language ("配音 · 日本語"). The adapter's
// idempotent replace matches by PREFIX so switching the target language
// between two applies replaces the old-language tracks instead of stacking.
export const DUB_AUDIO_TRACK_PREFIX = "配音 ·";
export const DUB_SUBTITLE_TRACK_PREFIX = "字幕 ·";

export function dubAudioTrackName({ label }: { label: string }): string {
	return `${DUB_AUDIO_TRACK_PREFIX} ${label}`;
}

export function dubSubtitleTrackName({ label }: { label: string }): string {
	return `${DUB_SUBTITLE_TRACK_PREFIX} ${label}`;
}

export async function assembleLesson({
	title,
	meta,
	segments,
	clips,
	settings,
	folder,
}: {
	title: string;
	meta: LessonMeta;
	segments: Segment[];
	clips: SynthesizedClip[];
	settings: DubSettings;
	/** 项目文件夹（课程名）— 批量产物在全部项目页自动归类 */
	folder?: string;
}): Promise<{ projectId: string; videoMediaId: string }> {
	const projectId = generateUUID();
	const videoMediaId = generateUUID();
	const langLabel = languageByCode(settings.targetLang).label;

	// --- main track: the source video, zero-copy (mediaId reference only) ---
	const scene = buildDefaultScene({ name: "Main scene", isMain: true });
	scene.tracks.main.elements.push({
		id: generateUUID(),
		type: "video",
		mediaId: videoMediaId,
		name: title,
		startTime: mediaTimeFromSeconds({ seconds: 0 }),
		duration: mediaTimeFromSeconds({ seconds: meta.duration }),
		trimStart: mediaTimeFromSeconds({ seconds: 0 }),
		trimEnd: mediaTimeFromSeconds({ seconds: 0 }),
		params: buildDefaultParamValues(getBuiltInElementParams({ type: "video" })),
	});
	scene.tracks.main = applyOriginalAudio({
		track: scene.tracks.main,
		settings,
	});

	// --- dub audio track: persist each TTS clip, then reference it ---
	const audioParams = buildDefaultParamValues(
		getBuiltInElementParams({ type: "audio" }),
	);
	const audioElements: UploadAudioElement[] = [];
	for (let i = 0; i < clips.length; i++) {
		const clip = clips[i];
		const assetId = generateUUID();
		await storageService.saveMediaAsset({
			projectId,
			mediaAsset: {
				id: assetId,
				name: `配音 ${i + 1}`,
				type: "audio",
				file: new File([clip.bytes.slice(0)], `dub-unit-${i}.mp3`, {
					type: "audio/mpeg",
				}),
				duration: clip.realDuration,
				hasAudio: true,
				ephemeral: true,
			},
		});
		audioElements.push({
			id: generateUUID(),
			type: "audio",
			sourceType: "upload",
			mediaId: assetId,
			name: `配音 ${i + 1}`,
			startTime: mediaTimeFromSeconds({ seconds: clip.start }),
			duration: mediaTimeFromSeconds({ seconds: clip.fitted }),
			trimStart: mediaTimeFromSeconds({ seconds: 0 }),
			trimEnd: mediaTimeFromSeconds({ seconds: 0 }),
			params: { ...audioParams },
			retime: { rate: clip.rate, maintainPitch: settings.maintainPitch },
		});
	}
	const dubTrack: AudioTrack = {
		id: generateUUID(),
		name: dubAudioTrackName({ label: langLabel }),
		type: "audio",
		muted: false,
		elements: audioElements,
	};
	scene.tracks.audio = [dubTrack];

	// --- subtitle track: per-SENTENCE granularity, independent of audio units ---
	if (settings.subtitles) {
		const canvasSize = { width: meta.width, height: meta.height };
		// long merged segments become several short sequential captions tiling
		// the same slot — one 100-char caption was a wall of text on screen
		const cues = segments
			.filter((seg) => seg.translated.trim().length > 0)
			.flatMap((seg) =>
				splitCaption({
					text: seg.translated,
					start: seg.start,
					// chunks tile the actual talk time (matching the TTS
					// reading progress); only the final chunk lingers ≤1s
					slot: seg.timing.targetDuration,
					speech: Math.max(
						seg.timing.fittedDuration,
						seg.end - seg.start,
					),
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
		scene.tracks.overlay = [subtitleTrack];
	}

	// --- project shell, saved straight to storage ---
	const project: TProject = {
		metadata: {
			id: projectId,
			name: `${title} · ${langLabel}配音`,
			folder,
			duration: getProjectDurationFromScenes({ scenes: [scene] }),
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		scenes: [scene],
		currentSceneId: scene.id,
		settings: {
			fps: floatToFrameRate(meta.fps) ?? DEFAULT_FPS,
			canvasSize:
				meta.width > 0 && meta.height > 0
					? { width: meta.width, height: meta.height }
					: DEFAULT_CANVAS_SIZE,
			canvasSizeMode: "custom",
			lastCustomCanvasSize: null,
			originalCanvasSize: null,
			background: { type: "color", color: DEFAULT_BACKGROUND_COLOR },
		},
		version: CURRENT_PROJECT_VERSION,
	};
	await storageService.saveProject({ project });

	// persist the reviewed lines so opening this project lands in 逐句编辑台
	await saveDubSession({ projectId, segments, settings });

	return { projectId, videoMediaId };
}
