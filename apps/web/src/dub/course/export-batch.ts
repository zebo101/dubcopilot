import type { EditorCore } from "@/core";
import { useCourseStore } from "@/dub/course/store";
import { StoreZipWriter } from "@/dub/course/zip";
import type { CourseLesson } from "@/dub/course/types";

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
			(l.status === "done" || l.status === "review") &&
			(onlyIds ? onlyIds.includes(l.id) : true),
	);
}

/** Render one lesson's project to an mp4 buffer via the real export pipeline. */
async function renderLesson({
	editor,
	projectId,
}: {
	editor: EditorCore;
	projectId: string;
}): Promise<ArrayBuffer> {
	await editor.project.loadProject({ id: projectId });
	const active = editor.project.getActive();
	const result = await editor.project.export({
		options: {
			format: "mp4",
			quality: "high",
			fps: active.settings.fps,
			includeAudio: true,
		},
	});
	if (!result.success || !result.buffer) {
		throw new Error(result.error ?? "导出失败");
	}
	return result.buffer;
}

/**
 * Export each finished lesson to `<courseDir>/_localized/<stem>_zh.mp4`.
 * Streams each render straight to disk — no size ceiling, no memory blowup.
 * The scalable choice for a full course.
 */
export async function exportCourseToFolder({
	editor,
	onlyIds,
	onProgress,
}: {
	editor: EditorCore;
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
		onProgress?.({ done: i, total: targets.length, current: lesson.title });
		const buffer = await renderLesson({ editor, projectId: lesson.projectId! });
		const fileHandle = await outDir.getFileHandle(outputName({ lesson }), {
			create: true,
		});
		const writable = await fileHandle.createWritable();
		await writable.write(buffer);
		await writable.close();
	}

	onProgress?.({ done: targets.length, total: targets.length, current: "" });
	return { written: targets.length };
}

/**
 * Export finished lessons into a single ZIP, streamed to a user-chosen file.
 * STORE method (mp4 already compressed). Best for "export selected" — for a
 * multi-GB full course prefer exportCourseToFolder (no 4 GB zip limit).
 */
export async function exportCourseToZip({
	editor,
	onlyIds,
	onProgress,
}: {
	editor: EditorCore;
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
		onProgress?.({ done: i, total: targets.length, current: lesson.title });
		const buffer = await renderLesson({ editor, projectId: lesson.projectId! });
		await zip.addFile({
			name: outputName({ lesson }),
			data: new Uint8Array(buffer),
		});
	}
	await zip.finish();

	onProgress?.({ done: targets.length, total: targets.length, current: "" });
	return { written: targets.length };
}
