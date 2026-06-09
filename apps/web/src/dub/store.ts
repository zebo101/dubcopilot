import { create } from "zustand";
import { autoFitSpeed, estimateDuration } from "@/dub/timing";
import type { DubPhase, DubSettings, Segment } from "@/dub/types";

const DEFAULT_SETTINGS: DubSettings = {
	targetLang: "zh",
	voiceId: "zh_male_liufei_uranus_bigtts",
	originalAudio: "mute",
	backgroundVolume: 0.12,
	subtitles: true,
	subtitleMode: "soft",
	speedAdaptive: true,
	nativeMaxSpeed: 1.35,
	maxSpeedup: 2.3,
	overlapGuardMs: 80,
	maintainPitch: true,
	// Tiny is ~6x smaller than Small → far faster download + inference, which
	// matters because browser Whisper has no per-chunk progress. Users who want
	// higher accuracy can bump this to Small/Medium in the setup panel.
	transcribeModel: "whisper-tiny",
	// Default to local: for course-scale work (hundreds of hours) audio must not
	// be uploaded. Cloud (Groq) stays available for one-off short clips.
	transcribeProvider: "local",
};

interface DubStore {
	phase: DubPhase;
	settings: DubSettings;
	/** Real segments from transcription — empty until the user generates. */
	segments: Segment[];
	selectedSegId: string | null;
	/** Human-readable current step + 0..100 progress during processing. */
	procStep: string;
	procPct: number;

	setSetting: <K extends keyof DubSettings>(args: {
		key: K;
		value: DubSettings[K];
	}) => void;
	setPhase: (phase: DubPhase) => void;
	setProc: (args: { step: string; pct: number }) => void;
	setSegments: (segments: Segment[]) => void;
	applyTranslations: (args: { map: Map<string, string> }) => void;
	backToSetup: () => void;
	selectSegment: (args: { id: string | null }) => void;
	editSegment: (args: { id: string; text: string }) => void;
	setSegmentSpeed: (args: { id: string; rate: number }) => void;
	resetSegmentSpeed: (args: { id: string }) => void;
}

export const useDubStore = create<DubStore>((set) => ({
	phase: "setup",
	settings: { ...DEFAULT_SETTINGS },
	segments: [],
	selectedSegId: null,
	procStep: "",
	procPct: 0,

	setSetting: ({ key, value }) =>
		set((s) => ({ settings: { ...s.settings, [key]: value } })),

	setPhase: (phase) => set({ phase }),
	setProc: ({ step, pct }) => set({ procStep: step, procPct: pct }),
	setSegments: (segments) => set({ segments }),

	applyTranslations: ({ map }) =>
		set((s) => ({
			segments: s.segments.map((seg) => {
				const zh = map.get(seg.id);
				if (!zh || zh === seg.translated) return seg;
				const orig = estimateDuration({ text: zh });
				const rate = autoFitSpeed({
					originalDuration: orig,
					targetDuration: seg.timing.targetDuration,
					maxSpeedup: s.settings.maxSpeedup,
				});
				return {
					...seg,
					translated: zh,
					status: "ready",
					timing: {
						...seg.timing,
						originalDuration: Number(orig.toFixed(2)),
						fittedDuration: Number((orig / rate).toFixed(2)),
						appliedSpeedup: Number(rate.toFixed(2)),
					},
				};
			}),
		})),

	backToSetup: () => set({ phase: "setup", selectedSegId: null }),

	selectSegment: ({ id }) => set({ selectedSegId: id }),

	editSegment: ({ id, text }) =>
		set((s) => ({
			segments: s.segments.map((seg) => {
				if (seg.id !== id || text === seg.translated) return seg;
				const orig = text ? estimateDuration({ text }) : 0;
				const rate =
					seg.speedMode === "manual"
						? seg.timing.appliedSpeedup
						: autoFitSpeed({
								originalDuration: orig,
								targetDuration: seg.timing.targetDuration,
								maxSpeedup: s.settings.maxSpeedup,
							});
				return {
					...seg,
					translated: text,
					status: "edited",
					timing: {
						...seg.timing,
						originalDuration: Number(orig.toFixed(2)),
						fittedDuration: Number(
							(rate > 0 ? orig / rate : orig).toFixed(2),
						),
						appliedSpeedup: Number(rate.toFixed(2)),
					},
				};
			}),
		})),

	setSegmentSpeed: ({ id, rate }) =>
		set((s) => ({
			segments: s.segments.map((seg) => {
				if (seg.id !== id) return seg;
				return {
					...seg,
					speedMode: "manual",
					timing: {
						...seg.timing,
						appliedSpeedup: Number(rate.toFixed(2)),
						fittedDuration: Number(
							(seg.timing.originalDuration / rate).toFixed(2),
						),
					},
				};
			}),
		})),

	resetSegmentSpeed: ({ id }) =>
		set((s) => ({
			segments: s.segments.map((seg) => {
				if (seg.id !== id) return seg;
				const rate = autoFitSpeed({
					originalDuration: seg.timing.originalDuration,
					targetDuration: seg.timing.targetDuration,
					maxSpeedup: s.settings.maxSpeedup,
				});
				return {
					...seg,
					speedMode: "auto",
					timing: {
						...seg.timing,
						appliedSpeedup: Number(rate.toFixed(2)),
						fittedDuration: Number(
							(seg.timing.originalDuration / rate).toFixed(2),
						),
					},
				};
			}),
		})),
}));
