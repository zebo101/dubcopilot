import { describe, expect, test } from "bun:test";
import { mergeCourseScan } from "@/dub/course/merge";
import type { Course, CourseLesson } from "@/dub/course/types";
import type { ScannedLesson, ScanResult } from "@/dub/course/scan";

const handle = (name: string) =>
	({ name }) as unknown as FileSystemFileHandle;

function scanned({
	videoPath,
	subtitle = false,
	subtitleLang = null,
}: {
	videoPath: string;
	subtitle?: boolean;
	subtitleLang?: string | null;
}): ScannedLesson {
	const stem = videoPath.replace(/\.mp4$/, "");
	return {
		stem,
		title: stem,
		chapter: "",
		videoPath,
		videoHandle: handle(videoPath),
		subtitleHandle: subtitle ? handle(`${stem}.srt`) : null,
		subtitleLang,
	} as ScannedLesson;
}

function lesson({
	id,
	videoPath,
	status = "queued",
	projectId,
	failReason = null,
}: {
	id: string;
	videoPath: string;
	status?: CourseLesson["status"];
	projectId?: string;
	failReason?: string | null;
}): CourseLesson {
	const stem = videoPath.replace(/\.mp4$/, "");
	return {
		id,
		index: 0,
		chapter: "",
		title: stem,
		stem,
		videoPath,
		hasSubtitle: false,
		subtitleLang: null,
		status,
		progress: status === "done" ? 100 : 0,
		failReason,
		...(projectId ? { projectId, videoMediaId: `${projectId}-media` } : {}),
	};
}

function course({ lessons }: { lessons: CourseLesson[] }): Course {
	return {
		id: "course-1",
		name: "我的课程",
		rootName: "我的课程",
		total: lessons.length,
		createdAt: 1000,
		lessons,
	};
}

function scan({ lessons }: { lessons: ScannedLesson[] }): ScanResult {
	const withSubtitle = lessons.filter((l) => l.subtitleHandle).length;
	return {
		rootName: "我的课程",
		lessons,
		withSubtitle,
		ready: 0,
		missing: lessons.length - withSubtitle,
	};
}

describe("mergeCourseScan", () => {
	test("processed lessons keep full state, handles re-pointed", () => {
		const current = course({
			lessons: [
				lesson({ id: "ls_000", videoPath: "a.mp4", status: "done", projectId: "p1" }),
				lesson({ id: "ls_001", videoPath: "b.mp4" }),
			],
		});
		const result = mergeCourseScan({
			current,
			scan: scan({
				lessons: [scanned({ videoPath: "a.mp4" }), scanned({ videoPath: "b.mp4" })],
			}),
			missingPolicy: "asr",
		});
		const a = result.course.lessons.find((l) => l.videoPath === "a.mp4");
		expect(a?.status).toBe("done");
		expect(a?.projectId).toBe("p1");
		expect(result.videoHandles.ls_000).toBeDefined();
		expect(result.videoHandles.ls_001).toBeDefined();
		expect(result.course.id).toBe("course-1");
		expect(result.course.createdAt).toBe(1000);
	});

	test("new files are appended queued with continued ls_ ids", () => {
		const current = course({
			lessons: [
				lesson({ id: "ls_000", videoPath: "a.mp4", status: "done", projectId: "p1" }),
				lesson({ id: "ls_005", videoPath: "b.mp4" }),
			],
		});
		const result = mergeCourseScan({
			current,
			scan: scan({
				lessons: [
					scanned({ videoPath: "a.mp4" }),
					scanned({ videoPath: "b.mp4" }),
					scanned({ videoPath: "c.mp4" }),
				],
			}),
			missingPolicy: "asr",
		});
		const c = result.course.lessons.find((l) => l.videoPath === "c.mp4");
		expect(c).toBeDefined();
		expect(c?.id).toBe("ls_006"); // continues past the highest ordinal
		expect(c?.status).toBe("queued");
		expect(result.course.total).toBe(3);
		expect(result.videoHandles.ls_006).toBeDefined();
	});

	test("vanished files keep the lesson but get no handle", () => {
		const current = course({
			lessons: [
				lesson({ id: "ls_000", videoPath: "a.mp4", status: "done", projectId: "p1" }),
				lesson({ id: "ls_001", videoPath: "gone.mp4", status: "done", projectId: "p2" }),
			],
		});
		const result = mergeCourseScan({
			current,
			scan: scan({ lessons: [scanned({ videoPath: "a.mp4" })] }),
			missingPolicy: "asr",
		});
		const gone = result.course.lessons.find((l) => l.videoPath === "gone.mp4");
		expect(gone?.status).toBe("done");
		expect(result.videoHandles.ls_001).toBeUndefined();
		expect(result.course.total).toBe(2);
	});

	test("skip-failed lesson that gained a subtitle returns to queued", () => {
		const current = course({
			lessons: [
				lesson({
					id: "ls_000",
					videoPath: "a.mp4",
					status: "failed",
					failReason: "缺少字幕，已按策略跳过",
				}),
			],
		});
		const result = mergeCourseScan({
			current,
			scan: scan({
				lessons: [scanned({ videoPath: "a.mp4", subtitle: true, subtitleLang: "en" })],
			}),
			missingPolicy: "skip",
		});
		const a = result.course.lessons[0];
		expect(a.status).toBe("queued");
		expect(a.failReason).toBeNull();
		expect(a.hasSubtitle).toBe(true);
		expect(a.subtitleLang).toBe("en");
	});

	test("queued lesson that lost its subtitle under skip policy fails", () => {
		const current = course({
			lessons: [
				{ ...lesson({ id: "ls_000", videoPath: "a.mp4" }), hasSubtitle: true },
			],
		});
		const result = mergeCourseScan({
			current,
			scan: scan({ lessons: [scanned({ videoPath: "a.mp4", subtitle: false })] }),
			missingPolicy: "skip",
		});
		expect(result.course.lessons[0].status).toBe("failed");
		expect(result.course.lessons[0].failReason).toBe("缺少字幕，已按策略跳过");
	});

	test("processed lesson metadata is never refreshed", () => {
		const current = course({
			lessons: [
				lesson({ id: "ls_000", videoPath: "a.mp4", status: "review", projectId: "p1" }),
			],
		});
		const result = mergeCourseScan({
			current,
			scan: scan({
				lessons: [scanned({ videoPath: "a.mp4", subtitle: true, subtitleLang: "zh" })],
			}),
			missingPolicy: "asr",
		});
		const a = result.course.lessons[0];
		expect(a.status).toBe("review");
		expect(a.hasSubtitle).toBe(false); // untouched — only handles re-pointed
	});

	test("lessons are re-sorted by videoPath and renumbered", () => {
		const current = course({
			lessons: [lesson({ id: "ls_000", videoPath: "b/02.mp4" })],
		});
		const result = mergeCourseScan({
			current,
			scan: scan({
				lessons: [
					scanned({ videoPath: "b/02.mp4" }),
					scanned({ videoPath: "a/10.mp4" }),
					scanned({ videoPath: "a/2.mp4" }),
				],
			}),
			missingPolicy: "asr",
		});
		expect(result.course.lessons.map((l) => l.videoPath)).toEqual([
			"a/2.mp4", // numeric compare: 2 before 10
			"a/10.mp4",
			"b/02.mp4",
		]);
		expect(result.course.lessons.map((l) => l.index)).toEqual([1, 2, 3]);
	});
});
