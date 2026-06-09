import type { EditorCore } from "@/core";
import { mediaTimeFromSeconds } from "@/wasm";
import { processMediaAssets } from "@/media/processing";
import {
	buildDefaultParamValues,
	getBuiltInElementParams,
} from "@/params/registry";
import { parseSubtitles } from "@/dub/course/subtitles";
import { applyTranslationMap, segmentsFromCues } from "@/dub/course/segments";
import { generateDubSegments } from "@/dub/generate";
import { translateSegments } from "@/dub/translate";
import { applyDubToTimeline } from "@/dub/adapter";
import { isOverflow, isSped } from "@/dub/timing";
import type { DubCredentials } from "@/dub/credentials";
import type { DubSettings, Segment } from "@/dub/types";

export interface LessonResult {
	projectId: string;
	segCount: number;
	spedCount: number;
	overflowCount: number;
}

/**
 * Run the full single-lesson pipeline headlessly against the shared editor:
 * new project ← source video → segments (subtitle fast-path or local ASR) →
 * translate → 豆包 TTS + align → save. Returns counts that drive the triage
 * status (flagged → review). Reuses the exact same dub modules as the
 * single-lesson editor so behaviour is identical.
 */
export async function processLesson({
	editor,
	title,
	videoFile,
	subtitleText,
	subtitleLang,
	transcribeModel,
	settings,
	creds,
	onProgress,
}: {
	editor: EditorCore;
	title: string;
	videoFile: File;
	subtitleText: string | null;
	/** "zh" → cues are a ready translation (skip DeepSeek); else translate. */
	subtitleLang?: "en" | "zh" | null;
	transcribeModel: DubSettings["transcribeModel"];
	settings: DubSettings;
	creds: DubCredentials;
	onProgress?: (args: { step: string; pct: number }) => void;
}): Promise<LessonResult> {
	const step = (s: string, p: number) => onProgress?.({ step: s, pct: p });

	// 1. Fresh project with the source video on the main track.
	step("新建项目…", 4);
	const projectId = await editor.project.createNewProject({
		name: `${title} · 中文配音`,
	});
	await editor.project.loadProject({ id: projectId });

	step("导入视频…", 10);
	const [processed] = await processMediaAssets({ files: [videoFile] });
	if (!processed) throw new Error("视频导入失败（格式不支持？）");
	const asset = await editor.media.addMediaAsset({ projectId, asset: processed });
	if (!asset) throw new Error("视频写入浏览器存储失败（空间不足？）");
	const videoParams = buildDefaultParamValues(
		getBuiltInElementParams({ type: "video" }),
	);
	editor.timeline.insertElement({
		element: {
			type: "video",
			mediaId: asset.id,
			name: title,
			startTime: mediaTimeFromSeconds({ seconds: 0 }),
			duration: mediaTimeFromSeconds({ seconds: asset.duration ?? 0 }),
			trimStart: mediaTimeFromSeconds({ seconds: 0 }),
			trimEnd: mediaTimeFromSeconds({ seconds: 0 }),
			params: videoParams,
		},
		placement: { mode: "auto", trackType: "video" },
	});

	// 2. Segments: subtitle sidecar (fast) or local ASR (slow).
	let segments: Segment[];
	if (subtitleText) {
		step("解析字幕…", 22);
		segments = segmentsFromCues({
			cues: parseSubtitles({ content: subtitleText }),
		});
		// Chinese subtitle = a ready translation → use it directly (fit timing),
		// no DeepSeek call. (source==translated here is fine for display.)
		if (subtitleLang === "zh") {
			const map = new Map(segments.map((s) => [s.id, s.source]));
			segments = applyTranslationMap({
				segments,
				map,
				maxSpeedup: settings.maxSpeedup,
			});
		}
	} else {
		segments = await generateDubSegments({
			editor,
			provider: "local",
			modelId: transcribeModel,
			language: "en",
			creds,
			onStep: ({ step: s, pct }) => step(s, 10 + Math.round(pct * 0.4)),
		});
	}
	if (segments.length === 0) {
		throw new Error("无字幕且未识别到语音，跳过");
	}

	// 3. Translate any still-untranslated lines (English subtitle / ASR path).
	//    Chinese subtitles are already filled above, so this is skipped for them.
	const needsTranslation = segments.some((s) => !s.translated.trim());
	if (needsTranslation && creds.deepseekApiKey.trim()) {
		step("翻译…", 60);
		const map = await translateSegments({ segments, creds });
		segments = applyTranslationMap({
			segments,
			map,
			maxSpeedup: settings.maxSpeedup,
		});
	}

	// 4. Real 豆包 TTS + variable-speed alignment onto the timeline.
	step("合成配音并对齐…", 75);
	await applyDubToTimeline({
		editor,
		segments,
		settings,
		creds,
		onStep: ({ step: s }) => step(s, 90),
	});

	await editor.project.saveCurrentProject();

	const spedCount = segments.filter((s) => isSped({ timing: s.timing })).length;
	const overflowCount = segments.filter((s) =>
		isOverflow({ timing: s.timing }),
	).length;
	return { projectId, segCount: segments.length, spedCount, overflowCount };
}
