import { create } from "zustand";
import { generateUUID } from "@/utils/id";
import type {
	Course,
	CourseLesson,
	MissingSubtitlePolicy,
} from "@/dub/course/types";
import {
	type ScanResult,
	ensurePermission,
	pickCourseDirectory,
	scanCourseDirectory,
} from "@/dub/course/scan";
import { idbDel, idbGet, idbSet } from "@/dub/course/idb";

const COURSE_KEY = "course";
const DIR_KEY = "dir";

// Debounced persistence: progress ticks fire dozens of times per lesson —
// writing the whole course to IDB each tick was a write storm (IMP-1).
const PERSIST_DEBOUNCE_MS = 2000;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

type CourseView = "none" | "import" | "center";
type ImportStep = "source" | "scan";

interface CourseStore {
	course: Course | null;
	dirHandle: FileSystemDirectoryHandle | null;
	/** in-memory handle maps (rebuilt from the dir on resume), keyed by lesson id */
	videoHandles: Record<string, FileSystemFileHandle>;
	subtitleHandles: Record<string, FileSystemFileHandle | null>;

	view: CourseView;
	importStep: ImportStep;
	scanResult: ScanResult | null;
	scanning: boolean;
	missingPolicy: MissingSubtitlePolicy;
	output: "sibling" | "new";
	selection: string[];
	batchRunning: boolean;
	hydrated: boolean;
	/** course restored from IDB but the folder permission needs a user gesture */
	needsPermission: boolean;

	exporting: boolean;
	exportDone: number;
	exportTotal: number;
	exportCurrent: string;

	openImport: () => void;
	closeImport: () => void;
	backImportSource: () => void;
	openCenter: () => void;
	closeCourse: () => void;
	setMissingPolicy: (args: { policy: MissingSubtitlePolicy }) => void;
	setOutput: (args: { output: "sibling" | "new" }) => void;
	pickFolder: () => Promise<void>;
	confirmImport: () => Promise<void>;
	toggleSelect: (args: { id: string }) => void;
	selectMany: (args: { ids: string[] }) => void;
	clearSelection: () => void;
	removeLessons: (args: { ids: string[] }) => void;
	updateLesson: (args: { id: string; patch: Partial<CourseLesson> }) => void;
	setBatchRunning: (args: { running: boolean }) => void;
	setExport: (args: {
		exporting?: boolean;
		done?: number;
		total?: number;
		current?: string;
	}) => void;
	persist: () => Promise<void>;
	persistNow: () => Promise<void>;
	hydrate: () => Promise<void>;
	/** must be called from a user gesture (click) — requests folder permission */
	restorePermission: () => Promise<boolean>;
	reset: () => Promise<void>;
}

