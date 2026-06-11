// Thin compatibility shell — the real orchestration lives in
// engine/scheduler.ts (concurrent, headless). Kept so existing imports
// (`runCourseBatch`) stay stable.

import {
	runCourse,
	stopCourseRun,
	stopLesson,
} from "@/dub/course/engine/scheduler";

export async function runCourseBatch({
	onlyIds,
}: { onlyIds?: string[] } = {}): Promise<void> {
	return runCourse({ onlyIds });
}

export { stopCourseRun, stopLesson };
