// runCourse — the course-level orchestrator. All target lessons enter the
// pipeline concurrently; per-stage semaphores do the throttling, so lessons
// naturally overlap across stages. Stop = abort signal; pause = gate promise.
// The live editor is never touched (old projects are deleted via storage).

import { Semaphore, AbortError } from "@/dub/course/engine/semaphore";
import { resolveExportDir } from "@/dub/course/export-dir";
import { runLesson, type StageSemaphores } from "@/dub/course/engine/pipeline";
import { useCourseStore } from "@/dub/course/store";
import { useDubStore } from "@/dub/store";
import { useDubCredentials } from "@/dub/credentials";
import { storageService } from "@/services/storage/service";
import { deleteDubSession } from "@/dub/session";
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
// per-lesson cancellation — stopping one lesson must not touch its siblings
const lessonAborts = new Map<string, AbortController>();

export function stopCourseRun(): void {
	abortCtrl?.abort();
	useCourseStore.getState().setBatchRunning({ running: false });
	useCourseStore.getState().setPaused({ paused: false });
}

/** Stop ONE running/queued lesson — it unwinds at the next stage boundary
 * (or instantly while waiting on a semaphore) and goes back to 排队. */
export function stopLesson({ id }: { id: string }): boolean {
	const ctrl = lessonAborts.get(id);
	if (!ctrl) return false;
	ctrl.abort();
	return true;
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

	// auto-export destination honors the 导出位置 setting; mid-batch we can't
	// prompt for a directory, so 另存新目录 without a usable saved handle falls
	// back to <courseDir>/_localized (resolveExportDir, interactive: false)
	let outDir: FileSystemDirectoryHandle | null = null;
	if (autoExport) {
		try {
			outDir = await resolveExportDir({ interactive: false });
		} catch {
			outDir = null;
		}
	}

	const processOne = async (lessonId: string): Promise<void> => {
		const s = useCourseStore.getState();
		const lesson = s.course?.lessons.find((l) => l.id === lessonId);
		if (!lesson) return; // removed while queued (IMP-6)

		// global stop OR this lesson's own 停止 button
		const lessonCtrl = new AbortController();
		lessonAborts.set(lessonId, lessonCtrl);
		const lessonSignal = AbortSignal.any([signal, lessonCtrl.signal]);
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
				await deleteDubSession({ projectId: lesson.projectId });
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
					signal: lessonSignal,
					gate: pauseGate,
					stillWanted: () =>
						!lessonSignal.aborted &&
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
			const stopped = error instanceof AbortError || lessonSignal.aborted;
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
		} finally {
			lessonAborts.delete(lessonId);
		}
	};

	try {
		await Promise.allSettled(targets.map((l) => processOne(l.id)));
	} finally {
		useCourseStore.getState().setBatchRunning({ running: false });
		useCourseStore.getState().setPaused({ paused: false });
		void useCourseStore.getState().persistNow();
		abortCtrl = null;
		lessonAborts.clear();
	}
}