function buildCourseFromScan({
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
		const willSkip = !l.subtitleHandle && missingPolicy === "skip";
		return {
			id,
			index: i + 1,
			chapter: l.chapter,
			title: l.title,
			stem: l.stem,
			videoPath: l.videoPath,
			hasSubtitle: !!l.subtitleHandle,
			subtitleLang: l.subtitleLang,
			status: willSkip ? "failed" : "queued",
			progress: 0,
			failReason: willSkip ? "缺少字幕，已按策略跳过" : null,
		};
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

/** Re-scan the folder and match handles back to lessons by videoPath. */
async function rebuildHandles({
	dirHandle,
	course,
}: {
	dirHandle: FileSystemDirectoryHandle;
	course: Course;
}): Promise<{
	videoHandles: Record<string, FileSystemFileHandle>;
	subtitleHandles: Record<string, FileSystemFileHandle | null>;
}> {
	const videoHandles: Record<string, FileSystemFileHandle> = {};
	const subtitleHandles: Record<string, FileSystemFileHandle | null> = {};
	try {
		const scan = await scanCourseDirectory({ dirHandle });
		const byPath = new Map(scan.lessons.map((l) => [l.videoPath, l]));
		for (const lesson of course.lessons) {
			const match = byPath.get(lesson.videoPath);
			if (match) {
				videoHandles[lesson.id] = match.videoHandle;
				subtitleHandles[lesson.id] = match.subtitleHandle;
			}
		}
	} catch (error) {
		console.error("course rescan failed", error);
	}
	return { videoHandles, subtitleHandles };
}

const TERMINAL_STATUSES = new Set(["done", "review", "failed"]);

export const useCourseStore = create<CourseStore>((set, get) => ({
	course: null,
	dirHandle: null,
	videoHandles: {},
	subtitleHandles: {},
	view: "none",
	importStep: "source",
	scanResult: null,
	scanning: false,
	missingPolicy: "asr",
	output: "sibling",
	selection: [],
	batchRunning: false,
	hydrated: false,
	needsPermission: false,
	exporting: false,
	exportDone: 0,
	exportTotal: 0,
	exportCurrent: "",

	openImport: () => set({ view: "import", importStep: "source" }),
	closeImport: () =>
		set((s) => ({ view: s.course ? "center" : "none" })),
	backImportSource: () => set({ importStep: "source", scanResult: null }),
	openCenter: () => set({ view: "center" }),
	closeCourse: () => set({ view: "none" }),
	setMissingPolicy: ({ policy }) => set({ missingPolicy: policy }),
	setOutput: ({ output }) => set({ output }),

	pickFolder: async () => {
		const dirHandle = await pickCourseDirectory();
		if (!dirHandle) return;
		set({ scanning: true });
		try {
			const scanResult = await scanCourseDirectory({ dirHandle });
			set({ dirHandle, scanResult, importStep: "scan", scanning: false });
		} catch (error) {
			set({ scanning: false });
			throw error;
		}
	},

	confirmImport: async () => {
		const { scanResult, missingPolicy } = get();
		if (!scanResult) return;
		const { course, videoHandles, subtitleHandles } = buildCourseFromScan({
			scan: scanResult,
			missingPolicy,
		});
		set({ course, videoHandles, subtitleHandles, view: "center", selection: [] });
		await get().persistNow();
	},

	toggleSelect: ({ id }) =>
		set((s) => ({
			selection: s.selection.includes(id)
				? s.selection.filter((x) => x !== id)
				: [...s.selection, id],
		})),
	selectMany: ({ ids }) => set({ selection: ids }),
	clearSelection: () => set({ selection: [] }),

	removeLessons: ({ ids }) => {
		set((s) => {
			if (!s.course) return s;
			const idset = new Set(ids);
			const lessons = s.course.lessons.filter((l) => !idset.has(l.id));
			const videoHandles = { ...s.videoHandles };
			const subtitleHandles = { ...s.subtitleHandles };
			for (const id of ids) {
				delete videoHandles[id];
				delete subtitleHandles[id];
			}
			return {
				course: { ...s.course, lessons, total: lessons.length },
				videoHandles,
				subtitleHandles,
				selection: s.selection.filter((x) => !idset.has(x)),
			};
		});
		void get().persistNow();
	},

	updateLesson: ({ id, patch }) => {
		set((s) => {
			if (!s.course) return s;
			const lessons = s.course.lessons.map((l) =>
				l.id === id ? { ...l, ...patch } : l,
			);
			return { course: { ...s.course, lessons } };
		});
		// terminal transitions persist immediately; progress ticks are debounced
		if (patch.status && TERMINAL_STATUSES.has(patch.status)) {
			void get().persistNow();
		} else {
			void get().persist();
		}
	},

	setBatchRunning: ({ running }) => set({ batchRunning: running }),

	setExport: ({ exporting, done, total, current }) =>
		set((s) => ({
			exporting: exporting ?? s.exporting,
			exportDone: done ?? s.exportDone,
			exportTotal: total ?? s.exportTotal,
			exportCurrent: current ?? s.exportCurrent,
		})),

	persist: async () => {
		// debounced — terminal states should call persistNow instead
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			persistTimer = null;
			void get().persistNow();
		}, PERSIST_DEBOUNCE_MS);
	},

	persistNow: async () => {
		if (persistTimer) {
			clearTimeout(persistTimer);
			persistTimer = null;
		}
		const { course, dirHandle } = get();
		try {
			if (course) await idbSet(COURSE_KEY, course);
			if (dirHandle) await idbSet(DIR_KEY, dirHandle);
		} catch (error) {
			console.error("course persist failed", error);
		}
	},

	hydrate: async () => {
		if (get().hydrated) return;
		const course = await idbGet<Course>(COURSE_KEY);
		const dirHandle = await idbGet<FileSystemDirectoryHandle>(DIR_KEY);
		if (!course || !dirHandle) {
			set({ hydrated: true });
			return;
		}
		// Only QUERY permission here — requestPermission needs a user gesture
		// and silently fails from an effect (IMP-5). If not granted, surface a
		// banner; restorePermission() (button click) completes the resume.
		let granted = false;
		try {
			const q = (
				dirHandle as FileSystemDirectoryHandle & {
					queryPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
				}
			).queryPermission;
			granted = q ? (await q.call(dirHandle, { mode: "readwrite" })) === "granted" : true;
		} catch {
			granted = false;
		}
		if (!granted) {
			set({ course, dirHandle, hydrated: true, needsPermission: true });
			return;
		}
		const { videoHandles, subtitleHandles } = await rebuildHandles({
			dirHandle,
			course,
		});
		set({ course, dirHandle, videoHandles, subtitleHandles, hydrated: true });
	},

	restorePermission: async () => {
		const { dirHandle, course } = get();
		if (!dirHandle || !course) return false;
		const granted = await ensurePermission({ handle: dirHandle });
		if (!granted) return false;
		const { videoHandles, subtitleHandles } = await rebuildHandles({
			dirHandle,
			course,
		});
		set({ videoHandles, subtitleHandles, needsPermission: false });
		return true;
	},

	reset: async () => {
		await idbDel(COURSE_KEY);
		await idbDel(DIR_KEY);
		set({
			course: null,
			dirHandle: null,
			videoHandles: {},
			subtitleHandles: {},
			view: "none",
			importStep: "source",
			scanResult: null,
			selection: [],
			batchRunning: false,
		});
	},
}));
