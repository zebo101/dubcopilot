// Batch export — fully headless. Each finished lesson's project is rendered
// via renderLessonHeadless (never loaded into the live editor) and streamed to
// `<courseDir>/_localized/<stem>_zh.mp4` or into a STORE ZIP. One render at a
// time (WebCodecs encoder limit); each buffer is written and dropped before
// the next render starts.

import { readVideoFile } from "@/media/mediabunny";
import { useCourseStore } from "@/dub/course/store";
import { renderLessonHeadless } from "@/dub/course/engine/stages/export";
import { StoreZipWriter } from "@/dub/course/zip";
import type { CourseLesson } from "@/dub/course/types";
import type { LessonMeta } from "@/dub/course/engine/types";

declare global {
	interface Window {
		showSaveFilePicker?: (options?: {
			suggestedName?: string;
			types?: { description?: string; accept: Record<string, string[]> }[];
		}) => Promise<FileSystemFileHandle>;
	}
}

export interface ExportProgress {
	done: number;
	total: number;
	current: string;
	/** render progress of the CURRENT lesson, 0–100 — a lesson takes minutes,
	 * so without this the banner sits frozen and reads as a hang */
	pct: number;
}

function outputName({ lesson }: { lesson: CourseLesson }): string {
	return `${lesson.stem}_zh.mp4`;
}

/** Lessons that have a generated project and finished (done/review). */
function exportableLessons({ onlyIds }: { onlyIds?: string[] }): CourseLesson[] {
	const course = useCourseStore.getState().course;
	if (!course) return [];
	return course.lessons.filter(
		(l) =>
			!!l.projectId &&
			!!l.videoMediaId &&
			(l.status === "done" || l.status === "review") &&
			(onlyIds ? onlyIds.includes(l.id) : true),
	);
}

/** Probe + render one lesson headlessly; returns the encoded mp4. */
async function renderOne({
	lesson,
	onPct,
}: {
	lesson: CourseLesson;
	onPct?: (pct: number) => void;
}): Promise<ArrayBuffer> {
	const { videoHandles } = useCourseStore.getState();
	const handle = videoHandles[lesson.id];
	if (!handle) {
		throw new Error("找不到视频文件，请先恢复文件夹授权");
	}
	const videoFile = await handle.getFile();
	const probe = await readVideoFile({ file: videoFile });
	if (probe.thumbnailUrl) URL.revokeObjectURL(probe.thumbnailUrl);
	const meta: LessonMeta = {
		duration: probe.duration,
		width: probe.width,
		height: probe.height,
		fps: probe.fps,
		hasAudio: probe.hasAudio,
	};
	return renderLessonHeadless({
		projectId: lesson.projectId!,
		videoMediaId: lesson.videoMediaId!,
		videoFile,
		meta,
		onStep: ({ pct }) => onPct?.(pct),
	});
}

function markExported({ lesson }: { lesson: CourseLesson }): void {
	useCourseStore.getState().updateLesson({
		id: lesson.id,
		patch: { outputName: outputName({ lesson }), exportedAt: Date.now() },
	});
}

/**
 * Export each finished lesson to `<courseDir>/_localized/<stem>_zh.mp4`.
 * Streams each render straight to disk — no archive size ceiling.
 */
export async function exportCourseToFolder({
	onlyIds,
	onProgress,
}: {
	onlyIds?: string[];
	onProgress?: (p: ExportProgress) => void;
}): Promise<{ written: number }> {
	const dirHandle = useCourseStore.getState().dirHandle;
	if (!dirHandle) throw new Error("找不到课程目录，请重新导入");
	const targets = exportableLessons({ onlyIds });
	if (targets.length === 0) throw new Error("没有可导出的课时（先生成）");

	const outDir = await dirHandle.getDirectoryHandle("_localized", {
		create: true,
	});

	for (let i = 0; i < targets.length; i++) {
		const lesson = targets[i];
		// exporter progress fires per FRAME — only forward integer pct changes so
		// the store (and the whole lesson table) isn't re-rendered 60×/s
		let lastPct = -1;
		const report = (pct: number) => {
			if (pct === lastPct) return;
			lastPct = pct;
			onProgress?.({ done: i, total: targets.length, current: lesson.title, pct });
		};
		report(0);
		let buffer: ArrayBuffer | null = await renderOne({ lesson, onPct: report });
		const fileHandle = await outDir.getFileHandle(outputName({ lesson }), {
			create: true,
		});
		const writable = await fileHandle.createWritable();
		await writable.write(buffer);
		await writable.close();
		buffer = null; // drop before the next render
		markExported({ lesson });
	}

	onProgress?.({ done: targets.length, total: targets.length, current: "", pct: 100 });
	return { written: targets.length };
}

/**
 * Export finished lessons into a single ZIP, streamed to a user-chosen file.
 * STORE method (mp4 already compressed). ZIP32 — guarded at 4 GB; for a
 * multi-GB full course prefer exportCourseToFolder.
 */
export async function exportCourseToZip({
	onlyIds,
	onProgress,
}: {
	onlyIds?: string[];
	onProgress?: (p: ExportProgress) => void;
}): Promise<{ written: number }> {
	if (!window.showSaveFilePicker) {
		throw new Error(
			"浏览器不支持保存文件，请用 Chrome/Edge，或改用「导出到 _localized 文件夹」",
		);
	}
	const course = useCourseStore.getState().course;
	if (!course) throw new Error("没有课程");
	const targets = exportableLessons({ onlyIds });
	if (targets.length === 0) throw new Error("没有可导出的课时（先生成）");

	const fileHandle = await window.showSaveFilePicker({
		suggestedName: `${course.name}_中文配音.zip`,
		types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }],
	});
	const writable = await fileHandle.createWritable();
	const zip = new StoreZipWriter({
		write: (chunk) => writable.write(chunk as BufferSource),
		close: () => writable.close(),
	});

	for (let i = 0; i < targets.length; i++) {
		const lesson = targets[i];
		let lastPct = -1;
		const report = (pct: number) => {
			if (pct === lastPct) return;
			lastPct = pct;
			onProgress?.({ done: i, total: targets.length, current: lesson.title, pct });
		};
		report(0);
		let buffer: ArrayBuffer | null = await renderOne({ lesson, onPct: report });
		await zip.addFile({
			name: outputName({ lesson }),
			data: new Uint8Array(buffer),
		});
		buffer = null;
		markExported({ lesson });
	}
	await zip.finish();

	onProgress?.({ done: targets.length, total: targets.length, current: "", pct: 100 });
	return { written: targets.length };
}
