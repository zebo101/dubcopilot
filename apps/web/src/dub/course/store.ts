import { create } from "zustand";
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
import { buildCourseFromScan, mergeCourseScan } from "@/dub/course/merge";
import { useDubStore } from "@/dub/store";

const COURSE_KEY = "course";
const DIR_KEY = "dir";
const OUT_DIR_KEY = "outDir";
const OUTPUT_KEY = "output";

// Debounced persistence: progress ticks fire dozens of times per lesson —
// writing the whole course to IDB each tick was a write storm (IMP-1).
const PERSIST_DEBOUNCE_MS = 2000;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

type CourseView = "none" | "import" | "center";
type ImportStep = "source" | "link" | "scan";

interface CourseStore {
	course: Course | null;
	dirHandle: FileSystemDirectoryHandle | null;
	/** 扫描出但尚未确认导入的目录 — confirm 时才接管 dirHandle，
	 * 这样才能用 isSameEntry 判断「同根再导入」走合并而不是清空 */
	pendingDirHandle: FileSystemDirectoryHandle | null;
	/** in-memory handle maps (rebuilt from the dir on resume), keyed by lesson id */
	videoHandles: Record<string, FileSystemFileHandle>;
	subtitleHandles: Record<string, FileSystemFileHandle | null>;

	view: CourseView;
	importStep: ImportStep;
	scanResult: ScanResult | null;
	scanning: boolean;
	missingPolicy: MissingSubtitlePolicy;
	output: "sibling" | "new";
	/** 「另存新目录」的目标目录（output === "new" 时使用），持久化到 IDB */
	outDirHandle: FileSystemDirectoryHandle | null;
	selection: string[];
	batchRunning: boolean;
	/** cooperative pause — the scheduler gates new stage entries on this */
	paused: boolean;
	/** render+write each lesson right after it's generated */
	autoExport: boolean;
	hydrated: boolean;
	/** course restored from IDB but the folder permission needs a user gesture */
	needsPermission: boolean;
	/** review hand-off: inject this video into the editor after it loads */
	pendingInjection: { projectId: string; mediaId: string; file: File } | null;

	exporting: boolean;
	exportDone: number;
	exportTotal: number;
	exportCurrent: string;
	/** render progress of the current lesson, 0–100 */
	exportPct: number;

	openImport: () => void;
	closeImport: () => void;
	backImportSource: () => void;
	openLinkImport: () => void;
	/** scan an already-acquired directory handle (link import hand-off) */
	scanFolder: (args: { dirHandle: FileSystemDirectoryHandle }) => Promise<void>;
	openCenter: () => void;
	closeCourse: () => void;
	setMissingPolicy: (args: { policy: MissingSubtitlePolicy }) => void;
	setOutput: (args: { output: "sibling" | "new" }) => void;
	setOutDirHandle: (args: { handle: FileSystemDirectoryHandle | null }) => void;
	pickFolder: () => Promise<void>;
	/** "needs-confirm" = 换了根目录且有已生成课时——UI 弹覆盖确认后用 force 重调 */
	confirmImport: (args?: { force?: boolean }) => Promise<"ok" | "needs-confirm">;
	toggleSelect: (args: { id: string }) => void;
	selectMany: (args: { ids: string[] }) => void;
	clearSelection: () => void;
	removeLessons: (args: { ids: string[] }) => void;
	updateLesson: (args: { id: string; patch: Partial<CourseLesson> }) => void;
	setBatchRunning: (args: { running: boolean }) => void;
	setPaused: (args: { paused: boolean }) => void;
	setAutoExport: (args: { autoExport: boolean }) => void;
	setPendingInjection: (args: {
		injection: { projectId: string; mediaId: string; file: File } | null;
	}) => void;
	setExport: (args: {
		exporting?: boolean;
		done?: number;
		total?: number;
		current?: string;
		pct?: number;
	}) => void;
	persist: () => Promise<void>;
	persistNow: () => Promise<void>;
	hydrate: () => Promise<void>;
	/** must be called from a user gesture (click) — requests folder permission */
	restorePermission: () => Promise<boolean>;
	reset: () => Promise<void>;
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
		const scan = await scanCourseDirectory({
			dirHandle,
			targetLang: useDubStore.getState().settings.targetLang,
		});
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
	pendingDirHandle: null,
	videoHandles: {},
	subtitleHandles: {},
	view: "none",
	importStep: "source",
	scanResult: null,
	scanning: false,
	missingPolicy: "asr",
	output: "sibling",
	outDirHandle: null,
	selection: [],
	batchRunning: false,
	paused: false,
	autoExport: false,
	hydrated: false,
	needsPermission: false,
	pendingInjection: null,
	exporting: false,
	exportDone: 0,
	exportTotal: 0,
	exportCurrent: "",
	exportPct: 0,

