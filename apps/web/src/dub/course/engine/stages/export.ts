// Stage: export — render a lesson project to mp4 WITHOUT loading it into the
// live editor. Mirrors RendererManager.exportProject's pipeline but takes all
// inputs as data: load the project + its stored TTS assets from storage,
// inject the zero-copy source video (File from the lesson's handle) as an
// in-memory asset, then buildScene → SceneExporter.
//
// Memory note: SceneExporter buffers the full encoded mp4 (mediabunny
// BufferTarget). The caller must write + drop the buffer immediately; very
// long lessons are bounded by browser heap (documented limitation).

import { storageService } from "@/services/storage/service";
import { buildScene } from "@/services/renderer/scene-builder";
import { SceneExporter } from "@/services/renderer/scene-exporter";
import { initializeGpuRenderer } from "@/services/renderer/gpu-renderer";
import { createTimelineAudioBuffer } from "@/media/audio";
import { calculateTotalDuration } from "@/timeline";
import type { MediaAsset } from "@/media/types";
import type { StepReport } from "@/dub/course/engine/types";
import type { LessonMeta } from "@/dub/course/engine/types";
import type { ExportFormat, ExportQuality } from "@/export";

export async function renderLessonHeadless({
	projectId,
	videoMediaId,
	videoFile,
	meta,
	format = "mp4",
	quality = "high",
	onStep,
}: {
	projectId: string;
	videoMediaId: string;
	videoFile: File;
	meta: LessonMeta;
	format?: ExportFormat;
	quality?: ExportQuality;
	onStep?: (args: StepReport) => void;
}): Promise<ArrayBuffer> {
	// the editor page initializes the wasm GPU context on mount — headless
	// export (course page, no editor) must do it itself or the render nodes
	// throw "GPU context not initialized". Idempotent; failure = degraded mode.
	await initializeGpuRenderer();

	const loaded = await storageService.loadProject({ id: projectId });
	if (!loaded) throw new Error("项目不存在，请重新生成");
	const project = loaded.project;
	const scene =
		project.scenes.find((s) => s.id === project.currentSceneId) ??
		project.scenes[0];
	if (!scene) throw new Error("项目没有场景");
	const tracks = scene.tracks;

	// media = stored TTS clips + the zero-copy source video injected in memory.
	// `url` must be truthy or scene-builder skips the VideoNode entirely
	// (scene-builder.ts:64) and the export renders BLACK video.
	const stored = await storageService.loadAllMediaAssets({ projectId });
	const videoUrl = URL.createObjectURL(videoFile);
	const videoAsset: MediaAsset = {
		id: videoMediaId,
		name: videoFile.name,
		type: "video",
		file: videoFile,
		url: videoUrl,
		duration: meta.duration,
		width: meta.width,
		height: meta.height,
		fps: meta.fps,
		hasAudio: meta.hasAudio,
	};
	const mediaAssets = [...stored, videoAsset];

	const duration = calculateTotalDuration({ tracks });
	if (duration === 0) throw new Error("项目为空，无法导出");

	onStep?.({ step: "混音…", pct: 5 });
	const audioBuffer = await createTimelineAudioBuffer({
		tracks,
		mediaAssets,
		duration,
	});

	const canvasSize = project.settings.canvasSize;
	const rootNode = buildScene({
		tracks,
		mediaAssets,
		duration,
		canvasSize,
		background: project.settings.background,
	});

	const exporter = new SceneExporter({
		width: canvasSize.width,
		height: canvasSize.height,
		fps: project.settings.fps,
		format,
		quality,
		shouldIncludeAudio: true,
		audioBuffer: audioBuffer || undefined,
	});
	exporter.on("progress", (progress) => {
		onStep?.({ step: "渲染导出…", pct: 5 + Math.round(progress * 95) });
	});

	try {
		const buffer = await exporter.export({ rootNode });
		if (!buffer) throw new Error("导出渲染失败");
		return buffer;
	} finally {
		URL.revokeObjectURL(videoUrl);
	}
}
