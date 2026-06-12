// Pure course-building / merging logic, kept out of the store so it's
// bun-testable. Re-importing the SAME root folder merges instead of wiping:
// processed lessons keep their full state, new files are appended — that's
// the "add new videos to the course folder, import again" workflow.

import { generateUUID } from "@/utils/id";
import type {
	Course,
	CourseLesson,
	MissingSubtitlePolicy,
} from "@/dub/course/types";
import type { ScanResult, ScannedLesson } from "@/dub/course/scan";

const SKIP_REASON = "缺少字幕，已按策略跳过";

/** Single source of truth for the queued-lesson shape — import and merge
 * both build new lessons through here so they can't drift. */
function lessonFromScan({
	scanned,
	id,
	index,
	missingPolicy,
}: {
	scanned: ScannedLesson;
	id: string;
	index: number;
	missingPolicy: MissingSubtitlePolicy;
}): CourseLesson {
	const willSkip = !scanned.subtitleHandle && missingPolicy === "skip";
	return {
		id,
		index,
		chapter: scanned.chapter,
		title: scanned.title,
		stem: scanned.stem,
		videoPath: scanned.videoPath,
		hasSubtitle: !!scanned.subtitleHandle,
		subtitleLang: scanned.subtitleLang,
		status: willSkip ? "failed" : "queued",
		progress: 0,
		failReason: willSkip ? SKIP_REASON : null,
	};
}

export function buildCourseFromScan({
	scan,
	missingPolicy,
}: {
	scan: ScanResult;
	missingPolicy: MissingSubtitlePolicy;
}): {
	course: Course;
	videoHandles: Record<string, FileSystemFileHandle>;
	subtitleHandles: Record<string, FileSystemFileHandle | null>;
} {
	const videoHandles: Record<string, FileSystemFileHandle> = {};
	const subtitleHandles: Record<string, FileSystemFileHandle | null> = {};

	const lessons: CourseLesson[] = scan.lessons.map((l, i) => {
		const id = `ls_${String(i).padStart(3, "0")}`;
		videoHandles[id] = l.videoHandle;
		subtitleHandles[id] = l.subtitleHandle;
		return lessonFromScan({ scanned: l, id, index: i + 1, missingPolicy });
	});

	const course: Course = {
		id: generateUUID(),
		name: scan.rootName,
		rootName: scan.rootName,
		total: lessons.length,
		createdAt: Date.now(),
		lessons,
	};
	return { course, videoHandles, subtitleHandles };
}

/** Merge a re-scan of the SAME root into the current course.
 * - matched by videoPath: lesson keeps its full state, handles re-pointed
 * - unprocessed (no projectId) lessons refresh subtitle info + skip policy
 * - vanished files: lesson kept verbatim, no handle (same degradation as
 *   rebuildHandles — 打开/导出/重跑 surface 找不到视频文件)
 * - new files: appended as queued with a continued `ls_NNN` id
 * - note: a lesson removed via 移除 that still exists on disk re-appears —
 *   re-import is the explicit "pick up folder changes" gesture
 */
export function mergeCourseScan({
	current,
	scan,
	missingPolicy,
}: {
	current: Course;
	scan: ScanResult;
	missingPolicy: MissingSubtitlePolicy;
}): {
	course: Course;
	videoHandles: Record<string, FileSystemFileHandle>;
	subtitleHandles: Record<string, FileSystemFileHandle | null>;
} {
	const videoHandles: Record<string, FileSystemFileHandle> = {};
	const subtitleHandles: Record<string, FileSystemFileHandle | null> = {};
	const byPath = new Map(scan.lessons.map((l) => [l.videoPath, l]));

	// continue the ls_NNN numbering past the highest existing ordinal
	let nextOrdinal =
		1 +
		current.lessons.reduce((max, l) => {
			const m = /^ls_(\d+)$/.exec(l.id);
			return m ? Math.max(max, Number.parseInt(m[1], 10)) : max;
		}, -1);

	const merged: CourseLesson[] = current.lessons.map((lesson) => {
		const match = byPath.get(lesson.videoPath);
		if (!match) return lesson; // vanished file — keep verbatim, no handle
		byPath.delete(lesson.videoPath);
		videoHandles[lesson.id] = match.videoHandle;
		subtitleHandles[lesson.id] = match.subtitleHandle;
		if (lesson.projectId) return lesson; // processed — don't touch metadata

		// unprocessed: refresh subtitle pairing + re-evaluate the skip policy
		const hasSubtitle = !!match.subtitleHandle;
		const willSkip = !hasSubtitle && missingPolicy === "skip";
		const wasSkipFailed =
			lesson.status === "failed" && lesson.failReason === SKIP_REASON;
		return {
			...lesson,
			hasSubtitle,
			subtitleLang: match.subtitleLang,
			status: willSkip ? "failed" : wasSkipFailed ? "queued" : lesson.status,
			failReason: willSkip
				? SKIP_REASON
				: wasSkipFailed
					? null
					: lesson.failReason,
		};
	});

	// genuinely new files — everything left in byPath
	for (const scanned of byPath.values()) {
		const id = `ls_${String(nextOrdinal++).padStart(3, "0")}`;
		videoHandles[id] = scanned.videoHandle;
		subtitleHandles[id] = scanned.subtitleHandle;
		merged.push(
			lessonFromScan({ scanned, id, index: 0, missingPolicy }),
		);
	}

	// same display order as a fresh scan (scanCourseDirectory's comparator)
	merged.sort((a, b) =>
		a.videoPath.localeCompare(b.videoPath, undefined, { numeric: true }),
	);
	const lessons = merged.map((l, i) => ({ ...l, index: i + 1 }));

	return {
		course: { ...current, total: lessons.length, lessons },
		videoHandles,
		subtitleHandles,
	};
}