	openImport: () => set({ view: "import", importStep: "source" }),
	closeImport: () =>
		set((s) => ({ view: s.course ? "center" : "none" })),
	backImportSource: () =>
		set({ importStep: "source", scanResult: null, pendingDirHandle: null }),
	openLinkImport: () => set({ importStep: "link" }),
	openCenter: () => set({ view: "center" }),
	closeCourse: () => set({ view: "none" }),
	setMissingPolicy: ({ policy }) => set({ missingPolicy: policy }),
	setOutput: ({ output }) => {
		set({ output });
		void idbSet(OUTPUT_KEY, output);
	},
	setOutDirHandle: ({ handle }) => {
		set({ outDirHandle: handle });
		void (handle ? idbSet(OUT_DIR_KEY, handle) : idbDel(OUT_DIR_KEY));
	},

	pickFolder: async () => {
		const dirHandle = await pickCourseDirectory();
		if (!dirHandle) return;
		await get().scanFolder({ dirHandle });
	},

	scanFolder: async ({ dirHandle }) => {
		set({ scanning: true });
		try {
			const scanResult = await scanCourseDirectory({
				dirHandle,
				targetLang: useDubStore.getState().settings.targetLang,
			});
			// dirHandle 留到 confirmImport 才接管 — 同根判断需要新旧并存
			set({
				pendingDirHandle: dirHandle,
				scanResult,
				importStep: "scan",
				scanning: false,
			});
		} catch (error) {
			set({ scanning: false });
			throw error;
		}
	},

	confirmImport: async ({ force = false } = {}) => {
		const { scanResult, missingPolicy, course, dirHandle, pendingDirHandle } =
			get();
		if (!scanResult || !pendingDirHandle) return "ok";

		let sameRoot = false;
		if (course && dirHandle) {
			try {
				sameRoot = await dirHandle.isSameEntry(pendingDirHandle);
			} catch {
				sameRoot = course.rootName === scanResult.rootName;
			}
		}

		if (course && sameRoot) {
			// 同根再导入 = 增量合并：已生成课时全保留，只追加/刷新
			const merged = mergeCourseScan({
				current: course,
				scan: scanResult,
				missingPolicy,
			});
			set({
				course: merged.course,
				videoHandles: merged.videoHandles,
				subtitleHandles: merged.subtitleHandles,
				dirHandle: pendingDirHandle,
				pendingDirHandle: null,
				view: "center",
				selection: [],
				needsPermission: false,
			});
			await get().persistNow();
			return "ok";
		}

		const processed = course?.lessons.filter((l) => !!l.projectId).length ?? 0;
		if (course && !sameRoot && processed > 0 && !force) {
			return "needs-confirm"; // UI 弹覆盖确认
		}

		const built = buildCourseFromScan({ scan: scanResult, missingPolicy });
		set({
			course: built.course,
			videoHandles: built.videoHandles,
			subtitleHandles: built.subtitleHandles,
			dirHandle: pendingDirHandle,
			pendingDirHandle: null,
			view: "center",
			selection: [],
			needsPermission: false,
		});
		await get().persistNow();
		return "ok";
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
	setPaused: ({ paused }) => set({ paused }),
	setAutoExport: ({ autoExport }) => set({ autoExport }),
	setPendingInjection: ({ injection }) => set({ pendingInjection: injection }),

	setExport: ({ exporting, done, total, current, pct }) =>
		set((s) => ({
			exporting: exporting ?? s.exporting,
			exportDone: done ?? s.exportDone,
			exportTotal: total ?? s.exportTotal,
			exportCurrent: current ?? s.exportCurrent,
			exportPct: pct ?? s.exportPct,
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
		// export-destination prefs — permission is checked lazily at export time
		const output = await idbGet<"sibling" | "new">(OUTPUT_KEY);
		const outDirHandle = await idbGet<FileSystemDirectoryHandle>(OUT_DIR_KEY);
		if (output) set({ output });
		if (outDirHandle) set({ outDirHandle });
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
		await idbDel(OUT_DIR_KEY);
		await idbDel(OUTPUT_KEY);
		set({
			course: null,
			dirHandle: null,
			pendingDirHandle: null,
			videoHandles: {},
			subtitleHandles: {},
			view: "none",
			importStep: "source",
			scanResult: null,
			selection: [],
			batchRunning: false,
			output: "sibling",
			outDirHandle: null,
		});
	},
}));
