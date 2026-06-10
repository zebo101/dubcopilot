// runCourse — the course-level orchestrator. All target lessons enter the
// pipeline concurrently; per-stage semaphores do the throttling, so lessons
// naturally overlap across stages. Stop = abort signal; pause = gate promise.
// The live editor is never touched (old projects are deleted via storage).

import { Semaphore, AbortError } from "@/dub/course/engine/semaphore";
import { runLesson, type StageSemaphores } from "@/dub/course/engine/pipeline";
import { useCourseStore } from "@/dub/course/store";
import { useDubStore } from "@/dub/store";
import { useDubCredentials } from "@/dub/credentials";
import { storageService } from "@/services/storage/service";
import type { StepReport } from "@/dub/course/engine/types";

const STAGE_RANGES: Record<string, [number, number]> = {
	准备: [0, 8],
	转写: [8, 45],
	翻译: [45, 60],
	配音: [60, 82],
	组装: [82, 86],
	导出: [86, 100],
};

function overallPct({ stage, report }: { stage: string; report: StepReport }): number {
	const [lo, hi] = STAGE_RANGES[stage] ?? [0, 100];
	return Math.min(100, lo + Math.round(((hi - lo) * Math.min(report.pct, 100)) / 100));
}

let abortCtrl: AbortController | null = null;

export function stopCourseRun(): void {
	abortCtrl?.abort();
	useCourseStore.getState().setBatchRunning({ running: false });
	useCourseStore.getState().setPaused({ paused: false });
}

/** Resolves while not paused; polls the store gate cheaply when paused. */
async function pauseGate(): Promise<void> {
	while (useCourseStore.getState().paused) {
		await new Promise((r) => setTimeout(r, 300));
	}
}

export async function runCourse({ onlyIds }: { onlyIds?: string[] } = {}): Promise<void> {
	const store = useCourseStore.getState();
	const course = store.course;
	if (!course || store.batchRunning) return;

	const targets = course.lessons.filter((l) =>
		onlyIds ? onlyIds.includes(l.id) : l.status === "queued",
	);
	if (targets.length === 0) return;

	abortCtrl = new AbortController();
	const signal = abortCtrl.signal;
	store.setBatchRunning({ running: true });
	store.setPaused({ paused: false });

	const settings = useDubStore.getState().settings;
	const creds = useDubCredentials.getState();
	const autoExport = useCourseStore.getState().autoExport;

	const sems: StageSemaphores = {
		inflight: new Semaphore(4),
		prepare: new Semaphore(4),
		asr: new Semaphore(1),
		network: new Semaphore(2),
		assemble: new Semaphore(2),
		export: new Semaphore(1),
	};

	// auto-export writes land in <courseDir>/_localized/
	let outDir: FileSystemDirectoryHandle | null = null;
	if (autoExport && store.dirHandle) {
		try {
			outDir = await store.dirHandle.getDirectoryHandle("_localized", {
				create: true,
			});
		} catch {
			outDir = null;
		}
	}

	const processOne = async (lessonId: string): Promise<void> => {
		const s = useCourseStore.getState();
		const lesson = s.course?.lessons.find((l) => l.id === lessonId);
		if (!lesson) return; // removed while queued (IMP-6)
		const videoHandle = s.videoHandles[lessonId];
		if (!videoHandle) {
			s.updateLesson({
				id: lessonId,
				patch: {
					status: "failed",
					progress: 0,
					failReason: "找不到视频文件，请恢复文件夹授权",
				},
			});
			return;
		}

		// re-run: drop the previous project + its stored media (IMP-2 leak)
		if (lesson.projectId) {
			try {
				await storageService.deleteProjectMedia({ projectId: lesson.projectId });
				await storageService.deleteProject({ id: lesson.projectId });
			} catch {
				// stale id — nothing to clean
			}
		}

		s.updateLesson({
			id: lessonId,
			patch: {
				status: "processing",
				progress: 0,
				failReason: null,
				projectId: undefined,
				videoMediaId: undefined,
			},
		});

		try {
			const outcome = await runLesson({
				lesson,
				videoHandle,
				subtitleHandle: s.subtitleHandles[lessonId] ?? null,
				sems,
				settings,
				creds,
				autoExport: autoExport && outDir !== null,
				hooks: {
					signal,
					gate: pauseGate,
					stillWanted: () =>
						!signal.aborted &&
						!!useCourseStore.getState().course?.lessons.some((l) => l.id === lessonId),
					onProgress: ({ stage, report }) =>
						useCourseStore.getState().updateLesson({
							id: lessonId,
							patch: { progress: overallPct({ stage, report }) },
						}),
				},
			});

			// write the auto-export product (serialized by the export semaphore
			// upstream; the write itself is cheap)
			let outputName: string | undefined;
			let exportedAt: number | undefined;
			if (outcome.exportedBuffer && outDir) {
				const fh = await outDir.getFileHandle(outcome.outputName, { create: true });
				const w = await fh.createWritable();
				await w.write(outcome.exportedBuffer);
				await w.close();
				outputName = outcome.outputName;
				exportedAt = Date.now();
			}

			const flagged = outcome.spedCount > 0 || outcome.overflowCount > 0;
			useCourseStore.getState().updateLesson({
				id: lessonId,
				patch: {
					status: flagged ? "review" : "done",
					progress: 100,
					projectId: outcome.projectId,
					videoMediaId: outcome.videoMediaId,
					segCount: outcome.segCount,
					spedCount: outcome.spedCount,
					overflowCount: outcome.overflowCount,
					failReason: null,
					...(outputName ? { outputName, exportedAt } : {}),
				},
			});
		} catch (error) {
			const stopped = error instanceof AbortError || signal.aborted;
			useCourseStore.getState().updateLesson({
				id: lessonId,
				patch: {
					status: stopped ? "queued" : "failed",
					progress: 0,
					failReason: stopped
						? null
						: error instanceof Error
							? error.message
							: "处理失败",
				},
			});
		}
	};

	try {
		await Promise.allSettled(targets.map((l) => processOne(l.id)));
	} finally {
		useCourseStore.getState().setBatchRunning({ running: false });
		useCourseStore.getState().setPaused({ paused: false });
		void useCourseStore.getState().persistNow();
		abortCtrl = null;
	}
}
