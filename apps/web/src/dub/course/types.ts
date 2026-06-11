// Course-level batch dubbing — domain types.
// A course is a folder of many lesson videos; each lesson runs the same
// single-lesson pipeline (subtitle-or-ASR → translate → TTS → align) and lands
// in a triage queue. Mirrors the prototype's data.js / batch.jsx model.

export type LessonStatus =
	| "queued" // not yet processed
	| "processing" // currently running
	| "done" // finished, nothing flagged
	| "review" // finished but flagged (overflow / heavy speedup) — needs a human
	| "failed"; // errored (missing subtitle under skip policy, TTS error, …)

export interface CourseLesson {
	id: string;
	/** 1-based position within the course (display order). */
	index: number;
	/** chapter / folder grouping label, e.g. "03 · 组件与 Props". */
	chapter: string;
	/** human title (derived from the file name). */
	title: string;
	/** file base name without extension, used to pair the subtitle sidecar. */
	stem: string;
	/** path of the video relative to the course root (for display + writeback). */
	videoPath: string;
	/** whether a sibling subtitle (.srt/.vtt) was found (→ skip ASR). */
	hasSubtitle: boolean;
	/** language code of the paired subtitle ("und" = untagged). Matches the
	 * target language → used directly; anything else → translated. */
	subtitleLang?: string | null;
	durationSec?: number;
	status: LessonStatus;
	/** 0..100 within the current stage / overall lesson. */
	progress: number;
	segCount?: number;
	/** lines that got sped up to fit (amber flag). */
	spedCount?: number;
	/** lines that overflow even at max speed (red flag → review). */
	overflowCount?: number;
	failReason?: string | null;
	/** id of the generated editor project once the lesson is processed. */
	projectId?: string;
	/** mediaId the project's video element references (zero-copy injection). */
	videoMediaId?: string;
	/** absolute output path note once exported (display only). */
	outputName?: string;
	exportedAt?: number;
}

export interface Course {
	id: string;
	name: string;
	/** chosen directory name. */
	rootName: string;
	total: number;
	createdAt: number;
	lessons: CourseLesson[];
}

/** Policy for lessons that have no subtitle sidecar. */
export type MissingSubtitlePolicy =
	| "asr" // transcribe locally (slow)
	| "skip"; // mark failed, leave for the user
