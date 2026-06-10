// Shared types for the headless course-dubbing engine.

import type { Segment } from "@/dub/types";
import type { SubtitleCue } from "@/dub/course/subtitles";
import type { SubtitleLang } from "@/dub/course/scan";

export interface LessonMeta {
	/** seconds */
	duration: number;
	width: number;
	height: number;
	fps: number;
	hasAudio: boolean;
}

export interface LessonWork {
	lessonId: string;
	stem: string;
	title: string;
	videoFile: File;
	meta: LessonMeta;
	subtitle: { lang: SubtitleLang; cues: SubtitleCue[] } | null;
	segments: Segment[];
	clips: SynthesizedClip[];
	projectId?: string;
}

export interface SynthesizedClip {
	/** member segment ids of the dub UNIT this clip voices (timeline order) */
	segIds: string[];
	/** timeline placement = the unit's first segment start (seconds) */
	start: number;
	/** the unit's available span on the timeline (seconds) */
	span: number;
	/** raw mp3 bytes from TTS (already at native speed) */
	bytes: ArrayBuffer;
	/** decoded real duration of the (native-speed) audio, seconds */
	realDuration: number;
	/** mechanical retime applied on the timeline element */
	rate: number;
	/** perceived total = nativeRatio × rate — drives ⚡/超时 flags */
	totalSpeedup: number;
	/** realDuration / rate, seconds */
	fitted: number;
}

export interface StepReport {
	step: string;
	pct: number;
}
