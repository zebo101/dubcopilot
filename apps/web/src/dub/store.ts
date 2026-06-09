import { create } from "zustand";
import { buildSeedSegments, PIPELINE_STAGES } from "@/dub/data";
import { autoFitSpeed, estimateDuration } from "@/dub/timing";
import type { DubPhase, DubSettings, Segment } from "@/dub/types";

const DEFAULT_SETTINGS: DubSettings = {
	targetLang: "zh",
	voiceId: "zh_male_liufei_uranus_bigtts",
	originalAudio: "mute",
	backgroundVolume: 0.12,
	subtitles: true,
	maxSpeedup: 2.3,
	maintainPitch: true,
};

interface DubStore {
	phase: DubPhase;
	settings: DubSettings;
	segments: Segment[];
	selectedSegId: string | null;
	procStage: number;
	procPct: number;

	setSetting: <K extends keyof DubSettings>(args: {
		key: K;
		value: DubSettings[K];
	}) => void;
	startGenerate: () => void;
	cancelGenerate: () => void;
	backToSetup: () => void;
	selectSegment: (args: { id: string | null }) => void;
	editSegment: (args: { id: string; text: string }) => void;
	setSegmentSpeed: (args: { id: string; rate: number }) => void;
	resetSegmentSpeed: (args: { id: string }) => void;
}

let procTimer: ReturnType<typeof setInterval> | null = null;

export const useDubStore = create<DubStore>((set, get) => ({
	phase: "setup",
	settings: { ...DEFAULT_SETTINGS },
	segments: buildSeedSegments(),
	selectedSegId: null,
	procStage: 0,
	procPct: 0,

	setSetting: ({ key, value }) =>
		set((s) => ({ settings: { ...s.settings, [key]: value } })),

	startGenerate: () => {
		set({ phase: "processing", procStage: 0, procPct: 0 });
		if (procTimer) clearInterval(procTimer);
		procTimer = setInterval(() => {
			const next = get().procPct + 2.5;
			if (next >= 100) {
				if (procTimer) clearInterval(procTimer);
				procTimer = null;
				set({ procPct: 100 });
				setTimeout(
					() => set({ phase: "review", selectedSegId: null }),
					200,
				);
				return;
			}
			set({
				procPct: next,
				procStage: Math.min(
					PIPELINE_STAGES.length - 1,
					Math.floor(next / (100 / PIPELINE_STAGES.length)),
				),
			});
		}, 90);
	},

	cancelGenerate: () => {
		if (procTimer) clearInterval(procTimer);
		procTimer = null;
		set({ phase: "setup" });
	},

	backToSetup: () => set({ phase: "setup", selectedSegId: null }),

	selectSegment: ({ id }) => set({ selectedSegId: id }),

	editSegment: ({ id, text }) =>
		set((s) => ({
			segments: s.segments.map((seg) => {
				if (seg.id !== id || !text || text === seg.translated) return seg;
				const orig = estimateDuration({ text });
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
						fittedDuration: Number((orig / rate).toFixed(2)),
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
