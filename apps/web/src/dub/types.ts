// AI 配音 (dubbing) feature — domain types.
// Draft state only; results are written to the real editor timeline via the
// adapter (see dub/adapter.ts in later phases).

import type { TranscriptionModelId } from "@/transcription/types";

export type DubPhase = "setup" | "processing" | "review";
export type SegmentStatus = "ready" | "edited";
export type SpeedMode = "auto" | "manual";
export type OriginalAudioMode = "mute" | "background";
export type SubtitleMode = "soft" | "burn";

export interface SegmentTiming {
	/** raw spoken length of the (Chinese) line, seconds */
	originalDuration: number;
	/** available slot on the timeline, seconds */
	targetDuration: number;
	/** length after speed-fit, seconds */
	fittedDuration: number;
	/** applied playback rate (maps to RetimeConfig.rate) */
	appliedSpeedup: number;
}

export interface Segment {
	id: string;
	index: number;
	/** scheduled start on the timeline, seconds (never rippled) */
	start: number;
	end: number;
	source: string;
	translated: string;
	status: SegmentStatus;
	speedMode: SpeedMode;
	timing: SegmentTiming;
}

export interface Voice {
	id: string;
	name: string;
	genderLabel: string;
	style: string;
	desc: string;
	hue: number;
	recommended?: boolean;
}

export interface DubSettings {
	targetLang: string;
	voiceId: string;
	originalAudio: OriginalAudioMode;
	backgroundVolume: number;
	subtitles: boolean;
	subtitleMode: SubtitleMode;
	/** auto speed-fit overlong lines to their slot */
	speedAdaptive: boolean;
	/** zh-dub --tts-native-max-speed-ratio */
	nativeMaxSpeed: number;
	/** matches zh-dub --max-tts-speedup */
	maxSpeedup: number;
	/** zh-dub --overlap-guard-ms */
	overlapGuardMs: number;
	/** all dubbing audio keeps pitch when sped up */
	maintainPitch: boolean;
	/** browser Whisper model used to transcribe the source audio (local mode).
	 * Smaller = much faster (download + inference) at some accuracy cost. */
	transcribeModel: TranscriptionModelId;
	/** where transcription runs: local browser Whisper (free/private/slow) or
	 * cloud Groq Whisper (fast, needs a key, uploads audio). */
	transcribeProvider: "local" | "cloud";
}
