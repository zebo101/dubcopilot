/**
 * GA4 analytics wrapper.
 *
 * All events are silently dropped when NEXT_PUBLIC_GA_ID is not configured.
 * In development mode events are logged to console instead of being sent.
 *
 * ## Event naming
 *
 * GA4 event names must be ≤ 40 chars, use snake_case.  Parameters use
 * the same convention.
 */


// ---------------------------------------------------------------------------
// gtag helper
// ---------------------------------------------------------------------------

declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
		dataLayer?: unknown[];
	}
}

/**
 * Measurement ID baked at build time — only defined when the env var is set.
 * We DON'T reference the NEXT_PUBLIC_ prefixed var directly here (that would
 * cause tree-shaking issues); the caller just needs the ID to be available on
 * `window.gtag` which the inline script in layout.tsx injects.
 */
function hasAnalytics(): boolean {
	return typeof window !== "undefined" && Boolean(window.gtag);
}

function send(name: string, params?: Record<string, unknown>) {
	if (!hasAnalytics()) return;
	if (process.env.NODE_ENV === "development") {
		// biome-ignore lint/suspicious/noConsole: dev mode analytics log
		console.log("[analytics]", name, params ?? {});
		return;
	}
	window.gtag!("event", name, params);
}

function config(path: string) {
	if (!hasAnalytics()) return;
	if (process.env.NODE_ENV === "development") {
		// biome-ignore lint/suspicious/noConsole: dev mode analytics log
		console.log("[analytics] page_view", path);
		return;
	}
	const id = process.env.NEXT_PUBLIC_GA_ID;
	window.gtag!("config", id, { page_path: path });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Call on every client-side route change. */
export function trackPageView(path: string) {
	config(path);
}

// -- Course ---------------------------------------------------------------

type ImportSource = "folder" | "link";

export function trackCourseImportStart(source: ImportSource) {
	send("course_import_start", { source });
}

export function trackCourseImportComplete(
	lessonCount: number,
	withSub: number,
	missing: number,
	source: ImportSource,
) {
	send("course_import_complete", {
		lesson_count: lessonCount,
		with_sub: withSub,
		missing,
		source,
	});
}

export function trackCourseImportError(error: string, source: ImportSource) {
	send("course_import_error", { error, source });
}

type RunMode = "full" | "selection";

export function trackCourseRunStart(lessonCount: number, mode: RunMode) {
	send("course_run_start", { lesson_count: lessonCount, mode });
}

export function trackCourseRunComplete(
	total: number,
	success: number,
	failed: number,
	durationSec: number,
) {
	send("course_run_complete", { total, success, failed, duration_sec: durationSec });
}

export function trackCourseExport(
	format: "folder" | "zip",
	lessonCount: number,
	auto: boolean,
) {
	send("course_export", { format, lesson_count: lessonCount, auto });
}

// -- Lesson stages --------------------------------------------------------

export interface StageTiming {
	lessonIndex: number;
	/** Pipeline stage key — matches the Chinese labels from `onProgress` and the STAGE_RANGES map. */
	stage: "准备" | "转写" | "翻译" | "配音" | "组装" | "导出";
	durationMs: number;
	status: "ok" | "error";
}

/**
 * Send a batch of per-lesson stage timings.
 *
 * GA4 has no native "batch" API so we fire one event per stage.  This is
 * called once at the end of a course run, not mid-run.
 */
export function trackLessonStageBatch(timings: StageTiming[]) {
	for (const t of timings) {
		send("lesson_stage_complete", {
			lesson_index: t.lessonIndex,
			stage: t.stage,
			duration_ms: t.durationMs,
			status: t.status,
		});
	}
}

// -- Settings -------------------------------------------------------------

export function trackSettingChanged(key: string, value: string | number | boolean) {
	send("setting_changed", { key, value: String(value) });
}
