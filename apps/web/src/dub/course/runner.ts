import type { EditorCore } from "@/core";
import { useCourseStore } from "@/dub/course/store";
import { useDubStore } from "@/dub/store";
import { useDubCredentials } from "@/dub/credentials";
import { processLesson } from "@/dub/course/lesson-pipeline";

/**
 * Sequentially process the course's queued lessons (or an explicit subset).
 * One lesson at a time — browser Whisper/TTS/render are heavy and don't
 * parallelize well. Progress + status persist per lesson, so closing the page
 * and reopening resumes from where it stopped; "stop" is cooperative (we check
 * batchRunning between lessons).
 */
export async function runCourseBatch({
	editor,
	onlyIds,
}: {
	editor: EditorCore;
	onlyIds?: string[];
}): Promise<void> {
	const store = useCourseStore.getState();
	const course = store.course;
	if (!course || store.batchRunning) return;

	store.setBatchRunning({ running: true });
	const settings = useDubStore.getState().settings;
	const creds = useDubCredentials.getState();

	try {
		const targets = course.lessons.filter((l) =>
			onlyIds ? onlyIds.includes(l.id) : l.status === "queued",
		);

		for (const lesson of targets) {
			if (!useCourseStore.getState().batchRunning) break; // user stopped

			const { videoHandles, subtitleHandles, updateLesson } =
				useCourseStore.getState();
			const videoHandle = videoHandles[lesson.id];
			if (!videoHandle) {
				updateLesson({
					id: lesson.id,
					patch: {
						status: "failed",
						progress: 0,
						failReason: "找不到视频文件，请重新导入并授权目录",
					},
				});
				continue;
			}

			updateLesson({
				id: lesson.id,
				patch: { status: "processing", progress: 0, failReason: null },
			});

			try {
				const videoFile = await videoHandle.getFile();
				const subtitleHandle = subtitleHandles[lesson.id];
				const subtitleText = subtitleHandle
					? await (await subtitleHandle.getFile()).text()
					: null;

				const result = await processLesson({
					editor,
					title: lesson.title,
					videoFile,
					subtitleText,
					transcribeModel: settings.transcribeModel,
					settings,
					creds,
					onProgress: ({ pct }) =>
						useCourseStore
							.getState()
							.updateLesson({ id: lesson.id, patch: { progress: pct } }),
				});

				const flagged = result.spedCount > 0 || result.overflowCount > 0;
				updateLesson({
					id: lesson.id,
					patch: {
						status: flagged ? "review" : "done",
						progress: 100,
						projectId: result.projectId,
						segCount: result.segCount,
						spedCount: result.spedCount,
						overflowCount: result.overflowCount,
						failReason: null,
					},
				});
			} catch (error) {
				useCourseStore.getState().updateLesson({
					id: lesson.id,
					patch: {
						status: "failed",
						progress: 0,
						failReason: error instanceof Error ? error.message : "处理失败",
					},
				});
			}
		}
	} finally {
		useCourseStore.getState().setBatchRunning({ running: false });
	}
}
