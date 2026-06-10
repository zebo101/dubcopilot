import type { Segment } from "@/dub/types";
import { sanitizeSegments } from "@/dub/sanitize";
import { autoFitSpeed, estimateDuration, extendSlots } from "@/dub/timing";
import { languageByCode } from "@/dub/languages";
import type { SubtitleCue } from "@/dub/course/subtitles";

/**
 * Build editable dub segments straight from subtitle cues — the fast path that
 * skips ASR entirely when a course ships *_en.srt / .vtt sidecars. Shape matches
 * generateDubSegments() so the rest of the pipeline is identical.
 */
export function segmentsFromCues({ cues }: { cues: SubtitleCue[] }): Segment[] {
	// subtitles fragment lines too — same dedupe/merge shaping as ASR
	const sane = sanitizeSegments({ raw: cues });
	const segments: Segment[] = sane.map((c, i) => {
		const target = Math.max(0, c.end - c.start);
		return {
			id: `seg_${String(i).padStart(3, "0")}`,
			index: i,
			start: c.start,
			end: c.end,
			source: c.text.trim(),
			translated: "",
			status: "ready",
			speedMode: "auto",
			timing: {
				originalDuration: 0,
				targetDuration: target,
				fittedDuration: target,
				appliedSpeedup: 1,
			},
		};
	});
	// absorb inter-cue silence so lines breathe instead of leaving dead air
	return extendSlots({ segments });
}

/**
 * Apply a translation map (segment id → translated text) to segments,
 * recomputing the speed-fit timing exactly like the single-lesson store's
 * applyTranslations. Pure, so it works in the headless batch runner.
 */
export function applyTranslationMap({
	segments,
	map,
	maxSpeedup,
	targetLang = "zh",
}: {
	segments: Segment[];
	map: Map<string, string>;
	maxSpeedup: number;
	targetLang?: string;
}): Segment[] {
	const secondsPerChar = languageByCode(targetLang).secondsPerChar;
	return segments.map((seg) => {
		const zh = map.get(seg.id);
		if (!zh || zh === seg.translated) return seg;
		const orig = estimateDuration({ text: zh, secondsPerChar });
		const rate = autoFitSpeed({
			originalDuration: orig,
			targetDuration: seg.timing.targetDuration,
			maxSpeedup,
		});
		return {
			...seg,
			translated: zh,
			status: "ready",
			timing: {
				...seg.timing,
				originalDuration: Number(orig.toFixed(2)),
				fittedDuration: Number((rate > 0 ? orig / rate : orig).toFixed(2)),
				appliedSpeedup: Number(rate.toFixed(2)),
			},
		};
	});
}
