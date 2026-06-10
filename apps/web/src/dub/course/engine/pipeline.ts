// runLesson — one lesson through every stage, each stage gated by its
// semaphore so lessons overlap across stages (A exporting while B in TTS
// while C transcribing). Entirely headless: the live editor is never touched.

import { Semaphore } from "@/dub/course/engine/semaphore";
import { prepareLesson } from "@/dub/course/engine/stages/prepare";
import { transcribeLesson } from "@/dub/course/engine/stages/transcribe";
import { synthesizeLesson } from "@/dub/course/engine/stages/synthesize";
import { assembleLesson } from "@/dub/course/engine/stages/assemble";
import { renderLessonHeadless } from "@/dub/course/engine/stages/export";
import { segmentsFromCues, applyTranslationMap } from "@/dub/course/segments";
import { translateSegments } from "@/dub/translate";
import { hasTranslateKey, type DubCredentials } from "@/dub/credentials";
import type { DubSettings, Segment } from "@/dub/types";
import type { CourseLesson } from "@/dub/course/types";
import type { StepReport, SynthesizedClip } from "@/dub/course/engine/types";

export interface StageSemaphores {
	inflight: Semaphore;
	prepare: Semaphore;
	asr: Semaphore;
	network: Semaphore;
	assemble: Semaphore;
	export: Semaphore;
}

export interface LessonOutcome {
	projectId: string;
	videoMediaId: string;
	segCount: number;
	spedCount: number;
	overflowCount: number;
	exportedBuffer: ArrayBuffer | null;
	outputName: string;
}

export interface PipelineHooks {
	/** stage progress for the UI; stage is a stable key */
	onProgress: (args: { stage: string; report: StepReport }) => void;
	/** returns false when the lesson disappeared / run was stopped */
	stillWanted: () => boolean;
	/** resolves when not paused — stage entries await this */
	gate: () => Promise<void>;
	signal: AbortSignal;
}

function flagCounts({
	segments,
	clips,
}: {
	segments: Segment[];
	clips: SynthesizedClip[];
}): { spedCount: number; overflowCount: number } {
	const target = new Map(segments.map((s) => [s.id, s.timing.targetDuration]));
	let spedCount = 0;
	let overflowCount = 0;
	for (const c of clips) {
		// perceived speed = native TTS ratio × mechanical retime
		if (c.totalSpeedup >= 1.2) spedCount++;
		const slot = target.get(c.segId) ?? 0;
		if (c.fitted > slot + 0.05) overflowCount++;
	}
	return { spedCount, overflowCount };
}

export async function runLesson({
	lesson,
	videoHandle,
	subtitleHandle,
	sems,
	settings,
	creds,
	autoExport,
	hooks,
}: {
	lesson: CourseLesson;
	videoHandle: FileSystemFileHandle;
	subtitleHandle: FileSystemFileHandle | null;
	sems: StageSemaphores;
	settings: DubSettings;
	creds: DubCredentials;
	autoExport: boolean;
	hooks: PipelineHooks;
}): Promise<LessonOutcome> {
	return sems.inflight.withPermit(async () => {
		const step =
			(stage: string) =>
			(report: StepReport): void =>
				hooks.onProgress({ stage, report });

		// ---- prepare ----
		await hooks.gate();
		if (!hooks.stillWanted()) throw new Error("已停止");
		const prep = await sems.prepare.withPermit(
			() =>
				prepareLesson({
					videoHandle,
					subtitleHandle,
					subtitleLang: lesson.subtitleLang ?? null,
				}),
			hooks.signal,
		);

		// ---- segments: subtitle fast-path or ASR ----
		await hooks.gate();
		if (!hooks.stillWanted()) throw new Error("已停止");
		let segments: Segment[];
		if (prep.subtitle) {
			segments = segmentsFromCues({ cues: prep.subtitle.cues });
			if (prep.subtitle.lang === "zh") {
				// ready translation — use directly, no DeepSeek
				const map = new Map(segments.map((s) => [s.id, s.source]));
				segments = applyTranslationMap({
					segments,
					map,
					maxSpeedup: settings.maxSpeedup,
				});
			}
		} else {
			segments = await sems.asr.withPermit(
				() =>
					transcribeLesson({
						videoFile: prep.videoFile,
						meta: prep.meta,
						provider: settings.transcribeProvider,
						modelId: settings.transcribeModel,
						creds,
						onStep: step("转写"),
					}),
				hooks.signal,
			);
		}
		if (segments.length === 0) {
			throw new Error("无字幕且未识别到语音");
		}

		// ---- translate (untranslated lines only) + TTS, network-bound ----
		await hooks.gate();
		if (!hooks.stillWanted()) throw new Error("已停止");
		const clips = await sems.network.withPermit(async () => {
			if (segments.some((s) => !s.translated.trim())) {
				if (!hasTranslateKey(creds)) {
					throw new Error("缺少 DeepSeek Key，无法翻译该课");
				}
				const map = await translateSegments({
					segments,
					creds,
					onStep: step("翻译"),
				});
				segments = applyTranslationMap({
					segments,
					map,
					maxSpeedup: settings.maxSpeedup,
				});
			}
			return synthesizeLesson({
				segments,
				settings,
				creds,
				onStep: step("配音"),
				signal: hooks.signal,
			});
		}, hooks.signal);

		// ---- assemble: plain-data project, saved to storage ----
		await hooks.gate();
		if (!hooks.stillWanted()) throw new Error("已停止");
		const { projectId, videoMediaId } = await sems.assemble.withPermit(
			() =>
				assembleLesson({
					title: lesson.title,
					meta: prep.meta,
					segments,
					clips,
					settings,
				}),
			hooks.signal,
		);

		// ---- optional export, encoder-bound ----
		let exportedBuffer: ArrayBuffer | null = null;
		if (autoExport) {
			await hooks.gate();
			if (hooks.stillWanted()) {
				exportedBuffer = await sems.export.withPermit(
					() =>
						renderLessonHeadless({
							projectId,
							videoMediaId,
							videoFile: prep.videoFile,
							meta: prep.meta,
							onStep: step("导出"),
						}),
					hooks.signal,
				);
			}
		}

		const { spedCount, overflowCount } = flagCounts({ segments, clips });
		return {
			projectId,
			videoMediaId,
			segCount: segments.length,
			spedCount,
			overflowCount,
			exportedBuffer,
			outputName: `${lesson.stem}_zh.mp4`,
		};
	}, hooks.signal);
}
