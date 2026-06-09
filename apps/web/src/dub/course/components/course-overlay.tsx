"use client";

import { useEffect } from "react";
import { useCourseStore } from "@/dub/course/store";
import { BatchCenter } from "@/dub/course/components/batch-center";
import { ImportCourse } from "@/dub/course/components/import-course";

/**
 * Mounts the course-batch overlays (import dialog + batch center) and restores
 * any previously-imported course on load (断点续传). Rendered once at the editor
 * shell level so it survives panel/tab changes.
 */
export function CourseOverlay() {
	const view = useCourseStore((s) => s.view);
	const hydrate = useCourseStore((s) => s.hydrate);

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	return (
		<>
			{view === "center" && <BatchCenter />}
			{view === "import" && <ImportCourse />}
		</>
	);
}
