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
	segId: string;
	/** raw mp3 bytes from TTS */
	bytes: ArrayBuffer;
	/** decoded real duration, seconds */
	realDuration: number;
	/** applied speed-fit rate */
	rate: number;
	/** realDuration / rate, seconds */
	fitted: number;
}

export interface StepReport {
	step: string;
	pct: number;
}
