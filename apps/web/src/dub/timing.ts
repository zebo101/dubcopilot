import type { Segment, SegmentTiming } from "@/dub/types";

/** Estimate spoken duration of a Chinese line (seconds). */
export function estimateDuration({ text }: { text: string }): number {
	const chars = (text || "").replace(/\s+/g, "").length;
	return Math.max(0.6, chars * 0.19 + 0.3);
}

/**
 * Slowest natural-sounding playback for a short line. Chinese TTS is usually
 * 20-40% shorter than the English slot; playing it at 1.0× left dead air after
 * EVERY line (the "区间不连贯" complaint). Down to 0.9× still sounds natural
 * and fills part of the slack.
 */
export const MIN_NATURAL_RATE = 0.9;

/**
 * Auto-fit speed for a line vs its slot. Long lines speed UP (clamped to
 * maxSpeedup — overflow is flagged, we never ripple later segments). Short
 * lines now slow DOWN slightly (≥ MIN_NATURAL_RATE) to reduce trailing
 * silence instead of always returning 1.
 */
export function autoFitSpeed({
	originalDuration,
	targetDuration,
	maxSpeedup,
}: {
	originalDuration: number;
	targetDuration: number;
	maxSpeedup: number;
}): number {
	if (targetDuration <= 0 || originalDuration <= 0) return 1;
	const needed = originalDuration / targetDuration;
	if (needed >= 1) return Math.min(needed, maxSpeedup);
	return Math.max(needed, MIN_NATURAL_RATE);
}

/** Keep this much clear before the next line starts (matches overlapGuardMs). */
const SLOT_GUARD_SECONDS = 0.08;
/** Never absorb more than this much of the following silence into a slot. */
const MAX_SLOT_EXTEND_SECONDS = 1.5;

/**
 * Absorb the natural inter-cue silence into each line's slot: a line may keep
 * speaking into the gap before the NEXT line starts (minus a guard), capped.
 * Effects — fewer unnecessary speed-ups (long lines get room to breathe) and
 * subtitles that stay up until the next line (continuous reading). Placement
 * stays at each line's original start; nothing ripples.
 */
export function extendSlots({ segments }: { segments: Segment[] }): Segment[] {
	return segments.map((seg, i) => {
		const next = segments[i + 1];
		const baseSlot = Math.max(0, seg.end - seg.start);
		const gapEnd = next
			? next.start - SLOT_GUARD_SECONDS
			: seg.end + MAX_SLOT_EXTEND_SECONDS;
		const extended = Math.min(
			Math.max(gapEnd - seg.start, baseSlot),
			baseSlot + MAX_SLOT_EXTEND_SECONDS,
		);
		if (extended <= baseSlot + 0.01) return seg;
		return {
			...seg,
			timing: {
				...seg.timing,
				targetDuration: Number(extended.toFixed(2)),
				fittedDuration: Number(extended.toFixed(2)),
			},
		};
	});
}

/** Dub is longer than its slot (will overlap the next line). Threshold matches v1. */
export function isOverflow({ timing }: { timing: SegmentTiming }): boolean {
	return timing.fittedDuration > timing.targetDuration + 0.05;
}

/** Time-compressed enough to be worth flagging. */
export function isSped({ timing }: { timing: SegmentTiming }): boolean {
	return timing.appliedSpeedup >= 1.2;
}
