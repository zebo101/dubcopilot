import type { SegmentTiming } from "@/dub/types";

/** Estimate spoken duration of a Chinese line (seconds). */
export function estimateDuration({ text }: { text: string }): number {
	const chars = (text || "").replace(/\s+/g, "").length;
	return Math.max(0.6, chars * 0.19 + 0.3);
}

/**
 * Auto-fit speed so the line fills (but never overflows beyond cap) its slot.
 * rate >= 1; clamped to maxSpeedup. Overflow (rate capped, still too long) is
 * surfaced as a warning — we never ripple/shift later segments.
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
	if (targetDuration <= 0) return 1;
	const needed = Math.max(originalDuration / targetDuration, 1);
	return Math.min(needed, maxSpeedup);
}

/** Dub is longer than its slot (will overlap the next line). Threshold matches v1. */
export function isOverflow({ timing }: { timing: SegmentTiming }): boolean {
	return timing.fittedDuration > timing.targetDuration + 0.05;
}

/** Time-compressed enough to be worth flagging. */
export function isSped({ timing }: { timing: SegmentTiming }): boolean {
	return timing.appliedSpeedup >= 1.2;
}
